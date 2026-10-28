const OpenAI = require("openai");
const { z } = require("zod");
const winston = require("winston");
const { canonicalizeLanguageCode, languageLabel } = require("../utils/locale");

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "openai-service" },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

const MODEL = "gpt-4o-mini";
const MODEL_MAX_OUTPUT_TOKENS = 16384;
const MAX_LANGUAGES_PER_REQUEST = 6;
const OUTPUT_TOKEN_BUDGET = 3000;
const MAX_EXISTING_TRANSLATIONS = 2;

// Scripts that cost more output tokens per character than Latin text.
const CJK_LANGUAGES = new Set(["zh", "ja", "ko", "yue", "wuu", "cjy", "nan", "hak", "hsn", "gan"]);
const DENSE_SCRIPT_LANGUAGES = new Set([
  "hi", "bn", "mr", "ne", "gu", "pa", "or", "as", "ta", "te", "kn", "ml", "si",
  "th", "lo", "my", "km", "am", "ti", "ka", "hy", "dv", "bho", "mai", "mag",
  "hne", "ctg", "tts", "bo", "dz",
]);
const MEDIUM_SCRIPT_LANGUAGES = new Set([
  "ru", "uk", "be", "bg", "sr", "mk", "kk", "ky", "tg", "mn", "el", "ar", "fa",
  "ur", "ps", "he", "yi", "sd", "ug", "ckb", "arz", "apc", "apd", "arq", "ary",
  "aec", "ars", "acm", "pnb", "prs", "skr", "pbu", "pbt", "azb",
]);

let client = null;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/**
 * Replace the OpenAI client (tests, custom endpoints).
 * @param {Object|null} customClient - Object exposing chat.completions.create
 */
function setClient(customClient) {
  client = customClient;
}

// Zod schema for translation response validation
const TranslationResponseSchema = z.object({
  translations: z
    .record(z.string())
    .describe(
      "Object with language codes as keys and translated text as values"
    ),
});

/**
 * Placeholders a translation must keep: {{name}}, {name}, %{name}, %s, %1$s, %@, $t(key)
 * and ICU argument names. Returned sorted so two lists compare as multisets.
 * @param {string} text
 * @returns {string[]}
 */
function extractPlaceholders(text) {
  let rest = String(text == null ? "" : text);
  const found = [];
  const take = (re, normalize = (m) => m) => {
    rest = rest.replace(re, (match) => {
      found.push(normalize(match));
      return " ";
    });
  };

  take(/\{\{[^{}]+\}\}/g, (m) => m.replace(/\s+/g, ""));
  take(/\$t\([^)]*\)/g);
  take(/%\{\s*\w+\s*\}/g, (m) => m.replace(/\s+/g, ""));
  rest = rest.replace(/%%/g, " ");
  take(/%(?:\d+\$)?[-+0#]*\d*(?:\.\d+)?[sdifuxXoeEgGc@]/g);

  if (/\{\s*\w+\s*,\s*(?:plural|select|selectordinal)\s*,/.test(rest)) {
    // ICU branches hold translatable text, so only the argument names must survive.
    const args = rest.match(/\{\s*\w+\s*,/g) || [];
    args.forEach((m) => found.push(`{${m.replace(/[{\s,]/g, "")},}`));
    const icuNames = new Set(args.map((m) => m.replace(/[{\s,]/g, "")));
    (rest.match(/\{\s*\w+\s*\}/g) || []).forEach((m) => {
      const name = m.replace(/[{}\s]/g, "");
      if (icuNames.has(name)) found.push(`{${name}}`);
    });
  } else {
    take(/\{\s*[\w.]+\s*\}/g, (m) => m.replace(/\s+/g, ""));
  }

  return found.sort();
}

function isAuthError(error) {
  return Boolean(error && (error.status === 401 || error.status === 403));
}

/**
 * "reason (de, es); other reason (ja)" instead of one line per language.
 * @param {Object} failed - Language to reason
 * @returns {string}
 */
function summarizeFailures(failed) {
  const byReason = new Map();
  Object.entries(failed || {}).forEach(([language, reason]) => {
    if (!byReason.has(reason)) byReason.set(reason, []);
    byReason.get(reason).push(language);
  });
  return [...byReason.entries()]
    .map(([reason, languages]) => `${reason} (${languages.sort().join(", ")})`)
    .join("; ");
}

function samePlaceholders(source, translation) {
  const a = extractPlaceholders(source);
  const b = extractPlaceholders(translation);
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/**
 * Rough output-token cost of one translation, erring high.
 * @param {string} sourceValue
 * @param {string} language
 * @returns {number}
 */
function estimateOutputTokens(sourceValue, language) {
  const chars = String(sourceValue == null ? "" : sourceValue).length;
  const base = String(canonicalizeLanguageCode(language) || "").split("-")[0];
  let perChar = 0.4;
  if (CJK_LANGUAGES.has(base)) perChar = 1.0;
  else if (DENSE_SCRIPT_LANGUAGES.has(base)) perChar = 1.3;
  else if (MEDIUM_SCRIPT_LANGUAGES.has(base)) perChar = 0.7;
  return Math.ceil(chars * perChar) + 16;
}

/**
 * Split target languages so each request stays under the output budget.
 * @param {string} sourceValue
 * @param {string[]} targetLanguages
 * @returns {string[][]}
 */
function chunkTargetLanguages(sourceValue, targetLanguages) {
  const chunks = [];
  let current = [];
  let currentTokens = 0;

  targetLanguages.forEach((language) => {
    const cost = estimateOutputTokens(sourceValue, language);
    if (
      current.length > 0 &&
      (current.length >= MAX_LANGUAGES_PER_REQUEST ||
        currentTokens + cost > OUTPUT_TOKEN_BUDGET)
    ) {
      chunks.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(language);
    currentTokens += cost;
  });

  if (current.length > 0) chunks.push(current);
  return chunks;
}

function maxTokensFor(sourceValue, languages) {
  const estimate = languages.reduce(
    (sum, language) => sum + estimateOutputTokens(sourceValue, language),
    0
  );
  return Math.min(MODEL_MAX_OUTPUT_TOKENS, Math.max(1024, estimate * 2 + 200));
}

/**
 * Keep the prompt small: at most a couple of reference translations, English first.
 * @param {Object} existingTranslations
 * @param {string} sourceLanguage
 * @returns {Object}
 */
function selectReferenceTranslations(existingTranslations, sourceLanguage) {
  if (!existingTranslations) return {};
  const source = canonicalizeLanguageCode(sourceLanguage);
  const entries = Object.entries(existingTranslations).filter(
    ([language, value]) =>
      canonicalizeLanguageCode(language) !== source &&
      typeof value === "string" &&
      value !== ""
  );
  entries.sort(([a], [b]) => {
    const rank = (language) => (canonicalizeLanguageCode(language).split("-")[0] === "en" ? 0 : 1);
    return rank(a) - rank(b);
  });
  return Object.fromEntries(entries.slice(0, MAX_EXISTING_TRANSLATIONS));
}

/**
 * Get optimized prompt for translation
 * @param {Object} params - Translation parameters
 * @returns {string} Optimized prompt
 */
function getTranslationPrompt({
  key,
  sourceValue,
  sourceLanguage,
  targetLanguages,
  existingTranslations,
  context,
  requiredPlaceholders,
}) {
  const references = selectReferenceTranslations(
    existingTranslations,
    sourceLanguage
  );
  const existingTranslationsText =
    Object.keys(references).length > 0
      ? `\n\nExisting translations for reference:\n${Object.entries(references)
          .map(([lang, value]) => `- ${lang}: ${JSON.stringify(value)}`)
          .join("\n")}`
      : "";

  const contextText = context
    ? `\n\nContext about the application:\n${context}`
    : "";

  const placeholderText =
    requiredPlaceholders && requiredPlaceholders.length > 0
      ? `\n\nA previous answer changed the placeholders. Every translation must contain exactly these placeholders, unchanged and untranslated: ${requiredPlaceholders.join(
          " "
        )}`
      : "";

  return `You are a professional translator specializing in software localization. Translate the following text while maintaining the original meaning, tone, and context.

Key: ${JSON.stringify(key)}
Source text (${languageLabel(sourceLanguage)}), as a JSON string: ${JSON.stringify(
    sourceValue
  )}
Target languages: ${targetLanguages.map(languageLabel).join(", ")}${existingTranslationsText}${contextText}${placeholderText}

Instructions:
1. Keep every placeholder exactly as written and do not translate its content: {{name}}, {name}, %{name}, %s, %d, %1$s, %@, $t(key), and ICU arguments such as {count, plural, ...} (translate only the text inside ICU branches)
2. Preserve HTML tags, line breaks (\\n) and special characters
3. Keep the same tone and style as the source text
4. For UI elements, ensure translations are concise and user-friendly
5. Consider cultural context for each target language
6. If the text contains proper nouns, brand names, or technical terms, keep them in their original form unless there's a widely accepted translation

Return ONLY a valid JSON object with a "translations" property. Its keys are exactly these language codes: ${targetLanguages.join(
    ", "
  )}. Its values are the translated texts. Do not include any explanations or additional text.

Example format:
{
  "translations": {
    "fr": "Translated text in French",
    "es": "Translated text in Spanish"
  }
}`;
}

/**
 * One completion for one group of languages.
 * @returns {Promise<{translations: Object, truncated: boolean}>}
 */
async function requestTranslations(params, languages, maxTokens) {
  const prompt = getTranslationPrompt({ ...params, targetLanguages: languages });

  const response = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a professional translator. Always respond with valid JSON only, no additional text or explanations.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3, // Lower temperature for more consistent translations
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });

  const choice = response.choices && response.choices[0];
  if (choice && choice.finish_reason === "length") {
    return { translations: {}, truncated: true };
  }

  const content = choice?.message?.content;
  if (!content) {
    throw new Error("No response content from OpenAI");
  }

  let parsedResponse;
  try {
    parsedResponse = JSON.parse(content);
  } catch (error) {
    // A cut-off answer without finish_reason "length" is still a truncation.
    return { translations: {}, truncated: true };
  }

  const validatedResponse = TranslationResponseSchema.parse(parsedResponse);
  const wanted = new Map(
    languages.map((language) => [canonicalizeLanguageCode(language), language])
  );
  const translations = {};
  Object.entries(validatedResponse.translations).forEach(([language, value]) => {
    const requested = wanted.get(canonicalizeLanguageCode(language));
    if (requested && !(requested in translations)) {
      translations[requested] = value;
    }
  });
  return { translations, truncated: false };
}

/**
 * Translate a group of languages, halving it while the answer is truncated.
 * @returns {Promise<{translations: Object, failed: Object}>}
 */
async function translateLanguageGroup(params, languages, maxTokens) {
  const tokens = maxTokens || maxTokensFor(params.sourceValue, languages);
  const { translations, truncated } = await requestTranslations(
    params,
    languages,
    tokens
  );

  if (truncated) {
    if (languages.length > 1) {
      const middle = Math.ceil(languages.length / 2);
      const first = await translateLanguageGroup(params, languages.slice(0, middle));
      const second = await translateLanguageGroup(params, languages.slice(middle));
      return {
        translations: { ...first.translations, ...second.translations },
        failed: { ...first.failed, ...second.failed },
      };
    }
    if (tokens < MODEL_MAX_OUTPUT_TOKENS) {
      return translateLanguageGroup(params, languages, MODEL_MAX_OUTPUT_TOKENS);
    }
    return {
      translations: {},
      failed: { [languages[0]]: "Response truncated (max_tokens reached)" },
    };
  }

  const failed = {};
  languages.forEach((language) => {
    if (!(language in translations)) {
      failed[language] = "Missing from the response";
    }
  });
  return { translations, failed };
}

/**
 * Translate a single key to several languages. Languages are split into small
 * requests so long strings are not truncated, and answers that drop or alter
 * placeholders are retried once, then rejected.
 * @param {Object} params - Translation parameters
 * @returns {Promise<{translations: Object, failed: Object}>} failed maps language to reason
 */
async function translateKey({
  key,
  sourceValue,
  sourceLanguage,
  targetLanguages,
  existingTranslations,
  context,
}) {
  const params = { key, sourceValue, sourceLanguage, existingTranslations, context };
  const translations = {};
  const failed = {};

  const runGroups = async (languages, extra = {}) => {
    const retry = [];
    for (const group of chunkTargetLanguages(sourceValue, languages)) {
      let result;
      try {
        result = await translateLanguageGroup({ ...params, ...extra }, group);
      } catch (error) {
        if (isAuthError(error)) throw error;
        const reason =
          error instanceof z.ZodError
            ? `Invalid translation response format: ${error.errors
                .map((e) => e.message)
                .join(", ")}`
            : error.message;
        group.forEach((language) => {
          failed[language] = reason;
        });
        continue;
      }

      Object.entries(result.failed).forEach(([language, reason]) => {
        failed[language] = reason;
      });
      Object.entries(result.translations).forEach(([language, value]) => {
        if (samePlaceholders(sourceValue, value)) {
          translations[language] = value;
          delete failed[language];
        } else {
          retry.push(language);
          failed[language] = "Placeholders do not match the source";
        }
      });
    }
    return retry;
  };

  const placeholderRetry = await runGroups(targetLanguages);
  const missingRetry = Object.keys(failed).filter(
    (language) =>
      failed[language] === "Missing from the response" &&
      !placeholderRetry.includes(language)
  );

  if (placeholderRetry.length > 0) {
    await runGroups(placeholderRetry, {
      requiredPlaceholders: extractPlaceholders(sourceValue),
    });
  }
  if (missingRetry.length > 0) {
    await runGroups(missingRetry);
  }

  if (Object.keys(failed).length > 0) {
    logger.warn(`Some translations were rejected for "${key}": ${summarizeFailures(failed)}`);
  }

  return { translations, failed };
}

/**
 * Translate multiple keys in parallel for efficiency
 * @param {Array} translationTasks - Array of translation tasks
 * @param {Object} options - Options including progress callback
 * @returns {Promise<Array>} Array of translation results
 */
async function translateKeysInParallel(translationTasks, options = {}) {
  const batchSize = options.batchSize || 5; // Process translations at a time to avoid rate limits
  const batchDelay =
    options.batchDelay === undefined ? 1000 : options.batchDelay; // Delay between batches in milliseconds
  const results = [];

  for (let i = 0; i < translationTasks.length; i += batchSize) {
    const batch = translationTasks.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (task) => {
        try {
          const response = await translateKey(task);
          const failedLanguages = Object.keys(response.failed);
          return {
            key: task.key,
            group: task.group,
            success: failedLanguages.length === 0,
            translations: response.translations,
            failedLanguages: response.failed,
            error:
              failedLanguages.length > 0
                ? summarizeFailures(response.failed)
                : undefined,
          };
        } catch (error) {
          if (isAuthError(error)) throw error;
          logger.error("Individual translation failed", {
            key: task.key,
            error: error.message,
          });
          return {
            key: task.key,
            group: task.group,
            success: false,
            error: error.message,
            translations: {},
            failedLanguages: Object.fromEntries(
              (task.targetLanguages || []).map((language) => [language, error.message])
            ),
          };
        }
      })
    );

    // Call progress callback after batch completion
    batchResults.forEach((result, index) => {
      if (options.onProgress) {
        options.onProgress(
          results.length + index + 1,
          translationTasks.length,
          result.key,
          result.translations
        );
      }
    });

    results.push(...batchResults);

    // Add a configurable delay between batches to respect rate limits
    if (i + batchSize < translationTasks.length && batchDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, batchDelay));
    }
  }

  return results;
}

/**
 * Get cost estimate for translations
 * @param {Array} translationTasks - Array of translation tasks
 * @returns {Object} Cost estimate
 */
function getCostEstimate(translationTasks) {
  // Rough estimates based on OpenAI pricing for gpt-4o-mini
  const promptOverheadTokens = 450; // Instructions and JSON framing
  const costPerInputToken = 0.15 / 1000000; // $0.15 per 1M tokens for gpt-4o-mini
  const costPerOutputToken = 0.6 / 1000000; // $0.60 per 1M tokens for gpt-4o-mini

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalRequests = 0;

  translationTasks.forEach((task) => {
    const languages = task.targetLanguages || [];
    const sourceTokens = Math.ceil(String(task.sourceValue || "").length / 3);
    const requests = chunkTargetLanguages(task.sourceValue, languages).length;
    totalRequests += requests;
    totalInputTokens += requests * (promptOverheadTokens + sourceTokens * 3);
    totalOutputTokens += languages.reduce(
      (sum, language) => sum + estimateOutputTokens(task.sourceValue, language),
      0
    );
  });

  const estimatedCost =
    totalInputTokens * costPerInputToken +
    totalOutputTokens * costPerOutputToken;

  return {
    totalTasks: translationTasks.length,
    estimatedRequests: totalRequests,
    estimatedInputTokens: totalInputTokens,
    estimatedOutputTokens: totalOutputTokens,
    estimatedCostUSD: estimatedCost,
    estimatedCostFormatted: `$${estimatedCost.toFixed(4)}`,
  };
}

/**
 * Validate OpenAI API key and connection
 * @returns {Promise<boolean>} Whether the API key is valid
 */
async function validateAPIKey() {
  try {
    await getClient().models.list();
    return true;
  } catch (error) {
    logger.error("OpenAI API key validation failed", { error: error.message });
    return false;
  }
}

module.exports = {
  translateKey,
  translateKeysInParallel,
  getCostEstimate,
  validateAPIKey,
  getTranslationPrompt,
  extractPlaceholders,
  samePlaceholders,
  summarizeFailures,
  chunkTargetLanguages,
  estimateOutputTokens,
  setClient,
};

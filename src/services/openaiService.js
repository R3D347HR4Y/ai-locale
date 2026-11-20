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

const DEFAULT_MODEL = "gpt-6-luna";
const DEFAULT_CONCURRENCY = 32;
const MODEL_MAX_OUTPUT_TOKENS = 16384;

// OpenAI-compatible providers picked from the model name when no base URL is given.
const PROVIDERS = [
  { prefix: "deepseek-", baseURL: "https://api.deepseek.com", keyEnv: "DEEPSEEK_API_KEY" },
  {
    prefix: "gemini-",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    keyEnv: "GEMINI_API_KEY",
  },
];

// Reasoning these models spend before answering; translation does not need it.
const DEFAULT_REASONING = [
  [/^gpt-6(\.\d+)?-(luna|terra)/, "none"],
  [/^gemini-/, "minimal"],
];

// $ per 1M tokens [input, output], standard tier, November 2026.
const PRICING = {
  "gpt-6-luna": [0.1, 0.5],
  "gpt-6.1-terra": [1.0, 5.0],
  "gpt-4o-mini": [0.15, 0.6],
  "deepseek-flash": [0.3, 1.2],
  "gemini-3.5-flash-lite": [0.3, 2.5],
};

// Request parameters dropped, or swapped, when a model rejects them.
const RELAXABLE_PARAMS = new Set([
  "temperature",
  "max_tokens",
  "max_completion_tokens",
  "reasoning_effort",
]);
const MAX_LANGUAGES_PER_REQUEST = 6;
const OUTPUT_TOKEN_BUDGET = 3000;
const MAX_EXISTING_TRANSLATIONS = 2;
// Short keys sharing the same languages go into one request.
const MAX_KEYS_PER_REQUEST = 25;
// A key above this output cost for its language group is sent on its own.
const PACKABLE_KEY_BUDGET = OUTPUT_TOKEN_BUDGET / 4;

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
let settings = {};
let rejectedParams = new Set();

function providerFor(model) {
  return PROVIDERS.find((provider) => model.startsWith(provider.prefix)) || null;
}

/**
 * Model and endpoint actually used, from configure() then env vars.
 * @returns {{model: string, baseURL?: string, apiKey?: string, reasoningEffort?: string}}
 */
function resolveSettings() {
  const model = settings.model || process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const explicitBase = settings.baseURL || process.env.OPENAI_BASE_URL;
  const provider = explicitBase ? null : providerFor(model);
  const baseURL = explicitBase || (provider && provider.baseURL) || undefined;
  const apiKey =
    settings.apiKey ||
    (provider && process.env[provider.keyEnv]) ||
    process.env.OPENAI_API_KEY;

  let reasoningEffort = settings.reasoningEffort || process.env.OPENAI_REASONING_EFFORT;
  if (!reasoningEffort && !explicitBase) {
    const match = DEFAULT_REASONING.find(([pattern]) => pattern.test(model));
    reasoningEffort = match ? match[1] : undefined;
  }
  if (reasoningEffort === "default") reasoningEffort = undefined;

  return { model, baseURL, apiKey, reasoningEffort, provider };
}

/**
 * Choose model, endpoint and key. Unset values fall back to OPENAI_MODEL,
 * OPENAI_BASE_URL, OPENAI_REASONING_EFFORT and the provider key env var.
 * @param {{model?: string, baseURL?: string, apiKey?: string, reasoningEffort?: string}} options
 */
function configure(options = {}) {
  settings = { ...options };
  client = null;
  rejectedParams = new Set();
}

function getClient() {
  if (!client) {
    const { baseURL, apiKey } = resolveSettings();
    // The SDK retries 429 and 5xx with backoff and honours Retry-After.
    client = new OpenAI({ apiKey, baseURL, maxRetries: 6 });
  }
  return client;
}

/**
 * Replace the OpenAI client (tests, custom endpoints).
 * @param {Object|null} customClient - Object exposing chat.completions.create
 */
function setClient(customClient) {
  client = customClient;
  rejectedParams = new Set();
}

/**
 * Caps how many requests are in flight, and optionally spaces their starts.
 * @param {number} concurrency
 * @param {number} [spacingMs]
 */
function createLimiter(concurrency, spacingMs = 0) {
  let active = 0;
  let nextStart = 0;
  let stopError = null;
  const waiting = [];

  // A finished request hands its slot straight to the next waiter.
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };

  return {
    stop(error) {
      stopError = error;
    },
    async run(fn) {
      if (active >= concurrency) {
        await new Promise((resolve) => waiting.push(resolve));
      } else {
        active++;
      }
      try {
        if (stopError) throw stopError;
        if (spacingMs > 0) {
          const now = Date.now();
          const start = Math.max(now, nextStart);
          nextStart = start + spacingMs;
          if (start > now) await new Promise((r) => setTimeout(r, start - now));
        }
        return await fn();
      } finally {
        release();
      }
    },
  };
}

let limiter = createLimiter(DEFAULT_CONCURRENCY);

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
/**
 * Name of the parameter a 400 error rejects, if we know how to do without it.
 * @param {Error} error
 * @returns {string|null}
 */
function rejectedParam(error) {
  if (!error || error.status !== 400) return null;
  const message = String(error.message || "");
  if (!/unsupported|not supported|unrecognized|unknown|not allowed|invalid/i.test(message)) {
    return null;
  }
  const candidates = [error.param, ...(message.match(/[a-z_]+/g) || [])];
  return candidates.find((name) => RELAXABLE_PARAMS.has(name)) || null;
}

function buildRequestBody(messages, maxTokens) {
  const { model, reasoningEffort, baseURL } = resolveSettings();
  const body = { model, messages, response_format: { type: "json_object" } };
  if (!rejectedParams.has("temperature")) body.temperature = 0.3;
  if (reasoningEffort && !rejectedParams.has("reasoning_effort")) {
    body.reasoning_effort = reasoningEffort;
  }
  // OpenAI's own reasoning models only take max_completion_tokens; other
  // OpenAI-compatible endpoints are likelier to know max_tokens.
  const preferred = baseURL ? "max_tokens" : "max_completion_tokens";
  const fallback = baseURL ? "max_completion_tokens" : "max_tokens";
  const tokenParam = rejectedParams.has(preferred) ? fallback : preferred;
  if (!rejectedParams.has(tokenParam)) body[tokenParam] = maxTokens;
  return body;
}

async function createCompletion(messages, maxTokens) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getClient().chat.completions.create(
        buildRequestBody(messages, maxTokens)
      );
    } catch (error) {
      const param = rejectedParam(error);
      if (!param || rejectedParams.has(param) || attempt >= RELAXABLE_PARAMS.size) {
        throw error;
      }
      rejectedParams.add(param);
      logger.debug(`Model rejected "${param}", retrying without it`);
    }
  }
}

async function requestTranslations(params, languages, maxTokens) {
  const prompt = getTranslationPrompt({ ...params, targetLanguages: languages });

  const response = await limiter.run(() => createCompletion([
      {
        role: "system",
        content:
          "You are a professional translator. Always respond with valid JSON only, no additional text or explanations.",
      },
      {
        role: "user",
        content: prompt,
      },
    ], maxTokens));

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
      const [first, second] = await Promise.all([
        translateLanguageGroup(params, languages.slice(0, middle)),
        translateLanguageGroup(params, languages.slice(middle)),
      ]);
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
  strictPlaceholders = false,
}) {
  const params = { key, sourceValue, sourceLanguage, existingTranslations, context };
  const required = { requiredPlaceholders: extractPlaceholders(sourceValue) };
  const translations = {};
  const failed = {};

  const runGroups = async (languages, extra = {}) => {
    const retry = [];
    const groups = chunkTargetLanguages(sourceValue, languages);
    const outcomes = await Promise.all(
      groups.map((group) =>
        translateLanguageGroup({ ...params, ...extra }, group).then(
          (result) => ({ result }),
          (error) => ({ error })
        )
      )
    );
    for (const [index, group] of groups.entries()) {
      const { result, error } = outcomes[index];
      if (error) {
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

  // Strict: a previous answer already broke the placeholders, so this is the retry.
  const firstRun = await runGroups(targetLanguages, strictPlaceholders ? required : {});
  const placeholderRetry = strictPlaceholders ? [] : firstRun;
  const missingRetry = Object.keys(failed).filter(
    (language) =>
      failed[language] === "Missing from the response" &&
      !placeholderRetry.includes(language)
  );

  await Promise.all([
    placeholderRetry.length > 0 &&
      runGroups(placeholderRetry, required),
    missingRetry.length > 0 && runGroups(missingRetry),
  ]);

  if (Object.keys(failed).length > 0) {
    logger.warn(`Some translations were rejected for "${key}": ${summarizeFailures(failed)}`);
  }

  return { translations, failed };
}

function costFor(sourceValue, languages) {
  return languages.reduce(
    (sum, language) => sum + estimateOutputTokens(sourceValue, language),
    0
  );
}

/**
 * Split work into requests. Short keys with the same missing languages are
 * packed together (up to MAX_KEYS_PER_REQUEST and the output budget); long
 * keys, and packs of one, go through translateKey on their own.
 * @param {Array} tasks
 * @returns {{packs: Array<{languages: string[], units: Array}>, solos: Array<{index: number, languages: string[]}>}}
 */
function planRequests(tasks) {
  const buckets = new Map();
  const solos = [];

  tasks.forEach((task, index) => {
    const languages = [...(task.targetLanguages || [])].sort();
    for (let i = 0; i < languages.length; i += MAX_LANGUAGES_PER_REQUEST) {
      const group = languages.slice(i, i + MAX_LANGUAGES_PER_REQUEST);
      const cost = costFor(task.sourceValue, group);
      if (cost > PACKABLE_KEY_BUDGET) {
        solos.push({ index, languages: group });
        continue;
      }
      const signature = group.join(",");
      if (!buckets.has(signature)) buckets.set(signature, []);
      buckets.get(signature).push({ index, cost });
    }
  });

  const packs = [];
  buckets.forEach((units, signature) => {
    const languages = signature.split(",");
    let current = [];
    let tokens = 0;
    const flush = () => {
      if (current.length === 1) solos.push({ index: current[0].index, languages });
      else if (current.length > 1) packs.push({ languages, units: current });
      current = [];
      tokens = 0;
    };
    units.forEach((unit) => {
      if (
        current.length >= MAX_KEYS_PER_REQUEST ||
        (current.length > 0 && tokens + unit.cost > OUTPUT_TOKEN_BUDGET)
      ) {
        flush();
      }
      current.push(unit);
      tokens += unit.cost;
    });
    flush();
  });

  return { packs, solos };
}

/**
 * Prompt asking for several keys in several languages at once.
 * @param {Array} tasks - The packed tasks, in item order (ids start at 1)
 * @param {string[]} languages
 * @returns {string}
 */
function getPackedTranslationPrompt(tasks, languages) {
  const { sourceLanguage, context } = tasks[0];
  const items = {};
  tasks.forEach((task, i) => {
    const item = { key: task.key, text: task.sourceValue };
    const refs = selectReferenceTranslations(task.existingTranslations, sourceLanguage);
    if (Object.keys(refs).length > 0) item.refs = refs;
    items[String(i + 1)] = item;
  });
  const ids = Object.keys(items);
  const contextText = context ? `\n\nContext about the application:\n${context}` : "";

  return `You are a professional translator specializing in software localization. Translate every item below from ${languageLabel(
    sourceLanguage
  )} into each target language while maintaining the original meaning, tone, and context.

Target languages: ${languages.map(languageLabel).join(", ")}${contextText}

Items to translate (JSON). "key" names the string in the app, "text" is the source, "refs" are existing translations for reference:
${JSON.stringify(items)}

Instructions:
1. Keep every placeholder exactly as written and do not translate its content: {{name}}, {name}, %{name}, %s, %d, %1$s, %@, $t(key), and ICU arguments such as {count, plural, ...} (translate only the text inside ICU branches)
2. Preserve HTML tags, line breaks (\\n) and special characters
3. Keep the same tone and style as the source text
4. For UI elements, ensure translations are concise and user-friendly
5. Consider cultural context for each target language
6. If the text contains proper nouns, brand names, or technical terms, keep them in their original form unless there's a widely accepted translation
7. Translate each item on its own; never merge, skip or reorder items

Return ONLY a valid JSON object with a "translations" property. Its keys are exactly the item ids: ${ids.join(
    ", "
  )}. Each value is an object whose keys are exactly these language codes: ${languages.join(
    ", "
  )}, and whose values are the translated texts. Do not include any explanations or additional text.

Example format:
{
  "translations": {
    "1": { "fr": "Texte traduit", "es": "Texto traducido" },
    "2": { "fr": "...", "es": "..." }
  }
}`;
}

const PackedResponseSchema = z.object({
  translations: z.record(z.record(z.unknown())),
});

/**
 * One request for a pack. Halves the pack while the answer is truncated.
 * @returns {Promise<Array<{translations: Object, retry: string[], strict: string[]}>>}
 *   one entry per task: accepted values, languages to redo, languages whose
 *   placeholders were broken
 */
async function translatePack(tasks, languages) {
  const prompt = getPackedTranslationPrompt(tasks, languages);
  const estimate = tasks.reduce((sum, task) => sum + costFor(task.sourceValue, languages), 0);
  const maxTokens = Math.min(MODEL_MAX_OUTPUT_TOKENS, Math.max(1024, estimate * 2 + 200));

  const response = await limiter.run(() =>
    createCompletion(
      [
        {
          role: "system",
          content:
            "You are a professional translator. Always respond with valid JSON only, no additional text or explanations.",
        },
        { role: "user", content: prompt },
      ],
      maxTokens
    )
  );

  const choice = response.choices && response.choices[0];
  let parsed = null;
  if (choice && choice.finish_reason !== "length" && choice.message && choice.message.content) {
    try {
      parsed = PackedResponseSchema.parse(JSON.parse(choice.message.content));
    } catch (error) {
      parsed = null;
    }
  }

  if (!parsed) {
    if (tasks.length > 1) {
      const middle = Math.ceil(tasks.length / 2);
      const [first, second] = await Promise.all([
        translatePack(tasks.slice(0, middle), languages),
        translatePack(tasks.slice(middle), languages),
      ]);
      return [...first, ...second];
    }
    return [{ translations: {}, retry: [...languages], strict: [] }];
  }

  const wanted = new Map(languages.map((l) => [canonicalizeLanguageCode(l), l]));
  return tasks.map((task, i) => {
    const answer = parsed.translations[String(i + 1)] || {};
    const values = {};
    Object.entries(answer).forEach(([language, value]) => {
      const requested = wanted.get(canonicalizeLanguageCode(language));
      if (requested && typeof value === "string" && !(requested in values)) {
        values[requested] = value;
      }
    });
    const result = { translations: {}, retry: [], strict: [] };
    languages.forEach((language) => {
      if (!(language in values)) result.retry.push(language);
      else if (!samePlaceholders(task.sourceValue, values[language])) result.strict.push(language);
      else result.translations[language] = values[language];
    });
    return result;
  });
}

/**
 * Translate many keys at once. Short keys are packed into shared requests,
 * every request goes through one limiter that keeps `concurrency` of them in
 * flight, so one slow request never holds the others back.
 * @param {Array} translationTasks - Array of translation tasks
 * @param {Object} options - concurrency (alias batchSize), batchDelay (ms between
 *   request starts), onProgress(completed, total, key, translations)
 * @returns {Promise<Array>} Results in the same order as translationTasks
 */
async function translateKeysInParallel(translationTasks, options = {}) {
  const concurrency = options.concurrency || options.batchSize || DEFAULT_CONCURRENCY;
  const spacing = options.batchDelay || 0;
  const previousLimiter = limiter;
  limiter = createLimiter(concurrency, spacing);

  const { packs, solos } = planRequests(translationTasks);
  const states = translationTasks.map(() => ({
    translations: {},
    failed: {},
    pending: 0,
    done: null,
  }));
  packs.forEach((pack) => pack.units.forEach(({ index }) => states[index].pending++));
  solos.forEach(({ index }) => states[index].pending++);

  let completed = 0;
  const results = new Array(translationTasks.length);

  const finish = (index) => {
    const task = translationTasks[index];
    const { translations, failed } = states[index];
    const failedLanguages = Object.keys(failed);
    results[index] = {
      key: task.key,
      group: task.group,
      success: failedLanguages.length === 0,
      translations,
      failedLanguages: failed,
      error: failedLanguages.length > 0 ? summarizeFailures(failed) : undefined,
    };
    completed++;
    if (options.onProgress) {
      options.onProgress(completed, translationTasks.length, task.key, translations);
    }
  };

  const merge = (index, response) => {
    const state = states[index];
    Object.assign(state.translations, response.translations);
    Object.entries(response.failed || {}).forEach(([language, reason]) => {
      if (!(language in state.translations)) state.failed[language] = reason;
    });
  };

  const settle = (index) => {
    states[index].pending--;
    if (states[index].pending === 0) finish(index);
  };

  const fail = (index, languages, error) => {
    if (isAuthError(error)) {
      limiter.stop(error);
      throw error;
    }
    logger.error("Individual translation failed", {
      key: translationTasks[index].key,
      error: error.message,
    });
    merge(index, {
      translations: {},
      failed: Object.fromEntries(languages.map((l) => [l, error.message])),
    });
  };

  const runSolo = async (index, languages, extra = {}) => {
    try {
      merge(index, await translateKey({ ...translationTasks[index], targetLanguages: languages, ...extra }));
    } catch (error) {
      fail(index, languages, error);
    }
  };

  const runPack = async (pack) => {
    const indexes = pack.units.map((unit) => unit.index);
    let outcomes;
    try {
      outcomes = await translatePack(indexes.map((i) => translationTasks[i]), pack.languages);
    } catch (error) {
      indexes.forEach((index) => fail(index, pack.languages, error));
      indexes.forEach(settle);
      return;
    }
    await Promise.all(
      outcomes.map(async (outcome, i) => {
        const index = indexes[i];
        merge(index, { translations: outcome.translations });
        // Anything the pack got wrong is redone key by key, with the usual retries.
        await Promise.all([
          outcome.retry.length > 0 && runSolo(index, outcome.retry),
          outcome.strict.length > 0 && runSolo(index, outcome.strict, { strictPlaceholders: true }),
        ]);
        settle(index);
      })
    );
  };

  try {
    // Tasks with nothing to translate still count as done.
    states.forEach((state, index) => {
      if (state.pending === 0) finish(index);
    });
    // Queue key by key, not language group by language group: the limiter is
    // FIFO, so a key's groups then finish close together and progress moves
    // steadily instead of jumping at the very end.
    const jobs = [
      ...packs.map((pack) => ({ first: pack.units[0].index, run: () => runPack(pack) })),
      ...solos.map(({ index, languages }) => ({
        first: index,
        run: async () => {
          await runSolo(index, languages);
          settle(index);
        },
      })),
    ].sort((a, b) => a.first - b.first);
    await Promise.all(jobs.map((job) => job.run()));
    return results;
  } finally {
    limiter = previousLimiter;
  }
}

/**
 * Get cost estimate for translations
 * @param {Array} translationTasks - Array of translation tasks
 * @returns {Object} Cost estimate
 */
function getCostEstimate(translationTasks) {
  const { model } = resolveSettings();
  const price = PRICING[model];
  const promptOverheadTokens = 450; // Instructions and JSON framing

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalRequests = 0;

  const { packs, solos } = planRequests(translationTasks);
  const inputTokensFor = (task) => {
    const refs = selectReferenceTranslations(task.existingTranslations, task.sourceLanguage);
    const chars = [task.key, task.sourceValue, ...Object.values(refs)].join("").length;
    return Math.ceil(chars / 3) + 10;
  };
  packs.forEach((pack) => {
    totalRequests += 1;
    totalInputTokens += promptOverheadTokens;
    pack.units.forEach(({ index, cost }) => {
      totalInputTokens += inputTokensFor(translationTasks[index]);
      totalOutputTokens += cost;
    });
  });
  solos.forEach(({ index, languages }) => {
    const task = translationTasks[index];
    const requests = chunkTargetLanguages(task.sourceValue, languages).length;
    totalRequests += requests;
    totalInputTokens += requests * (promptOverheadTokens + inputTokensFor(task));
    totalOutputTokens += costFor(task.sourceValue, languages);
  });

  const estimatedCost = price
    ? (totalInputTokens * price[0] + totalOutputTokens * price[1]) / 1000000
    : null;

  return {
    model,
    totalTasks: translationTasks.length,
    estimatedRequests: totalRequests,
    estimatedInputTokens: totalInputTokens,
    estimatedOutputTokens: totalOutputTokens,
    estimatedCostUSD: estimatedCost,
    estimatedCostFormatted:
      estimatedCost === null ? `unknown (no price for ${model})` : `$${estimatedCost.toFixed(4)}`,
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
  planRequests,
  getPackedTranslationPrompt,
  setClient,
  configure,
  resolveSettings,
  createLimiter,
  DEFAULT_MODEL,
  DEFAULT_CONCURRENCY,
};

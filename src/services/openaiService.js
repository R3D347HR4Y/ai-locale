const OpenAI = require("openai");
const { z } = require("zod");
const winston = require("winston");

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

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Zod schema for translation response validation
const TranslationResponseSchema = z.object({
  translations: z
    .record(z.string())
    .describe(
      "Object with language codes as keys and translated text as values"
    ),
});

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
}) {
  const existingTranslationsText = existingTranslations
    ? `\n\nExisting translations for context:\n${Object.entries(
        existingTranslations
      )
        .map(([lang, value]) => `- ${lang}: "${value}"`)
        .join("\n")}`
    : "";

  const contextText = context
    ? `\n\nContext about the application:\n${context}`
    : "";

  return `You are a professional translator specializing in mobile app localization. Translate the following text while maintaining the original meaning, tone, and context.

Key: "${key}"
Source text (${sourceLanguage}): "${sourceValue}"
Target languages: ${targetLanguages.join(
    ", "
  )}${existingTranslationsText}${contextText}

Instructions:
1. Maintain the original formatting, including placeholders like {variable}, {count}, etc.
2. Preserve HTML tags and special characters
3. Keep the same tone and style as the source text
4. For UI elements, ensure translations are concise and user-friendly
5. Consider cultural context for each target language
6. If the text contains proper nouns, brand names, or technical terms, keep them in their original form unless there's a widely accepted translation

Return ONLY a valid JSON object with a "translations" property containing language codes as keys and translated text as values. Do not include any explanations or additional text.

Example format:
{
  "translations": {
    "fr": "Translated text in French",
    "es": "Translated text in Spanish",
    "de": "Translated text in German"
  }
}`;
}

/**
 * Translate a single key to multiple languages
 * @param {Object} params - Translation parameters
 * @returns {Promise<Object>} Translation results
 */
async function translateKey({
  key,
  sourceValue,
  sourceLanguage,
  targetLanguages,
  existingTranslations,
  context,
}) {
  try {
    const prompt = getTranslationPrompt({
      key,
      sourceValue,
      sourceLanguage,
      targetLanguages,
      existingTranslations,
      context,
    });

    // Reduced logging for cleaner output
    // logger.info("Sending translation request to OpenAI", {
    //   key,
    //   sourceLanguage,
    //   targetLanguages: targetLanguages.length,
    //   promptLength: prompt.length,
    // });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using the most cost-effective model
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
      max_tokens: 2000, // Reasonable limit for translations
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from OpenAI");
    }

    // Parse and validate the response
    const parsedResponse = JSON.parse(content);
    const validatedResponse = TranslationResponseSchema.parse(parsedResponse);

    // Reduced logging for cleaner output
    // logger.info("Translation completed successfully", {
    //   key,
    //   translationsCount: Object.keys(validatedResponse.translations).length,
    // });

    return validatedResponse;
  } catch (error) {
    logger.error("Translation failed", {
      key,
      error: error.message,
      stack: error.stack,
    });

    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid translation response format: ${error.errors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    throw new Error(`Translation failed for key "${key}": ${error.message}`);
  }
}

/**
 * Translate multiple keys in parallel for efficiency
 * @param {Array} translationTasks - Array of translation tasks
 * @param {Object} options - Options including progress callback
 * @returns {Promise<Array>} Array of translation results
 */
async function translateKeysInParallel(translationTasks, options = {}) {
  const batchSize = 5; // Process 5 translations at a time to avoid rate limits
  const results = [];

  for (let i = 0; i < translationTasks.length; i += batchSize) {
    const batch = translationTasks.slice(i, i + batchSize);

    // Reduced logging for cleaner output
    // logger.info(
    //   `Processing translation batch ${
    //     Math.floor(i / batchSize) + 1
    //   }/${Math.ceil(translationTasks.length / batchSize)}`,
    //   {
    //     batchSize: batch.length,
    //     totalTasks: translationTasks.length,
    //   }
    // );

    try {
      const batchResults = await Promise.all(
        batch.map(async (task) => {
          try {
            const response = await translateKey(task);
            return {
              key: task.key,
              success: true,
              translations: response.translations,
            };
          } catch (error) {
            logger.error("Individual translation failed", {
              key: task.key,
              error: error.message,
            });
            return {
              key: task.key,
              success: false,
              error: error.message,
              translations: {},
            };
          }
        })
      );

      // Call progress callback after batch completion
      batchResults.forEach((result) => {
        if (options.onProgress) {
          options.onProgress(
            results.length + batchResults.indexOf(result) + 1,
            translationTasks.length,
            result.key,
            result.translations
          );
        }
      });

      results.push(...batchResults);

      // Add a small delay between batches to respect rate limits
      if (i + batchSize < translationTasks.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.error("Batch translation failed", {
        batchStart: i,
        batchSize: batch.length,
        error: error.message,
      });

      // Add failed results for this batch
      batch.forEach((task) => {
        results.push({
          key: task.key,
          success: false,
          error: error.message,
          translations: {},
        });
      });
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
  // Rough estimates based on OpenAI pricing (as of 2024)
  const inputTokensPerTask = 200; // Average prompt length
  const outputTokensPerTask = 50; // Average response length
  const costPerInputToken = 0.00015 / 1000; // $0.15 per 1K tokens for gpt-4o-mini
  const costPerOutputToken = 0.0006 / 1000; // $0.60 per 1K tokens for gpt-4o-mini

  const totalInputTokens = translationTasks.length * inputTokensPerTask;
  const totalOutputTokens = translationTasks.length * outputTokensPerTask;

  const estimatedCost =
    totalInputTokens * costPerInputToken +
    totalOutputTokens * costPerOutputToken;

  return {
    totalTasks: translationTasks.length,
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
    await openai.models.list();
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
};

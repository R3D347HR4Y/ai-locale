const openaiService = require("./openaiService");
const fileParser = require("../utils/fileParser");
const winston = require("winston");

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "translation-service" },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

/**
 * Find missing keys across all language files
 * @param {Array} files - Array of parsed files
 * @param {string} sourceLanguage - Source language code
 * @returns {Object} Missing keys per language
 */
function findMissingKeys(files, sourceLanguage) {
  const missingKeys = {};

  // Find the source file (usually the most complete one)
  const sourceFile = files.find((file) => file.language === sourceLanguage);
  if (!sourceFile) {
    throw new Error(`Source language file (${sourceLanguage}) not found`);
  }

  const sourceKeys = Object.keys(sourceFile.keys);

  // Check each target language file for missing keys
  files.forEach((file) => {
    if (file.language !== sourceLanguage) {
      const missing = sourceKeys.filter((key) => !(key in file.keys));
      if (missing.length > 0) {
        missingKeys[file.language] = missing;
      }
    }
  });

  logger.info("Missing keys analysis completed", {
    sourceLanguage,
    totalSourceKeys: sourceKeys.length,
    languagesWithMissingKeys: Object.keys(missingKeys).length,
    totalMissingKeys: Object.values(missingKeys).flat().length,
  });

  return missingKeys;
}

/**
 * Find keys that exist in source language but are missing in other languages
 * @param {Array} files - Array of parsed files
 * @param {string} sourceLanguage - Source language code
 * @returns {Object} Keys to translate per language with all existing translations as context
 */
function findKeysToTranslate(files, sourceLanguage) {
  const keysToTranslate = {};

  // Find the source file
  const sourceFile = files.find((file) => file.language === sourceLanguage);
  if (!sourceFile) {
    throw new Error(`Source language file (${sourceLanguage}) not found`);
  }

  const sourceKeys = Object.keys(sourceFile.keys);

  // For each source key, find which languages are missing it
  sourceKeys.forEach((key) => {
    const existingTranslations = {};
    const missingLanguages = [];

    // Collect all existing translations for this key
    files.forEach((file) => {
      if (file.keys[key]) {
        existingTranslations[file.language] = file.keys[key];
      } else if (file.language !== sourceLanguage) {
        missingLanguages.push(file.language);
      }
    });

    // If there are missing languages, add to translation tasks
    if (missingLanguages.length > 0) {
      missingLanguages.forEach((lang) => {
        if (!keysToTranslate[lang]) {
          keysToTranslate[lang] = [];
        }
        keysToTranslate[lang].push({
          key,
          existingTranslations,
          sourceValue: sourceFile.keys[key],
        });
      });
    }
  });

  // Reduced logging for cleaner output
  // logger.info("Keys to translate analysis completed", {
  //   sourceLanguage,
  //   totalSourceKeys: sourceKeys.length,
  //   languagesNeedingTranslation: Object.keys(keysToTranslate).length,
  //   totalKeysToTranslate: Object.values(keysToTranslate).flat().length,
  // });

  return keysToTranslate;
}

/**
 * Get existing translations for context
 * @param {Array} files - Array of parsed files
 * @param {string} key - Key to get translations for
 * @returns {Object} Existing translations
 */
function getExistingTranslations(files, key) {
  const existingTranslations = {};

  files.forEach((file) => {
    if (file.keys[key]) {
      existingTranslations[file.language] = file.keys[key];
    }
  });

  return existingTranslations;
}

/**
 * Process translations for all missing keys
 * @param {Object} params - Translation parameters
 * @returns {Promise<Object>} Translation results
 */
async function processTranslations({
  files,
  targetLanguages,
  sourceLanguage,
  batchSize = 5,
  batchDelay = 1000,
  onProgress,
}) {
  try {
    // Reduced logging for cleaner output
    // logger.info("Starting translation process", {
    //   fileCount: files.length,
    //   targetLanguages,
    //   sourceLanguage,
    // });

    // Find keys to translate with all existing translations as context
    const keysToTranslate = findKeysToTranslate(files, sourceLanguage);

    if (Object.keys(keysToTranslate).length === 0) {
      logger.info("No missing keys found, all files are complete");
      return {
        success: true,
        message: "All translation files are complete",
        data: {
          missingKeys: {},
          translations: {},
          files: files.map((file) => ({
            filename: file.filename,
            language: file.language,
            content: file.content,
            type: file.type,
          })),
        },
      };
    }

    // Prepare translation tasks grouped by key (one key to all missing languages)
    const translationTasks = [];

    // Group missing keys by key instead of by language
    const keysGroupedByKey = {};

    Object.entries(keysToTranslate).forEach(([language, keyData]) => {
      keyData.forEach(({ key, existingTranslations, sourceValue }) => {
        if (!keysGroupedByKey[key]) {
          keysGroupedByKey[key] = {
            key,
            sourceValue,
            sourceLanguage,
            targetLanguages: [],
            existingTranslations,
            context: "Mobile app localization for beauty services platform",
          };
        }
        keysGroupedByKey[key].targetLanguages.push(language);
      });
    });

    // Create one task per key (translating to all missing languages)
    Object.values(keysGroupedByKey).forEach((task) => {
      translationTasks.push(task);
    });

    // Reduced logging for cleaner output
    // logger.info("Translation tasks prepared", {
    //   totalTasks: translationTasks.length,
    //   costEstimate: openaiService.getCostEstimate(translationTasks),
    // });

    // Execute translations in parallel batches with progress tracking
    const translationResults = await openaiService.translateKeysInParallel(
      translationTasks,
      {
        batchSize,
        batchDelay,
        onProgress: onProgress,
      }
    );

    // Process results and update files
    const translations = {};
    const updatedFiles = [...files];

    translationResults.forEach((result) => {
      if (result.success) {
        Object.entries(result.translations).forEach(
          ([language, translation]) => {
            if (!translations[language]) {
              translations[language] = {};
            }
            translations[language][result.key] = translation;

            // Update the corresponding file
            const fileIndex = updatedFiles.findIndex(
              (file) => file.language === language
            );
            if (fileIndex !== -1) {
              updatedFiles[fileIndex].keys[result.key] = translation;
            }
          }
        );
      } else {
        logger.error("Translation failed for key", {
          key: result.key,
          error: result.error,
        });
      }
    });

    // Generate updated file contents
    const generatedFiles = updatedFiles.map((file) => {
      const content = fileParser.generateFileContent(
        file.keys,
        file.type,
        file.content
      );
      return {
        filename: file.filename,
        filePath: file.filePath,
        language: file.language,
        content,
        type: file.type,
        keysCount: Object.keys(file.keys).length,
      };
    });

    const successCount = translationResults.filter((r) => r.success).length;
    const failureCount = translationResults.filter((r) => !r.success).length;

    logger.info("Translation process completed", {
      successCount,
      failureCount,
      totalTasks: translationResults.length,
      generatedFiles: generatedFiles.length,
    });

    return {
      success: true,
      message: `Translation completed. ${successCount} keys translated successfully, ${failureCount} failed.`,
      data: {
        missingKeys: keysToTranslate,
        translations,
        files: generatedFiles,
        statistics: {
          totalTasks: translationResults.length,
          successfulTranslations: successCount,
          failedTranslations: failureCount,
          languagesProcessed: Object.keys(translations).length,
          filesGenerated: generatedFiles.length,
        },
      },
    };
  } catch (error) {
    logger.error("Translation process failed", {
      error: error.message,
      stack: error.stack,
    });

    throw new Error(`Translation process failed: ${error.message}`);
  }
}

/**
 * Validate translation files consistency
 * @param {Array} files - Array of parsed files
 * @returns {Object} Validation results
 */
function validateTranslationConsistency(files) {
  const validation = {
    isValid: true,
    issues: [],
    statistics: {
      totalFiles: files.length,
      totalKeys: 0,
      languages: [],
    },
  };

  if (files.length === 0) {
    validation.isValid = false;
    validation.issues.push("No files provided");
    return validation;
  }

  // Collect all keys from all files
  const allKeys = new Set();
  const languageKeys = {};

  files.forEach((file) => {
    validation.statistics.languages.push(file.language);
    languageKeys[file.language] = Object.keys(file.keys);
    Object.keys(file.keys).forEach((key) => allKeys.add(key));
  });

  validation.statistics.totalKeys = allKeys.size;

  // Check for missing keys in each language
  files.forEach((file) => {
    const missingKeys = Array.from(allKeys).filter(
      (key) => !(key in file.keys)
    );
    if (missingKeys.length > 0) {
      validation.issues.push(
        `Language ${file.language} is missing ${
          missingKeys.length
        } keys: ${missingKeys.slice(0, 5).join(", ")}${
          missingKeys.length > 5 ? "..." : ""
        }`
      );
    }
  });

  // Check for duplicate keys within the same file
  files.forEach((file) => {
    const keys = Object.keys(file.keys);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      validation.issues.push(`Language ${file.language} has duplicate keys`);
    }
  });

  validation.isValid = validation.issues.length === 0;

  return validation;
}

/**
 * Get translation statistics
 * @param {Array} files - Array of parsed files
 * @returns {Object} Statistics
 */
function getTranslationStatistics(files) {
  const stats = {
    totalFiles: files.length,
    languages: [],
    totalKeys: 0,
    completeness: {},
    fileTypes: {},
  };

  const allKeys = new Set();

  files.forEach((file) => {
    stats.languages.push(file.language);
    stats.fileTypes[file.type] = (stats.fileTypes[file.type] || 0) + 1;

    Object.keys(file.keys).forEach((key) => allKeys.add(key));
  });

  stats.totalKeys = allKeys.size;
  stats.languages = [...new Set(stats.languages)];

  // Calculate completeness for each language
  files.forEach((file) => {
    const languageKeys = Object.keys(file.keys);
    stats.completeness[file.language] = {
      totalKeys: languageKeys.length,
      percentage:
        stats.totalKeys > 0
          ? Math.round((languageKeys.length / stats.totalKeys) * 100)
          : 0,
    };
  });

  return stats;
}

/**
 * Purge keys that don't exist in the source language
 * @param {Array} files - Array of parsed files
 * @param {string} sourceLanguage - Source language code
 * @returns {Object} Purge results
 */
function purgeKeys(files, sourceLanguage) {
  const purgeResults = {
    purgedKeys: {},
    totalPurged: 0,
    filesUpdated: 0,
  };

  // Find the source file
  const sourceFile = files.find((file) => file.language === sourceLanguage);
  if (!sourceFile) {
    throw new Error(`Source language file (${sourceLanguage}) not found`);
  }

  const sourceKeys = Object.keys(sourceFile.keys);

  // Check each file for keys that don't exist in source
  files.forEach((file) => {
    if (file.language !== sourceLanguage) {
      const keysToPurge = Object.keys(file.keys).filter(
        (key) => !sourceKeys.includes(key)
      );

      if (keysToPurge.length > 0) {
        purgeResults.purgedKeys[file.language] = keysToPurge;
        purgeResults.totalPurged += keysToPurge.length;

        // Remove the keys from the file
        keysToPurge.forEach((key) => {
          delete file.keys[key];
        });

        purgeResults.filesUpdated++;
      }
    }
  });

  logger.info("Key purging completed", {
    sourceLanguage,
    totalSourceKeys: sourceKeys.length,
    languagesPurged: Object.keys(purgeResults.purgedKeys).length,
    totalPurgedKeys: purgeResults.totalPurged,
    filesUpdated: purgeResults.filesUpdated,
  });

  return purgeResults;
}

module.exports = {
  processTranslations,
  findMissingKeys,
  findKeysToTranslate,
  purgeKeys,
  validateTranslationConsistency,
  getTranslationStatistics,
  getExistingTranslations,
};

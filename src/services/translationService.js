const openaiService = require("./openaiService");
const fileParser = require("../utils/fileParser");
const { canonicalizeLanguageCode, localeGroupKey } = require("../utils/locale");
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
 * A key counts as missing when it is absent, null or an empty string.
 * @param {*} value
 * @returns {boolean}
 */
function isMissingValue(value) {
  return value === undefined || value === null || value === "";
}

/**
 * Group files that hold the same catalog in different languages,
 * e.g. locales/fr/email.json with locales/de/email.json.
 * Files without a path (in-memory callers) form one group.
 * @param {Array} files - Array of parsed files
 * @returns {Map<string, Array>} Group key to files
 */
function groupFilesByNamespace(files) {
  const groups = new Map();
  files.forEach((file) => {
    const key = localeGroupKey(file.filePath || file.filename || "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  });
  return groups;
}

function findSourceFile(groupFiles, sourceLanguage) {
  return groupFiles.find(
    (file) => canonicalizeLanguageCode(file.language) === sourceLanguage
  );
}

function sourceNotFound(sourceLanguage) {
  return new Error(`Source language file (${sourceLanguage}) not found`);
}

function normalizeTargets(targetLanguages) {
  if (!targetLanguages || targetLanguages.length === 0) return null;
  return new Set(targetLanguages.map((lang) => canonicalizeLanguageCode(lang)));
}

/**
 * Find missing keys across all language files
 * @param {Array} files - Array of parsed files
 * @param {string} sourceLanguage - Source language code
 * @returns {Object} Missing keys per language
 */
function findMissingKeys(files, sourceLanguage) {
  const missingKeys = {};
  sourceLanguage = canonicalizeLanguageCode(sourceLanguage);
  let foundSource = false;
  let totalSourceKeys = 0;

  groupFilesByNamespace(files).forEach((groupFiles) => {
    const sourceFile = findSourceFile(groupFiles, sourceLanguage);
    if (!sourceFile) return;
    foundSource = true;

    const sourceKeys = Object.keys(sourceFile.keys);
    totalSourceKeys += sourceKeys.length;

    groupFiles.forEach((file) => {
      const language = canonicalizeLanguageCode(file.language);
      if (language === sourceLanguage) return;
      const missing = sourceKeys.filter((key) => isMissingValue(file.keys[key]));
      if (missing.length > 0) {
        missingKeys[language] = (missingKeys[language] || []).concat(missing);
      }
    });
  });

  if (!foundSource) throw sourceNotFound(sourceLanguage);

  logger.info("Missing keys analysis completed", {
    sourceLanguage,
    totalSourceKeys,
    languagesWithMissingKeys: Object.keys(missingKeys).length,
    totalMissingKeys: Object.values(missingKeys).flat().length,
  });

  return missingKeys;
}

/**
 * Find keys that exist in source language but are missing in other languages
 * @param {Array} files - Array of parsed files
 * @param {string} sourceLanguage - Source language code
 * @param {string[]} [targetLanguages] - Only these languages when given
 * @returns {Object} Keys to translate per language; each entry carries its group
 */
function findKeysToTranslate(files, sourceLanguage, targetLanguages) {
  const keysToTranslate = {};
  sourceLanguage = canonicalizeLanguageCode(sourceLanguage);
  const targets = normalizeTargets(targetLanguages);
  let foundSource = false;

  groupFilesByNamespace(files).forEach((groupFiles, group) => {
    const sourceFile = findSourceFile(groupFiles, sourceLanguage);
    if (!sourceFile) return;
    foundSource = true;

    Object.entries(sourceFile.keys).forEach(([key, sourceValue]) => {
      if (typeof sourceValue !== "string" || sourceValue === "") return;

      const existingTranslations = {};
      const missingLanguages = [];

      groupFiles.forEach((file) => {
        const language = canonicalizeLanguageCode(file.language);
        if (!isMissingValue(file.keys[key])) {
          existingTranslations[language] = file.keys[key];
        } else if (
          language !== sourceLanguage &&
          (!targets || targets.has(language)) &&
          !missingLanguages.includes(language)
        ) {
          missingLanguages.push(language);
        }
      });

      missingLanguages.forEach((lang) => {
        if (!keysToTranslate[lang]) {
          keysToTranslate[lang] = [];
        }
        keysToTranslate[lang].push({
          key,
          group,
          existingTranslations,
          sourceValue,
        });
      });
    });
  });

  if (!foundSource) throw sourceNotFound(sourceLanguage);

  return keysToTranslate;
}

/**
 * Translation tasks, one per key and catalog, listing every missing language.
 * @param {Object} keysToTranslate - Output of findKeysToTranslate
 * @param {string} sourceLanguage
 * @param {string} [context]
 * @returns {Array}
 */
function buildTranslationTasks(keysToTranslate, sourceLanguage, context = "") {
  const tasks = new Map();
  Object.entries(keysToTranslate).forEach(([language, keyData]) => {
    keyData.forEach(({ key, group, existingTranslations, sourceValue }) => {
      const id = `${group}\u0000${key}`;
      if (!tasks.has(id)) {
        tasks.set(id, {
          key,
          group,
          sourceValue,
          sourceLanguage,
          targetLanguages: [],
          existingTranslations,
          context,
        });
      }
      tasks.get(id).targetLanguages.push(language);
    });
  });
  return [...tasks.values()];
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
    if (!isMissingValue(file.keys[key])) {
      existingTranslations[file.language] = file.keys[key];
    }
  });

  return existingTranslations;
}

/**
 * Process translations for all missing keys
 * @param {Object} params - Translation parameters
 * @returns {Promise<Object>} Translation results; data.files only lists files that changed
 */
async function processTranslations({
  files,
  targetLanguages,
  sourceLanguage,
  context = "",
  batchSize = 5,
  batchDelay = 1000,
  onProgress,
}) {
  try {
    sourceLanguage = canonicalizeLanguageCode(sourceLanguage);
    const keysToTranslate = findKeysToTranslate(
      files,
      sourceLanguage,
      targetLanguages
    );

    if (Object.keys(keysToTranslate).length === 0) {
      logger.info("No missing keys found, all files are complete");
      return {
        success: true,
        message: "All translation files are complete",
        data: {
          missingKeys: {},
          translations: {},
          files: [],
          statistics: {
            totalTasks: 0,
            successfulTranslations: 0,
            failedTranslations: 0,
            keysTranslated: 0,
            keysFailed: 0,
            perLanguage: {},
            languagesProcessed: 0,
            filesGenerated: 0,
          },
        },
      };
    }

    const translationTasks = buildTranslationTasks(
      keysToTranslate,
      sourceLanguage,
      context
    );

    const translationResults = await openaiService.translateKeysInParallel(
      translationTasks,
      {
        batchSize,
        batchDelay,
        onProgress: onProgress,
      }
    );

    const groups = groupFilesByNamespace(files);
    const changedFiles = new Set();
    const translations = {};
    const perLanguage = {};
    let successfulTranslations = 0;
    let failedTranslations = 0;

    translationResults.forEach((result) => {
      const groupFiles = groups.get(result.group) || files;

      Object.entries(result.translations || {}).forEach(([language, translation]) => {
        const file = groupFiles.find(
          (candidate) =>
            canonicalizeLanguageCode(candidate.language) ===
            canonicalizeLanguageCode(language)
        );
        if (!file) return;

        if (!translations[language]) {
          translations[language] = {};
        }
        translations[language][result.key] = translation;
        file.keys[result.key] = translation;
        changedFiles.add(file);
        successfulTranslations++;
        perLanguage[language] = (perLanguage[language] || 0) + 1;
      });

      const failed = Object.entries(result.failedLanguages || {});
      failedTranslations += failed.length;
      if (failed.length > 0 || !result.success) {
        logger.error("Translation failed for key", {
          key: result.key,
          error: result.error,
        });
      }
    });

    // Only files that received a translation are regenerated.
    const generatedFiles = files
      .filter((file) => changedFiles.has(file))
      .map((file) => ({
        filename: file.filename,
        filePath: file.filePath,
        language: file.language,
        content: fileParser.generateFileContent(file.keys, file.type, file.content),
        type: file.type,
        keysCount: Object.keys(file.keys).length,
      }));

    const keysTranslated = translationResults.filter((r) => r.success).length;
    const keysFailed = translationResults.length - keysTranslated;

    logger.info("Translation process completed", {
      successfulTranslations,
      failedTranslations,
      totalTasks: translationResults.length,
      generatedFiles: generatedFiles.length,
    });

    return {
      success: failedTranslations === 0,
      message: `Translation completed. ${successfulTranslations} translations written, ${failedTranslations} failed.`,
      data: {
        missingKeys: keysToTranslate,
        translations,
        files: generatedFiles,
        statistics: {
          totalTasks: translationResults.length,
          successfulTranslations,
          failedTranslations,
          keysTranslated,
          keysFailed,
          perLanguage,
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
 * Reference keys per catalog: the source file when one is given and found,
 * otherwise every key seen in that catalog.
 */
function referenceKeysByGroup(files, sourceLanguage) {
  const source = sourceLanguage ? canonicalizeLanguageCode(sourceLanguage) : null;
  const result = [];
  let foundSource = false;

  groupFilesByNamespace(files).forEach((groupFiles, group) => {
    const sourceFile = source ? findSourceFile(groupFiles, source) : null;
    let referenceKeys;
    if (sourceFile) {
      foundSource = true;
      referenceKeys = Object.keys(sourceFile.keys).filter(
        (key) => !isMissingValue(sourceFile.keys[key])
      );
    } else {
      const all = new Set();
      groupFiles.forEach((file) => Object.keys(file.keys).forEach((key) => all.add(key)));
      referenceKeys = [...all];
    }
    result.push({ group, groupFiles, referenceKeys });
  });

  if (source && !foundSource && files.length > 0) throw sourceNotFound(source);
  return result;
}

/**
 * Validate translation files consistency
 * @param {Array} files - Array of parsed files
 * @param {string} [sourceLanguage] - Reference language; otherwise all keys of each catalog
 * @returns {Object} Validation results
 */
function validateTranslationConsistency(files, sourceLanguage) {
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

  const groups = referenceKeysByGroup(files, sourceLanguage);
  const multipleGroups = groups.length > 1;

  groups.forEach(({ group, groupFiles, referenceKeys }) => {
    validation.statistics.totalKeys += referenceKeys.length;

    groupFiles.forEach((file) => {
      if (!validation.statistics.languages.includes(file.language)) {
        validation.statistics.languages.push(file.language);
      }
      const missingKeys = referenceKeys.filter((key) =>
        isMissingValue(file.keys[key])
      );
      if (missingKeys.length > 0) {
        const where = multipleGroups ? ` (${group})` : "";
        validation.issues.push(
          `Language ${file.language}${where} is missing ${
            missingKeys.length
          } keys: ${missingKeys.slice(0, 5).join(", ")}${
            missingKeys.length > 5 ? "..." : ""
          }`
        );
      }
    });
  });

  validation.isValid = validation.issues.length === 0;

  return validation;
}

/**
 * Get translation statistics. Nested keys are counted as flattened leaves
 * (a.b.c) and empty strings count as missing.
 * @param {Array} files - Array of parsed files
 * @param {string} [sourceLanguage] - Reference language; otherwise all keys of each catalog
 * @returns {Object} Statistics
 */
function getTranslationStatistics(files, sourceLanguage) {
  const stats = {
    totalFiles: files.length,
    languages: [],
    totalKeys: 0,
    completeness: {},
    fileTypes: {},
  };

  files.forEach((file) => {
    if (!stats.languages.includes(file.language)) {
      stats.languages.push(file.language);
    }
    stats.fileTypes[file.type] = (stats.fileTypes[file.type] || 0) + 1;
  });

  const totals = {};
  referenceKeysByGroup(files, sourceLanguage).forEach(
    ({ groupFiles, referenceKeys }) => {
      stats.totalKeys += referenceKeys.length;
      const seen = new Set();
      groupFiles.forEach((file) => {
        if (seen.has(file.language)) return;
        seen.add(file.language);
        const entry = totals[file.language] || { present: 0, expected: 0 };
        entry.present += referenceKeys.filter(
          (key) => !isMissingValue(file.keys[key])
        ).length;
        entry.expected += referenceKeys.length;
        totals[file.language] = entry;
      });
    }
  );

  stats.languages.forEach((language) => {
    const { present, expected } = totals[language] || { present: 0, expected: 0 };
    stats.completeness[language] = {
      totalKeys: present,
      expectedKeys: expected,
      percentage: expected > 0 ? Math.floor((present / expected) * 100) : 0,
    };
  });

  return stats;
}

/**
 * Purge keys that don't exist in the source language
 * @param {Array} files - Array of parsed files
 * @param {string} sourceLanguage - Source language code
 * @returns {Object} Purge results; updatedFiles lists the files that changed
 */
function purgeKeys(files, sourceLanguage) {
  const purgeResults = {
    purgedKeys: {},
    totalPurged: 0,
    filesUpdated: 0,
    updatedFiles: [],
  };
  sourceLanguage = canonicalizeLanguageCode(sourceLanguage);
  let foundSource = false;
  let totalSourceKeys = 0;

  groupFilesByNamespace(files).forEach((groupFiles) => {
    const sourceFile = findSourceFile(groupFiles, sourceLanguage);
    if (!sourceFile) return;
    foundSource = true;

    const sourceKeys = new Set(Object.keys(sourceFile.keys));
    totalSourceKeys += sourceKeys.size;

    groupFiles.forEach((file) => {
      const language = canonicalizeLanguageCode(file.language);
      if (language === sourceLanguage) return;

      const keysToPurge = Object.keys(file.keys).filter(
        (key) => !sourceKeys.has(key)
      );
      if (keysToPurge.length === 0) return;

      purgeResults.purgedKeys[language] = (
        purgeResults.purgedKeys[language] || []
      ).concat(keysToPurge);
      purgeResults.totalPurged += keysToPurge.length;
      keysToPurge.forEach((key) => {
        delete file.keys[key];
      });
      purgeResults.filesUpdated++;
      purgeResults.updatedFiles.push(file);
    });
  });

  if (!foundSource) throw sourceNotFound(sourceLanguage);

  logger.info("Key purging completed", {
    sourceLanguage,
    totalSourceKeys,
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
  buildTranslationTasks,
  groupFilesByNamespace,
  isMissingValue,
  purgeKeys,
  validateTranslationConsistency,
  getTranslationStatistics,
  getExistingTranslations,
};

#!/usr/bin/env node

const { Command } = require("commander");
const { glob } = require("glob");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const inquirer = require("inquirer");
const cliProgress = require("cli-progress");
require("dotenv").config();

const translationService = require("./services/translationService");
const fileParser = require("./utils/fileParser");
const openaiService = require("./services/openaiService");
const winston = require("winston");

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "translation-cli" },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

const program = new Command();

program
  .name("ai-locale")
  .description("CLI tool for translating localization files using OpenAI")
  .version("1.0.0");

program
  .command("translate")
  .description("Translate missing keys in localization files")
  .argument(
    "<pattern>",
    "File pattern (e.g., 'locales/*/translation.ts' or 'translations/**/*.strings')"
  )
  .option(
    "-k, --api-key <key>",
    "OpenAI API key (or set OPENAI_API_KEY env var)"
  )
  .option("-s, --source <lang>", "Source language code", "en")
  .option(
    "-t, --target <langs>",
    "Comma-separated target languages (auto-detected if not provided)"
  )
  .option(
    "-o, --output <dir>",
    "Output directory (default: overwrite original files)"
  )
  .option("--dry-run", "Show what would be translated without making changes")
  .option("--verbose", "Show detailed output")
  .option("--no-backup", "Don't create backup files")
  .option("--yes", "Skip confirmation prompt")
  .action(async (pattern, options) => {
    try {
      await translateFiles(pattern, options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("validate")
  .description("Validate translation files for missing keys")
  .argument("<pattern>", "File pattern to validate")
  .option("-s, --source <lang>", "Source language code", "en")
  .action(async (pattern, options) => {
    try {
      await validateFiles(pattern, options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("stats")
  .description("Show translation statistics")
  .argument("<pattern>", "File pattern to analyze")
  .option("--verbose", "Show detailed output")
  .action(async (pattern, options) => {
    try {
      await showStats(pattern, options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("purge")
  .description("Remove keys that don't exist in the source language")
  .argument("<pattern>", "File pattern to purge")
  .option("-s, --source <lang>", "Source language code", "en")
  .option("--dry-run", "Show what would be purged without making changes")
  .option("--verbose", "Show detailed output")
  .option("--no-backup", "Don't create backup files")
  .action(async (pattern, options) => {
    try {
      await purgeFiles(pattern, options);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

/**
 * Main translation function
 */
async function translateFiles(pattern, options) {
  const spinner = ora("Discovering translation files...").start();

  try {
    // Get API key
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OpenAI API key is required. Set OPENAI_API_KEY env var or use --api-key option"
      );
    }

    // Discover files
    const files = await discoverFiles(pattern);
    if (files.length === 0) {
      throw new Error(
        `No translation files found matching pattern: ${pattern}`
      );
    }

    spinner.text = `Found ${files.length} translation files`;
    spinner.succeed();

    // Parse files
    const parsedFiles = await parseFiles(files, options.verbose);

    // Auto-detect target languages from available files (excluding source language)
    const detectedLanguages = parsedFiles.map((file) => file.language);
    const targetLanguages = options.target
      ? options.target.split(",").map((lang) => lang.trim())
      : detectedLanguages.filter((lang) => lang !== options.source);

    // Validate that we have target languages
    if (targetLanguages.length === 0) {
      throw new Error(
        `No target languages found. Available languages: ${detectedLanguages.join(
          ", "
        )}. ` +
          `Make sure you have translation files for languages other than the source language (${options.source}).`
      );
    }

    // Show what will be translated
    const keysToTranslate = translationService.findKeysToTranslate(
      parsedFiles,
      options.source
    );
    const totalMissingKeys = Object.values(keysToTranslate).flat().length;

    if (totalMissingKeys === 0) {
      console.log(chalk.green("✅ All translation files are complete!"));
      return;
    }

    console.log(chalk.cyan(`\n📊 Translation Summary:`));
    console.log(
      chalk.blue(`   🌍 Source language: ${chalk.bold(options.source)}`)
    );
    const targetLanguagesText = options.target
      ? `${chalk.bold(targetLanguages.join(", "))} (specified)`
      : `${chalk.bold(targetLanguages.join(", "))} (auto-detected)`;
    console.log(chalk.blue(`   🎯 Target languages: ${targetLanguagesText}`));
    console.log(chalk.blue(`   📁 Files found: ${chalk.bold(files.length)}`));
    console.log(
      chalk.blue(`   🔍 Missing keys: ${chalk.bold(totalMissingKeys)}`)
    );

    Object.entries(keysToTranslate).forEach(([lang, keyData]) => {
      const emoji = keyData.length > 0 ? "⚠️" : "✅";
      console.log(
        chalk.yellow(
          `   ${emoji} ${lang}: ${chalk.bold(keyData.length)} missing keys`
        )
      );
    });

    // Cost estimation
    const costEstimate = openaiService.getCostEstimate(
      Object.values(keysToTranslate)
        .flat()
        .map(({ key, sourceValue, existingTranslations }) => ({
          key,
          sourceValue,
          sourceLanguage: options.source,
          targetLanguages: [targetLanguages[0]], // Estimate for one language
          existingTranslations,
          context: "Mobile app localization",
        }))
    );

    console.log(
      chalk.green(
        `\n💰 Estimated cost: ${chalk.bold(
          costEstimate.estimatedCostFormatted
        )}`
      )
    );

    if (options.dryRun) {
      console.log(chalk.cyan("\n🔍 Dry run mode - no changes will be made"));
      return;
    }

    // Confirm before proceeding (unless --yes is provided)
    if (!options.yes) {
      const { proceed } = await inquirer.prompt([
        {
          type: "confirm",
          name: "proceed",
          message: "Do you want to proceed with the translation?",
          default: true,
        },
      ]);

      if (!proceed) {
        console.log(chalk.yellow("Translation cancelled"));
        return;
      }
    }

    // Create backups if requested
    if (options.backup !== false) {
      await createBackups(files);
    }

    // Create progress bar
    const progressBar = new cliProgress.SingleBar({
      format:
        chalk.cyan("{bar}") + " | {percentage}% | {value}/{total} | {status}",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
      stopOnComplete: true,
    });

    // Start progress bar
    const totalTasks = parsedFiles.reduce((acc, file) => {
      const sourceFile = parsedFiles.find((f) => f.language === options.source);
      if (!sourceFile) return acc;

      return (
        acc +
        Object.keys(sourceFile.keys).filter((key) => {
          return !file.keys[key] && file.language !== options.source;
        }).length
      );
    }, 0);

    progressBar.start(totalTasks, 0, { status: "Starting translations..." });

    // Process translations with progress tracking
    const result = await translationService.processTranslations({
      files: parsedFiles,
      targetLanguages,
      sourceLanguage: options.source,
      onProgress: (completed, total, currentKey, translations) => {
        const percentage = Math.round((completed / total) * 100);

        // Create translation preview
        let translationPreview = "";
        if (Object.keys(translations).length > 0) {
          const sourceValue =
            parsedFiles.find((f) => f.language === options.source)?.keys[
              currentKey
            ] || "N/A";
          const translationEntries = Object.entries(translations).slice(0, 2); // Show max 2 translations
          translationPreview = translationEntries
            .map(
              ([lang, value]) =>
                `${chalk.gray(lang)}: ${chalk.green(`"${value}"`)}`
            )
            .join(" | ");
        }

        const status = currentKey
          ? `${chalk.yellow(currentKey)} → ${translationPreview}`
          : "Processing...";

        progressBar.update(completed, { status });
      },
    });

    progressBar.stop();

    // Write updated files
    await writeUpdatedFiles(result.data.files, options.output);

    // Show results
    console.log(chalk.green("\n🎉 Translation completed successfully!"));
    console.log(
      chalk.green(
        `   ✅ Successful: ${result.data.statistics.successfulTranslations}`
      )
    );
    if (result.data.statistics.failedTranslations > 0) {
      console.log(
        chalk.red(`   ❌ Failed: ${result.data.statistics.failedTranslations}`)
      );
    }
    console.log(
      chalk.blue(
        `   📁 Files updated: ${result.data.statistics.filesGenerated}`
      )
    );

    // Show translation summary - only show targeted languages
    if (result.data.statistics.successfulTranslations > 0) {
      console.log(chalk.cyan("\n📊 Translation Summary:"));
      targetLanguages.forEach((language) => {
        const translations = result.data.translations[language] || {};
        const count = Object.keys(translations).length;
        if (count > 0) {
          console.log(
            chalk.gray(`   ${language}: ${chalk.green(count)} new translations`)
          );
        }
      });
    }
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

/**
 * Validate translation files
 */
async function validateFiles(pattern, options) {
  const spinner = ora("Discovering translation files...").start();

  try {
    const files = await discoverFiles(pattern);
    if (files.length === 0) {
      throw new Error(
        `No translation files found matching pattern: ${pattern}`
      );
    }

    spinner.text = `Found ${files.length} translation files`;
    spinner.succeed();

    const parsedFiles = await parseFiles(files, options.verbose);
    const validation =
      translationService.validateTranslationConsistency(parsedFiles);
    const stats = translationService.getTranslationStatistics(parsedFiles);

    console.log(chalk.blue(`\n📊 Validation Results:`));
    console.log(chalk.blue(`   Files: ${stats.totalFiles}`));
    console.log(chalk.blue(`   Languages: ${stats.languages.join(", ")}`));
    console.log(chalk.blue(`   Total keys: ${stats.totalKeys}`));

    console.log(chalk.blue(`\n📈 Completeness:`));
    Object.entries(stats.completeness).forEach(([lang, data]) => {
      const status = data.percentage === 100 ? "✅" : "⚠️";
      console.log(
        chalk.blue(
          `   ${status} ${lang}: ${data.totalKeys}/${stats.totalKeys} (${data.percentage}%)`
        )
      );
    });

    if (validation.isValid) {
      console.log(chalk.green(`\n✅ All files are valid and complete!`));
    } else {
      console.log(chalk.red(`\n❌ Validation issues found:`));
      validation.issues.forEach((issue) => {
        console.log(chalk.red(`   - ${issue}`));
      });
    }
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

/**
 * Show translation statistics
 */
async function showStats(pattern, options = {}) {
  const spinner = ora("Discovering translation files...").start();

  try {
    const files = await discoverFiles(pattern);
    if (files.length === 0) {
      throw new Error(
        `No translation files found matching pattern: ${pattern}`
      );
    }

    spinner.text = `Found ${files.length} translation files`;
    spinner.succeed();

    const parsedFiles = await parseFiles(files, options.verbose);
    const stats = translationService.getTranslationStatistics(parsedFiles);

    console.log(chalk.blue(`\n📊 Translation Statistics:`));
    console.log(chalk.blue(`   Files: ${stats.totalFiles}`));
    console.log(chalk.blue(`   Languages: ${stats.languages.join(", ")}`));
    console.log(chalk.blue(`   Total keys: ${stats.totalKeys}`));

    console.log(chalk.blue(`\n📈 File Types:`));
    Object.entries(stats.fileTypes).forEach(([type, count]) => {
      console.log(chalk.blue(`   ${type}: ${count} files`));
    });

    console.log(chalk.blue(`\n📈 Completeness:`));
    Object.entries(stats.completeness).forEach(([lang, data]) => {
      const status = data.percentage === 100 ? "✅" : "⚠️";
      console.log(
        chalk.blue(
          `   ${status} ${lang}: ${data.totalKeys}/${stats.totalKeys} (${data.percentage}%)`
        )
      );
    });
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

/**
 * Purge keys that don't exist in source language
 */
async function purgeFiles(pattern, options) {
  const spinner = ora("Discovering translation files...").start();

  try {
    const files = await discoverFiles(pattern);
    if (files.length === 0) {
      throw new Error(
        `No translation files found matching pattern: ${pattern}`
      );
    }

    spinner.text = `Found ${files.length} translation files`;
    spinner.succeed();

    const parsedFiles = await parseFiles(files, options.verbose);

    // Perform purge analysis
    const purgeResults = translationService.purgeKeys(
      parsedFiles,
      options.source
    );

    if (purgeResults.totalPurged === 0) {
      console.log(
        chalk.green(
          "✅ No keys to purge! All files are consistent with source language."
        )
      );
      return;
    }

    console.log(chalk.yellow(`\n🗑️  Purge Summary:`));
    console.log(chalk.yellow(`   Source language: ${options.source}`));
    console.log(chalk.yellow(`   Files found: ${files.length}`));
    console.log(chalk.yellow(`   Keys to purge: ${purgeResults.totalPurged}`));
    console.log(
      chalk.yellow(`   Files to update: ${purgeResults.filesUpdated}`)
    );

    Object.entries(purgeResults.purgedKeys).forEach(([lang, keys]) => {
      console.log(chalk.yellow(`   - ${lang}: ${keys.length} keys to purge`));
      if (options.verbose) {
        keys.slice(0, 10).forEach((key) => {
          console.log(chalk.gray(`     • ${key}`));
        });
        if (keys.length > 10) {
          console.log(chalk.gray(`     ... and ${keys.length - 10} more`));
        }
      }
    });

    if (options.dryRun) {
      console.log(chalk.cyan("\n🔍 Dry run mode - no changes will be made"));
      return;
    }

    // Confirm before proceeding
    const { proceed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "proceed",
        message: "Do you want to proceed with purging these keys?",
        default: true,
      },
    ]);

    if (!proceed) {
      console.log(chalk.yellow("Purge cancelled"));
      return;
    }

    // Create backups if requested
    if (options.backup !== false) {
      await createBackups(files);
    }

    // Generate updated file contents
    const updatedFiles = parsedFiles.map((file) => {
      const content = fileParser.generateFileContent(
        file.keys,
        file.type,
        file.content
      );
      return {
        filename: file.filename,
        language: file.language,
        content,
        type: file.type,
        filePath: file.filePath,
        keysCount: Object.keys(file.keys).length,
      };
    });

    // Write updated files
    await writeUpdatedFiles(updatedFiles);

    // Show results
    console.log(chalk.green(`\n✅ Purge completed successfully!`));
    console.log(chalk.green(`   Keys purged: ${purgeResults.totalPurged}`));
    console.log(chalk.green(`   Files updated: ${purgeResults.filesUpdated}`));
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

/**
 * Discover files using glob pattern with #locale support
 */
async function discoverFiles(pattern) {
  let files = [];

  // Check if pattern contains #locale
  if (pattern.includes("#locale")) {
    // Common language codes to expand #locale
    const commonLanguages = [
      "en",
      "fr",
      "es",
      "de",
      "it",
      "pt",
      "nl",
      "sv",
      "da",
      "no",
      "fi",
      "pl",
      "ru",
      "ja",
      "ko",
      "zh",
      "ar",
      "hi",
      "tr",
      "th",
      "cs",
      "hu",
      "ro",
      "bg",
      "hr",
      "sk",
      "sl",
      "et",
      "lv",
      "lt",
      "mt",
      "cy",
      "ga",
      "eu",
      "ca",
      "gl",
      "is",
      "mk",
      "sq",
      "sr",
      "bs",
      "uk",
      "be",
      "ka",
      "hy",
      "az",
      "kk",
      "ky",
      "uz",
      "tg",
      "mn",
      "my",
      "km",
      "lo",
      "vi",
      "id",
      "ms",
      "tl",
      "sw",
      "am",
      "ti",
      "om",
      "so",
      "ha",
      "yo",
      "ig",
      "zu",
      "xh",
      "af",
      "st",
      "tn",
      "ts",
      "ss",
      "nr",
      "nso",
      "ve",
      "ts",
    ];

    // Expand #locale to all possible language codes
    const expandedPatterns = commonLanguages.map((lang) =>
      pattern.replace("#locale", lang)
    );

    // Use glob to find files for each expanded pattern
    for (const expandedPattern of expandedPatterns) {
      const patternFiles = await glob(expandedPattern, {
        nodir: true,
        absolute: true,
      });
      files.push(...patternFiles);
    }
  } else {
    // Use original pattern if no #locale
    files = await glob(pattern, {
      nodir: true,
      absolute: true,
    });
  }

  // Filter for supported file types
  const supportedExtensions = [".strings", ".json", ".ts", ".js"];
  return files.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return supportedExtensions.includes(ext);
  });
}

/**
 * Parse discovered files
 */
async function parseFiles(files, verbose) {
  const spinner = ora("Parsing translation files...").start();
  const parsedFiles = [];

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = await fileParser.parseFile({
        buffer: Buffer.from(content),
        originalname: path.basename(filePath),
        filePath: filePath,
      });

      parsedFiles.push({
        ...parsed,
        filePath,
      });

      if (verbose) {
        console.log(
          chalk.gray(
            `   Parsed ${path.basename(filePath)} (${parsed.language}) - ${
              Object.keys(parsed.keys).length
            } keys`
          )
        );
      }
    } catch (error) {
      console.error(chalk.red(`Failed to parse ${filePath}: ${error.message}`));
    }
  }

  spinner.succeed();
  return parsedFiles;
}

/**
 * Create backup files
 */
async function createBackups(files) {
  const spinner = ora("Creating backup files...").start();

  for (const filePath of files) {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
  }

  spinner.succeed();
}

/**
 * Write updated files
 */
async function writeUpdatedFiles(files, outputDir) {
  const spinner = ora("Writing updated files...").start();

  for (const file of files) {
    const outputPath = outputDir
      ? path.join(outputDir, file.filename)
      : file.filePath || file.filename;

    fs.writeFileSync(outputPath, file.content, "utf8");
  }

  spinner.succeed();
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error(chalk.red(`Uncaught Exception: ${error.message}`));
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    chalk.red(`Unhandled Rejection at: ${promise}, reason: ${reason}`)
  );
  process.exit(1);
});

// Parse command line arguments
program.parse();

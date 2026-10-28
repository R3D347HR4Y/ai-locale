const fs = require("fs");
const os = require("os");
const path = require("path");
const { BaseFormatTest } = require("../test-runner");

if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "test-key";
}
const openaiService = require("../../src/services/openaiService");
const translationService = require("../../src/services/translationService");

const TARGETS = [
  "en", "de", "es", "it", "pt", "nl", "pl", "ro", "cs", "sk", "hu", "sv",
  "da", "fi", "et", "lv", "lt", "bg", "hr", "sl", "el", "ga", "mt", "uk",
  "ru", "tr", "ar", "hi", "bn", "zh", "ja", "ko",
];

/**
 * Fake OpenAI client. Answers "[lang] <source>" for every requested language,
 * and lets a test truncate or corrupt specific requests.
 */
function createMockClient({ onRequest } = {}) {
  const requests = [];
  return {
    requests,
    chat: {
      completions: {
        create: async (body) => {
          const prompt = body.messages[1].content;
          const languages = prompt
            .match(/Its keys are exactly these language codes: ([^.]+)\./)[1]
            .split(",")
            .map((s) => s.trim());
          const source = JSON.parse(
            prompt.match(/as a JSON string: (".*")\nTarget languages/)[1]
          );
          const request = { languages, source, prompt, maxTokens: body.max_tokens };
          requests.push(request);

          const translations = {};
          languages.forEach((language) => {
            translations[language] = `[${language}] ${source}`;
          });
          const override = onRequest ? onRequest(request, translations) : null;
          if (override && override.truncated) {
            return {
              choices: [
                {
                  finish_reason: "length",
                  message: { content: '{"translations": {"de": "abc' },
                },
              ],
            };
          }
          return {
            choices: [
              {
                finish_reason: "stop",
                message: { content: JSON.stringify({ translations }) },
              },
            ],
          };
        },
      },
    },
  };
}

function writeCatalogs(root, namespace, catalogs) {
  Object.entries(catalogs).forEach(([language, content]) => {
    const dir = path.join(root, "locales", language);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, namespace), content, "utf8");
  });
}

async function parseAll(fileParser, root) {
  const files = [];
  const localesDir = path.join(root, "locales");
  for (const language of fs.readdirSync(localesDir).sort()) {
    for (const name of fs.readdirSync(path.join(localesDir, language)).sort()) {
      const filePath = path.join(localesDir, language, name);
      const parsed = await fileParser.parseFile({ filePath });
      files.push({ ...parsed, filePath });
    }
  }
  return files;
}

class TranslationTest extends BaseFormatTest {
  constructor() {
    super();
    this.root = null;
  }

  withTempDir(fn) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-locale-tr-"));
    return Promise.resolve(fn(root)).finally(() => {
      fs.rmSync(root, { recursive: true, force: true });
      openaiService.setClient(null);
    });
  }

  async testLongStringFillsAllTargets() {
    await this.withTempDir(async (root) => {
      const longText =
        "Bonjour {{name}},\n" +
        "Merci pour votre réservation chez nous. ".repeat(10) +
        "\nÀ bientôt.";
      this.assertTrue(longText.length >= 400, "Source must be at least 400 characters");

      const catalogs = { fr: JSON.stringify({ email: { body: longText } }, null, 2) + "\n" };
      TARGETS.forEach((language) => {
        catalogs[language] = "{}\n";
      });
      writeCatalogs(root, "email.json", catalogs);

      let truncatedOnce = false;
      const client = createMockClient({
        onRequest: (request) => {
          // A request mixing dense scripts is cut off once to exercise the split.
          if (!truncatedOnce && request.languages.length > 1 && request.languages.includes("hi")) {
            truncatedOnce = true;
            return { truncated: true };
          }
          return null;
        },
      });
      openaiService.setClient(client);

      const files = await parseAll(this.fileParser, root);
      const result = await translationService.processTranslations({
        files,
        sourceLanguage: "fr",
        batchDelay: 0,
      });

      this.assertTrue(truncatedOnce, "The mock should have truncated one request");
      client.requests.forEach((request) => {
        this.assertTrue(
          request.languages.length <= 6,
          `A request asked for ${request.languages.length} languages`
        );
      });
      this.assertEqual(result.data.statistics.failedTranslations, 0, "No translation should fail");
      this.assertEqual(result.data.statistics.successfulTranslations, 32, "Every target should be translated");
      this.assertEqual(result.data.files.length, 32, "Only the 32 target files change");

      TARGETS.forEach((language) => {
        const file = result.data.files.find((f) => f.language === language);
        this.assertTrue(file, `Missing generated file for ${language}`);
        const parsed = JSON.parse(file.content);
        this.assertEqual(
          parsed.email.body,
          `[${language}] ${longText}`,
          `Wrong translation for ${language}`
        );
        this.assertTrue(file.content.endsWith("}\n"), `Trailing newline lost for ${language}`);
      });
    });
  }

  async testTargetOptionLimitsRequestsAndWrites() {
    await this.withTempDir(async (root) => {
      writeCatalogs(root, "common.json", {
        fr: '{"hello": "Bonjour"}',
        de: "{}",
        es: "{}",
        it: "{}",
      });
      const client = createMockClient();
      openaiService.setClient(client);

      const files = await parseAll(this.fileParser, root);
      const keys = translationService.findKeysToTranslate(files, "fr", ["de", "es"]);
      this.assertEqual(Object.keys(keys).sort().join(","), "de,es", "Only de and es are targets");

      const result = await translationService.processTranslations({
        files,
        sourceLanguage: "fr",
        targetLanguages: ["de", "es"],
        batchDelay: 0,
      });
      const asked = client.requests.flatMap((r) => r.languages).sort().join(",");
      this.assertEqual(asked, "de,es", "The prompt must only ask for de and es");
      this.assertEqual(
        result.data.files.map((f) => f.language).sort().join(","),
        "de,es",
        "Only de and es are written"
      );
    });
  }

  async testPlaceholderMismatchIsRetriedThenRejected() {
    await this.withTempDir(async (root) => {
      writeCatalogs(root, "common.json", {
        fr: '{"greet": "Bonjour {{name}}, vous avez %d messages"}',
        de: "{}",
        es: "{}",
      });
      let germanAttempts = 0;
      const client = createMockClient({
        onRequest: (request, translations) => {
          if (request.languages.includes("de")) {
            germanAttempts++;
            if (germanAttempts === 1) translations.de = "Hallo name, %d Nachrichten";
          }
          if (request.languages.includes("es")) {
            translations.es = "Hola {{nombre}}, tienes %d mensajes";
          }
          return null;
        },
      });
      openaiService.setClient(client);

      const files = await parseAll(this.fileParser, root);
      const result = await translationService.processTranslations({
        files,
        sourceLanguage: "fr",
        batchDelay: 0,
      });

      const retry = client.requests.find(
        (r) => r.prompt.includes("A previous answer changed the placeholders")
      );
      this.assertTrue(retry, "A placeholder mismatch should trigger a retry");
      this.assertContains(retry.prompt, "{{name}}", "The retry lists the placeholders");

      const de = result.data.files.find((f) => f.language === "de");
      this.assertEqual(
        JSON.parse(de.content).greet,
        "[de] Bonjour {{name}}, vous avez %d messages",
        "de is accepted after the retry"
      );
      this.assertFalse(
        result.data.files.find((f) => f.language === "es"),
        "es keeps renaming the placeholder and must not be written"
      );
      this.assertEqual(result.data.statistics.failedTranslations, 1, "One translation fails");
    });
  }

  async testNothingWrittenWhenEverythingFails() {
    await this.withTempDir(async (root) => {
      writeCatalogs(root, "common.json", { fr: '{"a": "x"}\n', de: "{}\n" });
      openaiService.setClient({
        chat: {
          completions: {
            create: async () => {
              throw new Error("network down");
            },
          },
        },
      });

      const files = await parseAll(this.fileParser, root);
      const result = await translationService.processTranslations({
        files,
        sourceLanguage: "fr",
        batchDelay: 0,
      });
      this.assertEqual(result.data.files.length, 0, "No file is regenerated");
      this.assertEqual(result.data.statistics.failedTranslations, 1, "The failure is counted");
      this.assertFalse(result.success, "The result is not a success");
    });
  }

  async testNamespacesStaySeparate() {
    await this.withTempDir(async (root) => {
      writeCatalogs(root, "email.json", { fr: '{"subject": "Sujet"}', de: "{}" });
      writeCatalogs(root, "common.json", { fr: '{"ok": "D\'accord"}', de: '{"ok": "OK"}' });
      openaiService.setClient(createMockClient());

      const files = await parseAll(this.fileParser, root);
      const result = await translationService.processTranslations({
        files,
        sourceLanguage: "fr",
        batchDelay: 0,
      });
      this.assertEqual(result.data.files.length, 1, "Only de/email.json changes");
      const file = result.data.files[0];
      this.assertTrue(file.filePath.endsWith(path.join("de", "email.json")), "Written to the email catalog");
      this.assertEqual(JSON.parse(file.content).subject, "[de] Sujet", "Translated into the right file");
    });
  }

  async testStatsCountsNestedLeavesAndEmptyStrings() {
    await this.withTempDir(async (root) => {
      writeCatalogs(root, "email.json", {
        fr: JSON.stringify({ a: { x: "un", y: "deux" }, b: { z: { w: "trois" } } }),
        en: JSON.stringify({ a: { x: "one", y: "" }, b: {} }),
        de: "{}",
      });
      const files = await parseAll(this.fileParser, root);

      const stats = translationService.getTranslationStatistics(files, "fr");
      this.assertEqual(stats.totalKeys, 3, "Three nested leaves in the source");
      this.assertEqual(stats.completeness.fr.percentage, 100, "Source is complete");
      this.assertEqual(stats.completeness.en.totalKeys, 1, "Empty string counts as missing");
      this.assertEqual(stats.completeness.de.percentage, 0, "Empty catalog is 0%");

      const validation = translationService.validateTranslationConsistency(files, "fr");
      this.assertFalse(validation.isValid, "Missing leaves are reported");
      this.assertContains(validation.issues.join("\n"), "a.y", "Empty value is listed");
    });
  }

  async testPlaceholderExtraction() {
    const { extractPlaceholders, samePlaceholders } = openaiService;
    this.assertEqual(extractPlaceholders("50% de réduction").length, 0, "A percent sign is not a placeholder");
    this.assertEqual(extractPlaceholders("%1$s et %d, 100%%").join(" "), "%1$s %d", "printf placeholders");
    this.assertEqual(extractPlaceholders("Hi {{ name }} and {count}").join(" "), "{count} {{name}}", "Brace placeholders");
    this.assertTrue(
      samePlaceholders(
        "{count, plural, one {# message} other {# messages}}",
        "{count, plural, one {# Nachricht} other {# Nachrichten}}"
      ),
      "ICU branch text may be translated"
    );
    this.assertFalse(
      samePlaceholders("{count, plural, one {# m} other {# ms}}", "{n, plural, one {# m} other {# ms}}"),
      "ICU argument names must survive"
    );
  }

  async testPromptHasNoHardcodedContext() {
    const prompt = openaiService.getTranslationPrompt({
      key: "k",
      sourceValue: "Bonjour",
      sourceLanguage: "fr",
      targetLanguages: ["de"],
      existingTranslations: { fr: "Bonjour", en: "Hello", es: "Hola", it: "Ciao" },
    });
    this.assertFalse(/beauty/i.test(prompt), "No hardcoded beauty context");
    this.assertFalse(prompt.includes("Context about the application"), "No context section by default");
    this.assertContains(prompt, "{{name}}", "Double-brace placeholders are mentioned");
    this.assertContains(prompt, '- en: "Hello"', "English is kept as reference");
    this.assertFalse(prompt.includes("Ciao"), "Reference translations are capped");

    const withContext = openaiService.getTranslationPrompt({
      key: "k",
      sourceValue: "Bonjour",
      sourceLanguage: "fr",
      targetLanguages: ["de"],
      context: "Booking app for hair salons",
    });
    this.assertContains(withContext, "Booking app for hair salons", "--context reaches the prompt");
  }

  async testLanguageChunking() {
    const long = "x".repeat(400);
    const chunks = openaiService.chunkTargetLanguages(long, TARGETS);
    this.assertEqual(chunks.flat().length, 32, "Every language is kept");
    chunks.forEach((chunk) => {
      this.assertTrue(chunk.length <= 6, "At most six languages per request");
    });
    this.assertEqual(
      openaiService.chunkTargetLanguages("OK", ["de", "es"]).length,
      1,
      "Short strings share a request"
    );
  }

  async testMissingFinalNewlineIsRestoredFromSource() {
    await this.withTempDir(async (root) => {
      writeCatalogs(root, "m.json", {
        fr: '{\n  "a": "Bonjour",\n  "b": "Salut"\n}\n',
        de: '{\n  "a": "Hallo"\n}',
        es: "{}",
      });
      openaiService.setClient(createMockClient());

      const files = await parseAll(this.fileParser, root);
      const result = await translationService.processTranslations({
        files,
        sourceLanguage: "fr",
        batchDelay: 0,
      });
      ["de", "es"].forEach((language) => {
        const file = result.data.files.find((f) => f.language === language);
        this.assertTrue(file.content.endsWith("}\n"), `${language} gets the source's final newline back`);
      });

      const purgeFiles = await parseAll(this.fileParser, root);
      purgeFiles.find((f) => f.language === "de").keys.extra = "x";
      const purge = translationService.purgeKeys(purgeFiles, "fr");
      const refs = translationService.sourceContentByFile(purgeFiles, "fr");
      purge.updatedFiles.forEach((file) => {
        this.assertTrue(
          translationService.regenerateFile(file, refs).endsWith("}\n"),
          "purge restores the final newline too"
        );
      });
    });
  }

  async testTrailingNewlineIsPreserved() {
    const keys = { a: "b" };
    this.assertTrue(
      this.fileParser.generateFileContent(keys, "json", "{}\n").endsWith("}\n"),
      "Keeps \\n"
    );
    this.assertTrue(
      this.fileParser.generateFileContent(keys, "json", "{}\r\n").endsWith("}\r\n"),
      "Keeps \\r\\n"
    );
    this.assertTrue(
      this.fileParser.generateFileContent(keys, "json", "{}").endsWith("}"),
      "No newline added when neither file has one"
    );
    this.assertTrue(
      this.fileParser.generateFileContent(keys, "json", "{}", "{}\r\n").endsWith("}\r\n"),
      "Falls back to the reference file's newline"
    );
  }
}

module.exports = TranslationTest;

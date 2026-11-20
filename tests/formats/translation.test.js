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
          const packed = prompt.match(/Items to translate \(JSON\)[^\n]*\n(.*)\n/);
          if (packed) {
            const items = JSON.parse(packed[1]);
            const languages = prompt
              .match(/these language codes: (.+?), and whose values/)[1]
              .split(",")
              .map((s) => s.trim());
            const request = {
              packed: true,
              languages,
              sources: Object.values(items).map((item) => item.text),
              prompt,
              maxTokens: body.max_tokens || body.max_completion_tokens,
            };
            requests.push(request);
            const translations = {};
            let truncated = false;
            Object.entries(items).forEach(([id, item]) => {
              const perItem = {};
              languages.forEach((language) => {
                perItem[language] = `[${language}] ${item.text}`;
              });
              const override = onRequest
                ? onRequest({ ...request, source: item.text }, perItem)
                : null;
              if (override && override.truncated) truncated = true;
              if (!(override && override.drop)) translations[id] = perItem;
            });
            return {
              choices: [
                truncated
                  ? { finish_reason: "length", message: { content: '{"translations": {"1": {' } }
                  : { finish_reason: "stop", message: { content: JSON.stringify({ translations }) } },
              ],
            };
          }
          const languages = prompt
            .match(/Its keys are exactly these language codes: ([^.]+)\./)[1]
            .split(",")
            .map((s) => s.trim());
          const source = JSON.parse(
            prompt.match(/as a JSON string: (".*")\nTarget languages/)[1]
          );
          const request = { languages, source, prompt, maxTokens: body.max_tokens || body.max_completion_tokens };
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

  async testRequestsRunInParallelUpToTheLimit() {
    await this.withTempDir(async (root) => {
      const source = {};
      for (let i = 0; i < 12; i++) source[`k${i}`] = `Texte ${i}`;
      const catalogs = { fr: JSON.stringify(source) };
      TARGETS.forEach((language) => {
        catalogs[language] = "{}";
      });
      writeCatalogs(root, "common.json", catalogs);

      const mock = createMockClient();
      let inFlight = 0;
      let peak = 0;
      openaiService.setClient({
        chat: {
          completions: {
            create: async (body) => {
              inFlight++;
              peak = Math.max(peak, inFlight);
              await new Promise((r) => setTimeout(r, 5));
              inFlight--;
              return mock.chat.completions.create(body);
            },
          },
        },
      });

      const progress = [];
      const files = await parseAll(this.fileParser, root);
      const result = await translationService.processTranslations({
        files,
        sourceLanguage: "fr",
        concurrency: 3,
        onProgress: (completed) => progress.push(completed),
      });

      this.assertEqual(peak, 3, "The limiter should keep exactly 3 requests in flight");
      this.assertEqual(result.data.statistics.failedTranslations, 0, "Nothing fails");
      this.assertEqual(result.data.statistics.successfulTranslations, 12 * 32, "Every pair is translated");
      this.assertEqual(progress.join(","), [...Array(12).keys()].map((i) => i + 1).join(","), "Progress counts up once per key");
    });
  }

  async testShortKeysArePackedIntoFewRequests() {
    await this.withTempDir(async (root) => {
      const source = {};
      for (let i = 0; i < 60; i++) source[`k${i}`] = `Bouton ${i} {{count}}`;
      const catalogs = { fr: JSON.stringify(source) };
      TARGETS.forEach((language) => {
        catalogs[language] = "{}";
      });
      writeCatalogs(root, "common.json", catalogs);
      const client = createMockClient();
      openaiService.setClient(client);

      const files = await parseAll(this.fileParser, root);
      const tasks = translationService.buildTranslationTasks(
        translationService.findKeysToTranslate(files, "fr"),
        "fr"
      );
      const estimate = openaiService.getCostEstimate(tasks);
      const result = await translationService.processTranslations({ files, sourceLanguage: "fr" });

      // 32 languages -> 6 groups; 60 keys -> 3 packs of at most 25 per group,
      // a few more where dense scripts hit the output budget first.
      this.assertTrue(
        client.requests.length >= 18 && client.requests.length <= 24,
        `60 keys x 32 languages took ${client.requests.length} requests instead of ~18 (360 unpacked)`
      );
      this.assertEqual(estimate.estimatedRequests, client.requests.length, "The estimate counts packed requests");
      this.assertTrue(client.requests.every((r) => r.packed && r.languages.length <= 6), "Packs keep at most 6 languages");
      this.assertEqual(result.data.statistics.failedTranslations, 0, "Nothing fails");
      const ja = JSON.parse(result.data.files.find((f) => f.language === "ja").content);
      this.assertEqual(ja.k42, "[ja] Bouton 42 {{count}}", "Each item lands on its own key");
    });
  }

  async testPackFailuresFallBackToSingleKeys() {
    await this.withTempDir(async (root) => {
      writeCatalogs(root, "common.json", {
        fr: JSON.stringify({ a: "Salut {{name}}", b: "Oui", c: "Non", d: "Peut-être" }),
        de: "{}",
        es: "{}",
      });
      let truncatedOnce = false;
      const client = createMockClient({
        onRequest: (request, translations) => {
          if (!request.packed) return null;
          if (!truncatedOnce && request.sources.length === 4) {
            truncatedOnce = true;
            return { truncated: true };
          }
          if (request.source === "Salut {{name}}") translations.de = "Hallo name";
          if (request.source === "Oui") return { drop: true };
          return null;
        },
      });
      openaiService.setClient(client);

      const files = await parseAll(this.fileParser, root);
      const result = await translationService.processTranslations({ files, sourceLanguage: "fr" });

      this.assertTrue(truncatedOnce, "The first pack is truncated");
      this.assertTrue(
        client.requests.some((r) => r.packed && r.sources.length === 2),
        "A truncated pack is split in half"
      );
      const strict = client.requests.find(
        (r) => !r.packed && r.prompt.includes("A previous answer changed the placeholders")
      );
      this.assertTrue(strict && strict.languages.join() === "de", "Broken placeholders are redone alone, strictly");
      this.assertTrue(
        client.requests.some((r) => !r.packed && r.source === "Oui"),
        "A key missing from the pack is redone alone"
      );
      this.assertEqual(result.data.statistics.failedTranslations, 0, "Everything ends up translated");
      const de = JSON.parse(result.data.files.find((f) => f.language === "de").content);
      this.assertEqual(de.a, "[de] Salut {{name}}", "The strict retry is kept");
      this.assertEqual(de.b, "[de] Oui", "The dropped key is filled");
    });
  }

  async testProgressStartsEarlyOnBigRuns() {
    await this.withTempDir(async (root) => {
      const source = {};
      for (let i = 0; i < 200; i++) source[`k${i}`] = `Libellé ${i}`;
      const catalogs = { fr: JSON.stringify(source) };
      TARGETS.forEach((language) => {
        catalogs[language] = "{}";
      });
      writeCatalogs(root, "common.json", catalogs);
      const client = createMockClient();
      openaiService.setClient(client);

      let requestsAtFirstProgress = null;
      const files = await parseAll(this.fileParser, root);
      await translationService.processTranslations({
        files,
        sourceLanguage: "fr",
        concurrency: 2,
        onProgress: () => {
          if (requestsAtFirstProgress === null) requestsAtFirstProgress = client.requests.length;
        },
      });

      const total = client.requests.length;
      this.assertTrue(
        requestsAtFirstProgress <= 12,
        `First key finished after ${requestsAtFirstProgress} of ${total} requests`
      );
    });
  }

  async testRejectedParameterIsDroppedOnce() {
    await this.withTempDir(async (root) => {
      writeCatalogs(root, "common.json", { fr: '{"a": "Oui", "b": "Non"}', de: "{}", es: "{}" });
      const mock = createMockClient();
      let rejected = 0;
      openaiService.setClient({
        chat: {
          completions: {
            create: async (body) => {
              if ("temperature" in body || "max_completion_tokens" in body) {
                rejected++;
                const param = "temperature" in body ? "temperature" : "max_completion_tokens";
                const error = new Error(`400 Unsupported parameter: '${param}' is not supported with this model.`);
                error.status = 400;
                error.param = param;
                throw error;
              }
              return mock.chat.completions.create(body);
            },
          },
        },
      });

      const files = await parseAll(this.fileParser, root);
      const result = await translationService.processTranslations({
        files,
        sourceLanguage: "fr",
        concurrency: 1,
      });

      this.assertEqual(result.data.statistics.failedTranslations, 0, "Translations succeed once the parameters are dropped");
      this.assertEqual(rejected, 2, "Each parameter is rejected only once");
      this.assertTrue(mock.requests.every((r) => r.maxTokens > 0), "max_tokens replaces max_completion_tokens");
    });
  }

  testProviderIsPickedFromModelName() {
    const saved = { ...process.env };
    try {
      process.env.DEEPSEEK_API_KEY = "ds-key";
      delete process.env.OPENAI_BASE_URL;
      delete process.env.OPENAI_REASONING_EFFORT;
      openaiService.configure({ model: "deepseek-flash" });
      const ds = openaiService.resolveSettings();
      this.assertEqual(ds.baseURL, "https://api.deepseek.com", "DeepSeek endpoint");
      this.assertEqual(ds.apiKey, "ds-key", "DeepSeek key");

      openaiService.configure({});
      delete process.env.OPENAI_MODEL;
      const def = openaiService.resolveSettings();
      this.assertEqual(def.model, openaiService.DEFAULT_MODEL, "Default model");
      this.assertEqual(def.reasoningEffort, "none", "Luna runs without reasoning");
      this.assertEqual(def.baseURL, undefined, "OpenAI endpoint by default");
    } finally {
      process.env = saved;
      openaiService.configure({});
    }
  }

  async testDottedKeysKeepTheirShape() {
    await this.withTempDir(async (root) => {
      writeCatalogs(root, "common.json", {
        fr: JSON.stringify({ "ui.save": "Enregistrer", nested: { title: "Titre" }, "a.b": "flat" }),
        de: JSON.stringify({ "ui.save": "Speichern" }),
        es: "{}",
      });
      openaiService.setClient(createMockClient());

      const files = await parseAll(this.fileParser, root);
      const result = await translationService.processTranslations({ files, sourceLanguage: "fr" });

      const de = JSON.parse(result.data.files.find((f) => f.language === "de").content);
      this.assertEqual(de["ui.save"], "Speichern", "An existing flat key stays flat");
      this.assertEqual(de.nested.title, "[de] Titre", "A nested source key is written nested");
      this.assertEqual(de["a.b"], "[de] flat", "A new flat key follows the source shape");
      this.assertFalse("ui" in de || "a" in de, "No nesting invented from the dots");

      const es = JSON.parse(result.data.files.find((f) => f.language === "es").content);
      this.assertEqual(Object.keys(es).sort().join(","), "a.b,nested,ui.save", "An empty target copies the source shape");
    });
  }

  testConflictingKeysAreNotLost() {
    const json = this.fileParser.generateFileContent({ a: "x", "a.b": "y" }, "json");
    const parsed = JSON.parse(json);
    this.assertEqual(parsed.a, "x", "The string is kept");
    this.assertEqual(parsed["a.b"], "y", "The dotted key is kept as a literal key");

    const ts = this.fileParser.generateFileContent(
      { "ui.save": "Save", "deep.x": "X" },
      "tsjs",
      "",
      'export default { "ui.save": "Sauver", deep: { x: "x" } } as const;\n'
    );
    const object = this.fileParser.parseTSJSObject(ts);
    this.assertEqual(object["ui.save"], "Save", "TS flat key stays flat");
    this.assertEqual(object.deep.x, "X", "TS nested key stays nested");
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

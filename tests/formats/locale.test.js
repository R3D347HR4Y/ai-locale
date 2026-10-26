const fs = require("fs");
const os = require("os");
const path = require("path");
const { glob } = require("glob");
const { BaseFormatTest } = require("../test-runner");
const locale = require("../../src/utils/locale");

class LocaleTest extends BaseFormatTest {
  async testTwoLetterAndRegionalCodes() {
    const cases = {
      "locales/fr/messages.json": "fr",
      "locales/en/messages.json": "en",
      "locales/FR/messages.json": "fr",
      "locales/fr-CA/messages.json": "fr-CA",
      "locales/fr-ca/messages.json": "fr-CA",
      "locales/fr_CA/messages.json": "fr-CA",
      "locales/nl-BE/messages.json": "nl-BE",
      "locales/nl_be/translation.ts": "nl-BE",
      "locales/pt-BR/messages.json": "pt-BR",
      "locales/es-419/messages.json": "es-419",
      "locales/zh-Hans/messages.json": "zh-Hans",
      "locales/zh_Hant_TW/messages.json": "zh-Hant-TW",
      "locales/cs/messages.json": "cs",
      "translations/fr-CA.strings": "fr-CA",
      "translations/messages.fr-CA.json": "fr-CA",
      "Resources/en.lproj/Localizable.strings": "en",
      "Resources/fr-CA.lproj/Localizable.strings": "fr-CA",
      "locale/nl_BE/LC_MESSAGES/messages.po": "nl-BE",
      "locales/french/messages.json": "fr",
      "./tests/fixtures/ts/fr.ts": "fr",
      "./tests/fixtures/ts/en.ts": "en",
      "locales/js/messages.json": "en",
    };

    Object.entries(cases).forEach(([filePath, expected]) => {
      this.assertEqual(
        this.fileParser.detectLanguage(filePath),
        expected,
        `Should detect ${expected} from ${filePath}`
      );
    });

    this.assertEqual(
      locale.canonicalizeLanguageCode("fr_CA"),
      "fr-CA",
      "Should canonicalize underscore regions"
    );
    this.assertEqual(
      locale.canonicalizeLanguageCode("nl-be"),
      "nl-BE",
      "Should canonicalize lowercase regions"
    );
    this.assertTrue(
      locale.canonicalizeLanguageCode("fr") !==
        locale.canonicalizeLanguageCode("fr-CA"),
      "Should keep a regional locale distinct from its base language"
    );
  }

  async testSourceLookupAcceptsRegionalAliases() {
    if (!process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = "test-key";
    }
    const { findKeysToTranslate } = require("../../src/services/translationService");
    const files = [
      { language: "fr-CA", keys: { hello: "bonjour" } },
      { language: "nl-BE", keys: {} },
      { language: "fr", keys: {} },
    ];

    const result = findKeysToTranslate(files, "fr_CA");
    this.assertTrue(
      Array.isArray(result["nl-BE"]) && result["nl-BE"].length === 1,
      "Should treat nl-BE as a target when the source is fr-CA"
    );
    this.assertTrue(
      Array.isArray(result.fr) && result.fr.length === 1,
      "Should keep fr distinct from fr-CA"
    );
    this.assertTrue(
      result["fr-CA"] === undefined,
      "Should not ask to translate the source locale"
    );
  }

  async testLocaleDiscovery() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-locale-"));

    try {
      const files = [
        "locales/fr/messages.json",
        "locales/en/messages.json",
        "locales/fr-CA/messages.json",
        "locales/nl-BE/messages.json",
        "locales/fr_BE/messages.json",
        "locales/zh-Hans/messages.json",
        "locales/es-419/messages.json",
        "locales/notes/messages.json",
        "locales/js/messages.json",
        "Resources/en.lproj/Localizable.strings",
        "Resources/fr-CA.lproj/Localizable.strings",
        "Resources/Base.lproj/Localizable.strings",
        "translations/fr.json",
        "translations/nl-BE.json",
        "translations/messages.json",
      ];

      files.forEach((rel) => {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, "{}");
      });

      const directoryPattern = path.join(root, "locales/#locale/messages.json");
      const directories = await this.discoveredBasenames(
        directoryPattern,
        (file) => path.basename(path.dirname(file))
      );
      this.assertEqual(
        directories.join(","),
        "en,es-419,fr,fr-CA,fr_BE,nl-BE,zh-Hans",
        "Should discover two-letter codes and regional directories"
      );

      const lprojPattern = path.join(
        root,
        "Resources/#locale.lproj/Localizable.strings"
      );
      const lproj = await this.discoveredBasenames(
        lprojPattern,
        (file) => path.basename(path.dirname(file))
      );
      this.assertEqual(
        lproj.join(","),
        "en.lproj,fr-CA.lproj",
        "Should discover regional .lproj folders"
      );

      const filePattern = path.join(root, "translations/#locale.json");
      const names = await this.discoveredBasenames(filePattern, (file) =>
        path.basename(file)
      );
      this.assertEqual(
        names.join(","),
        "fr.json,nl-BE.json",
        "Should discover regional filenames"
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  async discoveredBasenames(pattern, label) {
    const found = await glob(locale.expandLocalePattern(pattern), {
      nodir: true,
      absolute: true,
    });
    return locale
      .filterDiscoveredFiles(pattern, found)
      .map(label)
      .sort();
  }
}

module.exports = LocaleTest;

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

  async testRequestedLanguageNames() {
    const languages = [
      ["Bulgarian", "bg"],
      ["Croatian", "hr"],
      ["Czech", "cs"],
      ["Danish", "da"],
      ["Dutch", "nl"],
      ["Estonian", "et"],
      ["Finnish", "fi"],
      ["German", "de"],
      ["Greek", "el"],
      ["Hungarian", "hu"],
      ["Irish", "ga"],
      ["Italian", "it"],
      ["Latvian", "lv"],
      ["Lithuanian", "lt"],
      ["Maltese", "mt"],
      ["Polish", "pl"],
      ["Portuguese", "pt"],
      ["Romanian", "ro"],
      ["Slovak", "sk"],
      ["Slovene", "sl"],
      ["Spanish", "es"],
      ["Swedish", "sv"],
      ["Chinese", "zh"],
      ["Japanese", "ja"],
      ["Korean", "ko"],
      ["Arabic", "ar"],
      ["Swahili", "sw"],
      ["Ukrainian", "uk"],
      ["Russian", "ru"],
      ["Hindi", "hi"],
      ["Bengali", "bn"],
    ];

    languages.forEach(([name, code]) => {
      const folder = name.toLowerCase();
      this.assertEqual(
        this.fileParser.detectLanguage(`locales/${code}/messages.json`),
        code,
        `Should detect ${name} from its code ${code}`
      );
      this.assertEqual(
        this.fileParser.detectLanguage(`locales/${folder}/messages.json`),
        code,
        `Should detect ${name} from its English name`
      );
      this.assertEqual(
        locale.canonicalizeLanguageCode(name),
        code,
        `Should canonicalize ${name} to ${code}`
      );
      this.assertTrue(
        locale.fileMatchesLocalePattern(
          "locales/#locale/messages.json",
          `/project/locales/${code}/messages.json`
        ),
        `Should discover #locale directory ${code}`
      );
      this.assertTrue(
        locale.fileMatchesLocalePattern(
          "locales/#locale/messages.json",
          `/project/locales/${folder}/messages.json`
        ),
        `Should discover #locale directory ${folder}`
      );
    });

    this.assertEqual(
      locale.canonicalizeLanguageCode("slovenian"),
      "sl",
      "Should accept Slovenian as an alias of Slovene"
    );
    this.assertEqual(
      this.fileParser.detectLanguage("locales/el-GR/messages.json"),
      "el-GR",
      "Should keep a regional Greek tag"
    );
  }

  async testEthnologueTop100() {
    // Ethnologue 2025, total speakers. Folder token -> canonical code.
    const languages = [
      ["english", "en"],
      ["mandarin", "zh"],
      ["hindi", "hi"],
      ["spanish", "es"],
      ["arabic", "ar"],
      ["french", "fr"],
      ["bengali", "bn"],
      ["portuguese", "pt"],
      ["russian", "ru"],
      ["indonesian", "id"],
      ["urdu", "ur"],
      ["german", "de"],
      ["japanese", "ja"],
      ["nigerian-pidgin", "pcm"],
      ["egyptian-arabic", "arz"],
      ["marathi", "mr"],
      ["vietnamese", "vi"],
      ["telugu", "te"],
      ["hausa", "ha"],
      ["turkish", "tr"],
      ["western-punjabi", "pnb"],
      ["swahili", "sw"],
      ["tagalog", "tl"],
      ["tamil", "ta"],
      ["cantonese", "yue"],
      ["wu", "wuu"],
      ["persian", "fa"],
      ["korean", "ko"],
      ["thai", "th"],
      ["javanese", "jv"],
      ["italian", "it"],
      ["gujarati", "gu"],
      ["levantine-arabic", "apc"],
      ["amharic", "am"],
      ["kannada", "kn"],
      ["bhojpuri", "bho"],
      ["sudanese-arabic", "apd"],
      ["yoruba", "yo"],
      ["jinyu", "cjy"],
      ["min-nan", "nan"],
      ["polish", "pl"],
      ["burmese", "my"],
      ["algerian-arabic", "arq"],
      ["hakka", "hak"],
      ["lingala", "ln"],
      ["moroccan-arabic", "ary"],
      ["odia", "or"],
      ["ukrainian", "uk"],
      ["xiang", "hsn"],
      ["malayalam", "ml"],
      ["sindhi", "sd"],
      ["eastern-punjabi", "pa"],
      ["sundanese", "su"],
      ["igbo", "ig"],
      ["dari", "prs"],
      ["nepali", "ne"],
      ["malay", "ms"],
      ["uzbek", "uz"],
      ["zulu", "zu"],
      ["saidi-arabic", "aec"],
      ["northern-pashto", "pbu"],
      ["oromo", "om"],
      ["saraiki", "skr"],
      ["dutch", "nl"],
      ["somali", "so"],
      ["romanian", "ro"],
      ["assamese", "as"],
      ["gan", "gan"],
      ["southern-pashto", "pbt"],
      ["cebuano", "ceb"],
      ["kazakh", "kk"],
      ["magahi", "mag"],
      ["najdi-arabic", "ars"],
      ["sinhala", "si"],
      ["mesopotamian-arabic", "acm"],
      ["xhosa", "xh"],
      ["khmer", "km"],
      ["afrikaans", "af"],
      ["fulfulde", "fuv"],
      ["maithili", "mai"],
      ["wolof", "wo"],
      ["northern-kurdish", "kmr"],
      ["chhattisgarhi", "hne"],
      ["kinyarwanda", "rw"],
      ["isan", "tts"],
      ["chichewa", "ny"],
      ["bamanankan", "bm"],
      ["shona", "sn"],
      ["south-azerbaijani", "azb"],
      ["setswana", "tn"],
      ["northern-sotho", "nso"],
      ["bavarian", "bar"],
      ["haitian-creole", "ht"],
      ["uyghur", "ug"],
      ["southern-sotho", "st"],
      ["greek", "el"],
      ["swedish", "sv"],
      ["chittagonian", "ctg"],
      ["kirundi", "rn"],
      ["jula", "dyu"],
    ];

    this.assertEqual(languages.length, 100, "Should cover the Ethnologue top 100");

    languages.forEach(([token, code]) => {
      this.assertEqual(
        this.fileParser.detectLanguage(`locales/${token}/messages.json`),
        code,
        `Should detect ${token} as ${code}`
      );
      this.assertTrue(
        locale.fileMatchesLocalePattern(
          "locales/#locale/messages.json",
          `/project/locales/${token}/messages.json`
        ),
        `Should discover #locale directory ${token}`
      );
    });

    this.assertEqual(
      locale.canonicalizeLanguageCode("cmn-CN"),
      "zh-CN",
      "Should fold Mandarin cmn onto zh"
    );
    this.assertEqual(
      this.fileParser.detectLanguage("locales/yue-HK/messages.json"),
      "yue-HK",
      "Should keep Cantonese distinct from Mandarin"
    );
    this.assertEqual(
      this.fileParser.detectLanguage("locales/src/messages.json"),
      "en",
      "Should ignore a three-letter directory that is not a language"
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

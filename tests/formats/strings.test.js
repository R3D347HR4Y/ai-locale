const { BaseFormatTest } = require("../test-runner");

class StringsFormatTest extends BaseFormatTest {
  async testParsing() {
    const content = this.loadFixture("strings/en.strings");
    const parsed = this.fileParser.parseStringsFile(content);

    this.assertEqual(Object.keys(parsed).length, 8, "Should parse 8 keys");
    this.assertEqual(
      parsed.app_name,
      "My App",
      "Should parse app_name correctly"
    );
    this.assertEqual(
      parsed.hello_user,
      "Hello %1$s!",
      "Should parse placeholders correctly"
    );
  }

  async testGeneration() {
    const keys = {
      test_key: "Test value",
      special_chars: "Price: €25.50 & Tax: 20%",
      quoted_text: 'She said "Hello world!"',
    };

    const generated = this.fileParser.generateStringsContent(keys);

    this.assertContains(
      generated,
      '"test_key" = "Test value";',
      "Should generate correct string format"
    );
    this.assertContains(
      generated,
      '"special_chars" = "Price: €25.50 & Tax: 20%";',
      "Should handle special characters"
    );
    this.assertContains(
      generated,
      '"quoted_text" = "She said \\"Hello world!\\"";',
      "Should escape quotes"
    );
    this.assertContains(generated, "/*", "Should include comment header");
  }

  async testLanguageDetection() {
    const enPath = "./tests/fixtures/strings/en.strings";
    const frPath = "./tests/fixtures/strings/fr.strings";

    const enLang = this.fileParser.detectLanguage(enPath);
    const frLang = this.fileParser.detectLanguage(frPath);

    this.assertEqual(enLang, "en", "Should detect English language");
    this.assertEqual(frLang, "fr", "Should detect French language");
  }

  async testMissingKeysDetection() {
    const enContent = this.loadFixture("strings/en.strings");
    const frContent = this.loadFixture("strings/fr-partial.strings");

    const enParsed = this.fileParser.parseStringsFile(enContent);
    const frParsed = this.fileParser.parseStringsFile(frContent);

    const enKeys = Object.keys(enParsed);
    const frKeys = Object.keys(frParsed);

    const missingKeys = enKeys.filter((key) => !frKeys.includes(key));

    this.assertEqual(missingKeys.length, 5, "Should detect 5 missing keys");
    this.assertTrue(
      missingKeys.includes("price_format"),
      "Should detect price_format as missing"
    );
    this.assertTrue(
      missingKeys.includes("terms_text"),
      "Should detect terms_text as missing"
    );
  }

  async testCommentsHandling() {
    const content = this.loadFixture("strings/en.strings");
    const parsed = this.fileParser.parseStringsFile(content);

    this.assertEqual(
      parsed.app_name,
      "My App",
      "Should ignore comments and parse keys"
    );
  }

  async testSpecialCharacters() {
    const content = this.loadFixture("strings/en.strings");
    const parsed = this.fileParser.parseStringsFile(content);

    this.assertEqual(
      parsed.special_chars,
      "Price: €25.50 & Tax: 20%",
      "Should handle special characters"
    );
    this.assertEqual(
      parsed.quoted_text,
      'She said "Hello world!"',
      "Should handle quoted text"
    );
    this.assertEqual(
      parsed.multiline_text,
      "Line 1\nLine 2\nLine 3",
      "Should handle multiline text"
    );
  }

  async testEscaping() {
    const keys = {
      test_quotes: 'She said "Hello!"',
      test_newlines: "Line 1\nLine 2",
      test_backslashes: "Path: C:\\Users\\Test",
    };

    const generated = this.fileParser.generateStringsContent(keys);

    this.assertContains(generated, '\\"Hello!\\"', "Should escape quotes");
    this.assertContains(generated, "\\n", "Should escape newlines");
    this.assertContains(generated, "\\\\", "Should escape backslashes");
  }
}

module.exports = StringsFormatTest;

const { BaseFormatTest } = require("../test-runner");

class JSONFormatTest extends BaseFormatTest {
  async testParsing() {
    const content = this.loadFixture("json/en.json");
    const parsed = this.fileParser.parseJSONFile(content);

    this.assertEqual(Object.keys(parsed).length, 9, "Should parse 9 keys");
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
    this.assertEqual(
      parsed["nested.deep.key"],
      "Nested value",
      "Should flatten nested objects"
    );
  }

  async testGeneration() {
    const keys = {
      test_key: "Test value",
      special_chars: "Price: €25.50 & Tax: 20%",
      "nested.key": "Nested value",
    };

    const generated = this.fileParser.generateJSONContent(keys);
    const parsed = JSON.parse(generated);

    this.assertEqual(
      parsed.test_key,
      "Test value",
      "Should generate correct key-value pairs"
    );
    this.assertEqual(
      parsed.special_chars,
      "Price: €25.50 & Tax: 20%",
      "Should handle special characters"
    );
    this.assertEqual(
      parsed.nested.key,
      "Nested value",
      "Should unflatten nested keys"
    );
  }

  async testLanguageDetection() {
    const enPath = "./tests/fixtures/json/en.json";
    const frPath = "./tests/fixtures/json/fr.json";

    const enLang = this.fileParser.detectLanguage(enPath);
    const frLang = this.fileParser.detectLanguage(frPath);

    this.assertEqual(enLang, "en", "Should detect English language");
    this.assertEqual(frLang, "fr", "Should detect French language");
  }

  async testMissingKeysDetection() {
    const enContent = this.loadFixture("json/en.json");
    const frContent = this.loadFixture("json/fr-partial.json");

    const enParsed = this.fileParser.parseJSONFile(enContent);
    const frParsed = this.fileParser.parseJSONFile(frContent);

    const enKeys = Object.keys(enParsed);
    const frKeys = Object.keys(frParsed);

    const missingKeys = enKeys.filter((key) => !frKeys.includes(key));

    this.assertEqual(missingKeys.length, 6, "Should detect 6 missing keys");
    this.assertTrue(
      missingKeys.includes("price_format"),
      "Should detect price_format as missing"
    );
    this.assertTrue(
      missingKeys.includes("terms_text"),
      "Should detect terms_text as missing"
    );
  }

  async testSpecialCharacters() {
    const content = this.loadFixture("json/en.json");
    const parsed = this.fileParser.parseJSONFile(content);

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
}

module.exports = JSONFormatTest;

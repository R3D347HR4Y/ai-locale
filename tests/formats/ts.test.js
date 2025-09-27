const { BaseFormatTest } = require("../test-runner");

class TypeScriptFormatTest extends BaseFormatTest {
  async testParsing() {
    const content = this.loadFixture("ts/en.ts");
    const parsed = this.fileParser.parseTSJSFile(content);

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

    const originalContent = this.loadFixture("ts/en.ts");
    const generated = this.fileParser.generateTSJSContent(
      keys,
      originalContent
    );

    this.assertContains(
      generated,
      "export default",
      "Should include export default"
    );
    this.assertContains(generated, "as const", "Should include as const");
    this.assertContains(
      generated,
      '"test_key": "Test value"',
      "Should generate correct key-value pairs"
    );
    this.assertContains(
      generated,
      '"nested": {',
      "Should unflatten nested keys"
    );
  }

  async testLanguageDetection() {
    const enPath = "./tests/fixtures/ts/en.ts";
    const frPath = "./tests/fixtures/ts/fr.ts";

    const enLang = this.fileParser.detectLanguage(enPath);
    const frLang = this.fileParser.detectLanguage(frPath);

    this.assertEqual(enLang, "en", "Should detect English language");
    this.assertEqual(frLang, "fr", "Should detect French language");
  }

  async testMissingKeysDetection() {
    const enContent = this.loadFixture("ts/en.ts");
    const frContent = this.loadFixture("ts/fr-partial.ts");

    const enParsed = this.fileParser.parseTSJSFile(enContent);
    const frParsed = this.fileParser.parseTSJSFile(frContent);

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

  async testTypeScriptSyntax() {
    const content = this.loadFixture("ts/en.ts");
    const parsed = this.fileParser.parseTSJSFile(content);

    this.assertEqual(
      parsed.app_name,
      "My App",
      "Should handle TypeScript syntax"
    );
    this.assertEqual(
      parsed["nested.deep.key"],
      "Nested value",
      "Should handle nested objects"
    );
  }

  async testSpecialCharacters() {
    const content = this.loadFixture("ts/en.ts");
    const parsed = this.fileParser.parseTSJSFile(content);

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

module.exports = TypeScriptFormatTest;

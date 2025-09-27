const { BaseFormatTest } = require("../test-runner");

/**
 * Example test for a new i18n format (YAML)
 *
 * This demonstrates how contributors can create tests for new file formats.
 * To implement a new format:
 *
 * 1. Add parsing/generation functions to fileParser.js
 * 2. Create test fixtures in tests/fixtures/[format-name]/
 * 3. Create a test file like this one
 * 4. Run tests with: node tests/test-runner.js
 */

class YAMLFormatTest extends BaseFormatTest {
  async testParsing() {
    // Create a test fixture
    const yamlContent = `
app_name: "My App"
welcome_message: "Welcome to our app!"
hello_user: "Hello %1$s!"
nested:
  deep:
    key: "Nested value"
`;

    const fixturePath = this.writeFixture("yaml", "en.yaml", yamlContent);

    // Test parsing (this would need to be implemented in fileParser.js)
    // const parsed = this.fileParser.parseYAMLFile(yamlContent);

    // Example assertions (uncomment when YAML parsing is implemented):
    // this.assertEqual(Object.keys(parsed).length, 4, 'Should parse 4 keys');
    // this.assertEqual(parsed.app_name, 'My App', 'Should parse app_name correctly');
    // this.assertEqual(parsed.nested.deep.key, 'Nested value', 'Should flatten nested objects');

    console.log("YAML parsing test - requires implementation in fileParser.js");
  }

  async testGeneration() {
    const keys = {
      test_key: "Test value",
      special_chars: "Price: €25.50 & Tax: 20%",
      "nested.key": "Nested value",
    };

    // Test generation (this would need to be implemented in fileParser.js)
    // const generated = this.fileParser.generateYAMLContent(keys);

    // Example assertions (uncomment when YAML generation is implemented):
    // this.assertContains(generated, 'test_key: "Test value"', 'Should generate correct YAML format');
    // this.assertContains(generated, 'nested:', 'Should unflatten nested keys');

    console.log(
      "YAML generation test - requires implementation in fileParser.js"
    );
  }

  async testLanguageDetection() {
    const enPath = "./tests/fixtures/yaml/en.yaml";
    const frPath = "./tests/fixtures/yaml/fr.yaml";

    // Test language detection
    const enLang = this.fileParser.detectLanguage(enPath);
    const frLang = this.fileParser.detectLanguage(frPath);

    this.assertEqual(enLang, "en", "Should detect English language");
    this.assertEqual(frLang, "fr", "Should detect French language");
  }

  async testMissingKeysDetection() {
    // Create test fixtures
    const enContent = `
app_name: "My App"
welcome_message: "Welcome to our app!"
hello_user: "Hello %1$s!"
price_format: "Price: %1$s%2$s"
`;

    const frContent = `
app_name: "Mon App"
welcome_message: "Bienvenue dans notre app !"
hello_user: "Bonjour %1$s !"
`;

    this.writeFixture("yaml", "en.yaml", enContent);
    this.writeFixture("yaml", "fr-partial.yaml", frContent);

    // Test missing keys detection (this would need to be implemented in fileParser.js)
    // const enParsed = this.fileParser.parseYAMLFile(enContent);
    // const frParsed = this.fileParser.parseYAMLFile(frContent);

    // const enKeys = Object.keys(enParsed);
    // const frKeys = Object.keys(frParsed);
    // const missingKeys = enKeys.filter(key => !frKeys.includes(key));

    // this.assertEqual(missingKeys.length, 1, 'Should detect 1 missing key');
    // this.assertTrue(missingKeys.includes('price_format'), 'Should detect price_format as missing');

    console.log(
      "YAML missing keys test - requires implementation in fileParser.js"
    );
  }

  async testSpecialCharacters() {
    const yamlContent = `
special_chars: "Price: €25.50 & Tax: 20%"
quoted_text: "She said \"Hello world!\""
multiline_text: "Line 1\nLine 2\nLine 3"
`;

    this.writeFixture("yaml", "special.yaml", yamlContent);

    // Test special characters (this would need to be implemented in fileParser.js)
    // const parsed = this.fileParser.parseYAMLFile(yamlContent);

    // this.assertEqual(parsed.special_chars, 'Price: €25.50 & Tax: 20%', 'Should handle special characters');
    // this.assertEqual(parsed.quoted_text, 'She said "Hello world!"', 'Should handle quoted text');
    // this.assertEqual(parsed.multiline_text, 'Line 1\nLine 2\nLine 3', 'Should handle multiline text');

    console.log(
      "YAML special characters test - requires implementation in fileParser.js"
    );
  }

  async testYAMLSyntax() {
    // Test YAML-specific syntax like comments, anchors, etc.
    const yamlContent = `
# This is a comment
app_name: &app_name "My App"
welcome_message: "Welcome to our app!"
display_name: *app_name
`;

    this.writeFixture("yaml", "syntax.yaml", yamlContent);

    console.log("YAML syntax test - requires implementation in fileParser.js");
  }
}

module.exports = YAMLFormatTest;

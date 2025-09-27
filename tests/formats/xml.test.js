const { BaseFormatTest } = require("../test-runner");

class XMLFormatTest extends BaseFormatTest {
  async testParsing() {
    const content = this.loadFixture("xml/en.xml");
    const parsed = this.fileParser.parseXMLFile(content);

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
      parsed.emoji_title,
      "💅 Beauty Services ✨",
      "Should handle emojis"
    );
  }

  async testGeneration() {
    const keys = {
      test_key: "Test value",
      special_chars: "Price: €25.50 & Tax: 20%",
      html_content: "<b>Bold</b> & <i>italic</i>",
    };

    const originalContent = this.loadFixture("xml/en.xml");
    const generated = this.fileParser.generateXMLContent(keys, originalContent);

    this.assertContains(
      generated,
      '<string name="test_key">Test value</string>',
      "Should generate correct string elements"
    );
    this.assertContains(generated, "&amp;", "Should escape ampersands");
    this.assertContains(
      generated,
      "&lt;b&gt;Bold&lt;/b&gt;",
      "Should escape HTML tags"
    );
    this.assertContains(
      generated,
      '<?xml version="1.0" encoding="utf-8"?>',
      "Should preserve XML header"
    );
    this.assertContains(
      generated,
      '<resources xmlns:tools="http://schemas.android.com/tools">',
      "Should preserve namespace"
    );
  }

  async testLanguageDetection() {
    const enPath = "./tests/fixtures/xml/en.xml";
    const frPath = "./tests/fixtures/xml/fr.xml";

    const enLang = this.fileParser.detectLanguage(enPath);
    const frLang = this.fileParser.detectLanguage(frPath);

    this.assertEqual(enLang, "en", "Should detect English language");
    this.assertEqual(frLang, "fr", "Should detect French language");
  }

  async testMissingKeysDetection() {
    const enContent = this.loadFixture("xml/en.xml");
    const frContent = this.loadFixture("xml/fr-partial.xml");

    const enParsed = this.fileParser.parseXMLFile(enContent);
    const frParsed = this.fileParser.parseXMLFile(frContent);

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

  async testCDATASections() {
    const content = this.loadFixture("xml/en.xml");
    const parsed = this.fileParser.parseXMLFile(content);

    this.assertContains(
      parsed.terms_text,
      "<b>Terms & Conditions</b>",
      "Should parse CDATA sections correctly"
    );
  }

  async testXMLEntities() {
    const content = this.loadFixture("xml/en.xml");
    const parsed = this.fileParser.parseXMLFile(content);

    this.assertEqual(
      parsed.special_chars,
      "Price: €25.50 & Tax: 20%",
      "Should decode XML entities"
    );
    this.assertEqual(
      parsed.quoted_text,
      'She said \\"Hello world!\\"',
      "Should handle quoted text"
    );
  }

  async testUnicodeHandling() {
    const content = this.loadFixture("xml/en.xml");
    const parsed = this.fileParser.parseXMLFile(content);

    this.assertEqual(
      parsed.emoji_title,
      "💅 Beauty Services ✨",
      "Should handle Unicode emojis"
    );
    this.assertEqual(
      parsed.multiline_text,
      "Line 1\\nLine 2\\nLine 3",
      "Should handle newlines"
    );
  }
}

module.exports = XMLFormatTest;

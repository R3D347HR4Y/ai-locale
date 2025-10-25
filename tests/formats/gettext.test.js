const { BaseFormatTest } = require("../test-runner");

class GettextFormatTest extends BaseFormatTest {
  async testParsing() {
    const content = this.loadFixture("gettext/en.po");
    const parsed = this.fileParser.parsePOFile(content);

    this.assertEqual(Object.keys(parsed).length, 5, "Should parse 5 keys");
    this.assertEqual(
      parsed.Welcome,
      "Welcome",
      "Should parse Welcome correctly"
    );
    this.assertEqual(
      parsed["Hello %(name)s"],
      "Hello %(name)s",
      "Should parse placeholders correctly"
    );
    this.assertEqual(
      parsed.Save,
      "Save",
      "Should parse Save correctly"
    );
    this.assertEqual(
      parsed.Cancel,
      "Cancel",
      "Should parse Cancel correctly"
    );
    this.assertEqual(
      parsed["Error occurred"],
      "Error occurred",
      "Should parse Error occurred correctly"
    );
  }

  async testGeneration() {
    const keys = {
      "Welcome": "Bienvenue",
      "Hello %(name)s": "Bonjour %(name)s",
      "Save": "Enregistrer",
      "Cancel": "Annuler",
      "Error occurred": "Une erreur s'est produite"
    };

    const generated = this.fileParser.generatePOContent(keys);

    this.assertContains(
      generated,
      'msgid "Welcome"',
      "Should generate correct msgid format"
    );
    this.assertContains(
      generated,
      'msgstr "Bienvenue"',
      "Should generate correct msgstr format"
    );
    this.assertContains(
      generated,
      'msgid "Hello %(name)s"',
      "Should handle placeholders in msgid"
    );
    this.assertContains(
      generated,
      'msgstr "Bonjour %(name)s"',
      "Should handle placeholders in msgstr"
    );
    this.assertContains(
      generated,
      'msgid "Save"',
      "Should generate Save msgid"
    );
    this.assertContains(
      generated,
      'msgstr "Enregistrer"',
      "Should generate Save msgstr"
    );
    this.assertContains(
      generated,
      'msgid "Cancel"',
      "Should generate Cancel msgid"
    );
    this.assertContains(
      generated,
      'msgstr "Annuler"',
      "Should generate Cancel msgstr"
    );
    this.assertContains(
      generated,
      'msgid "Error occurred"',
      "Should generate Error occurred msgid"
    );
    this.assertContains(
      generated,
      'msgstr "Une erreur s\'est produite"',
      "Should generate Error occurred msgstr with escaped quotes"
    );
    this.assertContains(
      generated,
      'msgid ""',
      "Should include header msgid"
    );
    this.assertContains(
      generated,
      'msgstr ""',
      "Should include header msgstr"
    );
  }

  async testLanguageDetection() {
    const enPath = "./tests/fixtures/gettext/en.po";
    const frPath = "./tests/fixtures/gettext/fr.po";
    
    const enLanguage = this.fileParser.detectLanguage(enPath);
    const frLanguage = this.fileParser.detectLanguage(frPath);

    this.assertEqual(enLanguage, "en", "Should detect English language");
    this.assertEqual(frLanguage, "fr", "Should detect French language");
  }

  async testRoundTrip() {
    const originalContent = this.loadFixture("gettext/en.po");
    const parsed = this.fileParser.parsePOFile(originalContent);
    const generated = this.fileParser.generatePOContent(parsed);
    const reparsed = this.fileParser.parsePOFile(generated);

    this.assertEqual(
      Object.keys(parsed).length,
      Object.keys(reparsed).length,
      "Round-trip should preserve key count"
    );

    // Check that all original keys are preserved
    for (const key in parsed) {
      this.assertHasProperty(
        reparsed,
        key,
        `Round-trip should preserve key: ${key}`
      );
      this.assertEqual(
        reparsed[key],
        parsed[key],
        `Round-trip should preserve value for key: ${key}`
      );
    }
  }

  async testSpecialCharacters() {
    const keys = {
      "Price: €25.50": "Prix : 25,50 €",
      "She said \"Hello\"": "Elle a dit \"Bonjour\"",
      "Line 1\nLine 2": "Ligne 1\nLigne 2",
      "Tab\tcharacter": "Caractère\ttabulation"
    };

    const generated = this.fileParser.generatePOContent(keys);

    this.assertContains(
      generated,
      'msgid "Price: €25.50"',
      "Should handle Euro symbol"
    );
    this.assertContains(
      generated,
      'msgstr "Prix : 25,50 €"',
      "Should handle Euro symbol in translation"
    );
    this.assertContains(
      generated,
      'msgid "She said \\"Hello\\""',
      "Should escape quotes in msgid"
    );
    this.assertContains(
      generated,
      'msgstr "Elle a dit \\"Bonjour\\""',
      "Should escape quotes in msgstr"
    );
    this.assertContains(
      generated,
      'msgid "Line 1\\nLine 2"',
      "Should escape newlines in msgid"
    );
    this.assertContains(
      generated,
      'msgstr "Ligne 1\\nLigne 2"',
      "Should escape newlines in msgstr"
    );
    this.assertContains(
      generated,
      'msgid "Tab\\tcharacter"',
      "Should escape tabs in msgid"
    );
    this.assertContains(
      generated,
      'msgstr "Caractère\\ttabulation"',
      "Should escape tabs in msgstr"
    );
  }

  async testEmptyValues() {
    const keys = {
      "Empty string": "",
      "Normal string": "Normal value",
      "Another empty": ""
    };

    const generated = this.fileParser.generatePOContent(keys);

    this.assertContains(
      generated,
      'msgid "Empty string"',
      "Should include empty string key"
    );
    this.assertContains(
      generated,
      'msgstr ""',
      "Should handle empty string value"
    );
    this.assertContains(
      generated,
      'msgid "Normal string"',
      "Should include normal string key"
    );
    this.assertContains(
      generated,
      'msgstr "Normal value"',
      "Should include normal string value"
    );
  }

  async testHeaderPreservation() {
    const originalContent = this.loadFixture("gettext/en.po");
    const parsed = this.fileParser.parsePOFile(originalContent);
    const generated = this.fileParser.generatePOContent(parsed, originalContent);

    // Check that header is preserved
    this.assertContains(
      generated,
      'msgid ""',
      "Should preserve header msgid"
    );
    this.assertContains(
      generated,
      'msgstr ""',
      "Should preserve header msgstr"
    );
    this.assertContains(
      generated,
      'Content-Type: text/plain; charset=UTF-8',
      "Should preserve Content-Type header"
    );
    this.assertContains(
      generated,
      'Content-Transfer-Encoding: 8bit',
      "Should preserve Content-Transfer-Encoding header"
    );
    this.assertContains(
      generated,
      'Language: en',
      "Should preserve Language header"
    );
    this.assertContains(
      generated,
      'Plural-Forms: nplurals=2; plural=(n != 1)',
      "Should preserve Plural-Forms header"
    );
  }

  async testMultiLineStrings() {
    const keys = {
      "Multi-line\nstring": "Chaîne\nmulti-ligne",
      "Another\nmulti\nline": "Autre\nchaîne\nmulti\nligne"
    };

    const generated = this.fileParser.generatePOContent(keys);

    this.assertContains(
      generated,
      'msgid "Multi-line\\nstring"',
      "Should handle multi-line msgid"
    );
    this.assertContains(
      generated,
      'msgstr "Chaîne\\nmulti-ligne"',
      "Should handle multi-line msgstr"
    );
    this.assertContains(
      generated,
      'msgid "Another\\nmulti\\nline"',
      "Should handle complex multi-line msgid"
    );
    this.assertContains(
      generated,
      'msgstr "Autre\\nchaîne\\nmulti\\nligne"',
      "Should handle complex multi-line msgstr"
    );
  }

  async testFileIntegration() {
    const testFile = {
      filePath: "./tests/fixtures/gettext/en.po",
      buffer: Buffer.from(this.loadFixture("gettext/en.po")),
      originalname: "en.po"
    };

    const parsed = await this.fileParser.parseFile(testFile);

    this.assertEqual(parsed.language, "en", "Should detect English language");
    this.assertEqual(parsed.type, "po", "Should detect .po file type");
    this.assertEqual(
      Object.keys(parsed.keys).length,
      5,
      "Should parse 5 keys from file"
    );
    this.assertEqual(
      parsed.filename,
      "en.po",
      "Should preserve filename"
    );
    this.assertEqual(
      parsed.filePath,
      "./tests/fixtures/gettext/en.po",
      "Should preserve file path"
    );
  }
}

module.exports = GettextFormatTest;

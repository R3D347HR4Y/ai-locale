# i18n Format Testing Suite

This testing suite allows contributors to easily test new i18n file formats by implementing test cases that verify parsing, generation, and validation.

## 🚀 Quick Start

Run all tests:

```bash
node tests/test-runner.js
```

Run a specific format test:

```bash
node tests/formats/json.test.js
```

## 📁 Structure

```
tests/
├── test-runner.js          # Main test runner and base classes
├── fixtures/               # Test data files
│   ├── json/              # JSON format fixtures
│   ├── xml/               # XML format fixtures
│   ├── ts/                # TypeScript format fixtures
│   ├── strings/           # iOS .strings format fixtures
│   └── yaml/              # Example YAML format fixtures
└── formats/               # Format-specific test files
    ├── json.test.js       # JSON format tests
    ├── xml.test.js        # XML format tests
    ├── ts.test.js         # TypeScript format tests
    ├── strings.test.js    # iOS .strings format tests
    └── yaml.test.js       # Example YAML format tests
```

## 🧪 Creating Tests for a New Format

### 1. Create Test Fixtures

Create a directory for your format in `tests/fixtures/[format-name]/`:

```bash
mkdir tests/fixtures/yaml
```

Add test files with different languages and completeness levels:

```yaml
# tests/fixtures/yaml/en.yaml
app_name: "My App"
welcome_message: "Welcome to our app!"
hello_user: "Hello %1$s!"

# tests/fixtures/yaml/fr.yaml
app_name: "Mon App"
welcome_message: "Bienvenue dans notre app !"
hello_user: "Bonjour %1$s !"

# tests/fixtures/yaml/fr-partial.yaml (incomplete)
app_name: "Mon App"
welcome_message: "Bienvenue dans notre app !"
```

### 2. Create Test File

Create `tests/formats/[format-name].test.js`:

```javascript
const { BaseFormatTest } = require("./test-runner");

class YAMLFormatTest extends BaseFormatTest {
  async testParsing() {
    const content = this.loadFixture("yaml/en.yaml");
    const parsed = this.fileParser.parseYAMLFile(content);

    this.assertEqual(Object.keys(parsed).length, 3, "Should parse 3 keys");
    this.assertEqual(
      parsed.app_name,
      "My App",
      "Should parse app_name correctly"
    );
  }

  async testGeneration() {
    const keys = { test_key: "Test value" };
    const generated = this.fileParser.generateYAMLContent(keys);

    this.assertContains(
      generated,
      'test_key: "Test value"',
      "Should generate correct YAML"
    );
  }

  async testLanguageDetection() {
    const enPath = "./tests/fixtures/yaml/en.yaml";
    const enLang = this.fileParser.detectLanguage(enPath);

    this.assertEqual(enLang, "en", "Should detect English language");
  }

  async testMissingKeysDetection() {
    const enContent = this.loadFixture("yaml/en.yaml");
    const frContent = this.loadFixture("yaml/fr-partial.yaml");

    const enParsed = this.fileParser.parseYAMLFile(enContent);
    const frParsed = this.fileParser.parseYAMLFile(frContent);

    const missingKeys = Object.keys(enParsed).filter((key) => !frParsed[key]);

    this.assertEqual(missingKeys.length, 1, "Should detect 1 missing key");
  }

  async testSpecialCharacters() {
    const content = this.loadFixture("yaml/en.yaml");
    const parsed = this.fileParser.parseYAMLFile(content);

    this.assertEqual(
      parsed.hello_user,
      "Hello %1$s!",
      "Should handle placeholders"
    );
  }
}

module.exports = YAMLFormatTest;
```

### 3. Implement Format Support

Add parsing and generation functions to `src/utils/fileParser.js`:

```javascript
/**
 * Parse YAML files
 */
function parseYAMLFile(content) {
  // Implementation here
}

/**
 * Generate YAML file content
 */
function generateYAMLContent(keys, originalContent = "") {
  // Implementation here
}

// Add to switch statement
case ".yaml":
case ".yml":
  keys = parseYAMLFile(content);
  type = "yaml";
  break;

// Add to generateFileContent function
else if (type === "yaml") {
  return generateYAMLContent(keys, originalContent);
}

// Add to module exports
module.exports = {
  // ... existing exports
  parseYAMLFile,
  generateYAMLContent,
};
```

### 4. Update CLI Support

Add your format to supported extensions in `src/cli.js`:

```javascript
const supportedExtensions = [
  ".strings",
  ".xml",
  ".json",
  ".ts",
  ".js",
  ".yaml",
  ".yml",
];
```

## 🔧 Test Methods

### BaseFormatTest Methods

- `loadFixture(filename)` - Load a test fixture file
- `writeFixture(formatName, filename, content)` - Write a test fixture file
- `createFixtureStructure(formatName)` - Create fixture directory structure

### Assertion Methods

- `assertEqual(actual, expected, message)` - Assert two values are equal
- `assertTrue(value, message)` - Assert value is truthy
- `assertFalse(value, message)` - Assert value is falsy
- `assertHasProperty(obj, property, message)` - Assert object has property
- `assertLength(array, expectedLength, message)` - Assert array has specific length
- `assertContains(str, substring, message)` - Assert string contains substring

### Test Method Naming

Test methods should start with `test` and describe what they're testing:

- `testParsing()` - Test parsing functionality
- `testGeneration()` - Test content generation
- `testLanguageDetection()` - Test language detection
- `testMissingKeysDetection()` - Test missing key detection
- `testSpecialCharacters()` - Test special character handling
- `test[FormatName]Syntax()` - Test format-specific syntax

## 📊 Test Results

The test runner provides detailed results:

```
🧪 Running i18n Format Testing Suite

📁 Testing json format...
✅ json: 6/6 tests passed

📁 Testing xml format...
✅ xml: 7/7 tests passed

📁 Testing ts format...
✅ ts: 6/6 tests passed

📁 Testing strings format...
✅ strings: 7/7 tests passed

📁 Testing yaml format...
⚠️ yaml: 2/6 tests passed
   ❌ Parsing: YAML parsing test - requires implementation in fileParser.js
   ❌ Generation: YAML generation test - requires implementation in fileParser.js
   ❌ Missing Keys Detection: YAML missing keys test - requires implementation in fileParser.js
   ❌ Special Characters: YAML special characters test - requires implementation in fileParser.js

📊 Test Summary
================
Formats tested: 5
Total tests: 33
Passed: 28
Failed: 5
Success rate: 85%
```

## 🎯 Best Practices

1. **Comprehensive Coverage**: Test parsing, generation, language detection, missing keys, and special characters
2. **Realistic Fixtures**: Use realistic test data that represents actual usage
3. **Edge Cases**: Test edge cases like empty files, malformed content, special characters
4. **Clear Messages**: Use descriptive assertion messages that explain what went wrong
5. **Consistent Naming**: Follow the naming conventions for test methods and fixtures

## 🔍 Debugging Tests

If a test fails, the error message will show exactly what went wrong:

```
❌ Parsing: Should parse 3 keys. Expected: 3, Got: 2
```

This tells you that the parsing function returned 2 keys instead of the expected 3.

## 📝 Contributing

When adding a new format:

1. Create comprehensive test fixtures
2. Implement all test methods
3. Add format support to fileParser.js
4. Update CLI support
5. Run tests to ensure everything works
6. Update this README with your format

The testing suite will help ensure your new format implementation is robust and handles all the edge cases correctly!

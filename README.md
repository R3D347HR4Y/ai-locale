# ai-locale Translation CLI

A command-line tool for validating and translating localization files using OpenAI's API. Supports multiple file formats with intelligent path matching using the `#locale` placeholder.

## 🌍 Multilingual Documentation

- 🇺🇸 [English](README.md) (Original)
- 🇫🇷 [Français](README.fr.md)
- 🇪🇸 [Español](README.es.md)
- 🇨🇳 [中文](README.zh.md)

## 🎯 Supported File Formats

The CLI supports a wide range of localization file formats:

### 📱 **iOS .strings Files**

```strings
/* Localizable.strings */
"SAVE_BUTTON" = "Save";
"CANCEL_BUTTON" = "Cancel";
"ERROR_MESSAGE" = "An error occurred: {error}";
```

### 📄 **Android XML Strings**

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="save_button">Save</string>
    <string name="cancel_button">Cancel</string>
    <string name="error_message">An error occurred: %1$s</string>
</resources>
```

### 📦 **JSON Files**

```json
{
  "save_button": "Save",
  "cancel_button": "Cancel",
  "error_message": "An error occurred: {error}"
}
```

### 🔧 **TypeScript/JavaScript Export Objects**

```typescript
export default {
  save_button: "Save",
  cancel_button: "Cancel",
  error_message: "An error occurred: {error}",
} as const;
```

### 🌍 **GNU gettext .po Files**

```po
msgid "Welcome"
msgstr "Welcome"

msgid "Hello %(name)s"
msgstr "Hello %(name)s"

msgid "Save"
msgstr "Save"
```

## 🗂️ Path Matching with `#locale`

The CLI uses the `#locale` placeholder for intelligent file discovery and language detection:

### **How `#locale` Works**

The `#locale` placeholder is automatically replaced with detected language codes from your file structure:

```bash
# Pattern: locales/#locale/messages.json
# Matches: locales/en/messages.json, locales/fr/messages.json, locales/es/messages.json
# Detected languages: en, fr, es

ai-locale translate 'locales/#locale/messages.json'
```

### **Common `#locale` Patterns**

```bash
# iOS/Android structure
'locales/#locale/Localizable.strings'
'locales/#locale/strings.xml'

# JSON structure
'locales/#locale/messages.json'
'i18n/#locale/translations.json'

# TypeScript structure
'src/locales/#locale/index.ts'
'locales/#locale/translation.ts'

# GNU gettext structure
'locale/#locale/LC_MESSAGES/messages.po'
'locales/#locale/messages.po'

# Mixed formats
'locales/#locale/strings.xml'
'locales/#locale/messages.json'
'locales/#locale/messages.po'
```

### **Language Detection**

The CLI automatically detects languages from:

- **Directory names**: `locales/en/`, `locales/fr/`
- **File names**: `en.json`, `fr.json`, `en.ts`
- **File paths**: `locales/en/messages.json`

## Features

- ✅ **Multi-format Support**: Handles iOS `.strings`, Android XML, JSON, TypeScript/JavaScript, and GNU gettext `.po` files
- ✅ **Smart Path Matching**: Use `#locale` placeholder for intelligent file discovery
- ✅ **Missing Key Detection**: Automatically identifies missing translations across language files
- ✅ **AI-Powered Translation**: Uses OpenAI's GPT-4o-mini for high-quality translations
- ✅ **Cost Optimized**: Processes translations in parallel batches with cost estimation
- ✅ **Context-Aware**: Uses ALL existing translations as context for maximum accuracy
- ✅ **Interactive CLI**: Beautiful terminal interface with progress indicators
- ✅ **Backup Support**: Automatically creates backup files before translation
- ✅ **Dry Run Mode**: Preview translations without making changes
- ✅ **Batch Control**: Configurable batch size and delay for rate limit management

## Installation

### Global Installation

```bash
npm install -g ai-locale-cli
```

### Local Installation

```bash
git clone <repository-url>
cd ai-locale-worldwide
npm install
```

## Quick Start

### 1. Set up API Key

Create a `.env` file in your project root:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

Or use the `--api-key` option:

```bash
ai-locale translate "locales/*/translation.ts" --api-key sk-your-key
```

### 2. Translate Files

```bash
# Using #locale pattern (recommended)
ai-locale translate "locales/#locale/messages.json" --source en

# Specify target languages explicitly
ai-locale translate "locales/#locale/strings.xml" --source en --target fr,es,de

# Use traditional glob patterns
ai-locale translate "translations/**/*.strings" --source en --target fr,es

# Dry run to see what would be translated
ai-locale translate "locales/#locale/messages.json" --dry-run
```

### 3. Validate Files

```bash
# Check for missing translations using #locale pattern
ai-locale validate "locales/#locale/messages.json" --source en

# Traditional glob pattern
ai-locale validate "translations/**/*.strings" --source en
```

### 4. View Statistics

```bash
# Show translation completeness statistics
ai-locale stats "locales/#locale/messages.json"

# Traditional glob pattern
ai-locale stats "translations/**/*.strings"
```

## CLI Commands

### `translate` - Translate Missing Keys

Translates missing keys in localization files.

```bash
ai-locale translate <pattern> [options]
```

**Arguments:**

- `pattern` - File pattern (e.g., `locales/#locale/messages.json`, `translations/**/*.strings`)

**Options:**

- `-k, --api-key <key>` - OpenAI API key (or set OPENAI_API_KEY env var)
- `-s, --source <lang>` - Source language code (default: "en")
- `-t, --target <langs>` - Comma-separated target languages (auto-detected if not provided)
- `-o, --output <dir>` - Output directory (default: overwrite original files)
- `--dry-run` - Show what would be translated without making changes
- `--verbose` - Show detailed output
- `--no-backup` - Don't create backup files
- `--yes` - Skip confirmation prompt
- `--batch-size <size>` - Number of translations to process in parallel (default: 5)
- `--batch-delay <ms>` - Delay between batches in milliseconds (default: 1000)

**Examples:**

```bash
# Basic translation with #locale pattern
ai-locale translate "locales/#locale/messages.json"

# Specify source and target languages
ai-locale translate "locales/#locale/strings.xml" --source en --target fr,es,de,it

# Dry run to preview
ai-locale translate "locales/#locale/messages.json" --dry-run --verbose

# Save to different directory
ai-locale translate "locales/#locale/messages.json" --output ./translated/

# Use specific API key
ai-locale translate "locales/#locale/messages.json" --api-key sk-your-key

# Control batch processing
ai-locale translate "locales/#locale/messages.json" --batch-size 3 --batch-delay 2000
```

### `validate` - Validate Translation Files

Checks translation files for missing keys and consistency issues.

```bash
ai-locale validate <pattern> [options]
```

**Arguments:**

- `pattern` - File pattern to validate

**Options:**

- `-s, --source <lang>` - Source language code (default: "en")

**Examples:**

```bash
# Validate all translation files using #locale pattern
ai-locale validate "locales/#locale/messages.json"

# Validate with specific source language
ai-locale validate "locales/#locale/strings.xml" --source en

# Traditional glob pattern
ai-locale validate "translations/**/*.strings" --source en
```

### `stats` - Show Translation Statistics

Displays comprehensive statistics about translation files.

```bash
ai-locale stats <pattern>
```

**Arguments:**

- `pattern` - File pattern to analyze

**Examples:**

```bash
# Show statistics for all files using #locale pattern
ai-locale stats "locales/#locale/messages.json"

# Show statistics for specific pattern
ai-locale stats "locales/#locale/strings.xml"

# Traditional glob pattern
ai-locale stats "translations/**/*.strings"
```

### `purge` - Remove Obsolete Keys

Removes keys that don't exist in the source language file.

```bash
ai-locale purge <pattern> [options]
```

**Arguments:**

- `pattern` - File pattern to purge

**Options:**

- `-s, --source <lang>` - Source language code (default: "en")
- `--dry-run` - Show what would be purged without making changes
- `--verbose` - Show detailed output
- `--no-backup` - Don't create backup files

**Examples:**

```bash
# Remove keys not present in English using #locale pattern
ai-locale purge "locales/#locale/messages.json" --source en

# Dry run to preview what would be purged
ai-locale purge "locales/#locale/strings.xml" --dry-run --verbose

# Purge with French as source
ai-locale purge "locales/#locale/messages.json" --source fr

# Traditional glob pattern
ai-locale purge "translations/**/*.strings" --source en
```

## Glob Pattern Examples

The CLI supports powerful glob patterns for file discovery:

```bash
# All translation files in locales directory
"locales/#locale/messages.json"

# All .strings files recursively
"translations/**/*.strings"

# Specific language files
"src/locales/en.ts"
"src/locales/fr.ts"

# Multiple patterns
"locales/#locale/messages.json" "src/i18n/#locale/translations.json"

# Files with specific naming convention
"**/i18n/#locale/*.ts"
"**/locales/#locale/*.strings"

# Mixed formats with #locale
"locales/#locale/strings.xml"
"locales/#locale/messages.json"
```

## Supported Languages

The tool supports 20+ languages including:

- English (en)
- French (fr)
- Spanish (es)
- German (de)
- Italian (it)
- Portuguese (pt)
- Dutch (nl)
- Swedish (sv)
- Danish (da)
- Norwegian (no)
- Finnish (fi)
- Polish (pl)
- Russian (ru)
- Japanese (ja)
- Korean (ko)
- Chinese (zh)
- Arabic (ar)
- Hindi (hi)
- Turkish (tr)
- Thai (th)

## Translation Context & Accuracy

The CLI provides maximum context to OpenAI for the most accurate translations:

### **Smart Context Detection**

- **All Existing Translations**: If a key exists in English and French, both are included in the prompt
- **Source Language Priority**: Uses the specified source language as the primary reference
- **Complete Context**: Provides all available translations for each key to ensure consistency

### **Example Translation Context**

```
Key: "common.save"
Existing translations:
- en: "Save"
- fr: "Enregistrer"
- es: "Guardar"

Missing in: de, it

AI receives: "Translate 'Save' to German and Italian, considering existing translations in French and Spanish for context"
```

## Cost Optimization

The CLI is optimized for cost and speed:

- **Parallel Processing**: Translates multiple keys simultaneously using `Promise.all`
- **Configurable Batching**: Control batch size and delay with `--batch-size` and `--batch-delay` options
- **Cost Estimation**: Shows estimated costs before processing
- **Efficient Model**: Uses GPT-4o-mini for optimal cost/quality ratio
- **Context Optimization**: Uses ALL existing translations as context for maximum accuracy
- **Rate Limit Management**: Built-in delays and batch processing to respect API limits

### Batch Control Examples

```bash
# Conservative approach (smaller batches, longer delays)
ai-locale translate "locales/#locale/messages.json" --batch-size 2 --batch-delay 2000

# Aggressive approach (larger batches, shorter delays)
ai-locale translate "locales/#locale/messages.json" --batch-size 10 --batch-delay 500

# Default settings (balanced)
ai-locale translate "locales/#locale/messages.json" --batch-size 5 --batch-delay 1000
```

### Cost Estimation Example

For 100 missing keys across 3 languages:

- Estimated cost: ~$0.15 USD
- Processing time: ~2-3 minutes
- Tokens used: ~25,000 input + 5,000 output

## Development

### Local Development

```bash
# Install dependencies
npm install

# Run CLI locally
node src/cli.js translate "examples/*.ts"

# Development with auto-reload
npm run dev translate "examples/*.ts"

# Run tests
npm test
```

### Building Executable

```bash
# Build standalone executable
npm run build

# The executable will be in dist/ directory
./dist/ai-locale-cli translate "locales/*/translation.ts"
```

### Environment Variables

| Variable         | Description    | Default     |
| ---------------- | -------------- | ----------- |
| `OPENAI_API_KEY` | OpenAI API key | Required    |
| `NODE_ENV`       | Environment    | development |

### Project Structure

```
src/
├── cli.js                    # Main CLI entry point
├── services/
│   ├── openaiService.js      # OpenAI integration
│   └── translationService.js # Translation logic
└── utils/
    ├── fileParser.js         # File parsing utilities
    └── validation.js         # Request validation
```

## Usage Examples

### Example 1: Basic Translation

```bash
# Project structure:
# locales/
#   ├── en/
#   │   └── messages.json
#   ├── fr/
#   │   └── messages.json (missing some keys)
#   └── es/
#       └── messages.json (missing some keys)

ai-locale translate "locales/#locale/messages.json" --source en
```

### Example 2: iOS Strings Files

```bash
# Project structure:
# translations/
#   ├── en/
#   │   └── Localizable.strings
#   ├── fr/
#   │   └── Localizable.strings
#   └── es/
#       └── Localizable.strings

ai-locale translate "translations/#locale/Localizable.strings" --source en
```

### Example 3: Android XML Files

```bash
# Project structure:
# locales/
#   ├── en/
#   │   └── strings.xml
#   ├── fr/
#   │   └── strings.xml
#   └── es/
#       └── strings.xml

ai-locale translate "locales/#locale/strings.xml" --source en
```

### Example 4: GNU gettext .po Files

```bash
# Project structure:
# locale/
#   ├── en/
#   │   └── LC_MESSAGES/
#   │       └── messages.po
#   ├── fr/
#   │   └── LC_MESSAGES/
#   │       └── messages.po
#   └── es/
#       └── LC_MESSAGES/
#           └── messages.po

ai-locale translate "locale/#locale/LC_MESSAGES/messages.po" --source en
```

### Example 5: Validation and Statistics

```bash
# Check what's missing
ai-locale validate "locales/#locale/messages.json" --source en

# Show statistics
ai-locale stats "locales/#locale/messages.json"

# Preview translation (dry run)
ai-locale translate "locales/#locale/messages.json" --dry-run --verbose
```

### Example 6: Purging Obsolete Keys

```bash
# Remove keys not present in English
ai-locale purge "locales/#locale/messages.json" --source en

# Preview what would be purged
ai-locale purge "translations/#locale/Localizable.strings" --dry-run --verbose

# Purge with French as source
ai-locale purge "locales/#locale/messages.json" --source fr
```

## Error Handling

The CLI provides comprehensive error handling:

- **File Not Found**: Clear error messages for invalid patterns
- **API Errors**: Graceful handling of OpenAI API failures
- **Parsing Errors**: Detailed error information for file issues
- **Validation Errors**: Clear messages for invalid requests

## Troubleshooting

### Common Issues

1. **OpenAI API Key Invalid**

   ```
   Error: OpenAI API key is required
   ```

   Solution: Set `OPENAI_API_KEY` environment variable or use `--api-key` option

2. **No Files Found**

   ```
   Error: No translation files found matching pattern
   ```

   Solution: Check your glob pattern and file structure

3. **File Parsing Errors**

   ```
   Error: Failed to parse file en.ts
   ```

   Solution: Check file format and syntax

4. **Permission Errors**

   ```
   Error: EACCES: permission denied
   ```

   Solution: Check file permissions or run with appropriate privileges

### Debug Mode

Enable verbose output for debugging:

```bash
ai-locale translate "locales/*.ts" --verbose
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review the logs
3. Create an issue with detailed information
4. Include file examples and error messages

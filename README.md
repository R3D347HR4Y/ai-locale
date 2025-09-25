# ai-locale Translation CLI

A command-line tool for validating and translating localization files using OpenAI's API. Supports iOS `.strings` files and TypeScript/JavaScript export objects with glob pattern matching.

## Features

- ✅ **Multi-format Support**: Handles iOS `.strings` files and TypeScript/JavaScript export objects
- ✅ **Glob Pattern Matching**: Use patterns like `locales/*/translation.ts` or `translations/**/*.strings`
- ✅ **Missing Key Detection**: Automatically identifies missing translations across language files
- ✅ **AI-Powered Translation**: Uses OpenAI's GPT-4o-mini for high-quality translations
- ✅ **Cost Optimized**: Processes translations in parallel batches with cost estimation
- ✅ **Context-Aware**: Uses ALL existing translations as context for maximum accuracy
- ✅ **Interactive CLI**: Beautiful terminal interface with progress indicators
- ✅ **Backup Support**: Automatically creates backup files before translation
- ✅ **Dry Run Mode**: Preview translations without making changes

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
# Translate missing keys in all translation files
ai-locale translate "locales/*/translation.ts" --source en --target fr,es,de

# Use glob patterns for different file structures
ai-locale translate "translations/**/*.strings" --source en --target fr,es

# Dry run to see what would be translated
ai-locale translate "locales/*/translation.ts" --dry-run
```

### 3. Validate Files

```bash
# Check for missing translations
ai-locale validate "locales/*/translation.ts" --source en
```

### 4. View Statistics

```bash
# Show translation completeness statistics
ai-locale stats "locales/*/translation.ts"
```

## CLI Commands

### `translate` - Translate Missing Keys

Translates missing keys in localization files.

```bash
ai-locale translate <pattern> [options]
```

**Arguments:**

- `pattern` - File pattern (e.g., `locales/*/translation.ts`, `translations/**/*.strings`)

**Options:**

- `-k, --api-key <key>` - OpenAI API key (or set OPENAI_API_KEY env var)
- `-s, --source <lang>` - Source language code (default: "en")
- `-t, --target <langs>` - Comma-separated target languages (default: "fr,es,de")
- `-o, --output <dir>` - Output directory (default: overwrite original files)
- `--dry-run` - Show what would be translated without making changes
- `--verbose` - Show detailed output
- `--no-backup` - Don't create backup files

**Examples:**

```bash
# Basic translation
ai-locale translate "locales/*/translation.ts"

# Specify source and target languages
ai-locale translate "translations/**/*.strings" --source en --target fr,es,de,it

# Dry run to preview
ai-locale translate "locales/*/translation.ts" --dry-run --verbose

# Save to different directory
ai-locale translate "locales/*/translation.ts" --output ./translated/

# Use specific API key
ai-locale translate "locales/*/translation.ts" --api-key sk-your-key
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
# Validate all translation files
ai-locale validate "locales/*/translation.ts"

# Validate with specific source language
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
# Show statistics for all files
ai-locale stats "locales/*/translation.ts"

# Show statistics for specific pattern
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
# Remove keys not present in English
ai-locale purge "locales/*/translation.ts" --source en

# Dry run to preview what would be purged
ai-locale purge "translations/**/*.strings" --dry-run --verbose

# Purge with specific source language
ai-locale purge "locales/*/translation.ts" --source fr
```

## Supported File Formats

### iOS .strings Files

```strings
/*
  Localizable.strings
  ai-locale
*/

"SAVE_BUTTON" = "Save";
"CANCEL_BUTTON" = "Cancel";
"ERROR_MESSAGE" = "An error occurred: {error}";
```

### TypeScript/JavaScript Export Objects

```typescript
export default {
  common: {
    save: "Save",
    cancel: "Cancel",
    error: {
      message: "An error occurred: {error}",
    },
  },
  navigation: {
    home: "Home",
    profile: "Profile",
  },
} as const;
```

## Glob Pattern Examples

The CLI supports powerful glob patterns for file discovery:

```bash
# All translation files in locales directory
"locales/*/translation.ts"

# All .strings files recursively
"translations/**/*.strings"

# Specific language files
"src/locales/en.ts"
"src/locales/fr.ts"

# Multiple patterns
"locales/*/translation.ts" "src/i18n/*.json"

# Files with specific naming convention
"**/i18n/*.ts"
"**/locales/*.strings"
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
- **Batch Processing**: Processes translations in batches of 5 to respect rate limits
- **Cost Estimation**: Shows estimated costs before processing
- **Efficient Model**: Uses GPT-4o-mini for optimal cost/quality ratio
- **Context Optimization**: Uses ALL existing translations as context for maximum accuracy

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
#   ├── en.ts
#   ├── fr.ts (missing some keys)
#   └── es.ts (missing some keys)

ai-locale translate "locales/*.ts" --source en --target fr,es
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

ai-locale translate "translations/*/Localizable.strings" --source en --target fr,es
```

### Example 3: Validation and Statistics

```bash
# Check what's missing
ai-locale validate "locales/*.ts" --source en

# Show statistics
ai-locale stats "locales/*.ts"

# Preview translation (dry run)
ai-locale translate "locales/*.ts" --dry-run --verbose
```

### Example 4: Purging Obsolete Keys

```bash
# Remove keys not present in English
ai-locale purge "locales/*.ts" --source en

# Preview what would be purged
ai-locale purge "translations/**/*.strings" --dry-run --verbose

# Purge with French as source
ai-locale purge "locales/*.ts" --source fr
```

### Example 5: Docker Usage

```bash
# Run with Docker
docker run -v $(pwd):/workspace -w /workspace \
  -e OPENAI_API_KEY=your-key \
  ai-locale translate "locales/*.ts" --source en --target fr,es
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

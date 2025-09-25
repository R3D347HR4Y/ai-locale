# CLI Usage Examples

## Basic Translation

```bash
# Translate missing keys in TypeScript files
ai-locale translate "examples/*.ts" --source en --target fr,es

# Translate iOS .strings files
ai-locale translate "examples/*.strings" --source en --target fr,es,de
```

## Validation

```bash
# Check for missing translations
ai-locale validate "examples/*.ts" --source en

# Validate with verbose output
ai-locale validate "examples/*.strings" --source en --verbose
```

## Statistics

```bash
# Show translation completeness
ai-locale stats "examples/*.ts"

# Show statistics for .strings files
ai-locale stats "examples/*.strings"
```

## Purging Obsolete Keys

```bash
# Remove keys not present in English
ai-locale purge "examples/*.ts" --source en

# Preview what would be purged
ai-locale purge "examples/*.strings" --dry-run --verbose

# Purge with French as source
ai-locale purge "examples/*.ts" --source fr
```

## Dry Run

```bash
# Preview what would be translated
ai-locale translate "examples/*.ts" --dry-run --verbose
```

## Docker Usage

```bash
# Run with Docker
docker run -v $(pwd):/workspace -w /workspace \
  -e OPENAI_API_KEY=your-key \
  ai-locale translate "examples/*.ts" --source en --target fr,es
```

## Advanced Patterns

```bash
# Recursive pattern matching
ai-locale translate "**/locales/*.ts"

# Multiple file types
ai-locale translate "locales/*.{ts,strings}"

# Specific directory structure
ai-locale translate "src/i18n/*/translation.ts"
```

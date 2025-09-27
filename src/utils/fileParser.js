const fs = require("fs");
const path = require("path");

/**
 * Parse iOS .strings files
 * @param {string} content - File content
 * @returns {Object} Parsed keys and values
 */
function parseStringsFile(content) {
  const keys = {};
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines, comments, and header comments
    if (
      !line ||
      line.startsWith("/*") ||
      line.startsWith("//") ||
      line.startsWith("*")
    ) {
      continue;
    }

    // Match key = "value"; pattern
    const match = line.match(/^"([^"]+)"\s*=\s*"([^"]*(?:\\.[^"]*)*)"\s*;?$/);
    if (match) {
      const [, key, value] = match;
      // Unescape common escape sequences
      const unescapedValue = value
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
      keys[key] = unescapedValue;
    }
  }

  return keys;
}

/**
 * Parse Android XML strings files
 * @param {string} content - File content
 * @returns {Object} Parsed keys and values
 */
function parseXMLFile(content) {
  const keys = {};

  // Regular expression to match <string name="key">value</string> patterns
  const stringRegex = /<string\s+name="([^"]+)"[^>]*>(.*?)<\/string>/gs;

  let match;
  while ((match = stringRegex.exec(content)) !== null) {
    const [, key, value] = match;

    // Clean up the value - remove leading/trailing whitespace and handle XML entities
    let cleanValue = value.trim();

    // Handle common XML entities
    cleanValue = cleanValue
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )
      .replace(/&#(\d+);/g, (match, dec) =>
        String.fromCharCode(parseInt(dec, 10))
      );

    // Handle escaped Unicode sequences like \u00A0
    cleanValue = cleanValue.replace(/\\u([0-9A-Fa-f]{4})/g, (match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

    keys[key] = cleanValue;
  }

  return keys;
}

/**
 * Parse JSON files
 * @param {string} content - File content
 * @returns {Object} Parsed keys and values
 */
function parseJSONFile(content) {
  try {
    // Parse JSON directly
    const parsedObject = JSON.parse(content);

    // Flatten nested objects into dot notation
    return flattenObject(parsedObject);
  } catch (error) {
    throw new Error(`Failed to parse JSON file: ${error.message}`);
  }
}

/**
 * Parse TypeScript/JavaScript export files
 * @param {string} content - File content
 * @returns {Object} Parsed keys and values
 */
function parseTSJSFile(content) {
  try {
    // Remove export default and any trailing semicolons/TypeScript syntax
    let cleanedContent = content
      .replace(/^export\s+default\s+/, "")
      .replace(/;\s*$/, "")
      .replace(/\s+as\s+const\s*;?\s*$/m, ""); // Remove "as const" syntax (multiline)

    // Handle multiline strings and complex objects
    // Remove comments (both // and /* */ style)
    cleanedContent = cleanedContent
      .replace(/\/\*[\s\S]*?\*\//g, "") // Remove /* */ comments
      .replace(/\/\/.*$/gm, ""); // Remove // comments

    // Clean up any remaining TypeScript-specific syntax
    cleanedContent = cleanedContent
      .replace(/:\s*string\s*[;,]/g, ":") // Remove : string type annotations
      .replace(/:\s*number\s*[;,]/g, ":") // Remove : number type annotations
      .replace(/:\s*boolean\s*[;,]/g, ":") // Remove : boolean type annotations
      .replace(/\[\s*\]/g, "[]") // Clean up empty arrays
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    // Ensure the content ends properly
    if (!cleanedContent.endsWith("}")) {
      cleanedContent = cleanedContent.replace(/[;,]\s*$/, "");
    }

    // Use eval to parse the object (in a controlled environment)
    // Note: In production, consider using a proper AST parser like @babel/parser
    const parsedObject = eval(`(${cleanedContent})`);

    // Flatten nested objects into dot notation
    return flattenObject(parsedObject);
  } catch (error) {
    // Provide more detailed error information
    const errorMessage = error.message.includes("Unexpected identifier")
      ? `Syntax error in TypeScript/JavaScript file. This might be due to TypeScript-specific syntax like 'as const' or type annotations.`
      : `Failed to parse TypeScript/JavaScript file: ${error.message}`;

    // Add debugging information for development
    if (process.env.NODE_ENV === "development") {
      console.error("Debug info:", {
        originalContent: content.substring(0, 200) + "...",
        cleanedContent: cleanedContent.substring(0, 200) + "...",
        error: error.message,
      });
    }

    throw new Error(errorMessage);
  }
}

/**
 * Flatten nested objects into dot notation
 * @param {Object} obj - Object to flatten
 * @param {string} prefix - Current prefix for keys
 * @returns {Object} Flattened object
 */
function flattenObject(obj, prefix = "") {
  const flattened = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        // Recursively flatten nested objects
        Object.assign(flattened, flattenObject(obj[key], newKey));
      } else {
        // Handle primitive values and arrays
        flattened[newKey] = obj[key];
      }
    }
  }

  return flattened;
}

/**
 * Detect language from filename
 * @param {string} filename - Filename
 * @returns {string} Detected language code
 */
function detectLanguage(filePath) {
  // For .strings files, check the directory structure first
  const dirname = path.dirname(filePath);
  const parentDir = path.basename(dirname);

  // Check if parent directory is a language code
  const languagePatterns = {
    en: ["en", "english", "eng"],
    fr: ["fr", "french", "francais"],
    es: ["es", "spanish", "espanol"],
    de: ["de", "german", "deutsch"],
    it: ["it", "italian", "italiano"],
    pt: ["pt", "portuguese", "portugues"],
    nl: ["nl", "dutch", "nederlands"],
    sv: ["sv", "swedish", "svenska"],
    da: ["da", "danish", "dansk"],
    no: ["no", "norwegian", "norsk"],
    fi: ["fi", "finnish", "suomi"],
    pl: ["pl", "polish", "polski"],
    ru: ["ru", "russian", "russkiy"],
    ja: ["ja", "japanese", "nihongo"],
    ko: ["ko", "korean", "hangul"],
    zh: ["zh", "chinese", "zhongwen"],
    ar: ["ar", "arabic", "arabiyya"],
    hi: ["hi", "hindi", "hindustani"],
    tr: ["tr", "turkish", "turkce"],
    th: ["th", "thai", "thailand"],
  };

  // First, check if parent directory is a language code
  const lowerParentDir = parentDir.toLowerCase();
  for (const [langCode, patterns] of Object.entries(languagePatterns)) {
    if (
      patterns.some(
        (pattern) =>
          lowerParentDir === pattern ||
          lowerParentDir.startsWith(pattern + ".") ||
          lowerParentDir.endsWith("." + pattern)
      )
    ) {
      return langCode;
    }
  }

  // If parent directory doesn't contain language info, check filename
  const basename = path.basename(filePath, path.extname(filePath));
  const lowerBasename = basename.toLowerCase();

  for (const [langCode, patterns] of Object.entries(languagePatterns)) {
    if (
      patterns.some(
        (pattern) =>
          lowerBasename === pattern ||
          lowerBasename.startsWith(pattern + ".") ||
          lowerBasename.endsWith("." + pattern)
      )
    ) {
      return langCode;
    }
  }

  // Default to 'en' if no language detected
  return "en";
}

/**
 * Parse a single file
 * @param {Object} file - File object with buffer and originalname, or filePath
 * @returns {Object} Parsed file data
 */
async function parseFile(file) {
  let content, filename, extension;

  if (file.filePath) {
    // CLI usage with file path
    content = fs.readFileSync(file.filePath, "utf8");
    filename = path.basename(file.filePath);
    extension = path.extname(file.filePath).toLowerCase();
  } else {
    // Server usage with buffer
    content = file.buffer.toString("utf8");
    filename = file.originalname;
    extension = path.extname(file.originalname).toLowerCase();
  }

  const language = detectLanguage(file.filePath || file.originalname);

  let keys = {};
  let type = "unknown";

  switch (extension) {
    case ".strings":
      keys = parseStringsFile(content);
      type = "strings";
      break;
    case ".xml":
      keys = parseXMLFile(content);
      type = "xml";
      break;
    case ".json":
      keys = parseJSONFile(content);
      type = "json";
      break;
    case ".ts":
    case ".js":
      keys = parseTSJSFile(content);
      type = "tsjs";
      break;
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }

  return {
    language,
    keys,
    type,
    content,
    filename,
    filePath: file.filePath || null,
  };
}

/**
 * Generate file content from parsed keys
 * @param {Object} keys - Flattened keys object
 * @param {string} type - File type ('strings' or 'tsjs')
 * @param {string} originalContent - Original file content for structure preservation
 * @returns {string} Generated file content
 */
function generateFileContent(keys, type, originalContent = "") {
  if (type === "strings") {
    return generateStringsContent(keys);
  } else if (type === "xml") {
    return generateXMLContent(keys, originalContent);
  } else if (type === "json") {
    return generateJSONContent(keys);
  } else if (type === "tsjs") {
    return generateTSJSContent(keys, originalContent);
  }
  throw new Error(`Unsupported file type: ${type}`);
}

/**
 * Generate .strings file content
 * @param {Object} keys - Flattened keys object
 * @returns {string} Generated .strings content
 */
function generateStringsContent(keys) {
  const lines = [
    "/*",
    "  Generated translation file",
    "  Created by ai-locale-server",
    "*/",
    "",
  ];

  for (const [key, value] of Object.entries(keys)) {
    // Escape special characters for .strings format
    const escapedValue = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t");

    lines.push(`"${key}" = "${escapedValue}";`);
  }

  return lines.join("\n");
}

/**
 * Generate Android XML strings file content
 * @param {Object} keys - Flattened keys object
 * @param {string} originalContent - Original file content for structure preservation
 * @returns {string} Generated XML content
 */
function generateXMLContent(keys, originalContent = "") {
  const lines = [];

  // Try to preserve the original XML header and namespace
  if (originalContent.includes("<?xml")) {
    const headerMatch = originalContent.match(/<\?xml[^>]*\?>/);
    if (headerMatch) {
      lines.push(headerMatch[0]);
    }
  } else {
    lines.push('<?xml version="1.0" encoding="utf-8"?>');
  }

  // Try to preserve the resources tag with namespace
  if (originalContent.includes("<resources")) {
    const resourcesMatch = originalContent.match(/<resources[^>]*>/);
    if (resourcesMatch) {
      lines.push(resourcesMatch[0]);
    } else {
      lines.push("<resources>");
    }
  } else {
    lines.push("<resources>");
  }

  lines.push(""); // Empty line after resources tag

  // Generate string entries
  for (const [key, value] of Object.entries(keys)) {
    // Escape XML special characters
    const escapedValue = value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

    lines.push(`    <string name="${key}">${escapedValue}</string>`);
  }

  lines.push("");
  lines.push("</resources>");

  return lines.join("\n");
}

/**
 * Generate JSON file content
 * @param {Object} keys - Flattened keys object
 * @returns {string} Generated JSON content
 */
function generateJSONContent(keys) {
  // Convert flattened keys back to nested structure
  const nestedObject = unflattenObject(keys);

  // Generate JSON with proper formatting
  return JSON.stringify(nestedObject, null, 2);
}

/**
 * Generate TypeScript/JavaScript file content
 * @param {Object} keys - Flattened keys object
 * @param {string} originalContent - Original file content for structure preservation
 * @returns {string} Generated TS/JS content
 */
function generateTSJSContent(keys, originalContent) {
  // Convert flattened keys back to nested structure
  const nestedObject = unflattenObject(keys);

  // Try to preserve original structure and formatting
  if (originalContent.includes("export default")) {
    return `export default ${JSON.stringify(nestedObject, null, 2)} as const;`;
  } else {
    return `export default ${JSON.stringify(nestedObject, null, 2)} as const;`;
  }
}

/**
 * Convert flattened object back to nested structure
 * @param {Object} flattened - Flattened object
 * @returns {Object} Nested object
 */
function unflattenObject(flattened) {
  const nested = {};

  for (const [key, value] of Object.entries(flattened)) {
    const keys = key.split(".");
    let current = nested;

    for (let i = 0; i < keys.length - 1; i++) {
      const currentKey = keys[i];
      if (!(currentKey in current)) {
        current[currentKey] = {};
      }
      current = current[currentKey];
    }

    current[keys[keys.length - 1]] = value;
  }

  return nested;
}

module.exports = {
  parseFile,
  parseStringsFile,
  parseXMLFile,
  parseJSONFile,
  parseTSJSFile,
  generateFileContent,
  generateStringsContent,
  generateXMLContent,
  generateJSONContent,
  generateTSJSContent,
  detectLanguage,
  flattenObject,
  unflattenObject,
};

const path = require("path");

// ISO 639-1. Two-letter segments outside this set (js, ui, …) are not locales.
const ISO_639_1 = new Set(
  (
    "aa ab ae af ak am an ar as av ay az " +
    "ba be bg bh bi bm bn bo br bs " +
    "ca ce ch co cr cs cu cv cy " +
    "da de dv dz " +
    "ee el en eo es et eu " +
    "fa ff fi fj fo fr fy " +
    "ga gd gl gn gu gv " +
    "ha he hi ho hr ht hu hy hz " +
    "ia id ie ig ii ik io is it iu " +
    "ja jv " +
    "ka kg ki kj kk kl km kn ko kr ks ku kv kw ky " +
    "la lb lg li ln lo lt lu lv " +
    "mg mh mi mk ml mn mr ms mt my " +
    "na nb nd ne ng nl nn no nr nv ny " +
    "oc oj om or os " +
    "pa pi pl ps pt " +
    "qu " +
    "rm rn ro ru rw " +
    "sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw " +
    "ta te tg th ti tk tl tn to tr ts tt tw ty " +
    "ug uk ur uz " +
    "ve vi vo " +
    "wa wo " +
    "xh " +
    "yi yo " +
    "za zh zu"
  ).split(/\s+/)
);

// ISO 639-3 codes for large languages that have no two-letter code, plus
// common three-letter aliases that fold onto a two-letter tag.
// Source: Ethnologue 2025 top 100 by total speakers.
const ISO_639_3 = {
  cmn: "zh",
  zho: "zh",
  chi: "zh",
  arb: "ar",
  ara: "ar",
  pes: "fa",
  uzn: "uz",
  fil: "tl",
  eng: "en",
  fra: "fr",
  fre: "fr",
  spa: "es",
  deu: "de",
  ger: "de",
  hin: "hi",
  ben: "bn",
  por: "pt",
  rus: "ru",
  jpn: "ja",
  kor: "ko",
  tur: "tr",
  vie: "vi",
  ind: "id",
  urd: "ur",
  nld: "nl",
  dut: "nl",
  ita: "it",
  pol: "pl",
  ukr: "uk",
  ell: "el",
  gre: "el",
  swe: "sv",
  ron: "ro",
  rum: "ro",
  yue: "yue",
  wuu: "wuu",
  cjy: "cjy",
  nan: "nan",
  hak: "hak",
  hsn: "hsn",
  gan: "gan",
  pcm: "pcm",
  arz: "arz",
  apc: "apc",
  apd: "apd",
  arq: "arq",
  ary: "ary",
  aec: "aec",
  ars: "ars",
  acm: "acm",
  pnb: "pnb",
  bho: "bho",
  prs: "prs",
  skr: "skr",
  gaz: "gaz",
  pbu: "pbu",
  pbt: "pbt",
  ceb: "ceb",
  mag: "mag",
  fuv: "fuv",
  mai: "mai",
  kmr: "kmr",
  hne: "hne",
  tts: "tts",
  nso: "nso",
  bar: "bar",
  azb: "azb",
  ctg: "ctg",
  dyu: "dyu",
};

const NAMED_LANGUAGES = {
  english: "en",
  eng: "en",
  french: "fr",
  francais: "fr",
  spanish: "es",
  espanol: "es",
  german: "de",
  deutsch: "de",
  italian: "it",
  italiano: "it",
  portuguese: "pt",
  portugues: "pt",
  dutch: "nl",
  nederlands: "nl",
  swedish: "sv",
  svenska: "sv",
  danish: "da",
  dansk: "da",
  norwegian: "no",
  norsk: "no",
  finnish: "fi",
  suomi: "fi",
  polish: "pl",
  polski: "pl",
  russian: "ru",
  russkiy: "ru",
  japanese: "ja",
  nihongo: "ja",
  korean: "ko",
  hangul: "ko",
  chinese: "zh",
  zhongwen: "zh",
  arabic: "ar",
  arabiyya: "ar",
  hindi: "hi",
  hindustani: "hi",
  turkish: "tr",
  turkce: "tr",
  thai: "th",
  thailand: "th",
  bulgarian: "bg",
  croatian: "hr",
  czech: "cs",
  estonian: "et",
  greek: "el",
  hungarian: "hu",
  irish: "ga",
  latvian: "lv",
  lithuanian: "lt",
  maltese: "mt",
  romanian: "ro",
  slovak: "sk",
  slovene: "sl",
  slovenian: "sl",
  swahili: "sw",
  ukrainian: "uk",
  bengali: "bn",
  bangla: "bn",
  mandarin: "zh",
  "mandarin-chinese": "zh",
  indonesian: "id",
  urdu: "ur",
  "nigerian-pidgin": "pcm",
  "egyptian-arabic": "arz",
  marathi: "mr",
  vietnamese: "vi",
  telugu: "te",
  hausa: "ha",
  punjabi: "pa",
  "western-punjabi": "pnb",
  "eastern-punjabi": "pa",
  tagalog: "tl",
  filipino: "tl",
  tamil: "ta",
  cantonese: "yue",
  "yue-chinese": "yue",
  wu: "wuu",
  "wu-chinese": "wuu",
  shanghainese: "wuu",
  persian: "fa",
  farsi: "fa",
  "iranian-persian": "fa",
  javanese: "jv",
  gujarati: "gu",
  "levantine-arabic": "apc",
  amharic: "am",
  kannada: "kn",
  bhojpuri: "bho",
  "sudanese-arabic": "apd",
  yoruba: "yo",
  jinyu: "cjy",
  "jinyu-chinese": "cjy",
  "min-nan": "nan",
  hokkien: "nan",
  hakka: "hak",
  "hakka-chinese": "hak",
  xiang: "hsn",
  "xiang-chinese": "hsn",
  "gan-chinese": "gan",
  burmese: "my",
  myanmar: "my",
  "algerian-arabic": "arq",
  lingala: "ln",
  "moroccan-arabic": "ary",
  odia: "or",
  oriya: "or",
  malayalam: "ml",
  sindhi: "sd",
  sundanese: "su",
  sunda: "su",
  igbo: "ig",
  dari: "prs",
  nepali: "ne",
  malay: "ms",
  uzbek: "uz",
  zulu: "zu",
  "saidi-arabic": "aec",
  pashto: "ps",
  "northern-pashto": "pbu",
  "southern-pashto": "pbt",
  oromo: "om",
  saraiki: "skr",
  seraiki: "skr",
  somali: "so",
  assamese: "as",
  cebuano: "ceb",
  kazakh: "kk",
  magahi: "mag",
  "najdi-arabic": "ars",
  sinhala: "si",
  sinhalese: "si",
  "mesopotamian-arabic": "acm",
  xhosa: "xh",
  khmer: "km",
  cambodian: "km",
  afrikaans: "af",
  fulfulde: "fuv",
  fula: "ff",
  fulani: "ff",
  maithili: "mai",
  wolof: "wo",
  kurdish: "ku",
  kurmanji: "kmr",
  "northern-kurdish": "kmr",
  chhattisgarhi: "hne",
  kinyarwanda: "rw",
  isan: "tts",
  "northeastern-thai": "tts",
  chichewa: "ny",
  nyanja: "ny",
  chewa: "ny",
  bambara: "bm",
  bamanankan: "bm",
  shona: "sn",
  azerbaijani: "az",
  azeri: "az",
  "south-azerbaijani": "azb",
  tswana: "tn",
  setswana: "tn",
  "northern-sotho": "nso",
  pedi: "nso",
  sepedi: "nso",
  bavarian: "bar",
  haitian: "ht",
  "haitian-creole": "ht",
  uyghur: "ug",
  uighur: "ug",
  sotho: "st",
  sesotho: "st",
  "southern-sotho": "st",
  chittagonian: "ctg",
  kirundi: "rn",
  rundi: "rn",
  jula: "dyu",
  dyula: "dyu",
};

// ll or lll, then optional script and region. Separators may be "-" or "_".
const LOCALE_RE =
  /^([a-z]{2,3})(?:[-_]([a-z]{4}))?(?:[-_]([a-z]{2}|\d{3}))?$/i;

/**
 * Canonical BCP 47 tag, or null when the token is not a locale.
 * fr, FR, fr-CA, fr_ca and nl-BE are accepted. fr-CA stays distinct from fr.
 * @param {string} token
 * @returns {string|null}
 */
function normalizeLocale(token) {
  if (token == null) return null;
  const match = String(token).match(LOCALE_RE);
  if (!match) return null;

  const subtag = match[1].toLowerCase();
  let language = null;
  if (subtag.length === 2 && ISO_639_1.has(subtag)) {
    language = subtag;
  } else if (subtag.length === 3 && Object.prototype.hasOwnProperty.call(ISO_639_3, subtag)) {
    language = ISO_639_3[subtag];
  }
  if (!language) return null;

  let tag = language;
  if (match[2]) {
    const script = match[2];
    tag += `-${script.charAt(0).toUpperCase()}${script.slice(1).toLowerCase()}`;
  }
  if (match[3]) {
    const region = match[3];
    tag += `-${/^\d+$/.test(region) ? region : region.toUpperCase()}`;
  }
  return tag;
}

/**
 * Locale encoded by a path segment or filename, or null.
 * Accepts fr-CA.lproj, messages.fr-CA and the name "french".
 * @param {string} token
 * @returns {string|null}
 */
function matchLocaleToken(token) {
  if (!token) return null;

  const lproj = String(token).match(/^(.+)\.lproj$/i);
  if (lproj) return matchLocaleToken(lproj[1]);

  const exact = normalizeLocale(token);
  if (exact) return exact;

  const named = NAMED_LANGUAGES[String(token).toLowerCase()];
  if (named) return named;

  if (String(token).includes(".")) {
    const parts = String(token).split(".");
    for (let i = parts.length - 1; i >= 0; i--) {
      const locale =
        normalizeLocale(parts[i]) || NAMED_LANGUAGES[parts[i].toLowerCase()];
      if (locale) return locale;
    }
  }

  return null;
}

/**
 * Language tag used for comparisons and prompts.
 * Unknown values are returned trimmed, so custom codes still match exactly.
 * @param {string} code
 * @returns {string}
 */
function canonicalizeLanguageCode(code) {
  if (code == null) return code;
  const trimmed = String(code).trim();
  return matchLocaleToken(trimmed) || trimmed;
}

/**
 * Detect a locale from a file path.
 * The closest matching segment wins, so locales/fr-CA/messages.json is fr-CA
 * and tests/fixtures/ts/fr.ts stays fr.
 * @param {string} filePath
 * @returns {string}
 */
function detectLanguage(filePath) {
  const parts = String(filePath).split(/[/\\]/).filter(Boolean);

  for (let i = parts.length - 1; i >= 0; i--) {
    let token = parts[i];
    if (i === parts.length - 1) {
      token = path.basename(token, path.extname(token));
    }
    const locale = matchLocaleToken(token);
    if (locale) return locale;
  }

  return "en";
}

const LOCALE_SHAPE =
  "[A-Za-z]{2,3}(?:[-_][A-Za-z]{4})?(?:[-_](?:[A-Za-z]{2}|[0-9]{3}))?";

function localeTokenPattern() {
  const names = Object.keys(NAMED_LANGUAGES)
    .sort((a, b) => b.length - a.length)
    .join("|");
  return `(?:${LOCALE_SHAPE}|${names})`;
}

function escapeGlobPiece(piece) {
  return piece
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
}

/**
 * Match one pattern segment. #locale must be a real language tag.
 * @param {string} patternPart
 * @param {string} filePart
 * @returns {{ok: boolean, locales: string[]}}
 */
function matchPatternSegment(patternPart, filePart) {
  if (!patternPart.includes("#locale")) {
    const re = new RegExp(`^${escapeGlobPiece(patternPart)}$`, "i");
    return { ok: re.test(filePart), locales: [] };
  }

  const body = patternPart
    .split("#locale")
    .map(escapeGlobPiece)
    .join(`(${localeTokenPattern()})`);
  const match = String(filePart).match(new RegExp(`^${body}$`, "i"));
  if (!match) return { ok: false, locales: [] };

  const locales = [];
  for (let i = 1; i < match.length; i++) {
    const locale = matchLocaleToken(match[i]);
    if (!locale) return { ok: false, locales: [] };
    locales.push(locale);
  }
  return { ok: true, locales };
}

/**
 * True when filePath fits pattern and every #locale segment is a real tag.
 * An absolute path may have a prefix the relative pattern does not mention.
 * @param {string} pattern
 * @param {string} filePath
 * @returns {boolean}
 */
function fileMatchesLocalePattern(pattern, filePath) {
  const patternParts = String(pattern).split(/[/\\]/).filter(Boolean);
  const fileParts = String(filePath).split(/[/\\]/).filter(Boolean);
  const parts =
    patternParts[0] === "**" ? patternParts : ["**", ...patternParts];

  function matchFrom(pi, fi) {
    if (pi === parts.length) return fi === fileParts.length;
    if (parts[pi] === "**") {
      for (let i = fi; i <= fileParts.length; i++) {
        if (matchFrom(pi + 1, i)) return true;
      }
      return false;
    }
    if (fi >= fileParts.length) return false;
    if (!matchPatternSegment(parts[pi], fileParts[fi]).ok) return false;
    return matchFrom(pi + 1, fi + 1);
  }

  return matchFrom(0, 0);
}

/**
 * Replace every #locale placeholder with a single path segment wildcard.
 * @param {string} pattern
 * @returns {string}
 */
function expandLocalePattern(pattern) {
  return String(pattern).split("#locale").join("*");
}

/**
 * Keep files whose #locale segment is a language code, a regional tag, or a language name.
 * @param {string} pattern
 * @param {string[]} files
 * @returns {string[]}
 */
function filterDiscoveredFiles(pattern, files) {
  if (!String(pattern).includes("#locale")) return files;
  return files.filter((file) => fileMatchesLocalePattern(pattern, file));
}

module.exports = {
  canonicalizeLanguageCode,
  detectLanguage,
  expandLocalePattern,
  fileMatchesLocalePattern,
  filterDiscoveredFiles,
  matchLocaleToken,
  normalizeLocale,
};

/**
 * Deterministic text sanitizer and Levenshtein distance utility
 * shared by both server (server.ts) and client (src/App.tsx).
 */

const MOJIBAKE_MAP: Array<[RegExp, string]> = [
  [/Ã©/g, 'é'],
  [/Ã¨/g, 'è'],
  [/Ãª/g, 'ê'],
  [/Ã«/g, 'ë'],
  [/Ã /g, 'à'],
  [/Ã¡/g, 'á'],
  [/Ã¢/g, 'â'],
  [/Ã¤/g, 'ä'],
  [/Ã§/g, 'ç'],
  [/Ã´/g, 'ô'],
  [/Ã¶/g, 'ö'],
  [/Ã¹/g, 'ù'],
  [/Ãº/g, 'ú'],
  [/Ã»/g, 'û'],
  [/Ã¼/g, 'ü'],
  [/Ã¯/g, 'ï'],
  [/Ã®/g, 'î'],
  [/Ã±/g, 'ñ'],
  [/ÃŸ/g, 'ß'],
  [/Ã‰/g, 'É'],
  [/Ã€/g, 'À'],
  [/Ã„/g, 'Ä'],
  [/Ã–/g, 'Ö'],
  [/Ãœ/g, 'Ü'],
  [/â€™/g, "'"],
  [/â€˜/g, "'"],
  [/â€œ/g, '"'],
  [/â€\u009d/g, '"'],
  [/â€“/g, '–'],
  [/â€”/g, '—'],
  [/â€¦/g, '…'],
];

export interface SanitizeOptions {
  isTitle?: boolean;
  isTag?: boolean;
  multiline?: boolean;
}

/**
 * Deterministic text cleanup:
 * - Unicode NFC normalization
 * - Strip zero-width characters (\u200B-\u200D, \uFEFF)
 * - Repair common UTF-8/Windows-1252 mojibake
 * - Collapse multiple spaces (preserving newlines when multiline)
 * - Fix space before punctuation (except French which requires \u00A0 before ; : ! ?)
 * - Fix doubled punctuation (e.g. ",," -> ",", preserving "...")
 * - Strip leading/trailing markdown "**", "#" or stray wrapping quotes in titles/tags
 */
export function sanitizeText(
  str: string,
  language: string = 'en-US',
  options: SanitizeOptions = {}
): string {
  if (typeof str !== 'string' || !str) return '';

  // 1. Normalize to Unicode NFC (composed diacritics)
  let out = str.normalize('NFC');

  // 2. Remove zero-width characters
  out = out.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 3. Repair common mojibake sequences
  for (const [pattern, replacement] of MOJIBAKE_MAP) {
    out = out.replace(pattern, replacement);
  }

  const isFrench = /^fr(-|$)/i.test(language || '');
  const isMultiline = options.multiline ?? out.includes('\n');

  // 4. Collapse horizontal spaces
  if (isMultiline) {
    out = out
      .split('\n')
      .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  } else {
    out = out.replace(/\s+/g, ' ');
  }

  // 5. Space before punctuation rules
  if (isFrench) {
    // French: no space before , and . ; non-breaking space (\u00A0) before ; : ! ?
    // Avoid touching timestamps like 00:00 or URLs like https://
    out = out.replace(/[ \t]+([,.])/g, '$1');
    out = out.replace(/([^\s\d\u00A0])[ \t]*([;!?])/g, '$1\u00A0$2');
    out = out.replace(/([^\s\d\u00A0h])[ \t]+(:)(?!\/\/|\d)/gi, '$1\u00A0$2');
    // French guillemets « text »
    out = out.replace(/«[ \t]*/g, '«\u00A0').replace(/[ \t]*»/g, '\u00A0»');
  } else {
    // Remove space before , . ! ? ; : (unless part of timestamp or emoji/dash)
    out = out.replace(/[ \t]+([,.!?;])(?!\d)/g, '$1');
    out = out.replace(/([a-zA-ZÀ-ỹ])[ \t]+(:)(?!\/\/)/g, '$1$2');
  }

  // 6. Fix doubled punctuation (keep "..." and "?!" / "!?")
  out = out.replace(/,{2,}/g, ',');
  out = out.replace(/;{2,}/g, ';');
  out = out.replace(/:{2,}(?!\/)/g, ':');
  out = out.replace(/!{2,}/g, '!');
  out = out.replace(/\?{2,}/g, '?');
  // Fix exactly two dots ".." into "." while preserving 3+ dots "..."
  out = out.replace(/(?<!\.)\.\.(?!\.)/g, '.');

  // 7. Title / Tag specific cleanup
  if (options.isTitle) {
    out = out
      .replace(/^\*{1,3}\s*|\s*\*{1,3}$/g, '')
      .replace(/\*\*/g, '')
      .replace(/^#+\s+/, '')
      .trim();
    // Strip stray wrapping quotes if the entire title is wrapped in quotes
    if (
      (out.startsWith('"') && out.endsWith('"') && out.slice(1, -1).indexOf('"') === -1) ||
      (out.startsWith('“') && out.endsWith('”') && out.slice(1, -1).indexOf('”') === -1)
    ) {
      out = out.slice(1, -1).trim();
    }
  }

  if (options.isTag) {
    // No markdown, no leading #, no emojis inside tags
    out = out
      .replace(/\*\*/g, '')
      .replace(/^#+/, '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/^["'“”]+|["'“”]+$/g, '')
      .trim();
  }

  return out.trim();
}

const VIETNAMESE_FIELDS = new Set([
  'vietnamese',
  'reason',
  'complianceNote',
  'seoNotes',
  'trendAlignment',
  'targetAudience',
  'searchIntent',
  'visualScene',
  'colorPsychology',
  'strategy',
  'whyItWorks',
]);

const TITLE_FIELDS = new Set(['localized', 'title', 'textOverlay']);
const MULTILINE_FIELDS = new Set(['description', 'disclaimerText', 'summary', 'seoNotes']);

/**
 * Recursively applies sanitizeText to every string property in an object or array.
 * Automatically uses 'vi-VN' rules for Vietnamese explanation/translation fields,
 * and applies title/tag/multiline options based on key context.
 */
export function deepSanitize<T>(obj: T, language: string = 'en-US', parentKey: string = ''): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    const effectiveLang = VIETNAMESE_FIELDS.has(parentKey) ? 'vi-VN' : language;
    const isTitle =
      TITLE_FIELDS.has(parentKey) ||
      parentKey === 'thumbnailTexts' ||
      parentKey === 'primaryKeyword';
    const isTag = parentKey === 'tags';
    const multiline = MULTILINE_FIELDS.has(parentKey);
    return sanitizeText(obj, effectiveLang, { isTitle, isTag, multiline }) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepSanitize(item, language, parentKey)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (key === 'proofreadReport' || key === 'sources' || key === 'url') {
        result[key] = value;
      } else {
        result[key] = deepSanitize(value, language, key);
      }
    }
    return result as T;
  }

  return obj;
}

/**
 * Computes the Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const alen = a.length;
  const blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;

  let prev = new Array<number>(blen + 1);
  let curr = new Array<number>(blen + 1);

  for (let j = 0; j <= blen; j++) prev[j] = j;

  for (let i = 1; i <= alen; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= blen; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[blen];
}

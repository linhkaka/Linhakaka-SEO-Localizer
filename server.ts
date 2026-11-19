import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { sanitizeText, deepSanitize, levenshteinDistance } from './src/lib/textQuality.ts';
import {
  getMarketSeoRule,
  getMarketTitlePlaybook,
  getTitleFormat,
  selectCandidateFormats,
} from './src/constants.ts';
import type {
  ContentType,
  ProofreadFix,
  ProofreadReport,
  TitleArchetype,
  TitleFormat,
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPort(): number {
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if ((arg === '--port' || arg === '-p') && process.argv[i + 1]) {
      const parsed = parseInt(process.argv[i + 1], 10);
      if (!isNaN(parsed)) return parsed;
    }
    if (arg.startsWith('--port=')) {
      const parsed = parseInt(arg.split('=')[1], 10);
      if (!isNaN(parsed)) return parsed;
    }
  }
  const isDevProxy = Boolean(process.env.NGINX_PORT) || process.env.NODE_ENV === 'development';
  if (isDevProxy) {
    return Number(process.env.DEFAULT_APP_PORT) || 3000;
  }
  return Number(process.env.PORT) || 3000;
}

function getHost(): string {
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if ((arg === '--host' || arg === '-h') && process.argv[i + 1]) {
      return process.argv[i + 1];
    }
    if (arg.startsWith('--host=')) {
      return arg.split('=')[1];
    }
  }
  return '0.0.0.0';
}

const app = express();
const port = getPort();
const host = getHost();

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

// Prevent /favicon.ico 404 errors in browser DevTools
app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();
}

// Health & diagnostic endpoints for Cloud Run and client status checks
app.get(['/health', '/healthz', '/_health', '/api/health'], (_req, res) => {
  res.status(200).json({
    status: 'ok',
    hasApiKey: Boolean(getGeminiApiKey()),
    timestamp: new Date().toISOString(),
  });
});

let cachedAiKey = '';
let cachedAiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const missingErr: any = new Error('MISSING_GEMINI_API_KEY');
    missingErr.code = 'MISSING_GEMINI_API_KEY';
    throw missingErr;
  }
  if (!cachedAiClient || cachedAiKey !== apiKey) {
    cachedAiKey = apiKey;
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAiClient;
}

const FALLBACK_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
];

// Circuit-breaker memory: deprioritize models that recently returned 503/429 for 3 minutes
const modelCooldownUntil = new Map<string, number>();
const COOLDOWN_MS = 3 * 60 * 1000;

function getPrioritizedModels(requestedModels?: string[]): string[] {
  const base = requestedModels && requestedModels.length > 0 ? requestedModels : FALLBACK_MODELS;
  const now = Date.now();
  const healthy: string[] = [];
  const cooling: string[] = [];

  for (const m of base) {
    const until = modelCooldownUntil.get(m) || 0;
    if (until > now) {
      cooling.push(m);
    } else {
      healthy.push(m);
    }
  }
  return [...healthy, ...cooling];
}

function isApiKeyOrAuthError(err: any): boolean {
  const raw = typeof err?.message === 'string' ? err.message : String(err || '');
  const status = Number(err?.status || err?.code || 0);
  if (err?.code === 'MISSING_GEMINI_API_KEY' || raw.includes('MISSING_GEMINI_API_KEY')) {
    return true;
  }
  if (
    raw.includes('API_KEY_INVALID') ||
    raw.includes('API key not valid') ||
    raw.includes('API key should be set') ||
    raw.includes('API key must be set') ||
    raw.includes('PERMISSION_DENIED') ||
    status === 401
  ) {
    return true;
  }
  if (status === 403 && /key|permission|unauthenticated|forbidden|referer/i.test(raw)) {
    return true;
  }
  return false;
}

function formatFriendlyError(err: any, defaultMsg: string): string {
  const raw = typeof err?.message === 'string' ? err.message : String(err || '');
  if (err?.code === 'MISSING_GEMINI_API_KEY' || raw.includes('MISSING_GEMINI_API_KEY')) {
    return 'Máy chủ chưa có GEMINI_API_KEY trên phiên bản chia sẻ. Chủ sở hữu cần kiểm tra Settings > Secrets trong AI Studio trước khi chia sẻ cho đối tác.';
  }
  if (isApiKeyOrAuthError(err)) {
    return 'GEMINI_API_KEY chưa hợp lệ hoặc chưa được cấp quyền cho liên kết chia sẻ này. Vui lòng kiểm tra Settings > Secrets hoặc giới hạn tên miền của API key.';
  }
  if (
    err?.status === 503 ||
    err?.code === 503 ||
    raw.includes('503') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('high demand')
  ) {
    return 'Hệ thống AI đang có lượng truy cập tăng đột biến (503). Vui lòng bấm thử lại sau vài giây.';
  }
  if (
    err?.status === 429 ||
    err?.code === 429 ||
    raw.includes('429') ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.includes('quota')
  ) {
    return 'Đã chạm giới hạn tần suất gọi API tạm thời (429). Vui lòng đợi 10–15 giây rồi thử lại.';
  }
  return defaultMsg;
}

/**
 * Per-language orthography, diacritics, spelling & punctuation rules
 * appended to every generation systemInstruction / prompt.
 */
export function getOrthographyRules(language: string = 'en-US'): string {
  const code = (language || 'en-US').toLowerCase();

  const vietnameseRule = `- VIETNAMESE ORTHOGRAPHY (applies to ALL Vietnamese outputs, translations, explanations, notes, and trend reports):
  * Write with 100% full and accurate Vietnamese diacritics (dấu thanh & dấu phụ), standard tone-mark placement, and composed Unicode NFC.
  * NEVER leave raw Telex/VNI typing artifacts (e.g. "aa", "ow", "uw", "dd", "f/r/x/s/j" at word ends).
  * NEVER invent non-existent Vietnamese compound words. Double-check common Vietnamese spelling confusions:
    - "hoang dã" (NEVER "hoang dạng"), "xúc xắc" / "sâu sắc" (sắc vs xắc), "câu chuyện" vs "truyện kể" (chuyện vs truyện), "giành chiến thắng" vs "dành riêng cho" (giành vs dành), "màn sương" vs "xương khớp" (sương vs xương), "lẽ phải / có lẽ" vs "số lẻ / đơn lẻ" (lẽ vs lẻ).
    - Distinguish initial consonants d / gi / r, ch / tr, s / x, n / l, and final consonants -c / -t, -n / -ng, -nh / -ch, and tones hỏi (?) vs ngã (~).
  * Keep international/English proper nouns, brand names, and technical names in their original English spelling (e.g. YouTube, Google, iPhone, New York).`;

  let targetLangRule = '';
  if (code.startsWith('en-gb')) {
    targetLangRule = `- ENGLISH (UK) ORTHOGRAPHY:
  * Strictly use British English spelling (colour, optimise, analyse, centre, programme, travelling, defence).
  * Use proper apostrophes in contractions and possessives (don't, it's, viewer's). Use Title Case for titles when requested.`;
  } else if (code.startsWith('en')) {
    targetLangRule = `- ENGLISH (US) ORTHOGRAPHY:
  * Strictly use American English spelling (color, optimize, analyze, center, program, traveling, defense).
  * Use proper apostrophes in contractions and possessives (don't, it's, viewer's). Use Title Case for titles when requested.`;
  } else if (code.startsWith('fr')) {
    targetLangRule = `- FRENCH ORTHOGRAPHY:
  * Include all required French accents and ligatures (é, è, ê, ë, à, â, ç, ô, û, ù, ï, î, œ).
  * Use a non-breaking space (\u00A0) before high punctuation (; : ! ?) and inside French guillemets («\u00A0...\u00A0»).
  * Apply mandatory elision (l', d', qu', jusqu', lorsqu', aujourd'hui).`;
  } else if (code.startsWith('es')) {
    targetLangRule = `- SPANISH ORTHOGRAPHY:
  * Include all mandatory tildes/accents (á, é, í, ó, ú, ü) and ñ.
  * Always include opening inverted question and exclamation marks (¿...? and ¡...!).`;
  } else if (code.startsWith('it')) {
    targetLangRule = `- ITALIAN ORTHOGRAPHY:
  * Distinguish grave vs acute accents accurately (è vs é — e.g. "è" vs "perché/poiché", plus à, ò, ù, ì).
  * Use correct elision and apostrophes (un'altra, l'uomo, dell'anno, qual è without apostrophe).`;
  } else if (code.startsWith('de')) {
    targetLangRule = `- GERMAN ORTHOGRAPHY:
  * Always use real German umlauts (ä, ö, ü, Ä, Ö, Ü) and Eszett (ß) according to standard Rechtschreibung — NEVER substitute ae, oe, ue, or ss where umlaut/ß is required.
  * Capitalize ALL German nouns (Substantive) and nominalized words.`;
  } else if (code.startsWith('ja')) {
    targetLangRule = `- JAPANESE ORTHOGRAPHY:
  * Use full-width Japanese punctuation (「」、。！？【】), and NEVER insert half-width spaces between Japanese words.
  * Use accurate Joyo Kanji, Hiragana, and Katakana with consistent standard loanword (外来語) spelling and long vowel marks (ー).`;
  } else if (code.startsWith('ko')) {
    targetLangRule = `- KOREAN ORTHOGRAPHY:
  * Follow standard Korean spelling (한글 맞춤법) and word spacing (띄어쓰기) strictly, with accurate 받침 (batchim, e.g. 되/돼, 로서/로써, 든지/던지).
  * Do NOT mix stray Chinese (Hanja) or Japanese characters into Korean text.`;
  } else if (!code.startsWith('vi')) {
    targetLangRule = `- TARGET LANGUAGE (${language}) ORTHOGRAPHY:
  * Write with 100% native spelling, diacritics, grammar, and punctuation conventions for ${language}.`;
  }

  const generalRule = `- GENERAL TEXT QUALITY RULES:
  * Zero typos, zero repeated words, zero accidental mixed scripts or broken UTF-8 characters.
  * NEVER put stray markdown symbols (** or #) inside titles, tags, or thumbnail text overlays.
  * NEVER include emojis inside tags.`;

  return [
    '===== ORTHOGRAPHY, SPELLING & GRAMMAR QUALITY RULES (MANDATORY) =====',
    vietnameseRule,
    targetLangRule,
    generalRule,
  ]
    .filter(Boolean)
    .join('\n');
}

async function generateWithFallback(params: {
  contents: string;
  config?: Record<string, any>;
  models?: string[];
}) {
  const ai = getAiClient();
  const modelsToTry = getPrioritizedModels(params.models);
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: params.contents,
        config: params.config,
      });
      modelCooldownUntil.delete(modelName);
      return { response, modelUsed: modelName };
    } catch (err: any) {
      lastError = err;
      if (isApiKeyOrAuthError(err)) {
        console.error('[Gemini Auth/Key Error]', err?.message || err);
        throw err;
      }
      const status = err?.status || err?.code || '';
      const msg = String(err?.message || '');
      if (
        status === 503 ||
        status === 429 ||
        msg.includes('503') ||
        msg.includes('429') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('RESOURCE_EXHAUSTED')
      ) {
        modelCooldownUntil.set(modelName, Date.now() + COOLDOWN_MS);
      }
      console.log(
        `[Gemini Fallback] Model ${modelName} unavailable (${status || 'retry'}), switching to next model.`
      );
    }
  }
  throw lastError || new Error('All Gemini models failed to respond.');
}

interface PathTextEntry {
  path: string;
  text: string;
  isTitle?: boolean;
  isVietnamese?: boolean;
}

function getByPath(obj: any, pathStr: string): any {
  const parts = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function setByPath(obj: any, pathStr: string, value: any): boolean {
  const parts = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  if (parts.length === 0) return false;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur == null || typeof cur !== 'object' || !(p in cur)) return false;
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (cur == null || typeof cur !== 'object' || !(last in cur)) return false;
  cur[last] = value;
  return true;
}

function collectMetadataEntries(metadata: any): PathTextEntry[] {
  const entries: PathTextEntry[] = [];
  const push = (path: string, val: any, isTitle = false, isVietnamese = false) => {
    if (typeof val === 'string' && val.trim().length > 0) {
      entries.push({ path, text: val, isTitle, isVietnamese });
    }
  };

  if (Array.isArray(metadata?.titles)) {
    metadata.titles.forEach((t: any, i: number) => {
      push(`titles[${i}].localized`, t?.localized, true, false);
      push(`titles[${i}].vietnamese`, t?.vietnamese, false, true);
      push(`titles[${i}].angle`, t?.angle, false, true);
      push(`titles[${i}].reason`, t?.reason, false, true);
      push(`titles[${i}].complianceNote`, t?.complianceNote, false, true);
    });
  }

  push('primaryKeyword', metadata?.primaryKeyword, true, false);
  push('description', metadata?.description, false, false);
  if (metadata?.disclaimerUsed) {
    push('disclaimerText', metadata?.disclaimerText, false, false);
  }

  if (Array.isArray(metadata?.tags)) {
    metadata.tags.forEach((tag: any, i: number) => {
      push(`tags[${i}]`, tag, false, false);
    });
  }

  if (Array.isArray(metadata?.thumbnailTexts)) {
    metadata.thumbnailTexts.forEach((tt: any, i: number) => {
      push(`thumbnailTexts[${i}]`, tt, true, false);
    });
  }

  if (Array.isArray(metadata?.thumbnailConcepts)) {
    metadata.thumbnailConcepts.forEach((tc: any, i: number) => {
      push(`thumbnailConcepts[${i}].textOverlay`, tc?.textOverlay, true, false);
      push(`thumbnailConcepts[${i}].vietnamese`, tc?.vietnamese, false, true);
      push(`thumbnailConcepts[${i}].visualScene`, tc?.visualScene, false, true);
      push(`thumbnailConcepts[${i}].colorPsychology`, tc?.colorPsychology, false, true);
    });
  }

  if (Array.isArray(metadata?.chapters)) {
    metadata.chapters.forEach((ch: any, i: number) => {
      push(`chapters[${i}].title`, ch?.title, true, false);
      push(`chapters[${i}].vietnamese`, ch?.vietnamese, false, true);
    });
  }

  if (Array.isArray(metadata?.pinnedComments)) {
    metadata.pinnedComments.forEach((pc: any, i: number) => {
      push(`pinnedComments[${i}].localized`, pc?.localized, false, false);
      push(`pinnedComments[${i}].vietnamese`, pc?.vietnamese, false, true);
      push(`pinnedComments[${i}].strategy`, pc?.strategy, false, true);
    });
  }

  push('seoNotes', metadata?.seoNotes, false, true);
  push('trendAlignment', metadata?.trendAlignment, false, true);
  push('targetAudience', metadata?.targetAudience, false, true);
  push('searchIntent', metadata?.searchIntent, false, true);

  return entries;
}

/**
 * Runs a single AI proofreading call over an array of { path, text } items
 * at temperature = 0 with a strict schema.
 */
async function runProofreadCall(
  items: { path: string; text: string }[],
  language: string,
  country?: string
): Promise<{ fixes: ProofreadFix[]; modelUsed: string }> {
  if (items.length === 0) {
    return { fixes: [], modelUsed: 'none' };
  }

  const systemInstruction = `You are a strict native proofreader for ${language}${country ? ` (${country})` : ''} and Vietnamese. Fix ONLY spelling, diacritics, accents, grammar, punctuation and spacing. Do NOT change meaning, tone, keywords, numbers, brand/proper names, and do not make text longer. If a string is already correct, do not include it.
Write the "reason" field in concise Vietnamese (e.g. "Sửa lỗi chính tả 'hoang dạng' thành 'hoang dã'").

${getOrthographyRules(language)}`;

  const payload = items.map((item) => ({ path: item.path, text: item.text }));

  const { response, modelUsed } = await generateWithFallback({
    contents: `Proofread the following JSON array of text fields. Return ONLY fields that have genuine spelling, diacritic, accent, grammar, or punctuation mistakes:\n${JSON.stringify(payload)}`,
    config: {
      systemInstruction,
      temperature: 0,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fixes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                path: { type: Type.STRING },
                original: { type: Type.STRING },
                corrected: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ['path', 'original', 'corrected', 'reason'],
            },
          },
        },
        required: ['fixes'],
      },
    },
  });

  const parsed = JSON.parse(response.text || '{"fixes":[]}');
  const rawFixes: ProofreadFix[] = Array.isArray(parsed?.fixes) ? parsed.fixes : [];
  return { fixes: rawFixes, modelUsed };
}

/**
 * AI Proofreading Pass for generated metadata.
 * Never blocks or throws: if the AI call fails, returns the sanitized metadata with proofreadReport.error set.
 */
export async function proofreadMetadata(
  metadata: any,
  language: string,
  country: string
): Promise<{ metadata: any; proofreadReport: ProofreadReport }> {
  const entries = collectMetadataEntries(metadata);
  const marketRule = getMarketSeoRule(language);

  try {
    const { fixes: candidateFixes, modelUsed } = await runProofreadCall(
      entries.map((e) => ({ path: e.path, text: e.text })),
      language,
      country
    );

    const appliedFixes: ProofreadFix[] = [];

    for (const fix of candidateFixes) {
      if (!fix || typeof fix.path !== 'string' || typeof fix.corrected !== 'string') continue;

      const currentVal = getByPath(metadata, fix.path);
      if (typeof currentVal !== 'string') continue;

      const entryMeta = entries.find((e) => e.path === fix.path);
      const effectiveLang = entryMeta?.isVietnamese ? 'vi-VN' : language;
      const isTitleField = /^titles\[\d+\]\.localized$/.test(fix.path);
      const isTagField = /^tags\[\d+\]$/.test(fix.path);

      const sanitizedCorrected = sanitizeText(fix.corrected, effectiveLang, {
        isTitle: isTitleField || entryMeta?.isTitle,
        isTag: isTagField,
        multiline: fix.path === 'description' || fix.path === 'disclaimerText',
      });

      if (!sanitizedCorrected || sanitizedCorrected === currentVal) continue;

      // Verify "original" matches current value (either exact or after NFC/whitespace normalization)
      const normCurrent = currentVal.normalize('NFC').trim();
      const normOriginal = (fix.original || '').normalize('NFC').trim();
      if (normOriginal !== normCurrent) continue;

      // Guardrail: change must be small (Levenshtein distance <= 35% of original length)
      const dist = levenshteinDistance(normCurrent, sanitizedCorrected);
      const maxAllowedDist = Math.max(2, Math.floor(normCurrent.length * 0.35));
      if (dist > maxAllowedDist) continue;

      // Guardrail: must not push a localized title over the market character limit
      if (isTitleField) {
        const limit =
          normCurrent.length <= marketRule.titleIdealMax
            ? marketRule.titleIdealMax
            : marketRule.titleHardMax;
        if (sanitizedCorrected.length > limit) continue;
      }

      if (setByPath(metadata, fix.path, sanitizedCorrected)) {
        appliedFixes.push({
          path: fix.path,
          original: currentVal,
          corrected: sanitizedCorrected,
          reason: sanitizeText(fix.reason || 'Sửa lỗi chính tả / dấu câu', 'vi-VN'),
        });
      }
    }

    const proofreadReport: ProofreadReport = {
      checked: entries.length,
      fixed: appliedFixes.length,
      fixes: appliedFixes,
      modelUsed,
    };

    return { metadata, proofreadReport };
  } catch (err: any) {
    console.log('[Proofread Metadata] Non-fatal error, returning sanitized metadata:', err?.message);
    const proofreadReport: ProofreadReport = {
      checked: entries.length,
      fixed: 0,
      fixes: [],
      error: formatFriendlyError(err, 'Không thể soát chính tả tự động ở lượt này.'),
    };
    return { metadata, proofreadReport };
  }
}

/**
 * Proofreads the Vietnamese trend report markdown.
 * Accepts the corrected markdown ONLY if its length stays within ±10% of the original.
 */
async function proofreadTrendSummary(summary: string, targetLanguage: string): Promise<{
  summary: string;
  applied: boolean;
}> {
  const sanitizedOriginal = sanitizeText(summary, 'vi-VN', { multiline: true });
  if (!sanitizedOriginal || sanitizedOriginal.length < 30) {
    return { summary: sanitizedOriginal, applied: false };
  }

  try {
    const { response } = await generateWithFallback({
      contents: `Proofread the following Vietnamese YouTube trend report (which also contains search phrases in ${targetLanguage}).
Return ONLY the corrected markdown text without adding any intro or outro.

"""
${sanitizedOriginal}
"""`,
      config: {
        systemInstruction: `You are a strict native Vietnamese and ${targetLanguage} proofreader.
Fix ONLY Vietnamese spelling, diacritics, tone marks (e.g. "hoang dã" never "hoang dạng"), grammar, and punctuation, while keeping ${targetLanguage} search terms accurate.
Do NOT add or remove sections, do NOT change markdown headings/lists, and keep total length nearly identical to the original.

${getOrthographyRules(targetLanguage)}`,
        temperature: 0,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const candidate = sanitizeText(response.text || '', 'vi-VN', { multiline: true });
    if (!candidate) return { summary: sanitizedOriginal, applied: false };

    const origLen = sanitizedOriginal.length;
    const diffRatio = Math.abs(candidate.length - origLen) / origLen;
    if (diffRatio <= 0.1) {
      return { summary: candidate, applied: true };
    }
    return { summary: sanitizedOriginal, applied: false };
  } catch (err: any) {
    console.log('[Proofread Trends] Non-fatal error, keeping sanitized summary:', err?.message);
    return { summary: sanitizedOriginal, applied: false };
  }
}

// Phase 1: Real-time trends via Google Search grounding (with automatic fallback if Search grounding is rate-limited or returns 404/429/503)
app.post('/api/trends', async (req, res) => {
  try {
    const { script, selectedCountry, selectedLanguage, language, proofread = true } = req.body;
    const langCode = language || selectedLanguage || 'en-US';
    const orthographyRules = getOrthographyRules(langCode);

    const basePrompt = `You are a YouTube trend researcher for ${selectedCountry} (${selectedLanguage}).
Analyze what is trending and high-performing around the topic of this video script for viewers in ${selectedCountry} who speak ${selectedLanguage}.

Video script (excerpt):
"""
${(script || '').slice(0, 2500)}
"""

Report concisely in Vietnamese, using markdown with these exact sections:
1. **Xu hướng nóng tại ${selectedCountry}** — 3-5 angles, formats, or viewer hooks currently performing strongly around this topic.
2. **Từ khóa & cụm từ đang lên** — trending search phrases in ${selectedLanguage} (write them in ${selectedLanguage}, followed by a short Vietnamese meaning in parentheses).
3. **Công thức đặt tiêu đề của kênh lớn** — 2-3 high-CTR title patterns top creators in ${selectedCountry} use for this niche.
4. **Góc khai thác nên tránh** — saturated or low-retention angles to avoid.

Keep it under 320 words. Be concrete, actionable, and market-specific.

${orthographyRules}`;

    let summary = '';
    let sources: { title: string; url: string }[] = [];
    let mode: 'live_search' | 'ai_market_knowledge' = 'live_search';

    try {
      const { response: trendResp } = await generateWithFallback({
        contents: basePrompt,
        config: {
          systemInstruction: orthographyRules,
          tools: [{ googleSearch: {} }],
        },
        models: [
          'gemini-3.6-flash',
          'gemini-3.5-flash',
          'gemini-3-flash-preview',
          'gemini-3.8-flash',
          'gemini-flash-latest',
        ],
      });

      summary = trendResp.text || '';
      const chunks: any[] = (trendResp as any).candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      sources = chunks
        .map((c: any) => ({
          title: sanitizeText(c.web?.title || c.web?.uri || 'Nguồn tham khảo Google', 'vi-VN'),
          url: c.web?.uri || '',
        }))
        .filter((s: { url: string }) => s.url && /^https?:\/\//i.test(s.url))
        .slice(0, 6);
    } catch (groundingErr: any) {
      console.log('Search grounding rate-limited or unavailable, falling back to standard model knowledge.');
      mode = 'ai_market_knowledge';
      const { response: fallbackResp } = await generateWithFallback({
        contents: basePrompt,
        config: {
          systemInstruction: orthographyRules,
        },
      });
      summary = fallbackResp.text || '';
    }

    summary = sanitizeText(summary, 'vi-VN', { multiline: true });
    let proofreadApplied = false;

    if (proofread !== false && summary) {
      const pr = await proofreadTrendSummary(summary, langCode);
      summary = pr.summary;
      proofreadApplied = pr.applied;
    }

    res.json({ summary, sources, mode, proofreadApplied });
  } catch (error: any) {
    console.error('Trend scan server error:', error);
    res.status(503).json({
      error: formatFriendlyError(error, 'Không thể quét xu hướng lúc này. Vui lòng thử lại.'),
    });
  }
});

const VALID_CONTENT_TYPES: ContentType[] = ['DOC', 'EDU', 'SELF', 'REVIEW', 'CHALLENGE', 'NEWS', 'ENT'];
const ALL_ARCHETYPES: TitleArchetype[] = [
  'SEO-Anchor',
  'Curiosity-Gap',
  'Number / Specificity',
  'Contrast / Authority',
  'Native-Emotional / Trend',
];

function parseContentType(raw: unknown): ContentType | 'AUTO' {
  if (typeof raw === 'string' && (VALID_CONTENT_TYPES as string[]).includes(raw)) {
    return raw as ContentType;
  }
  return 'AUTO';
}

function parsePreferredFormatIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const item of raw) {
    const num = Number(item);
    if (Number.isInteger(num) && num >= 1 && num <= 100 && !seen.has(num)) {
      seen.add(num);
      out.push(num);
      if (out.length >= 5) break;
    }
  }
  return out;
}

function buildPromptCandidateFormats(
  contentType: ContentType | 'AUTO',
  allowFirstPerson: boolean,
  preferredIds: number[]
): TitleFormat[] {
  const primary = selectCandidateFormats(contentType, { allowFirstPerson, preferredIds });
  const selected: TitleFormat[] = [];
  const seen = new Set<number>();

  const pushFormat = (f: TitleFormat) => {
    if (!seen.has(f.id) && selected.length < 40) {
      seen.add(f.id);
      selected.push(f);
    }
  };

  for (const id of preferredIds) {
    const f = primary.find((c) => c.id === id);
    if (f) pushFormat(f);
  }

  for (const arch of ALL_ARCHETYPES) {
    const archMatches = primary.filter((f) => f.archetype === arch);
    for (const f of archMatches.slice(0, 5)) {
      pushFormat(f);
    }
  }

  const fallbackPool = selectCandidateFormats('AUTO', { allowFirstPerson, preferredIds });
  for (const arch of ALL_ARCHETYPES) {
    if (!selected.some((f) => f.archetype === arch)) {
      const fallbackMatch = fallbackPool.find((f) => f.archetype === arch);
      if (fallbackMatch) pushFormat(fallbackMatch);
    }
  }

  for (const f of primary) {
    if (selected.length >= 40) break;
    pushFormat(f);
  }

  return selected;
}

function formatCandidateLibraryLines(candidates: TitleFormat[]): string {
  return candidates
    .slice(0, 40)
    .map((f) => `#${f.id} | ${f.pattern} | ${f.archetype} | ${f.risk}`)
    .join('\n');
}

// Phase 2: Comprehensive YouTube SEO metadata generation
app.post('/api/metadata', async (req, res) => {
  try {
    const {
      script,
      country,
      selectedCountry,
      language,
      selectedLanguage,
      selectedTitleStyle,
      channelName,
      brandVoice,
      descriptionLength,
      selectedDescStyle,
      selectedTone,
      selectedDensity,
      selectedDisclaimer,
      trendContext,
      proofread = true,
      contentType = 'AUTO',
      allowFirstPerson = false,
      preferredFormatIds = [],
    } = req.body;

    const langCode = language || selectedLanguage || 'en-US';
    const orthographyRules = getOrthographyRules(langCode);
    const marketRule = getMarketSeoRule(langCode);
    const playbook = getMarketTitlePlaybook(langCode);

    const parsedContentType = parseContentType(contentType);
    const allowFP = Boolean(allowFirstPerson);
    const pinnedIds = parsePreferredFormatIds(preferredFormatIds);
    const candidateFormats = buildPromptCandidateFormats(parsedContentType, allowFP, pinnedIds);
    const candidateLibraryBlock = formatCandidateLibraryLines(candidateFormats);

    const isDefaultCapStyle =
      !selectedTitleStyle ||
      selectedTitleStyle === 'auto' ||
      selectedTitleStyle === 'native' ||
      selectedTitleStyle.includes('Tự động') ||
      selectedTitleStyle.includes('Chuẩn bản địa');

    const { response } = await generateWithFallback({
      contents: `Generate a complete, studio-grade YouTube SEO & localization package for the following market:
        Script: ${script}
        Target Country (ISO 3166): ${country} (${selectedCountry})
        Output Language (BCP 47): ${language} (${selectedLanguage})
        Title Capitalization Style: ${selectedTitleStyle}
        Content Type Setting: ${parsedContentType}
        Allow First-Person ("I ...") Titles: ${allowFP ? 'Yes' : 'No'}
        Pinned Preferred Format IDs: ${pinnedIds.length > 0 ? pinnedIds.map((id) => `#${id}`).join(', ') : 'None'}
        Channel Name: ${channelName || 'Not provided'}
        Brand Voice: ${brandVoice || 'Professional & Engaging'}
        Description Length: ${descriptionLength}
        Description Style: ${selectedDescStyle}
        SEO Keyword Tone: ${selectedTone}
        Keyword Density: ${selectedDensity}
        Disclaimer Mode: ${selectedDisclaimer}
        ${trendContext ? `\nLIVE TREND RESEARCH (use this to make titles/keywords/hashtags ride current trends — but NEVER invent facts not in the script):\n"""\n${trendContext}\n"""` : ''}`,
      config: {
        temperature: 0.65,
        systemInstruction: `You are a senior YouTube SEO metadata strategist AND a native ${selectedCountry} market copywriter writing in ${selectedLanguage}.
          Analyze the video script and generate localized metadata that maximizes CLICK-THROUGH RATE (CTR) and WATCH TIME while staying 100% within YouTube's policies.

          ===== COMPLIANCE GUARDRAIL (HARD RULES — non-negotiable) =====
          YouTube penalizes videos when the title or thumbnail promises something the video does not deliver. Therefore:
          - Every title and every thumbnail text MUST be a promise the SCRIPT actually fulfills.
          - NEVER invent facts, numbers, quotes, deaths, arrests, or events not present in the script.
          - Create intrigue with a CURIOSITY GAP that the content pays off — never with deception.

          ===== CORE OBJECTIVES =====
          - Write human-sounding, persuasive, scannable metadata that a native ${selectedCountry} creator would write — not a literal translation.
          - Optimize for CTR and local search intent together.
          - Distribute keywords intelligently using "Keyword Density: ${selectedDensity}".

          ===== KEYWORD STRATEGY =====
          1. Identify 1 Primary Keyword and 2-4 Secondary Keywords from the script in ${selectedLanguage}.
          2. Put the Primary Keyword early (first 1-2 sentences of the description).
          3. Spread Secondary Keywords naturally; use semantic (LSI) variations and native synonyms.

          ===== DESCRIPTION ("Style: ${selectedDescStyle}") =====
          1. HOOK: 1-2 sentences stating the value, keyword-rich, front-loaded (shows before "...more").
          2. CORE VALUE: what the viewer will learn/experience.
          3. VIDEO CHAPTERS / TIMESTAMPS: include a clean block of timestamps (starting with 00:00) matching the "chapters" array.
          4. CTA: a native, non-spammy call to action.
          5. DISCLAIMER: add per SMART DISCLAIMER LOGIC below.

          ===== VIDEO CHAPTERS ("chapters", 4-7 chapters) =====
          - Segment the script into 4-7 logical chapters starting at "00:00". If the script already has timestamps, use them; otherwise estimate realistic timestamps (e.g. 00:00, 01:15, 03:30...).
          - "title": chapter title in ${selectedLanguage} optimized for Google Key Moments search.
          - "vietnamese": Vietnamese translation of the chapter title.
          - "seoKeyword": the sub-keyword targeted by this chapter.

          ===== PINNED COMMENTS ("pinnedComments", 3 options) =====
          - Generate 3 high-engagement Pinned Comment options in ${selectedLanguage} to spark viewer debate/questions in the comments section.
          - Include "vietnamese" translation and "strategy" (1 short Vietnamese phrase explaining the psychological hook, e.g. "Khơi gợi tranh luận", "Khảo sát trải nghiệm", "Ghim tài liệu & câu hỏi mở").

          ===== THUMBNAIL TEXT & VISUAL CONCEPTS =====
          - "thumbnailTexts": 4-5 short punchy text overlays in ${selectedLanguage} (2-5 words each, high contrast, never repeating the title verbatim).
          - "thumbnailConcepts": 3 complete thumbnail art direction concepts. Each has:
            * "textOverlay": 2-4 words in ${selectedLanguage}
            * "vietnamese": Vietnamese translation of the text overlay
            * "visualScene": 1-2 sentences in Vietnamese describing the exact foreground subject, facial expression/object, and background composition
            * "colorPsychology": short Vietnamese note on contrast colors to use (e.g. "Chữ vàng tươi trên nền tối xanh đậm, viền đỏ nhấn mạnh")

          ===== SMART DISCLAIMER LOGIC =====
          - If Disclaimer Mode is "Auto", scan for Medical/Health, Finance/Crypto/Investing, Legal, High-risk activities, or Affiliate/Sponsorship.
          - If detected or explicitly selected ("${selectedDisclaimer}"), append a professional localized disclaimer at the END of the description AND return it in "disclaimerText" (in ${selectedLanguage}).
          - If none needed: disclaimerUsed=false, disclaimerType="none", disclaimerText="".

          ===== MARKET TITLE SEO RULES for ${selectedCountry} / ${selectedLanguage} =====
          - Ideal title length: ${marketRule.titleIdealMin}-${marketRule.titleIdealMax} characters (hard max ${marketRule.titleHardMax} characters).
          - Market Playbook: ${playbook}
          - Universal Title Rules:
            * Every one of the 5 titles MUST contain the primaryKeyword or its closest native search variant.
            * Place the primaryKeyword inside the first 40 characters (before mobile cut-off).
            * NEVER include hashtags or the channel name inside titles.
            * Maximum 1 emoji per title (prefer 0 emojis).
            * No misleading ALL CAPS.
            * The 5 titles must be clearly different angles, not paraphrases of one another.
            * Capitalization override: ${
              isDefaultCapStyle
                ? 'Follow the Market Playbook capitalization rule above.'
                : `The user explicitly selected "${selectedTitleStyle}" — override the playbook capitalization with "${selectedTitleStyle}".`
            }

          ===== SNAKEMEDIA LONG-FORM ANALYTICAL & STORYTELLING TITLE ENGINE =====
          Prioritize deep curiosity, narrative tension, causal mechanisms, and watch-time retention over cheap clickbait.
          Use the TITLE FORMAT LIBRARY below.

          ===== TITLE FORMAT LIBRARY (candidates) =====
          ${candidateLibraryBlock}

          Content Type Detection & Formula Assignment Rules:
          - ${
            parsedContentType === 'AUTO'
              ? 'Content Type is AUTO: infer the best matching content category from the script and return it in top-level "detectedContentType" (one of: DOC, EDU, SELF, REVIEW, CHALLENGE, NEWS, ENT).'
              : `Use "${parsedContentType}" as "detectedContentType".`
          }
          - Map each of the 5 DISTINCT titles strictly to its archetype (set "angle" to the exact archetype name) AND select 5 DISTINCT "formatId" integers from the TITLE FORMAT LIBRARY above matching that archetype:
            1. SEO-Anchor — clear search intent + primary keyword in the first 3-5 words.
            2. Curiosity-Gap — genuine open loop / mystery answered by the script.
            3. Number / Specificity — concrete count, scale, timeframe, or structural levels grounded directly in the script.
            4. Contrast / Authority — expectation vs reality, hidden mechanism, or root cause.
            5. Native-Emotional / Trend — natural local phrasing + narrative tension, relatability, or trend hook (ride LIVE TREND RESEARCH if provided).
          - ${
            pinnedIds.length > 0
              ? `PRIORITIZE these user-pinned format IDs whenever compatible with the script: ${pinnedIds.map((id) => `#${id}`).join(', ')}.`
              : 'Select the strongest formatId per archetype for this script.'
          }
          - Treat each format pattern as a structural skeleton ONLY — REWRITE it natively using the Market Playbook and target language idioms (NEVER translate the English pattern literally).
          - ${
            allowFP
              ? 'First-person ("I ...") formats are allowed where appropriate for the script.'
              : 'First-person ("I ...") formats are FORBIDDEN — never select or write first-person titles.'
          }
          - Only use a format marked "medium" risk if the script literally supports the claim, AND set that title's complianceRisk to at least "Trung bình" (never "Thấp").
          - Fill [brackets] ONLY with real facts, entities, and numbers present in the script — NEVER invent numbers or claims.
          - Adapt idioms and tone naturally to the target Market Playbook above; avoid aggressive, guaranteed, or misleading claims on sensitive topics (finance, health, legal, kids).

          Set exactly ONE title isBestOverall=true; a title with complianceRisk "Cao" can never be best.
          IMPORTANT SCORE SCALE: ctrScore is an integer 0-100 (e.g. 88, 92 — NEVER use a 0-10 scale). Similarly, opportunityScore and all seoScore fields (overall, title, description, tags, keywordUsage) are integers 0-100.
          In each title's "reason" field (written in Vietnamese), name the exact applied formula (e.g. "Công thức #13 Rise & Fall + quy tắc ja-JP 【】"), explain why it drives clicks & watch-time retention, AND state which market SEO rule from the playbook above it uses.
          Output ONLY valid JSON matching the schema.

          ${orthographyRules}`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedContentType: {
              type: Type.STRING,
              enum: ['DOC', 'EDU', 'SELF', 'REVIEW', 'CHALLENGE', 'NEWS', 'ENT'],
            },
            titles: {
              type: Type.ARRAY,
              minItems: 5,
              maxItems: 5,
              items: {
                type: Type.OBJECT,
                properties: {
                  localized: { type: Type.STRING },
                  vietnamese: { type: Type.STRING },
                  angle: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  isBestOverall: { type: Type.BOOLEAN },
                  ctrScore: { type: Type.NUMBER, description: 'ctrScore is an integer 0-100' },
                  complianceRisk: { type: Type.STRING, enum: ['Thấp', 'Trung bình', 'Cao'] },
                  complianceNote: { type: Type.STRING },
                  formatId: { type: Type.INTEGER, description: 'Selected ID from TITLE FORMAT LIBRARY' },
                },
                required: [
                  'localized',
                  'vietnamese',
                  'angle',
                  'reason',
                  'isBestOverall',
                  'ctrScore',
                  'complianceRisk',
                  'complianceNote',
                  'formatId',
                ],
              },
            },
            primaryKeyword: { type: Type.STRING },
            keywordInsights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  keyword: { type: Type.STRING },
                  searchVolume: { type: Type.STRING, enum: ['Cao', 'Trung bình', 'Thấp'] },
                  competition: { type: Type.STRING, enum: ['Cao', 'Trung bình', 'Thấp'] },
                  opportunityScore: { type: Type.NUMBER },
                },
                required: ['keyword', 'searchVolume', 'competition', 'opportunityScore'],
              },
            },
            description: { type: Type.STRING },
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING },
                  title: { type: Type.STRING },
                  vietnamese: { type: Type.STRING },
                  seoKeyword: { type: Type.STRING },
                },
                required: ['timestamp', 'title', 'vietnamese', 'seoKeyword'],
              },
            },
            pinnedComments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  localized: { type: Type.STRING },
                  vietnamese: { type: Type.STRING },
                  strategy: { type: Type.STRING },
                },
                required: ['localized', 'vietnamese', 'strategy'],
              },
            },
            thumbnailConcepts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  textOverlay: { type: Type.STRING },
                  vietnamese: { type: Type.STRING },
                  visualScene: { type: Type.STRING },
                  colorPsychology: { type: Type.STRING },
                },
                required: ['textOverlay', 'vietnamese', 'visualScene', 'colorPsychology'],
              },
            },
            disclaimerUsed: { type: Type.BOOLEAN },
            disclaimerType: { type: Type.STRING },
            disclaimerText: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            thumbnailTexts: { type: Type.ARRAY, items: { type: Type.STRING } },
            seoNotes: { type: Type.STRING },
            trendAlignment: { type: Type.STRING },
            targetAudience: { type: Type.STRING },
            searchIntent: { type: Type.STRING },
            seoScore: {
              type: Type.OBJECT,
              properties: {
                overall: { type: Type.NUMBER },
                title: { type: Type.NUMBER },
                description: { type: Type.NUMBER },
                tags: { type: Type.NUMBER },
                keywordUsage: { type: Type.NUMBER },
              },
              required: ['overall', 'title', 'description', 'tags', 'keywordUsage'],
            },
          },
          required: [
            'detectedContentType',
            'titles',
            'primaryKeyword',
            'keywordInsights',
            'description',
            'chapters',
            'pinnedComments',
            'thumbnailConcepts',
            'disclaimerUsed',
            'disclaimerType',
            'disclaimerText',
            'tags',
            'hashtags',
            'thumbnailTexts',
            'seoNotes',
            'trendAlignment',
            'targetAudience',
            'searchIntent',
            'seoScore',
          ],
        },
      },
    });

    const text = response.text || '{}';
    let metadataObj = deepSanitize(JSON.parse(text), langCode);

    // Validate detectedContentType
    if (parsedContentType !== 'AUTO') {
      metadataObj.detectedContentType = parsedContentType;
    } else if (!VALID_CONTENT_TYPES.includes(metadataObj.detectedContentType)) {
      metadataObj.detectedContentType = 'DOC';
    }

    if (Array.isArray(metadataObj.titles)) {
      let titles = metadataObj.titles.slice(0, 5);
      // Normalize ctrScore: if every ctrScore <= 10, multiply by 10; clamp to 0-100
      const allCtrLe10 =
        titles.length > 0 &&
        titles.every((t: any) => (Number(t?.ctrScore) || 0) <= 10) &&
        titles.some((t: any) => (Number(t?.ctrScore) || 0) > 0);
      const usedFormatIds = new Set<number>();
      titles.forEach((t: any) => {
        const rawCtr = Number(t?.ctrScore) || 0;
        const scaledCtr = allCtrLe10 ? rawCtr * 10 : rawCtr;
        t.ctrScore = Math.min(100, Math.max(0, Math.round(scaledCtr)));

        // Validate & deduplicate formatId against TITLE_FORMATS
        const parsedFmtId = Number(t?.formatId);
        const fmt =
          Number.isInteger(parsedFmtId) && parsedFmtId >= 1 && parsedFmtId <= 100
            ? getTitleFormat(parsedFmtId)
            : undefined;
        if (!fmt || usedFormatIds.has(fmt.id) || (!allowFP && fmt.firstPerson)) {
          t.formatId = null;
        } else {
          usedFormatIds.add(fmt.id);
          t.formatId = fmt.id;
          if (fmt.risk === 'medium' && t.complianceRisk === 'Thấp') {
            t.complianceRisk = 'Trung bình';
          }
        }

        // A title with complianceRisk "Cao" can never be best
        if (t.complianceRisk === 'Cao') {
          t.isBestOverall = false;
        }
      });
      const validBests = titles.filter((t: any) => t.isBestOverall && t.complianceRisk !== 'Cao');
      if (validBests.length !== 1) {
        titles.forEach((t: any) => {
          t.isBestOverall = false;
        });
        const nonHighRisk = titles.filter((t: any) => t.complianceRisk !== 'Cao');
        const pool = nonHighRisk.length > 0 ? nonHighRisk : titles;
        if (pool.length > 0) {
          let bestCandidate = pool[0];
          for (const candidate of pool) {
            if ((Number(candidate.ctrScore) || 0) > (Number(bestCandidate.ctrScore) || 0)) {
              bestCandidate = candidate;
            }
          }
          bestCandidate.isBestOverall = true;
        }
      }
      // Sort so the best title is first and the rest by ctrScore desc
      titles.sort((a: any, b: any) => {
        if (a.isBestOverall && !b.isBestOverall) return -1;
        if (!a.isBestOverall && b.isBestOverall) return 1;
        return (Number(b.ctrScore) || 0) - (Number(a.ctrScore) || 0);
      });
      metadataObj.titles = titles;
    }

    if (Array.isArray(metadataObj.keywordInsights) && metadataObj.keywordInsights.length > 0) {
      const allKwLe10 =
        metadataObj.keywordInsights.every((k: any) => (Number(k?.opportunityScore) || 0) <= 10) &&
        metadataObj.keywordInsights.some((k: any) => (Number(k?.opportunityScore) || 0) > 0);
      metadataObj.keywordInsights.forEach((k: any) => {
        const raw = Number(k?.opportunityScore) || 0;
        k.opportunityScore = Math.min(100, Math.max(0, Math.round(allKwLe10 ? raw * 10 : raw)));
      });
    }

    if (metadataObj.seoScore && typeof metadataObj.seoScore === 'object') {
      const s = metadataObj.seoScore;
      const vals = [
        Number(s.overall) || 0,
        Number(s.title) || 0,
        Number(s.description) || 0,
        Number(s.tags) || 0,
        Number(s.keywordUsage) || 0,
      ];
      const allSeoLe10 = vals.every((v) => v <= 10) && vals.some((v) => v > 0);
      const norm = (v: number) => Math.min(100, Math.max(0, Math.round(allSeoLe10 ? v * 10 : v)));
      metadataObj.seoScore = {
        overall: norm(vals[0]),
        title: norm(vals[1]),
        description: norm(vals[2]),
        tags: norm(vals[3]),
        keywordUsage: norm(vals[4]),
      };
    }

    if (proofread !== false) {
      const { metadata: checkedMeta, proofreadReport } = await proofreadMetadata(
        metadataObj,
        langCode,
        country || selectedCountry || 'US'
      );
      metadataObj = deepSanitize(checkedMeta, langCode);
      metadataObj.proofreadReport = proofreadReport;
    }

    res.json(metadataObj);
  } catch (error: any) {
    console.error('Metadata generation server error:', error);
    res.status(503).json({
      error: formatFriendlyError(error, 'Không thể tạo metadata lúc này. Vui lòng thử lại.'),
    });
  }
});

// Phase 3: Instant A/B Title Refiner & Hook Multiplier
app.post('/api/refine-title', async (req, res) => {
  try {
    const {
      baseTitle,
      primaryKeyword,
      selectedCountry,
      selectedLanguage,
      language,
      scriptExcerpt,
      contentType = 'AUTO',
      allowFirstPerson = false,
      preferredFormatIds = [],
    } = req.body;
    if (!baseTitle) {
      res.status(400).json({ error: 'Thiếu tiêu đề gốc để tối ưu.' });
      return;
    }

    const langCode = language || selectedLanguage || 'en-US';
    const orthographyRules = getOrthographyRules(langCode);
    const marketRule = getMarketSeoRule(langCode);
    const playbook = getMarketTitlePlaybook(langCode);

    const parsedContentType = parseContentType(contentType);
    const allowFP = Boolean(allowFirstPerson);
    const pinnedIds = parsePreferredFormatIds(preferredFormatIds);
    const candidateFormats = buildPromptCandidateFormats(parsedContentType, allowFP, pinnedIds);
    const candidateLibraryBlock = formatCandidateLibraryLines(candidateFormats);

    const { response } = await generateWithFallback({
      contents: `You are a YouTube A/B Title Testing Specialist for the ${selectedCountry} (${selectedLanguage}) market using the SNAKEMEDIA LONG-FORM ANALYTICAL & STORYTELLING TITLE ENGINE.
Base Title: "${baseTitle}"
Primary Keyword: "${primaryKeyword || ''}"
Script Context: "${(scriptExcerpt || '').slice(0, 1000)}"
Market SEO Length: ideal ${marketRule.titleIdealMin}-${marketRule.titleIdealMax} chars (hard max ${marketRule.titleHardMax}).
Market Playbook: ${playbook}
Content Type: ${parsedContentType} | Allow First-Person ("I ..."): ${allowFP ? 'Yes' : 'No'} | Pinned Formats: ${pinnedIds.length > 0 ? pinnedIds.map((id) => `#${id}`).join(', ') : 'None'}

Prioritize deep curiosity, narrative tension, causal mechanisms, and watch-time retention over cheap clickbait.
Use the TITLE FORMAT LIBRARY below.

===== TITLE FORMAT LIBRARY (candidates) =====
${candidateLibraryBlock}

Generate 5 distinct, high-CTR A/B variations of this title in ${selectedLanguage}, one per archetype using 5 distinct formats from the TITLE FORMAT LIBRARY above:
1. SEO-Anchor — clear search intent + primary keyword early, front-loaded for mobile.
2. Curiosity-Gap — genuine open loop / mystery answered by the script.
3. Number / Specificity — concrete count, scale, or structural levels grounded in the script.
4. Contrast / Authority — expectation vs reality, hidden mechanism, or root cause.
5. Native-Emotional / Trend — natural local phrasing + tension/relatability/trend hook.

Rules:
- Treat patterns as structural skeletons ONLY and rewrite natively according to the Market Playbook (never literal English translation).
- ${allowFP ? 'First-person ("I ...") formats are allowed if consistent with script.' : 'NEVER use first-person ("I ...") title framing.'}
- Fill [brackets] ONLY with facts/numbers grounded in the script context; never promise a shortcut or shock that contradicts a long-form analytical script.
- Adapt idioms and tone naturally to the target market playbook; avoid aggressive/misleading claims on sensitive topics (finance, health, legal, kids).
- ctrScore MUST be an integer 0-100. Write "whyItWorks" in concise Vietnamese naming the formula #id applied.

${orthographyRules}`,
      config: {
        systemInstruction: orthographyRules,
        temperature: 0.65,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variants: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  localized: { type: Type.STRING },
                  vietnamese: { type: Type.STRING },
                  style: { type: Type.STRING },
                  ctrScore: { type: Type.NUMBER, description: 'Estimated CTR score from 0 to 100' },
                  whyItWorks: { type: Type.STRING },
                },
                required: ['localized', 'vietnamese', 'style', 'ctrScore', 'whyItWorks'],
              },
            },
          },
          required: ['variants'],
        },
      },
    });

    const parsed = deepSanitize(JSON.parse(response.text || '{"variants":[]}'), langCode);
    if (Array.isArray(parsed.variants) && parsed.variants.length > 0) {
      const allVarLe10 =
        parsed.variants.every((v: any) => (Number(v?.ctrScore) || 0) <= 10) &&
        parsed.variants.some((v: any) => (Number(v?.ctrScore) || 0) > 0);
      parsed.variants.forEach((v: any) => {
        const raw = Number(v?.ctrScore) || 0;
        v.ctrScore = Math.min(100, Math.max(0, Math.round(allVarLe10 ? raw * 10 : raw)));
      });
    }
    res.json(parsed);
  } catch (error: any) {
    console.error('Title refine error:', error);
    res.status(503).json({
      error: formatFriendlyError(error, 'Không thể tạo biến thể tiêu đề. Vui lòng thử lại.'),
    });
  }
});

// Phase 4: On-demand AI Proofreader for manual re-checks
app.post('/api/proofread', async (req, res) => {
  try {
    const { texts, language = 'en-US', country = 'US' } = req.body;
    if (!Array.isArray(texts) || texts.length === 0) {
      res.status(400).json({ error: 'Danh sách văn bản cần soát chính tả trống.' });
      return;
    }

    const marketRule = getMarketSeoRule(language);
    const sanitizedInputs = texts
      .filter((t: any) => t && typeof t.path === 'string' && typeof t.text === 'string' && t.text.trim())
      .map((t: any) => {
        const isVietnamese =
          t.path.endsWith('.vietnamese') ||
          t.path.endsWith('.reason') ||
          t.path.endsWith('.complianceNote') ||
          t.path === 'seoNotes' ||
          t.path === 'trendAlignment';
        const isTitle =
          /^titles\[\d+\]\.localized$/.test(t.path) ||
          t.path === 'customTitleOverride' ||
          t.path.endsWith('.title');
        const isTag = /^tags\[\d+\]$/.test(t.path);
        return {
          path: t.path,
          rawText: t.text,
          text: sanitizeText(t.text, isVietnamese ? 'vi-VN' : language, {
            isTitle,
            isTag,
            multiline: t.path === 'description' || t.path === 'disclaimerText',
          }),
          isVietnamese,
          isTitle,
          isTag,
        };
      });

    const { fixes: candidateFixes, modelUsed } = await runProofreadCall(
      sanitizedInputs.map((i) => ({ path: i.path, text: i.text })),
      language,
      country
    );

    const validatedFixes: ProofreadFix[] = [];
    const fixedPaths = new Set<string>();

    for (const fix of candidateFixes) {
      if (!fix || typeof fix.path !== 'string' || typeof fix.corrected !== 'string') continue;
      const inputItem = sanitizedInputs.find((i) => i.path === fix.path);
      if (!inputItem) continue;

      const effectiveLang = inputItem.isVietnamese ? 'vi-VN' : language;
      const sanitizedCorrected = sanitizeText(fix.corrected, effectiveLang, {
        isTitle: inputItem.isTitle,
        isTag: inputItem.isTag,
        multiline: inputItem.path === 'description' || inputItem.path === 'disclaimerText',
      });

      if (!sanitizedCorrected || sanitizedCorrected === inputItem.rawText) continue;

      const normCurrent = inputItem.text.normalize('NFC').trim();
      const normOriginal = (fix.original || '').normalize('NFC').trim();
      if (normOriginal !== normCurrent) continue;

      const dist = levenshteinDistance(normCurrent, sanitizedCorrected);
      const maxAllowedDist = Math.max(2, Math.floor(normCurrent.length * 0.35));
      if (dist > maxAllowedDist) continue;

      if (inputItem.isTitle) {
        const limit =
          normCurrent.length <= marketRule.titleIdealMax
            ? marketRule.titleIdealMax
            : marketRule.titleHardMax;
        if (sanitizedCorrected.length > limit) continue;
      }

      fixedPaths.add(fix.path);
      validatedFixes.push({
        path: fix.path,
        original: inputItem.rawText,
        corrected: sanitizedCorrected,
        reason: sanitizeText(fix.reason || 'Chuẩn hóa chính tả & dấu câu', 'vi-VN'),
      });
    }

    // Also include deterministic sanitizer fixes if the user typed spacing/punctuation errors that didn't need AI changes
    for (const item of sanitizedInputs) {
      if (!fixedPaths.has(item.path) && item.text !== item.rawText) {
        validatedFixes.push({
          path: item.path,
          original: item.rawText,
          corrected: item.text,
          reason: 'Chuẩn hóa khoảng trắng, dấu câu & mã Unicode NFC',
        });
      }
    }

    const report: ProofreadReport = {
      checked: sanitizedInputs.length,
      fixed: validatedFixes.length,
      fixes: validatedFixes,
      modelUsed,
    };

    res.json(report);
  } catch (error: any) {
    console.error('Manual proofread error:', error);
    res.status(503).json({
      error: formatFriendlyError(error, 'Không thể soát chính tả lúc này. Vui lòng thử lại.'),
    });
  }
});

// Catch-all for unknown /api/* routes so they return clean JSON instead of HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({
    error: `API endpoint không tồn tại: ${req.method} ${req.originalUrl}`,
  });
});

async function startServer() {
  const isDevMode = Boolean(process.env.NGINX_PORT) || process.env.NODE_ENV === 'development';
  const distPath = path.join(__dirname, 'dist');
  const hasBuiltDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (hasBuiltDist && !isDevMode) {
    app.use(express.static(distPath, { index: 'index.html' }));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/assets/')) {
        return res.status(404).end();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`);
  });
}

startServer();

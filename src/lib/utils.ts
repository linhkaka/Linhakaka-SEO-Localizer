import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { YouTubeMetadata, ChecklistItem, SeoScoreBreakdown } from '@/src/types';
import { getMarketSeoRule } from '@/src/constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface KeywordMatchResult {
  found: boolean;
  inFirst40: boolean;
  matchedToken: string;
}

const PUNCT_AND_BRACKETS_RE =
  /[【】「」『』［］（）()\[\]{}<>《》〈〉"“”'‘’、。・，．,.:;!?！？/／\\|｜~〜—–\-_#@$%^&*+=]+/g;

function normalizeForKeywordMatch(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFKC')
    .toLowerCase()
    .replace(PUNCT_AND_BRACKETS_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripAllPunctAndSpaces(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFKC')
    .toLowerCase()
    .replace(PUNCT_AND_BRACKETS_RE, '')
    .replace(/\s+/g, '');
}

/**
 * Finds the earliest character index in the original NFKC-lowercased title where `token` appears
 * (falling back to the bracket-stripped title position if punctuation was inside the token).
 */
function findTokenPosition(rawNormTitle: string, cleanTitleNoPunct: string, token: string): number {
  const cleanTok = token.replace(PUNCT_AND_BRACKETS_RE, '').trim();
  if (!cleanTok) return -1;

  const directIdx = rawNormTitle.indexOf(cleanTok);
  if (directIdx !== -1) return directIdx;

  const strippedIdx = cleanTitleNoPunct.indexOf(cleanTok);
  return strippedIdx;
}

/**
 * Shared keyword matcher for both title card badges and the On-Page SEO checklist.
 * Handles multi-word keywords, bracketed prefixes (【...】), and CJK (ja/zh/ko) compounds/abbreviations.
 */
export function keywordMatchInfo(
  title: string,
  primaryKeyword: string,
  lang: string = 'en-US'
): KeywordMatchResult {
  if (!title || !primaryKeyword || !primaryKeyword.trim()) {
    return { found: false, inFirst40: false, matchedToken: '' };
  }

  const rawNormTitle = title.normalize('NFKC').toLowerCase();
  const cleanTitle = normalizeForKeywordMatch(title);
  const cleanTitleNoPunct = stripAllPunctAndSpaces(title);
  const cleanKw = normalizeForKeywordMatch(primaryKeyword);
  const cleanKwNoPunct = stripAllPunctAndSpaces(primaryKeyword);

  if (!cleanKw && !cleanKwNoPunct) {
    return { found: false, inFirst40: false, matchedToken: '' };
  }

  const isCJK = /^(ja|zh|ko)(-|$)/i.test(lang || '') || /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(primaryKeyword);

  // 1. Full phrase match first
  if (cleanKw && cleanTitle.includes(cleanKw)) {
    const pos = rawNormTitle.indexOf(cleanKw) !== -1 ? rawNormTitle.indexOf(cleanKw) : cleanTitle.indexOf(cleanKw);
    return {
      found: true,
      inFirst40: pos >= 0 && pos < 40,
      matchedToken: primaryKeyword.trim(),
    };
  }

  if (isCJK && cleanKwNoPunct.length >= 2 && cleanTitleNoPunct.includes(cleanKwNoPunct)) {
    const pos = findTokenPosition(rawNormTitle, cleanTitleNoPunct, cleanKwNoPunct);
    return {
      found: true,
      inFirst40: pos >= 0 && pos < 40,
      matchedToken: primaryKeyword.trim(),
    };
  }

  // 2. Split primaryKeyword on spaces / 、 / ・ and brackets/punctuation into tokens (>= 2 chars)
  const rawTokens = primaryKeyword
    .normalize('NFKC')
    .split(/[\s、・,，/／|｜【】「」『』［］（）()\[\]{}<>《》〈〉"“”'‘’.:;!?！？~〜—–\-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const matchedTokens: { token: string; pos: number }[] = [];

  for (const tok of rawTokens) {
    const normTok = tok.toLowerCase();
    const pos = findTokenPosition(rawNormTitle, cleanTitleNoPunct, normTok);
    if (pos !== -1) {
      matchedTokens.push({ token: tok, pos });
    }
  }

  if (rawTokens.length > 0) {
    const minRequired = Math.max(1, Math.floor(rawTokens.length / 2));
    const halfMatched = matchedTokens.length >= Math.max(1, Math.ceil(rawTokens.length / 2));
    if (halfMatched || (isCJK && matchedTokens.length >= minRequired)) {
      matchedTokens.sort((a, b) => a.pos - b.pos);
      const firstPos = matchedTokens[0].pos;
      const bestDisplayToken =
        matchedTokens.find((m) => m.pos < 40)?.token || matchedTokens[0].token;
      return {
        found: true,
        inFirst40: firstPos >= 0 && firstPos < 40,
        matchedToken: bestDisplayToken,
      };
    }
  }

  // 3. CJK (ja/zh/ko) fallback: accept if any 2+ character token/segment or the first 2-3 CJK characters appear
  if (isCJK) {
    // Check any already-matched 2+ char token first
    if (matchedTokens.length > 0) {
      matchedTokens.sort((a, b) => a.pos - b.pos);
      const firstPos = matchedTokens[0].pos;
      return {
        found: true,
        inFirst40: firstPos >= 0 && firstPos < 40,
        matchedToken: matchedTokens[0].token,
      };
    }

    // Extract contiguous Kanji / Katakana / Hangul / Alphanumeric sub-tokens (splitting out Hiragana grammatical particles)
    const cjkSubTokens =
      primaryKeyword
        .normalize('NFKC')
        .match(/[\u30a0-\u30ffー]{2,}|[\u4e00-\u9fff]{2,}|[\uac00-\ud7af]{2,}|[a-zA-Z0-9]{2,}/g) || [];

    const subMatches: { token: string; pos: number }[] = [];
    for (const sub of cjkSubTokens) {
      const pos = findTokenPosition(rawNormTitle, cleanTitleNoPunct, sub.toLowerCase());
      if (pos !== -1) {
        subMatches.push({ token: sub, pos });
      }
    }

    if (subMatches.length > 0) {
      subMatches.sort((a, b) => a.pos - b.pos);
      const firstPos = subMatches[0].pos;
      return {
        found: true,
        inFirst40: firstPos >= 0 && firstPos < 40,
        matchedToken: subMatches[0].token,
      };
    }

    // Check first 3 then first 2 CJK characters of the keyword (or of its tokens, e.g. ノートパソコン -> ノート)
    const candidateSources = [cleanKwNoPunct, ...rawTokens.map((t) => stripAllPunctAndSpaces(t)), ...cjkSubTokens];
    for (const src of candidateSources) {
      if (!src || src.length < 2) continue;
      for (const prefixLen of [3, 2]) {
        if (src.length >= prefixLen) {
          const prefix = src.slice(0, prefixLen);
          const pos = findTokenPosition(rawNormTitle, cleanTitleNoPunct, prefix.toLowerCase());
          if (pos !== -1) {
            return {
              found: true,
              inFirst40: pos >= 0 && pos < 40,
              matchedToken: prefix,
            };
          }
        }
      }
    }
  }

  return { found: false, inFirst40: false, matchedToken: '' };
}

/**
 * Normalizes CTR, opportunity, and SEO scores to a 0-100 scale.
 * If the model returned scores on a 0-10 scale (every score <= 10), multiplies by 10 and clamps to 0-100.
 */
export function normalizeMetadataScores(metadata: YouTubeMetadata): YouTubeMetadata {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const copy: YouTubeMetadata = { ...metadata };

  if (Array.isArray(copy.titles) && copy.titles.length > 0) {
    const allTitlesLe10 = copy.titles.every((t) => {
      const s = Number(t?.ctrScore) || 0;
      return s <= 10;
    });
    const anyTitlePositive = copy.titles.some((t) => (Number(t?.ctrScore) || 0) > 0);
    copy.titles = copy.titles.map((t) => {
      const raw = Number(t?.ctrScore) || 0;
      const scaled = allTitlesLe10 && anyTitlePositive ? raw * 10 : raw;
      return {
        ...t,
        ctrScore: Math.min(100, Math.max(0, Math.round(scaled))),
      };
    });
  }

  if (Array.isArray(copy.keywordInsights) && copy.keywordInsights.length > 0) {
    const allKwLe10 = copy.keywordInsights.every((k) => (Number(k?.opportunityScore) || 0) <= 10);
    const anyKwPositive = copy.keywordInsights.some((k) => (Number(k?.opportunityScore) || 0) > 0);
    copy.keywordInsights = copy.keywordInsights.map((k) => {
      const raw = Number(k?.opportunityScore) || 0;
      const scaled = allKwLe10 && anyKwPositive ? raw * 10 : raw;
      return {
        ...k,
        opportunityScore: Math.min(100, Math.max(0, Math.round(scaled))),
      };
    });
  }

  if (copy.seoScore && typeof copy.seoScore === 'object') {
    const vals = [
      Number(copy.seoScore.overall) || 0,
      Number(copy.seoScore.title) || 0,
      Number(copy.seoScore.description) || 0,
      Number(copy.seoScore.tags) || 0,
      Number(copy.seoScore.keywordUsage) || 0,
    ];
    const allSeoLe10 = vals.every((v) => v <= 10);
    const anySeoPositive = vals.some((v) => v > 0);
    const scale = (v: number) =>
      Math.min(100, Math.max(0, Math.round(allSeoLe10 && anySeoPositive ? v * 10 : v)));
    copy.seoScore = {
      overall: scale(vals[0]),
      title: scale(vals[1]),
      description: scale(vals[2]),
      tags: scale(vals[3]),
      keywordUsage: scale(vals[4]),
    };
  }

  return copy;
}

/**
 * Real-time, deterministic on-page optimization checklist (vidIQ-style).
 * Runs entirely client-side against the currently selected title and current description,
 * updating instantly when the user picks a different title or edits text.
 */
export function buildSeoChecklist(
  metadata: YouTubeMetadata,
  languageCode: string,
  selectedTitle: string,
  customDescription?: string
): ChecklistItem[] {
  const rule = getMarketSeoRule(languageCode);
  const items: ChecklistItem[] = [];
  const primaryKw = (metadata.primaryKeyword || '').trim();
  const kwLower = primaryKw.toLowerCase();
  const desc = customDescription ?? metadata.description ?? '';
  const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
  const hashtags = Array.isArray(metadata.hashtags) ? metadata.hashtags : [];

  const titleLen = selectedTitle.length;
  items.push({
    id: 'title-length',
    label: 'Độ dài tiêu đề',
    status:
      titleLen > rule.titleHardMax
        ? 'fail'
        : titleLen >= rule.titleIdealMin && titleLen <= rule.titleIdealMax
        ? 'pass'
        : 'warn',
    detail: `${titleLen} ký tự (chuẩn thị trường: ${rule.titleIdealMin}–${rule.titleIdealMax}, tối đa ${rule.titleHardMax})`,
  });

  const titleKwMatch = keywordMatchInfo(selectedTitle, primaryKw, languageCode);
  items.push({
    id: 'title-keyword',
    label: 'Từ khóa chính trong tiêu đề',
    status: titleKwMatch.inFirst40 ? 'pass' : titleKwMatch.found ? 'warn' : 'fail',
    detail: titleKwMatch.inFirst40
      ? `Từ khóa "${titleKwMatch.matchedToken}" nằm trong 40 ký tự đầu (tối ưu di động)`
      : titleKwMatch.found
      ? `Đã khớp "${titleKwMatch.matchedToken}" nhưng nằm sau 40 ký tự đầu`
      : 'Tiêu đề đang chọn chưa chứa từ khóa chính',
  });

  const descHook = desc.slice(0, rule.descHookChars);
  const hookKwMatch = keywordMatchInfo(descHook, primaryKw, languageCode);
  items.push({
    id: 'desc-hook',
    label: `Từ khóa trong ${rule.descHookChars} ký tự đầu mô tả`,
    status: hookKwMatch.found ? 'pass' : 'warn',
    detail: hookKwMatch.found
      ? `Từ khóa "${hookKwMatch.matchedToken}" xuất hiện trước nút "...xem thêm"`
      : 'Nên đưa từ khóa chính lên 1–2 câu đầu tiên của phần mô tả',
  });

  const descLen = desc.length;
  items.push({
    id: 'desc-length',
    label: 'Độ dài mô tả chuẩn SEO',
    status: descLen >= 250 ? 'pass' : descLen >= 100 ? 'warn' : 'fail',
    detail: `${descLen} ký tự (khuyến nghị ≥ 250 ký tự)`,
  });

  const hasTimestamps = /\b\d{1,2}:\d{2}\b/.test(desc);
  items.push({
    id: 'desc-timestamps',
    label: 'Chia chương (Timestamps 00:00)',
    status: hasTimestamps ? 'pass' : 'warn',
    detail: hasTimestamps
      ? 'Mô tả đã có mốc thời gian giúp hiển thị Key Moments trên Google & YouTube'
      : 'Chưa có mốc 00:00 — hãy nhấn "Chèn Chapters vào mô tả" bên dưới',
  });

  const tagsCharTotal = tags.join(',').length;
  items.push({
    id: 'tags-budget',
    label: 'Ngân sách ký tự Tags (Giới hạn 500)',
    status:
      tagsCharTotal > rule.tagsCharBudget
        ? 'fail'
        : tagsCharTotal >= rule.tagsCharBudget * 0.45
        ? 'pass'
        : 'warn',
    detail: `${tagsCharTotal}/${rule.tagsCharBudget} ký tự đã sử dụng`,
  });

  const firstTag = (tags[0] || '').trim();
  const firstTagMatch = keywordMatchInfo(firstTag, primaryKw, languageCode);
  const firstTagIsKeyword = (!!kwLower && firstTag.toLowerCase() === kwLower) || firstTagMatch.found;
  items.push({
    id: 'tags-first-keyword',
    label: 'Tag đầu tiên khớp từ khóa chính',
    status: firstTagIsKeyword ? 'pass' : 'warn',
    detail: firstTagIsKeyword
      ? `Tag #1 khớp với từ khóa chính (${firstTagMatch.matchedToken || firstTag})`
      : 'Nên đặt từ khóa chính làm Tag đầu tiên',
  });

  items.push({
    id: 'hashtags-count',
    label: 'Số lượng Hashtags (Tối ưu 3–5)',
    status: hashtags.length >= 2 && hashtags.length <= 5 ? 'pass' : 'warn',
    detail: `${hashtags.length} hashtags (3 hashtag đầu hiển thị ngay trên tiêu đề)`,
  });

  return items;
}

/**
 * Recomputes a live SEO score combining AI's base assessment with real-time on-page adjustments
 * as the user switches titles or edits the description.
 */
export function computeLiveSeoScore(
  metadata: YouTubeMetadata,
  checklist: ChecklistItem[],
  selectedTitleIndex: number
): SeoScoreBreakdown {
  const normalized = normalizeMetadataScores(metadata);
  const base = normalized.seoScore || {
    overall: 80,
    title: 80,
    description: 80,
    tags: 80,
    keywordUsage: 80,
  };
  const selectedTitleObj = normalized.titles?.[selectedTitleIndex];
  const passCount = checklist.filter((c) => c.status === 'pass').length;
  const warnCount = checklist.filter((c) => c.status === 'warn').length;
  const checklistRatio = checklist.length > 0 ? (passCount + warnCount * 0.5) / checklist.length : 0.85;

  const titleScore = selectedTitleObj
    ? Math.min(100, Math.round(selectedTitleObj.ctrScore * 0.65 + base.title * 0.35))
    : base.title;

  const overall = Math.min(
    100,
    Math.round(titleScore * 0.3 + base.description * 0.25 + base.tags * 0.15 + base.keywordUsage * 0.15 + checklistRatio * 100 * 0.15)
  );

  return {
    overall,
    title: titleScore,
    description: base.description,
    tags: base.tags,
    keywordUsage: base.keywordUsage,
  };
}

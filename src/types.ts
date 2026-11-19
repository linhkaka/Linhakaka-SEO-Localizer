export type ContentType = 'DOC' | 'EDU' | 'SELF' | 'REVIEW' | 'CHALLENGE' | 'NEWS' | 'ENT';

export type TitleArchetype =
  | 'SEO-Anchor'
  | 'Curiosity-Gap'
  | 'Number / Specificity'
  | 'Contrast / Authority'
  | 'Native-Emotional / Trend';

export interface TitleFormat {
  id: number;
  pattern: string;
  archetype: TitleArchetype;
  types: ContentType[];
  firstPerson: boolean;
  risk: 'low' | 'medium';
}

export interface UserPreferences {
  country: string;
  language: string;
  channelName: string;
  titleStyle: string;
  brandVoice: string;
  descriptionLength: string;
  keywordTone: string;
  descriptionStyle: string;
  keywordDensity: string;
  disclaimerMode: string;
  autoProofread?: boolean;
  contentType?: ContentType | 'AUTO';
  allowFirstPerson?: boolean;
  preferredFormatIds?: number[];
}

export interface ProofreadFix {
  path: string;
  original: string;
  corrected: string;
  reason: string;
}

export interface ProofreadReport {
  checked: number;
  fixed: number;
  fixes: ProofreadFix[];
  modelUsed?: string;
  error?: string;
}

export interface YouTubeTitle {
  localized: string;
  vietnamese: string;
  angle: string;
  reason: string;
  isBestOverall: boolean;
  /** AI-estimated click-through potential for this title in the target market, 0-100. */
  ctrScore: number;
  complianceRisk: 'Thấp' | 'Trung bình' | 'Cao';
  complianceNote: string;
  formatId?: number | null;
}

/** vidIQ-style keyword opportunity row: AI-estimated, not live search data. */
export interface KeywordInsight {
  keyword: string;
  searchVolume: 'Cao' | 'Trung bình' | 'Thấp';
  competition: 'Cao' | 'Trung bình' | 'Thấp';
  /** Higher when volume is decent but competition is low, 0-100. */
  opportunityScore: number;
}

/** vidIQ-style SEO score breakdown for the generated metadata, 0-100 each. */
export interface SeoScoreBreakdown {
  overall: number;
  title: number;
  description: number;
  tags: number;
  keywordUsage: number;
}

/** SEO-optimized video chapter / timestamp row. */
export interface VideoChapter {
  timestamp: string;
  title: string;
  vietnamese: string;
  seoKeyword?: string;
}

/** Thumbnail text + visual composition concept. */
export interface ThumbnailConcept {
  textOverlay: string;
  vietnamese: string;
  visualScene: string;
  colorPsychology: string;
}

/** Pinned comment & community engagement hook to boost early comment velocity. */
export interface PinnedCommentOption {
  localized: string;
  vietnamese: string;
  strategy: string;
}

/** A/B title variation returned by /api/refine-title */
export interface RefinedTitleVariant {
  localized: string;
  vietnamese: string;
  style: string;
  ctrScore: number;
  whyItWorks: string;
}

export interface YouTubeMetadata {
  titles: YouTubeTitle[];
  detectedContentType?: ContentType;
  primaryKeyword: string;
  keywordInsights: KeywordInsight[];
  description: string;
  disclaimerUsed: boolean;
  disclaimerType: string;
  /** Full localized disclaimer text (also appended to the description) so the user can copy/edit it separately. */
  disclaimerText: string;
  tags: string[];
  hashtags: string[];
  /** 3-5 short punchy text overlays for the thumbnail (2-5 words each) to boost CTR. */
  thumbnailTexts: string[];
  /** Detailed thumbnail concepts with visual scene & color guide. */
  thumbnailConcepts?: ThumbnailConcept[];
  /** Auto-segmented video chapters with timestamps. */
  chapters?: VideoChapter[];
  /** High-engagement pinned comments in the target language. */
  pinnedComments?: PinnedCommentOption[];
  seoNotes: string;
  /** 1-2 sentences: how this metadata leverages the current trends found (empty if trend scan was off). */
  trendAlignment: string;
  targetAudience?: string;
  searchIntent?: string;
  seoScore: SeoScoreBreakdown;
  proofreadReport?: ProofreadReport;
}

/** Result of the live trend scan (Gemini + Google Search grounding). */
export interface TrendReport {
  /** Markdown summary of what is trending right now around this topic in the target market. */
  summary: string;
  /** Source links returned by Google Search grounding, when available. */
  sources: { title: string; url: string }[];
  /** Model or mode used for transparency. */
  mode?: 'live_search' | 'ai_market_knowledge';
  /** Whether the Vietnamese trend summary passed AI proofreading. */
  proofreadApplied?: boolean;
}

/** One row in the real-time on-page optimization checklist (computed client-side, no AI cost). */
export interface ChecklistItem {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

/** Saved history item in localStorage so users can revisit past generations. */
export interface HistoryEntry {
  id: string;
  createdAt: string;
  country: string;
  language: string;
  channelName: string;
  scriptExcerpt: string;
  fullScript: string;
  metadata: YouTubeMetadata;
  trendReport: TrendReport | null;
}

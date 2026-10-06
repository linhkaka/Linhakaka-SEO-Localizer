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

export interface YouTubeMetadata {
  titles: YouTubeTitle[];
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
  seoNotes: string;
  /** 1-2 sentences: how this metadata leverages the current trends found (empty if trend scan was off). */
  trendAlignment: string;
  targetAudience?: string;
  searchIntent?: string;
  seoScore: SeoScoreBreakdown;
}

/** Result of the live trend scan (Gemini + Google Search grounding). */
export interface TrendReport {
  /** Markdown summary of what is trending right now around this topic in the target market. */
  summary: string;
  /** Source links returned by Google Search grounding, when available. */
  sources: { title: string; url: string }[];
}

/** One row in the real-time on-page optimization checklist (computed client-side, no AI cost). */
export interface ChecklistItem {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

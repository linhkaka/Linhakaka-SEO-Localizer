import type { ContentType, TitleArchetype, TitleFormat } from '@/src/types';

export type { ContentType, TitleArchetype, TitleFormat };

/** vidIQ-style on-page rules, tuned per market: CJK scripts convey more meaning per
 * character, so their ideal title length (in characters) is much shorter than
 * Latin-script languages even though the *reading time* is similar. */
export interface MarketSeoRule {
  titleIdealMin: number;
  titleIdealMax: number;
  titleHardMax: number;
  /** Characters visible in search/mobile before YouTube truncates the description ("...more"). */
  descHookChars: number;
  /** YouTube's real tag field limit is ~500 characters total (all tags combined). */
  tagsCharBudget: number;
}

export const DEFAULT_SEO_RULE: MarketSeoRule = {
  titleIdealMin: 40,
  titleIdealMax: 70,
  titleHardMax: 100,
  descHookChars: 125,
  tagsCharBudget: 500,
};

export const MARKET_SEO_RULES: Record<string, MarketSeoRule> = {
  'ja-JP': { titleIdealMin: 15, titleIdealMax: 32, titleHardMax: 100, descHookChars: 60, tagsCharBudget: 500 },
  'ko-KR': { titleIdealMin: 15, titleIdealMax: 35, titleHardMax: 100, descHookChars: 70, tagsCharBudget: 500 },
  'zh-CN': { titleIdealMin: 12, titleIdealMax: 30, titleHardMax: 100, descHookChars: 60, tagsCharBudget: 500 },
  'zh-TW': { titleIdealMin: 12, titleIdealMax: 30, titleHardMax: 100, descHookChars: 60, tagsCharBudget: 500 },
  'zh-HK': { titleIdealMin: 12, titleIdealMax: 30, titleHardMax: 100, descHookChars: 60, tagsCharBudget: 500 },
  'th-TH': { titleIdealMin: 30, titleIdealMax: 60, titleHardMax: 100, descHookChars: 100, tagsCharBudget: 500 },
  'ar': { titleIdealMin: 25, titleIdealMax: 55, titleHardMax: 100, descHookChars: 100, tagsCharBudget: 500 },
  'ar-SA': { titleIdealMin: 25, titleIdealMax: 55, titleHardMax: 100, descHookChars: 100, tagsCharBudget: 500 },
  'ar-AE': { titleIdealMin: 25, titleIdealMax: 55, titleHardMax: 100, descHookChars: 100, tagsCharBudget: 500 },
  'he-IL': { titleIdealMin: 25, titleIdealMax: 55, titleHardMax: 100, descHookChars: 100, tagsCharBudget: 500 },
  'hi-IN': { titleIdealMin: 30, titleIdealMax: 60, titleHardMax: 100, descHookChars: 110, tagsCharBudget: 500 },
  'ta-IN': { titleIdealMin: 25, titleIdealMax: 55, titleHardMax: 100, descHookChars: 100, tagsCharBudget: 500 },
  'bn-BD': { titleIdealMin: 25, titleIdealMax: 55, titleHardMax: 100, descHookChars: 100, tagsCharBudget: 500 },
  'ur-PK': { titleIdealMin: 25, titleIdealMax: 55, titleHardMax: 100, descHookChars: 100, tagsCharBudget: 500 },
};

export function getMarketSeoRule(languageCode: string): MarketSeoRule {
  return MARKET_SEO_RULES[languageCode] || DEFAULT_SEO_RULE;
}

export const MARKET_TITLE_PLAYBOOK: Record<string, string> = {
  'en-US':
    'Title Case; keyword in first 40 chars (mobile cut-off); ideal 50-70 chars; numerals not words; power words: Why, How, The Truth About, Finally, Nobody Tells You; max 1 word in ALL CAPS; separators ":" or "—"; no emoji spam.',
  'en-GB':
    'Sentence case or Title Case; British spelling (colour, programme, organise); calmer, understated tone, less hype than US; same keyword-first rule (in first 40 chars); numerals not words.',
  en: 'Title Case; keyword in first 40 chars (mobile cut-off); ideal 50-70 chars; numerals not words; power words: Why, How, The Truth About, Finally, Nobody Tells You; max 1 word in ALL CAPS; separators ":" or "—"; no emoji spam.',
  'ko-KR':
    '15-35 chars; keyword at the very start; natural 띄어쓰기; endings like "~한 이유", "~의 진실", "~하는 법", question ending "~일까?"; brackets [ ] for category allowed; avoid overused "충격/경악".',
  ko: '15-35 chars; keyword at the very start; natural 띄어쓰기; endings like "~한 이유", "~의 진실", "~하는 법", question ending "~일까?"; brackets [ ] for category allowed; avoid overused "충격/경악".',
  'ja-JP':
    '15-32 chars, no spaces between words; 【】at the start for keyword/category is a strong convention; 「」for quotes; patterns "〜の理由", "〜の正体", "知られざる〜", "なぜ〜のか"; full-width punctuation.',
  ja: '15-32 chars, no spaces between words; 【】at the start for keyword/category is a strong convention; 「」for quotes; patterns "〜の理由", "〜の正体", "知られざる〜", "なぜ〜のか"; full-width punctuation.',
  'zh-TW':
    'Traditional characters only; 【】category prefix; patterns with 為什麼 / 真相 / 揭秘; 12-30 chars; full-width punctuation.',
  'zh-HK':
    'Traditional characters only; 【】category prefix; patterns with 為什麼 / 真相 / 揭秘; 12-30 chars; full-width punctuation.',
  'zh-CN':
    'Simplified characters; 【】category prefix; patterns with 为什么 / 真相 / 揭秘; 12-30 chars; full-width punctuation.',
  fr: 'Sentence case (only first word + proper nouns capitalized); non-breaking space before ? ! : ; ; patterns "Pourquoi…", "Ce que personne ne dit sur…", "La vérité sur…"; avoid needless anglicisms.',
  'fr-FR':
    'Sentence case (only first word + proper nouns capitalized); non-breaking space before ? ! : ; ; patterns "Pourquoi…", "Ce que personne ne dit sur…", "La vérité sur…"; avoid needless anglicisms.',
  'fr-CA':
    'Sentence case (only first word + proper nouns capitalized); non-breaking space before ? ! : ; ; patterns "Pourquoi…", "Ce que personne ne dit sur…", "La vérité sur…"; natural Québécois/Canadian French phrasing.',
  es: 'Sentence case; ALWAYS opening ¿ and ¡; patterns "Por qué…", "La verdad sobre…", "Lo que nadie te cuenta de…"; use es-ES vocabulary for Spain, neutral LatAm for es-MX/es-419.',
  'es-ES':
    'Sentence case; ALWAYS opening ¿ and ¡; patterns "Por qué…", "La verdad sobre…", "Lo que nadie te cuenta de…"; use authentic Spain (es-ES) vocabulary.',
  'es-MX':
    'Sentence case; ALWAYS opening ¿ and ¡; patterns "Por qué…", "La verdad sobre…", "Lo que nadie te cuenta de…"; use neutral Latin American / Mexican vocabulary.',
  'es-419':
    'Sentence case; ALWAYS opening ¿ and ¡; patterns "Por qué…", "La verdad sobre…", "Lo que nadie te cuenta de…"; use neutral Latin American vocabulary.',
  it: 'Sentence case; patterns "Perché…", "La vera storia di…", "Come…", "Cosa succede se…"; natural Italian phrasing and elision.',
  'it-IT':
    'Sentence case; patterns "Perché…", "La vera storia di…", "Come…", "Cosa succede se…"; natural Italian phrasing and elision.',
  de: 'All nouns capitalized (German rules); compound keywords kept intact; factual, precise tone; patterns "Warum…", "So funktioniert…", "Die Wahrheit über…"; ideal 45-70 chars.',
  'de-DE':
    'All nouns capitalized (German rules); compound keywords kept intact; factual, precise tone; patterns "Warum…", "So funktioniert…", "Die Wahrheit über…"; ideal 45-70 chars.',
  'pt-BR':
    'Sentence case; Brazilian vocabulary (você); patterns "Por que…", "A verdade sobre…", "O que ninguém te conta sobre…".',
  'pt-PT':
    'Sentence case; European Portuguese vocabulary; patterns "Porque…", "A verdade sobre…", "O que ninguém te diz sobre…".',
  pt: 'Sentence case; patterns "Por que…", "A verdade sobre…", "O que ninguém te conta sobre…".',
  fil: 'Natural Taglish allowed (English search keyword + Tagalog hook); patterns "Bakit…", "Ang totoo sa…", "Ito ang…".',
  'fil-PH':
    'Natural Taglish allowed (English search keyword + Tagalog hook); patterns "Bakit…", "Ang totoo sa…", "Ito ang…".',
  tl: 'Natural Taglish allowed (English search keyword + Tagalog hook); patterns "Bakit…", "Ang totoo sa…", "Ito ang…".',
  'vi-VN':
    'Sentence case, full diacritics (NFC); keyword first; patterns "Vì sao…", "Sự thật về…", "Bí mật…".',
  vi: 'Sentence case, full diacritics (NFC); keyword first; patterns "Vì sao…", "Sự thật về…", "Bí mật…".',
  default: 'Keyword first, sentence case, native phrasing, no literal translation.',
};

export function getMarketTitlePlaybook(lang: string): string {
  if (!lang) return MARKET_TITLE_PLAYBOOK.default;
  if (MARKET_TITLE_PLAYBOOK[lang]) return MARKET_TITLE_PLAYBOOK[lang];
  const base = lang.split('-')[0].toLowerCase();
  for (const key of Object.keys(MARKET_TITLE_PLAYBOOK)) {
    if (key.toLowerCase() === lang.toLowerCase()) return MARKET_TITLE_PLAYBOOK[key];
  }
  if (MARKET_TITLE_PLAYBOOK[base]) return MARKET_TITLE_PLAYBOOK[base];
  return MARKET_TITLE_PLAYBOOK.default;
}

export const COUNTRIES = [
  { code: "AE", name: "Các Tiểu vương quốc Ả Rập Thống nhất (UAE)" },
  { code: "AR", name: "Argentina" },
  { code: "AT", name: "Áo" },
  { code: "AU", name: "Australia" },
  { code: "BE", name: "Bỉ" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "CH", name: "Thụy Sĩ" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "Trung Quốc" },
  { code: "CO", name: "Colombia" },
  { code: "CZ", name: "Cộng hòa Séc" },
  { code: "DE", name: "Đức" },
  { code: "DK", name: "Đan Mạch" },
  { code: "EG", name: "Ai Cập" },
  { code: "ES", name: "Tây Ban Nha" },
  { code: "FI", name: "Phần Lan" },
  { code: "FR", name: "Pháp" },
  { code: "GB", name: "Vương quốc Anh (UK)" },
  { code: "GR", name: "Hy Lạp" },
  { code: "HK", name: "Hồng Kông" },
  { code: "HU", name: "Hungary" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IN", name: "Ấn Độ" },
  { code: "IT", name: "Ý" },
  { code: "JP", name: "Nhật Bản" },
  { code: "KR", name: "Hàn Quốc" },
  { code: "MX", name: "Mexico" },
  { code: "MY", name: "Malaysia" },
  { code: "NL", name: "Hà Lan" },
  { code: "NO", name: "Na Uy" },
  { code: "NZ", name: "New Zealand" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PK", name: "Pakistan" },
  { code: "PL", name: "Ba Lan" },
  { code: "PR", name: "Puerto Rico" },
  { code: "PT", name: "Bồ Đào Nha" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Nga" },
  { code: "SA", name: "Ả Rập Xê-út" },
  { code: "SE", name: "Thụy Điển" },
  { code: "SG", name: "Singapore" },
  { code: "TH", name: "Thái Lan" },
  { code: "TR", name: "Thổ Nhĩ Kỳ" },
  { code: "TW", name: "Đài Loan" },
  { code: "UA", name: "Ukraine" },
  { code: "US", name: "Hoa Kỳ (US)" },
  { code: "VN", name: "Việt Nam" },
  { code: "ZA", name: "Nam Phi" }
].sort((a, b) => a.name.localeCompare(b.name, 'vi'));

export const LANGUAGES = [
  { code: "en-US", name: "English (United States)" },
  { code: "en-GB", name: "English (United Kingdom)" },
  { code: "vi-VN", name: "Tiếng Việt" },
  { code: "ja-JP", name: "Japanese" },
  { code: "ko-KR", name: "Korean" },
  { code: "fr-FR", name: "French (France)" },
  { code: "fr-CA", name: "French (Canada)" },
  { code: "de-DE", name: "German" },
  { code: "es-ES", name: "Spanish (Spain)" },
  { code: "es-US", name: "Spanish (United States)" },
  { code: "es-MX", name: "Spanish (Mexico)" },
  { code: "es-419", name: "Spanish (Latin America)" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "pt-PT", name: "Portuguese (Portugal)" },
  { code: "th-TH", name: "Thai" },
  { code: "id-ID", name: "Indonesian" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional - Taiwan)" },
  { code: "zh-HK", name: "Chinese (Traditional - Hong Kong)" },
  { code: "ru-RU", name: "Russian" },
  { code: "hi-IN", name: "Hindi" },
  { code: "it-IT", name: "Italian" },
  { code: "fil-PH", name: "Filipino" },
  { code: "ms-MY", name: "Malay" },
  { code: "ar", name: "Arabic" },
  { code: "ar-SA", name: "Arabic (Saudi Arabia)" },
  { code: "ar-AE", name: "Arabic (UAE)" },
  { code: "tr-TR", name: "Turkish" },
  { code: "pl-PL", name: "Polish" },
  { code: "nl-NL", name: "Dutch" },
  { code: "uk-UA", name: "Ukrainian" },
  { code: "he-IL", name: "Hebrew" },
  { code: "el-GR", name: "Greek" },
  { code: "sv-SE", name: "Swedish" },
  { code: "cs-CZ", name: "Czech" },
  { code: "ro-RO", name: "Romanian" },
  { code: "hu-HU", name: "Hungarian" },
  { code: "da-DK", name: "Danish" },
  { code: "fi-FI", name: "Finnish" },
  { code: "no-NO", name: "Norwegian" },
  { code: "ur-PK", name: "Urdu (Pakistan)" },
  { code: "ta-IN", name: "Tamil" },
  { code: "bn-BD", name: "Bengali" }
].sort((a, b) => a.name.localeCompare(b.name, 'en'));

export const TITLE_STYLES = [
  { id: 'auto', name: 'Tự động (theo locale)' },
  { id: 'title', name: 'Viết hoa kiểu tiêu đề' },
  { id: 'sentence', name: 'Viết hoa đầu câu' },
  { id: 'native', name: 'Chuẩn bản địa' }
];

export const DESCRIPTION_LENGTHS = [
  { id: 'short', name: 'Ngắn' },
  { id: 'medium', name: 'Trung bình' },
  { id: 'long', name: 'Dài' }
];

export const KEYWORD_TONES = [
  { id: 'natural', name: 'Tự nhiên' },
  { id: 'aggressive', name: 'SEO mạnh' },
  { id: 'educational', name: 'Giáo dục' },
  { id: 'entertainment', name: 'Giải trí' }
];

export const DESCRIPTION_STYLES = [
  { id: 'balanced', name: 'Cân bằng' },
  { id: 'seo', name: 'Tập trung SEO' },
  { id: 'story', name: 'Dẫn dắt theo câu chuyện' },
  { id: 'conversion', name: 'Tập trung chuyển đổi' },
  { id: 'educational', name: 'Giải thích / giáo dục' }
];

export const KEYWORD_DENSITIES = [
  { id: 'light', name: 'Nhẹ' },
  { id: 'normal', name: 'Bình thường' },
  { id: 'strong', name: 'Mạnh' }
];

export const DISCLAIMER_MODES = [
  { id: 'auto', name: 'Tự động phát hiện' },
  { id: 'none', name: 'Không có' },
  { id: 'medical', name: 'Y tế / sức khỏe' },
  { id: 'finance', name: 'Tài chính / đầu tư' },
  { id: 'legal', name: 'Pháp lý' },
  { id: 'affiliate', name: 'Tiếp thị liên kết / tài trợ' },
  { id: 'safety', name: 'An toàn / rủi ro' },
  { id: 'general', name: 'Chỉ nhằm mục đích cung cấp thông tin' }
];

export interface SampleScriptTemplate {
  id: string;
  label: string;
  country: string;
  language: string;
  script: string;
}

export const SAMPLE_SCRIPTS: SampleScriptTemplate[] = [
  {
    id: 'culinary-pho',
    label: 'Ẩm thực: Nấu Phở Bò (US)',
    country: 'US',
    language: 'en-US',
    script: `[00:00] Most people think authentic Vietnamese beef phở takes 24 hours to simmer, but street vendors in Hanoi use a 3-step roasting trick that unlocks deep, crystal-clear broth in under 3 hours.
[01:15] Step 1: Parboiling the beef marrow bones with ginger and salt for exactly 8 minutes removes 95% of impurities so your broth never turns cloudy.
[03:40] Step 2: Dry-toasting star anise, cinnamon, cardamom, and cloves until fragrant before charred onion and ginger go into the pot.
[06:20] Step 3: Balancing fish sauce, rock sugar, and thinly sliced eye of round steak with fresh rice noodles, scallions, and Thai basil.`
  },
  {
    id: 'tech-battery',
    label: 'Công nghệ: Tối ưu Pin Laptop (JP)',
    country: 'JP',
    language: 'ja-JP',
    script: `[00:00] ノートパソコンのバッテリーが1年で急激に劣化する最大の原因は、100%充電のまま電源アダプターを繋ぎっぱなしにすることではありません。真犯人は「高温状態での高電圧維持」です。
[01:30] ステップ1：充電上限を80%に制限する設定方法と、バッテリーサイクル寿命が2.4倍に伸びる実験データ。
[04:10] ステップ2：バックグラウンドで電力を消費し続ける隠れたプロセスの特定と停止方法。
[07:00] ステップ3：外出先で駆動時間をさらに90分延ばすディスプレイと電力プランの最適設定。`
  },
  {
    id: 'finance-saving',
    label: 'Tài chính: Quy tắc 50/30/20 (DE)',
    country: 'DE',
    language: 'de-DE',
    script: `[00:00] Warum scheitern 78 Prozent aller Haushaltsbücher bereits im zweiten Monat? Weil klassische Sparregeln wie die 50-30-20-Methode die aktuellen Wohn- und Energiekosten in Deutschland ignorieren.
[01:45] Teil 1: Das 60-20-20-Modell für Großstädte und wie man Fixkosten automatisiert deckelt.
[04:30] Teil 2: Das 3-Konten-System mit Tagesgeld-Puffer für unerwartete Nachzahlungen.
[08:15] Teil 3: Konkrete Beispiele für ein Nettoeinkommen von 2.800 Euro ohne Verzicht auf Lebensqualität.`
  },
  {
    id: 'doc-history',
    label: 'Khám phá: Bí ẩn Hàng Sơn Đoòng (VN)',
    country: 'VN',
    language: 'vi-VN',
    script: `[00:00] Nằm sâu dưới dãy Trường Sơn, hang Sơn Đoòng lớn đến mức có thể chứa trọn một khu phố 40 tầng ở New York và sở hữu cả một hệ sinh thái rừng nguyên sinh cùng mây mù riêng biệt.
[02:10] Phần 1: Hành trình tình cờ phát hiện cửa hang năm 1991 của Hồ Khanh và chuyến thám hiểm lịch sử năm 2009.
[05:30] Phần 2: Hố sụt Doline khổng lồ nơi ánh nắng chiếu rọi tạo nên khu rừng Địa Đàng giữa lòng đất.
[09:00] Phần 3: Bức tường Việt Nam cao 90 mét và quy trình bảo tồn nghiêm ngặt giới hạn số lượng du khách mỗi năm.`
  }
];

export const CONTENT_TYPE_OPTIONS: Array<{ id: ContentType | 'AUTO'; label: string }> = [
  { id: 'AUTO', label: 'Tự động nhận diện (AI)' },
  { id: 'DOC', label: 'Phân tích / Tài liệu chuyên sâu (DOC)' },
  { id: 'EDU', label: 'Hướng dẫn / Giáo dục (EDU)' },
  { id: 'SELF', label: 'Phát triển bản thân / Tâm lý (SELF)' },
  { id: 'REVIEW', label: 'Đánh giá / Mua sắm (REVIEW)' },
  { id: 'CHALLENGE', label: 'Thử thách / Trải nghiệm (CHALLENGE)' },
  { id: 'NEWS', label: 'Tin tức / Xu hướng mới (NEWS)' },
  { id: 'ENT', label: 'Giải trí / Phim & Game (ENT)' },
];

type ArchetypeCode = 'SEO' | 'CG' | 'NUM' | 'CA' | 'NE';

const ARCHETYPE_CODE_MAP: Record<ArchetypeCode, TitleArchetype> = {
  SEO: 'SEO-Anchor',
  CG: 'Curiosity-Gap',
  NUM: 'Number / Specificity',
  CA: 'Contrast / Authority',
  NE: 'Native-Emotional / Trend',
};

const RAW_TITLE_FORMAT_ROWS: Array<
  [number, string, ArchetypeCode, ContentType[], boolean?, ('low' | 'medium')?]
> = [
  [1, 'Something Weird Is Happening In [Place / Group]', 'CG', ['DOC', 'NEWS']],
  [2, "It's [Painful Adjective], But It'll [Desired Outcome]", 'CA', ['SELF', 'EDU']],
  [3, "Give Me [X Minutes] And I'll Make You [Dangerously] Good At [Skill]", 'NUM', ['EDU', 'SELF']],
  [4, 'I Gave Myself [30 Days] To [Ambitious Goal]', 'NUM', ['CHALLENGE'], true],
  [5, 'I Tried [Thing] For [Time Period] (This Is What Happened)', 'CG', ['CHALLENGE', 'REVIEW'], true],
  [6, '[Number] Things That Are No Longer Worth Your Money', 'NUM', ['REVIEW', 'SELF']],
  [7, 'The New Era Of [Topic] Has Just Begun', 'NE', ['NEWS', 'DOC']],
  [8, "I'm [Age]. If You're In Your [Age]s, Watch This", 'NE', ['SELF'], true],
  [9, 'Unfortunately, [Difficult Goal] Really Is This Simple', 'CA', ['SELF', 'EDU']],
  [10, '[Skill] Is Hard Until You [Learn This]', 'CG', ['EDU']],
  [11, 'How To [Train / Trick] Your Brain To [Do Hard Things]', 'SEO', ['SELF', 'EDU']],
  [12, 'This [Video / Message] Will Find You Right Before [Something Good Happens]', 'NE', ['SELF'], false, 'medium'],
  [13, 'The Rise And Fall Of [Person / Brand]', 'CA', ['DOC']],
  [14, 'I Wasted [Time] [Doing Thing] (Until I Learned This)', 'NE', ['SELF', 'EDU'], true],
  [15, "Don't Buy [Product] Until You Watch This", 'CA', ['REVIEW']],
  [16, 'Ranking Every [Category] From Worst To Best', 'NUM', ['DOC', 'REVIEW', 'ENT']],
  [17, 'The Psychology Of People Who [Behavior]', 'SEO', ['SELF', 'DOC']],
  [18, 'The Dark Side Of [Topic]', 'CA', ['DOC']],
  [19, 'Stop [Common Habit] (Do This Instead)', 'CA', ['SELF', 'EDU']],
  [20, 'How [Person / Company] Secretly [Achieved Outcome]', 'CG', ['DOC', 'NEWS']],
  [21, "Why [Popular Thing] Isn't What You Think", 'CA', ['DOC', 'REVIEW']],
  [22, 'The [Number]-Minute Guide To [Complex Skill]', 'NUM', ['EDU']],
  [23, 'What Happens To Your [Body / Mind / Money] If You [Action] Every Day', 'CG', ['SELF', 'EDU', 'DOC']],
  [24, 'Every [Topic] Explained In [X] Minutes', 'SEO', ['DOC', 'EDU', 'ENT']],
  [25, 'Why Everyone Is Suddenly Talking About [Topic]', 'NE', ['NEWS', 'DOC']],
  [26, 'The Hidden Truth Behind [Major Event / System]', 'CA', ['DOC', 'NEWS']],
  [27, 'The Real Reason [Group / System] Never [Expected Outcome]', 'CG', ['DOC', 'SELF']],
  [28, '[Number] Mistakes Beginners Make With [Skill / Tool]', 'NUM', ['EDU', 'REVIEW']],
  [29, 'Is [Product / Trend] Actually Worth It In [Year]?', 'SEO', ['REVIEW', 'NEWS']],
  [30, 'How To [Achieve Goal] Without [Common Pain Point]', 'SEO', ['EDU', 'SELF']],
  [31, 'How [Complex System / Phenomenon] Actually Works', 'SEO', ['DOC', 'EDU']],
  [32, 'I Quit [Habit / Tool] For [Time Period] And Here Is What Changed', 'CG', ['CHALLENGE', 'SELF'], true],
  [33, 'Everyone Believes [Myth], But Data Shows [Reality]', 'CA', ['DOC', 'EDU']],
  [34, 'The [Time Period] Rule That Changes [Area Of Life]', 'NUM', ['SELF', 'EDU']],
  [35, "If You Feel [Emotion], You Need To Understand [Core Mechanism]", 'NE', ['SELF', 'DOC']],
  [36, 'The [Adjective] History Of [Subject / Place]', 'SEO', ['DOC', 'ENT']],
  [37, 'Why [Big Company / Country] Is Quietly [Strategic Move]', 'CG', ['NEWS', 'DOC']],
  [38, '[Number] Signs You Are [Ahead / Falling Behind] In [Area]', 'NUM', ['SELF'], false, 'medium'],
  [39, 'What [Expert Group] Know About [Topic] That Others Miss', 'CA', ['EDU', 'DOC']],
  [40, 'Nobody Can Explain Why [Unusual Phenomenon] Happens', 'CG', ['DOC', 'NEWS']],
  [41, 'How To [Solve Specific Problem] Step By Step', 'SEO', ['EDU']],
  [42, 'I Tested The [Cheapest vs Most Expensive] [Product]', 'CG', ['REVIEW', 'CHALLENGE'], true],
  [43, 'The [Number] Levels Of [Skill / System]', 'NUM', ['EDU', 'DOC']],
  [44, 'Why [Old Method] Is Dead (And What Replaced It)', 'CA', ['NEWS', 'EDU', 'REVIEW']],
  [45, 'The Moment [Industry / History] Changed Forever', 'NE', ['DOC', 'NEWS']],
  [46, 'Can [Person / Group] Survive [Extreme Constraint] For [Time]?', 'CG', ['CHALLENGE', 'DOC']],
  [47, '[Product A] vs [Product B]: The Honest Comparison', 'SEO', ['REVIEW']],
  [48, 'Why So Many People Fail At [Goal] (And How To Fix It)', 'CA', ['SELF', 'EDU']],
  [49, '[Number] Tiny Habits That Compound Over [Timeframe]', 'NUM', ['SELF']],
  [50, 'Inside [Secretive Place / High-Stakes System]', 'CG', ['DOC', 'NEWS']],
  [51, 'The Complete Beginner Roadmap For [Skill]', 'SEO', ['EDU']],
  [52, 'I Spent [Amount / Time] Learning [Skill] So You Dont Have To', 'NE', ['CHALLENGE', 'EDU'], true],
  [53, 'How [Tiny Detail] Caused [Massive Consequence]', 'CA', ['DOC']],
  [54, '[Number] Rules For [Mastering Topic] Nobody Teaches', 'NUM', ['EDU', 'SELF']],
  [55, 'Why [Topic] Is Becoming A [Global / Local] Crisis', 'NE', ['NEWS', 'DOC']],
  [56, 'What Really Happened To [Famous Thing / Trend]?', 'CG', ['DOC', 'ENT']],
  [57, 'The Chain Reaction That [Created / Destroyed] [Subject]', 'CA', ['DOC']],
  [58, 'The Paradox Of [Counterintuitive Concept]', 'CG', ['DOC', 'SELF']],
  [59, 'Best [Category] Under [Budget] In [Year]', 'SEO', ['REVIEW']],
  [60, 'Why You Should Stop [Popular Advice] Right Now', 'CA', ['SELF', 'REVIEW'], false, 'medium'],
  [61, 'I Followed [Famous Routine] For [X Days] To Test The Hype', 'NUM', ['CHALLENGE', 'SELF'], true],
  [62, 'The Science Behind [Everyday Experience]', 'SEO', ['DOC', 'EDU']],
  [63, 'Things Nobody Warns You About [Life Change / Purchase]', 'NE', ['SELF', 'NEWS']],
  [64, 'How [Country / Industry] Solved [Massive Problem]', 'CG', ['DOC', 'NEWS']],
  [65, '[Number] Numbers That Explain [Big Topic]', 'NUM', ['DOC', 'NEWS']],
  [66, 'The Forgotten Story Of [Historical Event / Creator]', 'CG', ['DOC', 'ENT']],
  [67, 'How [Cause] Quietly Reshaped [Entire System / Culture]', 'CA', ['DOC']],
  [68, 'Why [Common Solution] Makes [Problem] Worse', 'CA', ['DOC', 'EDU', 'SELF']],
  [69, 'You Are Probably [Doing Common Thing] Wrong — Here Is Why', 'NE', ['EDU', 'SELF']],
  [70, '[Number] Reasons Why [Topic] Costs So Much', 'NUM', ['DOC', 'REVIEW']],
  [71, 'I Lived Like [Persona / Constraint] For [Time Period]', 'CG', ['CHALLENGE', 'ENT'], true],
  [72, 'What Is [Concept]? Everything You Need To Know', 'SEO', ['EDU', 'DOC']],
  [73, 'The Real Cost Of [Popular Trend / Habit]', 'CA', ['DOC', 'SELF']],
  [74, 'Why [Expert / System] Actually Designed [Thing] This Way', 'CA', ['DOC', 'EDU']],
  [75, '[Number] Days Later: Is [Product / Habit] Still Worth It?', 'NUM', ['REVIEW', 'SELF']],
  [76, 'Watch This Before You [Major Decision]', 'CA', ['SELF', 'REVIEW'], false, 'medium'],
  [77, 'The Turning Point Nobody Noticed In [Topic]', 'NE', ['NEWS', 'DOC']],
  [78, '[Number] Factors That Decide [Important Outcome]', 'NUM', ['DOC', 'EDU']],
  [79, '[Primary Keyword]: How It Works And Why It Matters', 'SEO', ['DOC', 'EDU', 'NEWS']],
  [80, 'What Happens When [Extreme Scenario] Takes Over [Place / Market]?', 'CG', ['DOC', 'ENT']],
  [81, 'Why [Generation / Group] Are Walking Away From [Norm]', 'NE', ['NEWS', 'DOC', 'SELF']],
  [82, 'I Built [Project / System] From Scratch In [Time]', 'NUM', ['CHALLENGE', 'EDU'], true],
  [83, 'The Difference Between [Amateur] And [Master] At [Skill]', 'CA', ['EDU', 'SELF']],
  [84, '[Number] Hidden Features Inside [Product / Platform]', 'NUM', ['REVIEW', 'EDU']],
  [85, 'How To Spot [Red Flag / Scam / Quality] In [Seconds]', 'SEO', ['REVIEW', 'EDU'], false, 'medium'],
  [86, 'Why [Simple Question] Has No Easy Answer', 'CG', ['DOC', 'SELF']],
  [87, 'The Untold Truth About [Iconic Movie / Game / Franchise]', 'CA', ['ENT', 'DOC']],
  [88, 'How [Creator / Studio] Made [Masterpiece] Work', 'SEO', ['ENT', 'EDU']],
  [89, '[Number] Details You Missed In [Show / Game / Event]', 'NUM', ['ENT', 'DOC']],
  [90, 'The Strange Reason [Product / Policy] Disappeared', 'CG', ['DOC', 'REVIEW']],
  [91, 'Why [Trend] Is Taking Over [Country / Platform] Right Now', 'NE', ['NEWS']],
  [92, 'The Myth Of [Popular Belief] Explained', 'CA', ['DOC', 'SELF']],
  [93, 'Step-By-Step: How To [Master Core Task] At Home', 'SEO', ['EDU']],
  [94, 'If I Started [Goal] From Zero Today, Here Is My Plan', 'NE', ['EDU', 'SELF'], true],
  [95, '[Number] Lessons From [X Years] Of [Experience]', 'NUM', ['SELF', 'EDU']],
  [96, 'What Nobody Tells You About Moving To / Living In [Place]', 'CG', ['DOC', 'SELF']],
  [97, 'Why [High-Risk Claim] Backfires Fast', 'CA', ['DOC', 'SELF'], false, 'medium'],
  [98, 'The Physics / Economics Of [Everyday Thing]', 'SEO', ['DOC', 'EDU']],
  [99, 'One Small Shift That Transforms [Daily Outcome]', 'NE', ['SELF'], false, 'medium'],
  [100, 'How [Thing] Went From [Origin] To [Global Phenomenon]', 'CG', ['DOC', 'ENT', 'NEWS']],
];

export const TITLE_FORMATS: TitleFormat[] = RAW_TITLE_FORMAT_ROWS.map(
  ([id, pattern, archetypeCode, types, firstPerson = false, risk = 'low']) => ({
    id,
    pattern,
    archetype: ARCHETYPE_CODE_MAP[archetypeCode],
    types,
    firstPerson,
    risk,
  })
);

export function getTitleFormat(id: number): TitleFormat | undefined {
  return TITLE_FORMATS.find((f) => f.id === id);
}

export function selectCandidateFormats(
  contentType: ContentType | 'AUTO' = 'AUTO',
  opts: { allowFirstPerson?: boolean; preferredIds?: number[] } = {}
): TitleFormat[] {
  const allowFirstPerson = Boolean(opts.allowFirstPerson);
  const preferredIds = Array.isArray(opts.preferredIds) ? opts.preferredIds : [];

  const pool = TITLE_FORMATS.filter((f) => allowFirstPerson || !f.firstPerson);
  const seen = new Set<number>();
  const result: TitleFormat[] = [];

  for (const id of preferredIds) {
    const found = pool.find((f) => f.id === id);
    if (found && !seen.has(found.id)) {
      seen.add(found.id);
      result.push(found);
    }
  }

  if (contentType === 'AUTO') {
    const docFormats = pool.filter((f) => f.types.includes('DOC'));
    const eduNewsFormats = pool.filter(
      (f) => !f.types.includes('DOC') && (f.types.includes('EDU') || f.types.includes('NEWS'))
    );
    for (const f of [...docFormats, ...eduNewsFormats]) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        result.push(f);
      }
    }
  } else {
    for (const f of pool) {
      if (f.types.includes(contentType) && !seen.has(f.id)) {
        seen.add(f.id);
        result.push(f);
      }
    }
  }

  return result;
}

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
  { id: 'educational', name: 'Giáo giải thích / giáo dục' }
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

import { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Youtube, 
  Search, 
  Globe, 
  User, 
  FileText, 
  Copy, 
  Check, 
  Loader2, 
  Sparkles,
  RefreshCw,
  Hash,
  Tag,
  AlignLeft,
  Type as TypeIcon,
  Save,
  Download,
  RotateCcw,
  MessageSquare,
  Settings,
  Zap,
  Brain,
  Layout,
  ChevronDown,
  Shield,
  AlertTriangle,
  Key as KeyIcon,
  Eye,
  EyeOff,
  ExternalLink,
  ClipboardCheck,
  XCircle,
  Gauge,
  TrendingUp,
  CircleCheck,
  CircleAlert,
  CircleX,
  Flame,
  Image as ImageIcon,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell, 
  CartesianGrid,
  LabelList 
} from 'recharts';
import { cn, buildSeoChecklist } from '@/src/lib/utils';
import { YouTubeMetadata, UserPreferences, TrendReport } from '@/src/types';
import { 
  COUNTRIES, 
  LANGUAGES, 
  TITLE_STYLES, 
  DESCRIPTION_LENGTHS, 
  KEYWORD_TONES,
  DESCRIPTION_STYLES,
  KEYWORD_DENSITIES,
  DISCLAIMER_MODES
} from '@/src/constants';

const MEMORY_KEY = 'linhakaka_seo_memory';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface CtrTooltipProps {
  active?: boolean;
  payload?: any[];
}

function CtrScoreTooltip({ active, payload }: CtrTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-sm text-white p-3 rounded-xl shadow-xl text-xs max-w-xs border border-slate-700/80 pointer-events-none">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="font-bold text-slate-200">
            #{data.index}: {data.angle || 'Tiêu đề'}
          </span>
          {data.isBestOverall && (
            <span className="px-1.5 py-0.5 rounded bg-red-600 text-[10px] font-bold text-white">
              Best Overall
            </span>
          )}
        </div>
        <p className="font-medium text-slate-100 text-xs mb-1 line-clamp-2">
          {data.fullTitle}
        </p>
        <p className="text-[11px] text-slate-400 mb-2 italic line-clamp-1">
          {data.vietnamese}
        </p>
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 text-[11px]">
          <span className="text-slate-400">Điểm CTR ước tính:</span>
          <span className={cn(
            "font-black text-sm",
            data.ctrScore >= 80 ? "text-emerald-400" : data.ctrScore >= 50 ? "text-amber-400" : "text-red-400"
          )}>
            {data.ctrScore}/100
          </span>
        </div>
        {data.complianceRisk && (
          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
            <span>Độ an toàn tuân thủ:</span>
            <span className={cn(
              "font-medium",
              data.complianceRisk === 'Thấp' ? "text-emerald-400" : data.complianceRisk === 'Trung bình' ? "text-amber-400" : "text-red-400"
            )}>
              {data.complianceRisk === 'Thấp' ? 'An toàn' : data.complianceRisk === 'Trung bình' ? 'Cần lưu ý' : 'Rủi ro'}
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
}

export default function App() {
  const [script, setScript] = useState('');
  const [country, setCountry] = useState('US');
  const [language, setLanguage] = useState('en-US');
  const [channelName, setChannelName] = useState('');
  const [titleStyle, setTitleStyle] = useState('auto');
  const [brandVoice, setBrandVoice] = useState('');
  const [descriptionLength, setDescriptionLength] = useState('medium');
  const [keywordTone, setKeywordTone] = useState('natural');
  const [descriptionStyle, setDescriptionStyle] = useState('balanced');
  const [keywordDensity, setKeywordDensity] = useState('normal');
  const [disclaimerMode, setDisclaimerMode] = useState('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStage, setGenStage] = useState<'idle' | 'trends' | 'metadata'>('idle');
  const [useTrends, setUseTrends] = useState(true);
  const [trendReport, setTrendReport] = useState<TrendReport | null>(null);
  const [isTrendExpanded, setIsTrendExpanded] = useState(true);
  const [metadata, setMetadata] = useState<YouTubeMetadata | null>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(true);
  const [isDisclaimerExpanded, setIsDisclaimerExpanded] = useState(false);
  const [isSeoNotesExpanded, setIsSeoNotesExpanded] = useState(false);
  const [isAudienceExpanded, setIsAudienceExpanded] = useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMemory();
  }, []);

  // Recomputes instantly client-side whenever the metadata or the selected
  // title changes — no extra AI call needed for this checklist.
  const checklist = useMemo(() => {
    if (!metadata) return [];
    const selectedTitle = metadata.titles[selectedTitleIndex]?.localized || '';
    return buildSeoChecklist(metadata, language, selectedTitle);
  }, [metadata, selectedTitleIndex, language]);

  const titleChartData = useMemo(() => {
    if (!metadata?.titles) return [];
    return metadata.titles.map((t, idx) => ({
      index: idx + 1,
      name: t.angle ? `#${idx + 1} ${t.angle}` : `#${idx + 1}`,
      shortName: t.angle ? `#${idx + 1} ${t.angle.length > 10 ? t.angle.slice(0, 9) + '…' : t.angle}` : `#${idx + 1}`,
      fullTitle: t.localized,
      vietnamese: t.vietnamese,
      angle: t.angle,
      ctrScore: Math.round(t.ctrScore || 0),
      isBestOverall: t.isBestOverall,
      complianceRisk: t.complianceRisk,
      isSelected: selectedTitleIndex === idx,
    }));
  }, [metadata?.titles, selectedTitleIndex]);

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    
    const mapping: Record<string, string> = {
      'VN': 'vi-VN',
      'US': 'en-US',
      'GB': 'en-GB',
      'MX': 'es-MX',
      'BR': 'pt-BR',
      'PT': 'pt-PT',
      'ES': 'es-ES',
      'AE': 'ar-AE',
      'SA': 'ar-SA',
      'EG': 'ar',
      'TR': 'tr-TR',
      'PL': 'pl-PL',
      'NL': 'nl-NL',
      'UA': 'uk-UA',
      'IL': 'he-IL',
      'HK': 'zh-HK',
      'TW': 'zh-TW',
      'DE': 'de-DE',
      'FR': 'fr-FR',
      'IT': 'it-IT',
      'JP': 'ja-JP',
      'KR': 'ko-KR',
      'PH': 'fil-PH'
    };
    
    if (mapping[newCountry]) {
      setLanguage(mapping[newCountry]);
    }
  };

  const saveMemory = () => {
    const prefs: UserPreferences = {
      country,
      language,
      channelName,
      titleStyle,
      brandVoice,
      descriptionLength,
      keywordTone,
      descriptionStyle,
      keywordDensity,
      disclaimerMode
    };
    localStorage.setItem(MEMORY_KEY, JSON.stringify(prefs));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const loadMemory = () => {
    const saved = localStorage.getItem(MEMORY_KEY);
    if (saved) {
      try {
        const prefs: UserPreferences = JSON.parse(saved);
        setCountry(prefs.country || 'US');
        setLanguage(prefs.language || 'en-US');
        setChannelName(prefs.channelName || '');
        setTitleStyle(prefs.titleStyle || 'auto');
        setBrandVoice(prefs.brandVoice || '');
        setDescriptionLength(prefs.descriptionLength || 'medium');
        setKeywordTone(prefs.keywordTone || 'natural');
        setDescriptionStyle(prefs.descriptionStyle || 'balanced');
        setKeywordDensity(prefs.keywordDensity || 'normal');
        setDisclaimerMode(prefs.disclaimerMode || 'auto');
      } catch (e) {
        console.error('Failed to parse memory', e);
      }
    }
  };

  const resetMemory = () => {
    localStorage.removeItem(MEMORY_KEY);
    setCountry('US');
    setLanguage('en-US');
    setChannelName('');
    setTitleStyle('auto');
    setBrandVoice('');
    setDescriptionLength('medium');
    setKeywordTone('natural');
    setDescriptionStyle('balanced');
    setKeywordDensity('normal');
    setDisclaimerMode('auto');
  };

  const getCapRuleNote = (locale: string) => {
    if (locale.startsWith('en')) return "Mặc định: Title Case (chuẩn SEO cho US/UK)";
    if (locale.startsWith('vi')) return "Mặc định: Viết hoa đầu câu (Tự nhiên tiếng Việt)";
    if (locale.startsWith('es') || locale.startsWith('fr') || locale.startsWith('de')) return "Mặc định: Viết hoa đầu câu (Đúng ngữ pháp locale)";
    return "Mặc định: Kiểu viết chuẩn theo thị trường này";
  };

  const generateMetadata = async () => {
    if (!script.trim()) {
      setError("Vui lòng cung cấp kịch bản video.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const selectedCountry = COUNTRIES.find(c => c.code === country)?.name || country;
      const selectedLanguage = LANGUAGES.find(l => l.code === language)?.name || language;
      const selectedTitleStyle = TITLE_STYLES.find(s => s.id === titleStyle)?.name || titleStyle;
      const selectedTone = KEYWORD_TONES.find(t => t.id === keywordTone)?.name || keywordTone;
      const selectedDescStyle = DESCRIPTION_STYLES.find(s => s.id === descriptionStyle)?.name || descriptionStyle;
      const selectedDensity = KEYWORD_DENSITIES.find(d => d.id === keywordDensity)?.name || keywordDensity;
      const selectedDisclaimer = DISCLAIMER_MODES.find(m => m.id === disclaimerMode)?.name || disclaimerMode;

      // ===== PHASE 1: Live trend scan (Google Search grounding) =====
      // JSON mode and Search grounding cannot be combined in one call, so we run
      // a separate grounded call first and feed its findings into the metadata call.
      let trendContext = '';
      let newTrendReport: TrendReport | null = null;
      if (useTrends) {
        setGenStage('trends');
        try {
          const trendResp = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `You are a YouTube trend researcher. Using Google Search, research what is CURRENTLY trending (last 30-90 days) around the topic of this video script for viewers in ${selectedCountry} who speak ${selectedLanguage}.

Video script (excerpt):
"""
${script.slice(0, 2000)}
"""

Report concisely in Vietnamese, using markdown with these sections:
1. **Xu hướng nóng** — 3-5 angles/formats/events currently trending around this topic in this market.
2. **Từ khóa & cụm từ đang lên** — trending search phrases in ${selectedLanguage} (write them in ${selectedLanguage}, with a short Vietnamese gloss).
3. **Cách đối thủ đặt tiêu đề** — 2-3 title patterns top-performing videos on this topic are using right now.
4. **Góc khai thác nên tránh** — angles that are saturated or declining.

Keep it under 300 words. Be specific and current, not generic.`,
            config: {
              tools: [{ googleSearch: {} }]
            }
          });
          const summary = trendResp.text || '';
          const chunks: any[] = (trendResp as any).candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          const sources = chunks
            .map((c: any) => ({ title: c.web?.title || c.web?.uri || '', url: c.web?.uri || '' }))
            .filter((s: { url: string }) => s.url)
            .slice(0, 6);
          if (summary.trim()) {
            newTrendReport = { summary, sources };
            trendContext = summary;
          }
        } catch (trendErr) {
          // Trend scan is best-effort: if grounding fails, continue without it.
          console.warn('Trend scan failed, continuing without trends', trendErr);
        }
      }
      setTrendReport(newTrendReport);

      // ===== PHASE 2: Structured metadata generation =====
      setGenStage('metadata');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate high-quality YouTube metadata localized for the following market:
          Script: ${script}
          Target Country (ISO 3166): ${country} (${selectedCountry})
          Output Language (BCP 47): ${language} (${selectedLanguage})
          Title Capitalization Style: ${selectedTitleStyle}
          Channel Name: ${channelName || "Not provided"}
          Brand Voice: ${brandVoice || "Professional & Engaging"}
          Description Length: ${descriptionLength}
          Description Style: ${selectedDescStyle}
          SEO Keyword Tone: ${selectedTone}
          Keyword Density: ${selectedDensity}
          Disclaimer Mode: ${selectedDisclaimer}
          ${trendContext ? `\nLIVE TREND RESEARCH (from Google Search, use this to make titles/keywords/hashtags ride current trends — but NEVER invent facts not in the script):\n"""\n${trendContext}\n"""` : ''}`,
        config: {
          systemInstruction: `You are a senior YouTube SEO metadata strategist AND a native ${selectedCountry} market copywriter writing in ${selectedLanguage}.
            Analyze the video script and generate localized metadata that maximizes CLICK-THROUGH RATE (CTR) while staying 100% within YouTube's policies.

            ===== COMPLIANCE GUARDRAIL (HARD RULES — non-negotiable) =====
            YouTube removes videos as "egregious clickbait" when the title or thumbnail promises something the video does not deliver, especially for news/current events. Therefore:
            - Every title and every thumbnail text MUST be a promise the SCRIPT actually fulfills. If the script does not support a claim, DO NOT write it.
            - NEVER invent facts, numbers, quotes, deaths, arrests, or events not present in the script.
            - For news / politics / health / finance: no false, exaggerated, or unverifiable claims. No fake urgency ("BREAKING", "just happened") unless the script is truly about that event.
            - Create intrigue with a CURIOSITY GAP that the content pays off — never with deception or a bait-and-switch.
            - If any title borders on over-promising, LOWER its ctrScore and add a one-line warning in "seoNotes" telling the creator to make sure the video answers that hook within the first 30 seconds.

            ===== CORE OBJECTIVES =====
            - Write human-sounding, persuasive, scannable metadata that a native ${selectedCountry} creator would write — not a translation bot.
            - Optimize for CTR and local search intent together.
            - Distribute keywords intelligently using "Keyword Density: ${selectedDensity}".

            ===== KEYWORD STRATEGY =====
            1. Identify 1 Primary Keyword and 2-4 Secondary Keywords from the script.
            2. Put the Primary Keyword early (first 1-2 sentences of the description).
            3. Spread Secondary Keywords naturally; use semantic (LSI) variations and native synonyms.
            4. AVOID keyword stuffing; never repeat the exact keyword unnaturally.

            ===== DESCRIPTION ("Style: ${selectedDescStyle}") =====
            1. HOOK: 1-2 sentences stating the value, keyword-rich, front-loaded (shows before "...more").
            2. CORE VALUE: what the viewer will learn/feel.
            3. SUPPORTING DETAILS: specific points/sections; include a "00:00 ..." timestamps placeholder line.
            4. CTA: a native, non-spammy call to action.
            5. DISCLAIMER: add per SMART DISCLAIMER LOGIC below.
            Readability: vary sentence length, 2-4 short paragraphs, match Brand Voice: "${brandVoice}".

            ===== SMART DISCLAIMER LOGIC =====
            - If Disclaimer Mode is "Auto", scan for Medical/Health, Finance/Crypto/Investing, Legal, High-risk activities, or Affiliate/Sponsorship.
            - If detected or explicitly selected ("${selectedDisclaimer}"), append a professional localized disclaimer at the END of the description AND return it in "disclaimerText" (same language).
            - Use YouTube-standard phrasing (Medical=informational not medical advice; Finance=not financial advice, past performance != future results; Affiliate=links may earn commission; Safety=performed by professionals, do not attempt).
            - If none needed: disclaimerUsed=false, disclaimerType="none", disclaimerText="".

            ===== TITLES — generate 7 DISTINCT titles, one per archetype below =====
            Use a DIFFERENT proven high-CTR archetype for each (label it in "angle"):
            1. SEO-Anchor — primary keyword inside the first 3 words; crystal clear.
            2. Curiosity-Gap / Open Loop — opens a question the viewer needs answered (that the script answers).
            3. Contrast / Paradox — rise-and-fall or expectation-vs-reality tension.
            4. Number / Specificity — a concrete figure, amount, or timeframe from the script.
            5. Authority / Evidence — insiders, documents, records, or experts reveal the truth.
            6. Trend-Riding — leverages the LIVE TREND RESEARCH if provided; otherwise a clear, direct take.
            7. Native-Emotional — native phrasing + the strongest emotion the story carries.

            HIGH-CTR CRAFT (apply to EVERY title):
            - Front-load the keyword OR the emotional hook in the first 3-5 words (mobile cuts the rest).
            - Use CTR levers where natural: numbers, brackets/parentheses for context, and power words NATIVE to ${selectedLanguage} (local equivalents of: secret, mistake, warning, finally, nobody tells you, the real reason).
            - Localize punctuation & style per market: Japanese/Korean titles are short and often use quote brackets; Latin-script markets run 45-60 chars. Respect the ideal length for ${selectedLanguage}.
            - Do NOT use ALL-CAPS whole titles or more than 1 emoji.
            - Set exactly ONE title isBestOverall=true — the highest CTR that ALSO fully passes the COMPLIANCE GUARDRAIL.
            - "reason": 1 sentence on why it works for the ${selectedCountry} market.
            - "vietnamese": a faithful Vietnamese gloss of the localized title.
            - "ctrScore" (0-100): honest click potential for a ${selectedCountry} viewer scrolling search/suggested, based on curiosity gap, clarity, keyword front-loading — MINUS any compliance risk. Scores MUST differ meaningfully.
            - "complianceRisk" ('Thấp' | 'Trung bình' | 'Cao'): rate based on the COMPLIANCE GUARDRAIL (risk of over-promising). If "Cao", the title CANNOT be isBestOverall=true.
            - "complianceNote": 1 short Vietnamese sentence explaining the risk and how to fix it. If 'Thấp', just say "An toàn — đúng nội dung kịch bản".

            ===== THUMBNAIL TEXT ("thumbnailTexts", 3-5, in ${selectedLanguage}) =====
            - 2-5 words each, high-contrast, readable at small size.
            - Must COMPLEMENT the best title (never repeat it) so title + thumbnail form one curiosity gap — and must obey the COMPLIANCE GUARDRAIL.

            ===== TAGS =====
            - 10-15 tags, total under 450 characters. FIRST tag = exact primary keyword.
            - Mix 2-3 broad + 5-7 specific + 3-5 long-tail. All in ${selectedLanguage}, no "#", no duplicates/stuffing.

            ===== HASHTAGS =====
            - EXACTLY 3-5. YouTube shows only the FIRST 3 above the title: order them 1 primary-keyword, 1 trending/topical, 1 broad category. CamelCase, no spaces, nothing misleading.

            ===== SCORING & INSIGHTS =====
            - "seoScore" (title/description/tags/keywordUsage/overall, 0-100 each): grade like a strict honest auditor, do not inflate.
            - "keywordInsights" (5-8, vidIQ-style): primary + secondary/LSI + 2-3 uncovered long-tail. Each has searchVolume (Cao/Trung binh/Thap), competition (Cao/Trung binh/Thap), opportunityScore (0-100, higher when decent volume + low competition). Relative estimates, not live data.
            - "seoNotes": 1-2 sentences of specific SEO advice (include any compliance warning here).
            - "targetAudience" and "searchIntent": identify both.
            - "trendAlignment": if live trend research was provided, 1-2 sentences (in Vietnamese) on exactly how the titles/keywords/hashtags ride those trends; else empty string.

            Output ONLY valid JSON matching the schema.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    localized: { type: Type.STRING },
                    vietnamese: { type: Type.STRING },
                    angle: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    isBestOverall: { type: Type.BOOLEAN },
                    ctrScore: { type: Type.NUMBER },
                    complianceRisk: { type: Type.STRING, enum: ["Thấp", "Trung bình", "Cao"] },
                    complianceNote: { type: Type.STRING }
                  },
                  required: ["localized", "vietnamese", "angle", "reason", "isBestOverall", "ctrScore", "complianceRisk", "complianceNote"]
                }
              },
              primaryKeyword: { type: Type.STRING },
              keywordInsights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    keyword: { type: Type.STRING },
                    searchVolume: { type: Type.STRING, enum: ["Cao", "Trung bình", "Thấp"] },
                    competition: { type: Type.STRING, enum: ["Cao", "Trung bình", "Thấp"] },
                    opportunityScore: { type: Type.NUMBER }
                  },
                  required: ["keyword", "searchVolume", "competition", "opportunityScore"]
                }
              },
              description: { type: Type.STRING },
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
                  keywordUsage: { type: Type.NUMBER }
                },
                required: ["overall", "title", "description", "tags", "keywordUsage"]
              }
            },
            required: ["titles", "primaryKeyword", "keywordInsights", "description", "disclaimerUsed", "disclaimerType", "disclaimerText", "tags", "hashtags", "thumbnailTexts", "seoNotes", "trendAlignment", "targetAudience", "searchIntent", "seoScore"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}') as YouTubeMetadata;
      setMetadata(result);
      // Auto-select the best overall title or the first one
      const bestIdx = result.titles.findIndex(t => t.isBestOverall);
      setSelectedTitleIndex(bestIdx !== -1 ? bestIdx : 0);
      
      setIsDescExpanded(true);
      setIsTrendExpanded(true);
      setIsDisclaimerExpanded(result.disclaimerUsed);
      setIsSeoNotesExpanded(false);
      setIsAudienceExpanded(true);
      setIsTagsExpanded(window.innerWidth >= 768); // Expanded on desktop by default
      
      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      console.error(err);
      setError("Không thể tạo metadata. Vui lòng thử lại sau.");
    } finally {
      setIsGenerating(false);
      setGenStage('idle');
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-red-100 selection:text-red-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-1.5 rounded-lg">
              <Youtube className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Linhakaka SEO Localizer</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded uppercase tracking-wider">
              Powered by Gemini
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* Input Section */}
          <div className="lg:col-span-5 space-y-6">
            {/* Market Preset / Memory Section */}
            <section className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800 overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Brain className="w-24 h-24 rotate-12" />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-red-500/20 p-2 rounded-xl">
                      <Brain className="w-5 h-5 text-red-500" />
                    </div>
                    <h2 className="text-lg font-bold tracking-tight">Bộ nhớ thị trường</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={saveMemory}
                      title="Lưu cấu hình hiện tại"
                      className={cn(
                        "p-2.5 rounded-xl transition-all border shrink-0",
                        saveStatus === 'saved' 
                          ? "bg-green-500/20 border-green-500 text-green-500" 
                          : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                      )}
                    >
                      {saveStatus === 'saved' ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={loadMemory}
                      title="Tải cấu hình đã lưu"
                      className="p-2.5 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-xl transition-all shrink-0"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={resetMemory}
                      title="Đặt lại mặc định"
                      className="p-2.5 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-xl transition-all shrink-0"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-400 max-w-[200px] leading-snug font-medium">
                  Lưu thị trường mục tiêu và tùy chọn SEO để dùng lại nhanh.
                </p>
              </div>
            </section>

            {/* Local Market Settings Section */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-8 pb-4 border-b border-slate-100">
                <div className="bg-slate-100 p-2 rounded-xl">
                  <Settings className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 leading-tight">Cài đặt địa phương</h2>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Market & SEO Strategy</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Locale Group */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-[13px] font-bold text-slate-600 mb-2 px-1">
                        <Globe className="w-4 h-4 text-slate-400" />
                        Quốc gia
                      </label>
                      <div className="relative">
                        <select 
                          value={country}
                          onChange={(e) => handleCountryChange(e.target.value)}
                          className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all cursor-pointer"
                        >
                          {COUNTRIES.map(c => (
                            <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-[13px] font-bold text-slate-600 mb-2 px-1">
                        <Search className="w-4 h-4 text-slate-400" />
                        Ngôn ngữ
                      </label>
                      <div className="relative">
                        <select 
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all cursor-pointer"
                        >
                          {LANGUAGES.map(l => (
                            <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Style Group */}
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-[13px] font-bold text-slate-600 mb-2 px-1">
                        <TypeIcon className="w-4 h-4 text-slate-400" />
                        Kiểu tiêu đề
                      </label>
                      <div className="relative">
                        <select 
                          value={titleStyle}
                          onChange={(e) => setTitleStyle(e.target.value)}
                          className="w-full appearance-none bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all cursor-pointer"
                        >
                          {TITLE_STYLES.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-[13px] font-bold text-slate-600 mb-2 px-1">
                        <Layout className="w-4 h-4 text-slate-400" />
                        Độ dài mô tả
                      </label>
                      <div className="relative">
                        <select 
                          value={descriptionLength}
                          onChange={(e) => setDescriptionLength(e.target.value)}
                          className="w-full appearance-none bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all cursor-pointer"
                        >
                          {DESCRIPTION_LENGTHS.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {titleStyle === 'auto' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3"
                    >
                      <div className="bg-red-500 p-1.5 rounded-lg shrink-0 mt-0.5">
                        <Sparkles className="w-3 h-3 text-white" />
                      </div>
                      <p className="text-[11px] text-red-700 font-bold leading-tight">
                        {getCapRuleNote(language)}
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Additional SEO Info */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-[13px] font-bold text-slate-600 mb-2 px-1">
                        <User className="w-4 h-4 text-slate-400" />
                        Tên kênh
                      </label>
                      <input 
                        type="text"
                        value={channelName}
                        onChange={(e) => setChannelName(e.target.value)}
                        placeholder="v.d. Linhakaka"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-[13px] font-bold text-slate-600 mb-2 px-1">
                        <Zap className="w-4 h-4 text-slate-400" />
                        Tông SEO
                      </label>
                      <div className="relative">
                        <select 
                          value={keywordTone}
                          onChange={(e) => setKeywordTone(e.target.value)}
                          className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all cursor-pointer"
                        >
                          {KEYWORD_TONES.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-[13px] font-bold text-slate-600 mb-2 px-1">
                        <AlignLeft className="w-4 h-4 text-slate-400" />
                        Kiểu mô tả
                      </label>
                      <div className="relative">
                        <select 
                          value={descriptionStyle}
                          onChange={(e) => setDescriptionStyle(e.target.value)}
                          className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all cursor-pointer"
                        >
                          {DESCRIPTION_STYLES.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-[13px] font-bold text-slate-600 mb-2 px-1">
                        <Sparkles className="w-4 h-4 text-slate-400" />
                        Mật độ từ khóa
                      </label>
                      <div className="relative">
                        <select 
                          value={keywordDensity}
                          onChange={(e) => setKeywordDensity(e.target.value)}
                          className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all cursor-pointer"
                        >
                          {KEYWORD_DENSITIES.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-[13px] font-bold text-slate-600 mb-2 px-1">
                      <Shield className="w-4 h-4 text-slate-400" />
                      Chế độ định dạng disclaimer
                    </label>
                    <div className="relative">
                      <select 
                        value={disclaimerMode}
                        onChange={(e) => setDisclaimerMode(e.target.value)}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all cursor-pointer"
                      >
                        {DISCLAIMER_MODES.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-[13px] font-bold text-slate-600 mb-2 px-1">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      Giọng thương hiệu (Brand Voice)
                    </label>
                    <input 
                      type="text"
                      value={brandVoice}
                      onChange={(e) => setBrandVoice(e.target.value)}
                      placeholder="v.d. Thân thiện, chuyên nghiệp, hoặc giật gân"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Trend Scan Toggle */}
                <div
                  onClick={() => setUseTrends(!useTrends)}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all",
                    useTrends
                      ? "bg-orange-50 border-orange-200"
                      : "bg-slate-50 border-slate-200"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-xl shrink-0", useTrends ? "bg-orange-500" : "bg-slate-300")}>
                      <Flame className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-slate-700 leading-tight">Bắt xu hướng (Google Search)</p>
                      <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                        Quét trend thật trên Google trước khi tạo metadata — tiêu đề & từ khóa bám xu hướng hiện tại. Chậm hơn vài giây.
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "w-11 h-6 rounded-full relative transition-colors shrink-0 ml-3",
                    useTrends ? "bg-orange-500" : "bg-slate-300"
                  )}>
                    <div className={cn(
                      "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all",
                      useTrends ? "left-[22px]" : "left-0.5"
                    )} />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 text-[13px] font-bold text-slate-600 mb-2 px-1">
                    <FileText className="w-4 h-4 text-slate-400" />
                    Kịch bản video
                  </label>
                  <textarea 
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder="Dán toàn bộ kịch bản video vào đây..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-4 py-4 text-sm font-medium focus:ring-4 focus:ring-red-500/10 focus:border-red-500 outline-none transition-all min-h-[180px] resize-y"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
                    {error}
                  </div>
                )}

                <button
                  onClick={generateMetadata}
                  disabled={isGenerating}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-xl shadow-red-500/25",
                    isGenerating 
                      ? "bg-slate-400 cursor-not-allowed" 
                      : "bg-red-600 hover:bg-red-700 active:scale-[0.98] hover:-translate-y-0.5"
                  )}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {genStage === 'trends' ? 'Đang quét xu hướng trên Google...' : 'Đang tạo metadata SEO...'}
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 fill-white" />
                      Tạo metadata SEO
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-7" ref={resultsRef}>
            <AnimatePresence mode="wait">
              {metadata ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6 pb-20"
                >
                  {/* Result Header Actions */}
                  <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="bg-red-600 p-1.5 rounded-lg">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <h2 className="text-sm font-bold text-slate-800">Kết quả tối ưu</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={generateMetadata}
                        disabled={isGenerating}
                        className="p-2 hover:bg-slate-50 text-slate-500 hover:text-red-600 rounded-xl transition-all border border-transparent hover:border-slate-100 flex items-center gap-2 text-xs font-bold"
                        title="Tạo lại kết quả"
                      >
                        <RefreshCw className={cn("w-4 h-4", isGenerating && "animate-spin")} />
                        Tạo lại
                      </button>
                      <button 
                        onClick={() => {
                          const allText = `TIÊU ĐỀ ĐÃ CHỌN:\n${metadata.titles[selectedTitleIndex].localized}\n\nTẤT CẢ TIÊU ĐỀ GỢI Ý:\n${metadata.titles.map((t, i) => `${i+1}. ${t.localized} (${t.angle})`).join('\n')}\n\nMÔ TẢ:\n${metadata.description}\n\nHASHTAGS:\n${metadata.hashtags.join(' ')}\n\nTAGS:\n${metadata.tags.join(', ')}`;
                          copyToClipboard(allText, 'copy-all');
                        }}
                        className="p-2 hover:bg-slate-50 text-slate-500 hover:text-red-600 rounded-xl transition-all border border-transparent hover:border-slate-100 flex items-center gap-2 text-xs font-bold"
                        title="Sao chép tất cả"
                      >
                        {copiedField === 'copy-all' ? <><Check className="w-4 h-4" /> Đã chép</> : <><Copy className="w-4 h-4" /> Sao chép hết</>}
                      </button>
                      <button 
                        onClick={() => { setMetadata(null); setTrendReport(null); }}
                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-all"
                        title="Xóa kết quả"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Live Trend Insights (Google Search grounding) */}
                  {trendReport && (
                    <div className="bg-linear-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
                      <button
                        onClick={() => setIsTrendExpanded(!isTrendExpanded)}
                        className="w-full flex items-center justify-between p-4 hover:bg-orange-100/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 text-xs font-bold text-orange-700 uppercase tracking-wider">
                          <Flame className="w-4 h-4 text-orange-500" />
                          Xu hướng hiện tại (dữ liệu Google Search)
                        </div>
                        <ChevronDown className={cn("w-4 h-4 text-orange-400 transition-transform duration-300", isTrendExpanded && "rotate-180")} />
                      </button>
                      <AnimatePresence>
                        {isTrendExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-0 space-y-4">
                              {metadata.trendAlignment && (
                                <div className="p-3 bg-orange-500/10 border border-orange-300/50 rounded-xl">
                                  <p className="text-[10px] uppercase tracking-wider font-bold text-orange-600 mb-1">Metadata này bám trend như thế nào</p>
                                  <p className="text-xs text-orange-900 font-medium leading-relaxed">{metadata.trendAlignment}</p>
                                </div>
                              )}
                              <div className="p-4 bg-white/70 rounded-xl border border-orange-200/50 text-xs text-slate-700 leading-relaxed [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_strong]:text-orange-800 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-2 [&_li]:mb-1">
                                <ReactMarkdown>{trendReport.summary}</ReactMarkdown>
                              </div>
                              {trendReport.sources.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {trendReport.sources.map((s, i) => (
                                    <a
                                      key={i}
                                      href={s.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white/80 border border-orange-200 rounded-lg text-[10px] font-bold text-orange-700 hover:bg-white transition-colors max-w-[220px]"
                                    >
                                      <LinkIcon className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{s.title}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* SEO Score Overview (vidIQ-style) */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-5">
                      <Gauge className="w-4 h-4 text-red-500" />
                      Điểm SEO tổng thể
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="relative w-32 h-32 shrink-0">
                        <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                          <circle
                            cx="50" cy="50" r="42" fill="none"
                            stroke={metadata.seoScore.overall >= 80 ? '#16a34a' : metadata.seoScore.overall >= 50 ? '#f59e0b' : '#dc2626'}
                            strokeWidth="10"
                            strokeDasharray={`${(metadata.seoScore.overall / 100) * 263.9} 263.9`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-black text-slate-800">{Math.round(metadata.seoScore.overall)}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">/ 100</span>
                        </div>
                      </div>
                      <div className="flex-1 w-full grid grid-cols-2 gap-3">
                        {[
                          { label: 'Tiêu đề', value: metadata.seoScore.title },
                          { label: 'Mô tả', value: metadata.seoScore.description },
                          { label: 'Tags', value: metadata.seoScore.tags },
                          { label: 'Dùng từ khóa', value: metadata.seoScore.keywordUsage },
                        ].map((s) => (
                          <div key={s.label} className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                              <span>{s.label}</span>
                              <span className="text-slate-700">{Math.round(s.value)}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  s.value >= 80 ? "bg-green-500" : s.value >= 50 ? "bg-amber-500" : "bg-red-500"
                                )}
                                style={{ width: `${Math.min(100, Math.max(0, s.value))}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
                      Điểm do Gemini tự chấm dựa trên chuẩn SEO YouTube cho thị trường {LANGUAGES.find(l => l.code === language)?.name} — mang tính tham khảo định hướng, không phải dữ liệu thời gian thực từ YouTube.
                    </p>
                  </div>

                  {/* On-Page Optimization Checklist (computed client-side, updates instantly per selected title) */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                      <ClipboardCheck className="w-4 h-4 text-red-500" />
                      Checklist tối ưu (theo tiêu đề đang chọn)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {checklist.map((item) => (
                        <div key={item.id} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                          {item.status === 'pass' && <CircleCheck className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />}
                          {item.status === 'warn' && <CircleAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                          {item.status === 'fail' && <CircleX className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                          <div>
                            <p className="text-xs font-bold text-slate-700 leading-tight">{item.label}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{item.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Title Suggestions Card */}
                    <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          <TypeIcon className="w-4 h-4 text-red-500" />
                          Gợi ý tiêu đề (Title Suggestions)
                        </div>
                        <button 
                          onClick={() => {
                            const titlesText = metadata.titles.map((t, i) => `${i+1}. ${t.localized}`).join('\n');
                            copyToClipboard(titlesText, 'titles-all');
                          }}
                          className="p-1 px-2 hover:bg-white rounded-lg text-slate-400 hover:text-red-600 transition-all border border-transparent hover:border-slate-200 font-bold text-[10px] flex items-center gap-1.5"
                        >
                          {copiedField === 'titles-all' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          Sao chép tất cả tiêu đề
                        </button>
                      </div>
                      <div className="p-4 space-y-3">
                        {metadata.titles.map((title, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => setSelectedTitleIndex(idx)}
                            className={cn(
                              "group relative p-4 rounded-xl border transition-all cursor-pointer",
                              selectedTitleIndex === idx 
                                ? "bg-red-50 border-red-200 shadow-sm" 
                                : "bg-white border-slate-100 hover:border-slate-200"
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                    title.isBestOverall 
                                      ? "bg-red-600 text-white" 
                                      : "bg-slate-100 text-slate-500"
                                  )}>
                                    {title.isBestOverall ? 'Best Overall' : title.angle}
                                  </span>
                                  {title.complianceRisk === 'Thấp' && (
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-emerald-100">
                                      <Shield className="w-3 h-3" /> An toàn
                                    </span>
                                  )}
                                  {title.complianceRisk === 'Trung bình' && (
                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-amber-100">
                                      <AlertTriangle className="w-3 h-3" /> Cần lưu ý
                                    </span>
                                  )}
                                  {title.complianceRisk === 'Cao' && (
                                    <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-red-100">
                                      <AlertTriangle className="w-3 h-3" /> Rủi ro
                                    </span>
                                  )}
                                  {selectedTitleIndex === idx && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-600">
                                      <Check className="w-3 h-3" /> Đã chọn đăng tải
                                    </span>
                                  )}
                                  <span
                                    className={cn(
                                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ml-auto",
                                      title.ctrScore >= 80 ? "bg-green-100 text-green-700" : title.ctrScore >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                    )}
                                    title="Điểm CTR ước tính bởi AI"
                                  >
                                    <TrendingUp className="w-3 h-3" />
                                    CTR {Math.round(title.ctrScore)}
                                  </span>
                                </div>
                                <h3 className={cn(
                                  "text-base font-bold leading-tight mb-1",
                                  selectedTitleIndex === idx ? "text-red-900" : "text-slate-800"
                                )}>
                                  {title.localized}
                                </h3>
                                <p className="text-xs text-slate-400 font-medium mb-1">Dịch: {title.vietnamese}</p>
                                <p className="text-[11px] text-slate-400 italic leading-snug">
                                  {title.reason}
                                </p>
                                {title.complianceNote && (
                                  <p className="text-[11px] text-slate-500 mt-2 leading-snug">
                                    <span className="font-semibold text-slate-600">Lưu ý tuân thủ: </span>
                                    {title.complianceNote}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col gap-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(title.localized, `title-${idx}`);
                                  }}
                                  className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                                  title="Sao chép tiêu đề này"
                                >
                                  {copiedField === `title-${idx}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTR Score Comparison Chart Card */}
                    {metadata.titles && metadata.titles.length > 0 && (
                      <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                              <TrendingUp className="w-4 h-4 text-red-500" />
                              So sánh điểm CTR các tiêu đề (CTR Score Comparison)
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Khả năng thu hút lượt nhấp (0 - 100) theo từng góc độ tiếp cận. Nhấp vào cột để chọn tiêu đề.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm bg-red-600 inline-block" />
                              <span className="font-semibold text-slate-700">Best Overall</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                              <span>CTR Cao (≥80)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                              <span>CTR TB (50-79)</span>
                            </div>
                          </div>
                        </div>

                        <div className="h-60 w-full pt-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={titleChartData}
                              margin={{ top: 20, right: 15, left: -20, bottom: 20 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis
                                dataKey="shortName"
                                tick={{ fontSize: 11, fill: '#64748b' }}
                                tickLine={false}
                                axisLine={{ stroke: '#e2e8f0' }}
                                interval={0}
                              />
                              <YAxis
                                domain={[0, 100]}
                                ticks={[0, 25, 50, 75, 100]}
                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                tickLine={false}
                                axisLine={false}
                              />
                              <Tooltip content={<CtrScoreTooltip />} cursor={{ fill: '#f8fafc' }} />
                              <Bar
                                dataKey="ctrScore"
                                radius={[6, 6, 0, 0]}
                                onClick={(entry: any) => {
                                  if (entry && typeof entry.index === 'number') {
                                    setSelectedTitleIndex(entry.index - 1);
                                  }
                                }}
                                className="cursor-pointer"
                              >
                                <LabelList
                                  dataKey="ctrScore"
                                  position="top"
                                  fill="#475569"
                                  fontSize={11}
                                  fontWeight={700}
                                  offset={6}
                                />
                                {titleChartData.map((entry, index) => {
                                  let barColor = entry.ctrScore >= 80 ? '#10b981' : entry.ctrScore >= 50 ? '#f59e0b' : '#ef4444';
                                  if (entry.isBestOverall) {
                                    barColor = '#dc2626';
                                  }
                                  const isCurrent = selectedTitleIndex === index;
                                  return (
                                    <Cell
                                      key={`cell-${index}`}
                                      fill={barColor}
                                      stroke={isCurrent ? '#991b1b' : 'none'}
                                      strokeWidth={isCurrent ? 2 : 0}
                                      opacity={isCurrent ? 1 : 0.85}
                                    />
                                  );
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Keywords Section */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <KeyIcon className="w-3.5 h-3.5 text-red-500" />
                            Từ khóa chính
                          </div>
                          <button 
                            onClick={() => copyToClipboard(metadata.primaryKeyword, 'pk-box')}
                            className="p-1 hover:bg-slate-50 rounded-lg text-slate-300 hover:text-red-500 transition-all"
                          >
                            {copiedField === 'pk-box' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-red-50 border border-red-100 text-red-700 font-bold text-sm">
                          {metadata.primaryKeyword}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <Search className="w-3.5 h-3.5 text-slate-400" />
                            Từ khóa & Cơ hội (AI ước tính)
                          </div>
                          <button 
                            onClick={() => copyToClipboard(metadata.keywordInsights.map(k => k.keyword).join(', '), 'sk-box')}
                            className="p-1 hover:bg-slate-50 rounded-lg text-slate-300 hover:text-red-500 transition-all"
                          >
                            {copiedField === 'sk-box' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {metadata.keywordInsights.map((k, i) => (
                            <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-xs font-bold text-slate-700 truncate">{k.keyword}</span>
                                <span className="text-[10px] font-black text-slate-500 shrink-0">{Math.round(k.opportunityScore)}</span>
                              </div>
                              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1.5">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    k.opportunityScore >= 70 ? "bg-green-500" : k.opportunityScore >= 40 ? "bg-amber-500" : "bg-slate-400"
                                  )}
                                  style={{ width: `${Math.min(100, Math.max(0, k.opportunityScore))}%` }}
                                />
                              </div>
                              <div className="flex items-center gap-3 text-[10px] font-medium text-slate-400">
                                <span>Lượng tìm: <b className="text-slate-600">{k.searchVolume}</b></span>
                                <span>Cạnh tranh: <b className="text-slate-600">{k.competition}</b></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Hashtags Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <Hash className="w-3.5 h-3.5 text-blue-500" />
                          Hashtags
                        </div>
                        <button 
                          onClick={() => copyToClipboard(metadata.hashtags.join(' '), 'hashtags-box')}
                          className="p-1 px-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-red-500 transition-all text-[10px] font-bold flex items-center gap-1"
                        >
                          {copiedField === 'hashtags-box' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedField === 'hashtags-box' ? 'Đã chép' : 'Sao chép'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {metadata.hashtags.map((h, i) => (
                          <span
                            key={i}
                            className={cn(
                              "font-bold text-sm",
                              i < 3 ? "text-blue-600" : "text-slate-400"
                            )}
                            title={i < 3 ? "Hiển thị phía trên tiêu đề video" : "Chỉ nằm trong mô tả"}
                          >
                            {h.startsWith('#') ? h : `#${h}`}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-3 leading-snug">
                        YouTube chỉ hiển thị <b>3 hashtag đầu tiên</b> phía trên tiêu đề — 3 hashtag xanh là quan trọng nhất.
                      </p>

                      {/* Thumbnail Text Suggestions */}
                      {metadata.thumbnailTexts && metadata.thumbnailTexts.length > 0 && (
                        <div className="mt-5 pt-5 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
                              Chữ trên Thumbnail (tăng CTR)
                            </div>
                            <button
                              onClick={() => copyToClipboard(metadata.thumbnailTexts.join('\n'), 'thumb-box')}
                              className="p-1 hover:bg-slate-50 rounded-lg text-slate-300 hover:text-purple-500 transition-all"
                            >
                              {copiedField === 'thumb-box' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {metadata.thumbnailTexts.map((t, i) => (
                              <button
                                key={i}
                                onClick={() => copyToClipboard(t, `thumb-${i}`)}
                                className="px-3 py-1.5 bg-purple-50 border border-purple-100 rounded-xl text-purple-700 font-black text-sm hover:bg-purple-100 transition-colors flex items-center gap-1.5"
                                title="Click để sao chép"
                              >
                                {t}
                                {copiedField === `thumb-${i}` && <Check className="w-3 h-3" />}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2 leading-snug">
                            Kết hợp với tiêu đề để tạo "khoảng trống tò mò" — không lặp lại nguyên văn tiêu đề.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Final Description Card */}
                    <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
                      <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          <AlignLeft className="w-4 h-4 text-slate-400" />
                          Mô tả video cuối cùng (Final Description)
                        </div>
                        <button 
                          onClick={() => copyToClipboard(metadata.description, 'desc-box')}
                          className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-red-600 transition-all border border-transparent hover:border-slate-200 font-bold text-[10px] flex items-center gap-1.5"
                        >
                          {copiedField === 'desc-box' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedField === 'desc-box' ? 'Đã chép' : 'Sao chép mô tả'}
                        </button>
                      </div>
                      <div className="p-6">
                        <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 whitespace-pre-wrap text-sm text-slate-700 leading-relaxed max-h-[500px] overflow-y-auto font-medium custom-scrollbar">
                          {metadata.description}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Tags Section */}
                    <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <button 
                        onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          <Tag className="w-4 h-4 text-slate-400" />
                          Thẻ video (Video Tags)
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(metadata.tags.join(', '), 'tags-box');
                            }}
                            className="p-1 px-2 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 transition-all text-[10px] font-bold flex items-center gap-1 border border-transparent hover:border-slate-100"
                          >
                            {copiedField === 'tags-box' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            Sao chép
                          </button>
                          <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-300", isTagsExpanded && "rotate-180")} />
                        </div>
                      </button>
                      <AnimatePresence>
                        {isTagsExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-0">
                              <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                {metadata.tags.map((t, i) => (
                                  <span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-500 text-[11px] font-medium">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Disclaimer Section */}
                    {metadata.disclaimerUsed && (
                      <div className="md:col-span-2 bg-amber-50 rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                        <button 
                          onClick={() => setIsDisclaimerExpanded(!isDisclaimerExpanded)}
                          className="w-full flex items-center justify-between p-4 hover:bg-amber-100/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider uppercase">
                            <Shield className="w-4 h-4 text-amber-500" />
                            Cảnh báo / Miễn trừ trách nhiệm
                          </div>
                          <ChevronDown className={cn("w-4 h-4 text-amber-400 transition-transform duration-300", isDisclaimerExpanded && "rotate-180")} />
                        </button>
                        <AnimatePresence>
                          {isDisclaimerExpanded && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-5 pb-5 pt-0">
                                <div className="p-4 bg-white/50 rounded-xl border border-amber-200/50">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-amber-600">Loại: {metadata.disclaimerType}</p>
                                    {metadata.disclaimerText && (
                                      <button
                                        onClick={() => copyToClipboard(metadata.disclaimerText, 'disclaimer-box')}
                                        className="p-1 px-2 hover:bg-amber-100 rounded-lg text-amber-500 hover:text-amber-700 transition-all text-[10px] font-bold flex items-center gap-1"
                                      >
                                        {copiedField === 'disclaimer-box' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        {copiedField === 'disclaimer-box' ? 'Đã chép' : 'Sao chép'}
                                      </button>
                                    )}
                                  </div>
                                  {metadata.disclaimerText ? (
                                    <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap font-medium">
                                      {metadata.disclaimerText}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-amber-800 leading-relaxed italic">
                                      Nội dung disclaimer đã được tích hợp tự động vào cuối phần mô tả video.
                                    </p>
                                  )}
                                  <p className="text-[10px] text-amber-600/70 mt-2 italic">
                                    Disclaimer đã được chèn sẵn vào cuối mô tả video — phần trên chỉ để bạn xem lại / chỉnh sửa riêng.
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Target Audience & Intent Card */}
                    <div className="md:col-span-2 bg-indigo-50 rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
                      <button 
                        onClick={() => setIsAudienceExpanded(!isAudienceExpanded)}
                        className="w-full flex items-center justify-between p-4 hover:bg-indigo-100/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 uppercase tracking-wider uppercase">
                          <User className="w-4 h-4 text-indigo-500" />
                          Đối tượng & Ý định tìm kiếm
                        </div>
                        <ChevronDown className={cn("w-4 h-4 text-indigo-400 transition-transform duration-300", isAudienceExpanded && "rotate-180")} />
                      </button>
                      <AnimatePresence>
                        {isAudienceExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-4 bg-white/60 rounded-xl border border-indigo-200/50">
                                <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-500 mb-1">Đối tượng mục tiêu</p>
                                <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                                  {metadata.targetAudience}
                                </p>
                              </div>
                              <div className="p-4 bg-white/60 rounded-xl border border-indigo-200/50">
                                <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-500 mb-1">Ý định tìm kiếm (Search Intent)</p>
                                <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                                  {metadata.searchIntent}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* SEO Notes Card */}
                    <div className="md:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden">
                      <button 
                        onClick={() => setIsSeoNotesExpanded(!isSeoNotesExpanded)}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider uppercase">
                          <Brain className="w-4 h-4 text-red-500" />
                          Ghi chú chiến lược (SEO Notes)
                        </div>
                        <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform duration-300", isSeoNotesExpanded && "rotate-180")} />
                      </button>
                      <AnimatePresence>
                        {isSeoNotesExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-0">
                              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                <p className="text-xs text-slate-300 leading-relaxed">
                                  {metadata.seoNotes || "Gemini đã phân tích và tối ưu Metadata dựa trên kịch bản và thị trường địa phương bạn chọn."}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Ready to Publish Block */}
                    <div className="md:col-span-2 bg-linear-to-br from-red-600 to-red-700 p-8 rounded-3xl shadow-2xl shadow-red-500/25 text-white relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-12 opacity-15 blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-1000">
                        <Youtube className="w-80 h-80" />
                      </div>
                      
                      <div className="relative z-10 space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="bg-white/15 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                            <ClipboardCheck className="w-7 h-7" />
                          </div>
                          <div>
                            <h2 className="text-2xl font-black tracking-tight leading-tight">Sẵn sàng xuất bản?</h2>
                            <p className="text-red-100/80 text-sm font-medium">Click để sao chép toàn bộ metadata đã chọn.</p>
                          </div>
                        </div>

                        <div className="p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 space-y-4">
                          <div className="flex items-center justify-between text-[10px] font-bold text-red-200 uppercase tracking-widest">
                            Chỉ số tối ưu hoàn tất
                            <div className="flex items-center gap-1.5 text-green-400">
                              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                              Bản địa hóa 100%
                            </div>
                          </div>
                          <div className="h-px bg-white/10" />
                          <div className="grid grid-cols-2 gap-4 text-[11px]">
                            <div className="space-y-1">
                              <p className="text-red-300 font-bold uppercase tracking-tighter opacity-70">Thị trường</p>
                              <p className="font-bold truncate">{LANGUAGES.find(l => l.code === language)?.name}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-red-300 font-bold uppercase tracking-tighter opacity-70">Từ khóa chính</p>
                              <p className="font-bold truncate">{metadata.primaryKeyword}</p>
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={() => {
                            const selectedTitle = metadata.titles[selectedTitleIndex].localized;
                            const allText = `${selectedTitle}\n\n${metadata.description}\n\n${metadata.hashtags.join(' ')}\n\n${metadata.tags.join(', ')}`;
                            copyToClipboard(allText, 'ready-to-pub');
                          }}
                          className="w-full py-4.5 bg-white text-red-600 rounded-2xl font-black text-xl hover:bg-slate-50 active:scale-[0.98] transition-all shadow-2xl flex items-center justify-center gap-3 cursor-pointer group/btn"
                        >
                          {copiedField === 'ready-to-pub' ? <Check className="w-7 h-7" /> : <Copy className="w-7 h-7 group-hover/btn:scale-110 transition-transform" />}
                          {copiedField === 'ready-to-pub' ? 'ĐÃ SAO CHÉP!' : 'COPY TẤT CẢ'}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-dashed border-slate-200 min-h-[500px]">
                  <div className="bg-slate-50 p-6 rounded-full mb-6 relative">
                    <div className="absolute -top-2 -right-2 bg-red-100 p-2 rounded-full animate-bounce">
                      <Sparkles className="w-4 h-4 text-red-500" />
                    </div>
                    <Youtube className="w-16 h-16 text-slate-200" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Cần Metadata video?</h3>
                  <p className="text-slate-500 max-w-sm mx-auto font-medium leading-relaxed">
                    Dán kịch bản video của bạn bên trái và chọn thị trường mục tiêu. Linhakaka sẽ biến nó thành Metadata chuẩn SEO bản địa ngay lập tức.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-8 border-t border-slate-200 text-center text-slate-400 text-sm">
        <p>© 2026 YouTube SEO Localizer • Được vận hành bởi Gemini AI</p>
      </footer>
    </div>
  );
}

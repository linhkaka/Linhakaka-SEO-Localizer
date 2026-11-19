import { useState, useRef, useEffect, useMemo } from 'react';
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
  ClipboardCheck,
  XCircle,
  Gauge,
  TrendingUp,
  CircleCheck,
  CircleAlert,
  CircleX,
  Flame,
  Image as ImageIcon,
  Link as LinkIcon,
  Clock,
  Pin,
  Smartphone,
  Monitor,
  History,
  Wand2,
  FileDown,
  Trash2,
  Edit3,
  PlusCircle,
  BookOpen,
  X,
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
  LabelList,
} from 'recharts';
import {
  cn,
  buildSeoChecklist,
  computeLiveSeoScore,
  keywordMatchInfo,
  normalizeMetadataScores,
} from '@/src/lib/utils';
import { sanitizeText, deepSanitize } from '@/src/lib/textQuality';
import {
  YouTubeMetadata,
  YouTubeTitle,
  UserPreferences,
  TrendReport,
  HistoryEntry,
  RefinedTitleVariant,
  ProofreadReport,
  ContentType,
  TitleArchetype,
} from '@/src/types';
import {
  COUNTRIES,
  LANGUAGES,
  TITLE_STYLES,
  DESCRIPTION_LENGTHS,
  KEYWORD_TONES,
  DESCRIPTION_STYLES,
  KEYWORD_DENSITIES,
  DISCLAIMER_MODES,
  SAMPLE_SCRIPTS,
  CONTENT_TYPE_OPTIONS,
  TITLE_FORMATS,
  getMarketSeoRule,
  getTitleFormat,
} from '@/src/constants';

const MEMORY_KEY = 'linhakaka_seo_memory';
const HISTORY_KEY = 'linhakaka_seo_history_v2';

function safeGetStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage access errors in restricted/incognito/iframe contexts
  }
}

function safeRemoveStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage access errors in restricted/incognito/iframe contexts
  }
}

async function safeParseJsonResponse<T = any>(res: Response): Promise<T> {
  const rawText = await res.text();
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error(`Máy chủ trả về phản hồi trống (HTTP ${res.status}).`);
  }
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
    throw new Error(
      `Không thể kết nối API trên phiên bản chia sẻ (HTTP ${res.status}). Vui lòng kiểm tra quyền truy cập liên kết chia sẻ hoặc tải lại trang.`
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`Phản hồi từ máy chủ không hợp lệ (HTTP ${res.status}).`);
  }
}

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
            <span className="text-[10px] font-bold text-red-400">
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
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 text-[11px] tabular-nums">
          <span className="text-slate-400">Điểm CTR ước tính:</span>
          <span
            className={cn(
              'font-black text-sm',
              data.ctrScore >= 80
                ? 'text-emerald-400'
                : data.ctrScore >= 50
                ? 'text-amber-400'
                : 'text-red-400'
            )}
          >
            {data.ctrScore}/100
          </span>
        </div>
        {data.complianceRisk && (
          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
            <span>Độ an toàn tuân thủ:</span>
            <span
              className={cn(
                'font-medium',
                data.complianceRisk === 'Thấp'
                  ? 'text-emerald-400'
                  : data.complianceRisk === 'Trung bình'
                  ? 'text-amber-400'
                  : 'text-red-400'
              )}
            >
              {data.complianceRisk === 'Thấp'
                ? 'An toàn'
                : data.complianceRisk === 'Trung bình'
                ? 'Cần lưu ý'
                : 'Rủi ro'}
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
  const [autoProofread, setAutoProofread] = useState<boolean>(() => {
    try {
      const saved = safeGetStorage('linhakaka_auto_proofread');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return true;
  });
  const [isProofreadingManual, setIsProofreadingManual] = useState(false);
  const [isProofreadExpanded, setIsProofreadExpanded] = useState(false);
  const [trendReport, setTrendReport] = useState<TrendReport | null>(null);
  const [isTrendExpanded, setIsTrendExpanded] = useState(true);
  const [metadata, setMetadata] = useState<YouTubeMetadata | null>(null);
  const [isDisclaimerExpanded, setIsDisclaimerExpanded] = useState(false);
  const [isSeoNotesExpanded, setIsSeoNotesExpanded] = useState(true);
  const [isAudienceExpanded, setIsAudienceExpanded] = useState(true);
  const [isTagsExpanded, setIsTagsExpanded] = useState(true);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0);
  const [selectedThumbIndex, setSelectedThumbIndex] = useState(0);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [customTitleOverride, setCustomTitleOverride] = useState<string | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  // A/B Title Refiner state
  const [isRefiningTitle, setIsRefiningTitle] = useState(false);
  const [refinedVariants, setRefinedVariants] = useState<RefinedTitleVariant[]>([]);
  const [refineSourceTitle, setRefineSourceTitle] = useState<string>('');

  // History & Form Collapsible state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [keywordFilter, setKeywordFilter] = useState<'all' | 'high-opp' | 'low-comp'>('all');
  const [isBasicOpen, setIsBasicOpen] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // 100 Title Format Library settings & modal state
  const [contentType, setContentType] = useState<ContentType | 'AUTO'>('AUTO');
  const [allowFirstPerson, setAllowFirstPerson] = useState<boolean>(false);
  const [preferredFormatIds, setPreferredFormatIds] = useState<number[]>([]);
  const [showFormatLibraryModal, setShowFormatLibraryModal] = useState<boolean>(false);
  const [formatSearch, setFormatSearch] = useState<string>('');
  const [formatArchetypeFilter, setFormatArchetypeFilter] = useState<TitleArchetype | 'ALL'>('ALL');
  const [formatTypeFilter, setFormatTypeFilter] = useState<ContentType | 'ALL'>('ALL');
  const [hideFirstPersonInModal, setHideFirstPersonInModal] = useState<boolean>(false);

  const resultsRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const keywordsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMemory();
    loadHistory();
  }, []);

  // Script live metrics
  const scriptStats = useMemo(() => {
    const trimmed = script.trim();
    if (!trimmed) return { words: 0, chars: 0, estMinutes: 0 };
    const words = trimmed.split(/\s+/).length;
    const chars = trimmed.length;
    const estMinutes = Math.max(1, Math.round(words / 140));
    return { words, chars, estMinutes };
  }, [script]);

  const activeTitleText = useMemo(() => {
    if (!metadata) return '';
    if (customTitleOverride !== null) return customTitleOverride;
    return metadata.titles?.[selectedTitleIndex]?.localized || '';
  }, [metadata, selectedTitleIndex, customTitleOverride]);

  const marketRule = useMemo(() => getMarketSeoRule(language), [language]);

  // Real-time deterministic SEO checklist
  const checklist = useMemo(() => {
    if (!metadata) return [];
    return buildSeoChecklist(metadata, language, activeTitleText, metadata.description);
  }, [metadata, activeTitleText, language]);

  // Live recalculated SEO score
  const liveSeoScore = useMemo(() => {
    if (!metadata) return { overall: 0, title: 0, description: 0, tags: 0, keywordUsage: 0 };
    return computeLiveSeoScore(metadata, checklist, selectedTitleIndex);
  }, [metadata, checklist, selectedTitleIndex]);

  const filteredKeywords = useMemo(() => {
    if (!metadata?.keywordInsights) return [];
    return metadata.keywordInsights.filter((k) => {
      if (keywordFilter === 'high-opp') return k.opportunityScore >= 65;
      if (keywordFilter === 'low-comp') return k.competition === 'Thấp' || k.competition === 'Trung bình';
      return true;
    });
  }, [metadata?.keywordInsights, keywordFilter]);

  const filteredFormats = useMemo(() => {
    const q = formatSearch.trim().toLowerCase();
    return TITLE_FORMATS.filter((fmt) => {
      if (hideFirstPersonInModal && fmt.firstPerson) return false;
      if (formatArchetypeFilter !== 'ALL' && fmt.archetype !== formatArchetypeFilter) return false;
      if (formatTypeFilter !== 'ALL' && !fmt.types.includes(formatTypeFilter)) return false;
      if (q) {
        const idMatch = `#${fmt.id}`.includes(q) || String(fmt.id) === q.replace(/^#/, '');
        const textMatch =
          fmt.pattern.toLowerCase().includes(q) ||
          fmt.archetype.toLowerCase().includes(q) ||
          fmt.types.some((t) => t.toLowerCase().includes(q));
        if (!idMatch && !textMatch) return false;
      }
      return true;
    });
  }, [formatSearch, formatArchetypeFilter, formatTypeFilter, hideFirstPersonInModal]);

  const togglePreferredFormat = (id: number) => {
    setPreferredFormatIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const titleChartData = useMemo(() => {
    if (!metadata?.titles) return [];
    return metadata.titles.map((t, idx) => ({
      index: idx + 1,
      name: t.angle ? `#${idx + 1} ${t.angle}` : `#${idx + 1}`,
      shortName: t.angle
        ? `#${idx + 1} ${t.angle.length > 10 ? t.angle.slice(0, 9) + '…' : t.angle}`
        : `#${idx + 1}`,
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
      VN: 'vi-VN',
      US: 'en-US',
      GB: 'en-GB',
      AU: 'en-US',
      CA: 'en-US',
      MX: 'es-MX',
      BR: 'pt-BR',
      PT: 'pt-PT',
      ES: 'es-ES',
      AE: 'ar-AE',
      SA: 'ar-SA',
      EG: 'ar',
      TR: 'tr-TR',
      PL: 'pl-PL',
      NL: 'nl-NL',
      UA: 'uk-UA',
      IL: 'he-IL',
      HK: 'zh-HK',
      TW: 'zh-TW',
      CN: 'zh-CN',
      DE: 'de-DE',
      AT: 'de-DE',
      CH: 'de-DE',
      FR: 'fr-FR',
      IT: 'it-IT',
      JP: 'ja-JP',
      KR: 'ko-KR',
      PH: 'fil-PH',
      TH: 'th-TH',
      ID: 'id-ID',
      IN: 'hi-IN',
      RU: 'ru-RU',
    };

    if (mapping[newCountry]) {
      setLanguage(mapping[newCountry]);
    }
  };

  const toggleAutoProofread = () => {
    const next = !autoProofread;
    setAutoProofread(next);
    safeSetStorage('linhakaka_auto_proofread', JSON.stringify(next));
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
      disclaimerMode,
      autoProofread,
      contentType,
      allowFirstPerson,
      preferredFormatIds,
    };
    safeSetStorage(MEMORY_KEY, JSON.stringify(prefs));
    safeSetStorage('linhakaka_auto_proofread', JSON.stringify(autoProofread));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const loadMemory = () => {
    const saved = safeGetStorage(MEMORY_KEY);
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
        if (typeof prefs.autoProofread === 'boolean') {
          setAutoProofread(prefs.autoProofread);
        }
        if (
          prefs.contentType &&
          CONTENT_TYPE_OPTIONS.some((opt) => opt.id === prefs.contentType)
        ) {
          setContentType(prefs.contentType);
        }
        if (typeof prefs.allowFirstPerson === 'boolean') {
          setAllowFirstPerson(prefs.allowFirstPerson);
        }
        if (Array.isArray(prefs.preferredFormatIds)) {
          setPreferredFormatIds(
            prefs.preferredFormatIds
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && !!getTitleFormat(id))
              .slice(0, 5)
          );
        }
      } catch {
        // Ignore malformed localStorage memory
      }
    }
  };

  const loadHistory = () => {
    try {
      const raw = safeGetStorage(HISTORY_KEY);
      if (raw) {
        const parsed: HistoryEntry[] = JSON.parse(raw);
        const sanitizedHistory = parsed.map((entry) => ({
          ...entry,
          metadata: normalizeMetadataScores(deepSanitize(entry.metadata, entry.language || 'en-US')),
          trendReport: entry.trendReport
            ? {
                ...entry.trendReport,
                summary: sanitizeText(entry.trendReport.summary, 'vi-VN', { multiline: true }),
              }
            : null,
        }));
        setHistory(sanitizedHistory);
      }
    } catch {
      // Ignore malformed localStorage history
    }
  };

  const pushToHistory = (newMeta: YouTubeMetadata, newTrend: TrendReport | null) => {
    try {
      const entry: HistoryEntry = {
        id: `${Date.now()}`,
        createdAt: new Date().toLocaleString('vi-VN'),
        country,
        language,
        channelName: channelName || 'Kênh YouTube',
        scriptExcerpt: script.trim().slice(0, 120) + (script.trim().length > 120 ? '…' : ''),
        fullScript: script,
        metadata: normalizeMetadataScores(deepSanitize(newMeta, language)),
        trendReport: newTrend,
      };
      const updated = [entry, ...history].slice(0, 10);
      setHistory(updated);
      safeSetStorage(HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }
  };

  const clearHistory = () => {
    setHistory([]);
    safeRemoveStorage(HISTORY_KEY);
  };

  const resetMemory = () => {
    safeRemoveStorage(MEMORY_KEY);
    safeRemoveStorage('linhakaka_auto_proofread');
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
    setAutoProofread(true);
    setContentType('AUTO');
    setAllowFirstPerson(false);
    setPreferredFormatIds([]);
  };

  const getCapRuleNote = (locale: string) => {
    if (locale.startsWith('en')) return 'Mặc định: Title Case (chuẩn SEO cho thị trường US/UK)';
    if (locale.startsWith('vi')) return 'Mặc định: Viết hoa đầu câu (Tự nhiên tiếng Việt)';
    if (locale.startsWith('ja') || locale.startsWith('ko') || locale.startsWith('zh'))
      return 'Mặc định: Ngắn gọn 15–32 ký tự kèm ngoặc nhấn 【...】 chuẩn CJK';
    if (locale.startsWith('es') || locale.startsWith('fr') || locale.startsWith('de'))
      return 'Mặc định: Viết hoa chuẩn ngữ pháp bản địa Châu Âu';
    return 'Mặc định: Tối ưu hóa quy tắc viết hoa theo thị trường mục tiêu';
  };

  const generateMetadata = async () => {
    if (!script.trim()) {
      setError('Vui lòng dán kịch bản video hoặc chọn 1 kịch bản mẫu để bắt đầu.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCustomTitleOverride(null);
    setRefinedVariants([]);

    try {
      const selectedCountry = COUNTRIES.find((c) => c.code === country)?.name || country;
      const selectedLanguage = LANGUAGES.find((l) => l.code === language)?.name || language;
      const selectedTitleStyle = TITLE_STYLES.find((s) => s.id === titleStyle)?.name || titleStyle;
      const selectedTone = KEYWORD_TONES.find((t) => t.id === keywordTone)?.name || keywordTone;
      const selectedDescStyle =
        DESCRIPTION_STYLES.find((s) => s.id === descriptionStyle)?.name || descriptionStyle;
      const selectedDensity =
        KEYWORD_DENSITIES.find((d) => d.id === keywordDensity)?.name || keywordDensity;
      const selectedDisclaimer =
        DISCLAIMER_MODES.find((m) => m.id === disclaimerMode)?.name || disclaimerMode;

      // ===== PHASE 1: Live trend scan =====
      let trendContext = '';
      let newTrendReport: TrendReport | null = null;
      if (useTrends) {
        setGenStage('trends');
        try {
          const trendRes = await fetch('/api/trends', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              script,
              selectedCountry,
              selectedLanguage,
              language,
              proofread: autoProofread,
            }),
          });
          if (trendRes.ok) {
            const data = await safeParseJsonResponse<any>(trendRes);
            if (data.summary && data.summary.trim()) {
              const cleanSummary = sanitizeText(data.summary, 'vi-VN', { multiline: true });
              newTrendReport = {
                summary: cleanSummary,
                sources: data.sources || [],
                mode: data.mode || 'live_search',
                proofreadApplied: data.proofreadApplied,
              };
              trendContext = cleanSummary;
            }
          }
        } catch {
          // Trend scan is optional; continue to metadata generation
        }
      }
      setTrendReport(newTrendReport);

      // ===== PHASE 2: Structured metadata generation (with automatic retry on 503/429) =====
      setGenStage('metadata');
      const requestBody = JSON.stringify({
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
        proofread: autoProofread,
        contentType,
        allowFirstPerson,
        preferredFormatIds,
      });

      let metaRes = await fetch('/api/metadata', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      if (!metaRes.ok && (metaRes.status === 503 || metaRes.status === 429 || metaRes.status === 500)) {
        await new Promise((r) => setTimeout(r, 1500));
        metaRes = await fetch('/api/metadata', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        });
      }

      if (!metaRes.ok) {
        const errJson = await safeParseJsonResponse<any>(metaRes).catch(() => ({}));
        throw new Error(errJson.error || `Lỗi máy chủ (${metaRes.status})`);
      }

      const rawResult = await safeParseJsonResponse<YouTubeMetadata>(metaRes);
      const result = normalizeMetadataScores(deepSanitize(rawResult, language));
      setMetadata(result);
      setIsProofreadExpanded(false);
      const bestIdx = (result.titles || []).findIndex((t) => t.isBestOverall);
      setSelectedTitleIndex(bestIdx !== -1 ? bestIdx : 0);
      setSelectedThumbIndex(0);
      setIsTrendExpanded(true);
      setIsDisclaimerExpanded(result.disclaimerUsed);
      setIsSeoNotesExpanded(true);
      setIsAudienceExpanded(true);
      setIsTagsExpanded(true);

      pushToHistory(result, newTrendReport);

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      const rawMsg = String(err?.message || '');
      if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand')) {
        setError('Hệ thống AI đang có lượng truy cập cao đột biến (503). Vui lòng nhấn tạo lại sau vài giây.');
      } else {
        setError(rawMsg || 'Không thể tạo metadata. Vui lòng thử lại.');
      }
    } finally {
      setIsGenerating(false);
      setGenStage('idle');
    }
  };

  const handleManualProofread = async () => {
    if (!metadata || isProofreadingManual) return;
    setIsProofreadingManual(true);
    try {
      const texts: { path: string; text: string }[] = [];
      (metadata.titles || []).forEach((t, i) => {
        if (t.localized) texts.push({ path: `titles[${i}].localized`, text: t.localized });
        if (t.vietnamese) texts.push({ path: `titles[${i}].vietnamese`, text: t.vietnamese });
        if (t.reason) texts.push({ path: `titles[${i}].reason`, text: t.reason });
      });
      if (customTitleOverride !== null && customTitleOverride.trim()) {
        texts.push({ path: 'customTitleOverride', text: customTitleOverride });
      }
      if (metadata.description) {
        texts.push({ path: 'description', text: metadata.description });
      }
      (metadata.tags || []).forEach((tag, i) => {
        if (tag) texts.push({ path: `tags[${i}]`, text: tag });
      });

      const res = await fetch('/api/proofread', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts,
          language,
          country,
        }),
      });

      if (!res.ok) {
        const errJson = await safeParseJsonResponse<any>(res).catch(() => ({}));
        throw new Error(errJson.error || 'Không thể soát chính tả lúc này.');
      }

      const report = await safeParseJsonResponse<ProofreadReport>(res);
      const updatedMeta: YouTubeMetadata = JSON.parse(JSON.stringify(metadata));
      let nextCustomTitle = customTitleOverride;

      for (const fix of report.fixes || []) {
        if (fix.path === 'customTitleOverride') {
          nextCustomTitle = fix.corrected;
          continue;
        }
        if (fix.path === 'description') {
          updatedMeta.description = fix.corrected;
          continue;
        }
        const titleLocMatch = fix.path.match(/^titles\[(\d+)\]\.(localized|vietnamese|reason)$/);
        if (titleLocMatch) {
          const idx = Number(titleLocMatch[1]);
          const field = titleLocMatch[2] as 'localized' | 'vietnamese' | 'reason';
          if (updatedMeta.titles[idx]) {
            updatedMeta.titles[idx][field] = fix.corrected;
          }
          continue;
        }
        const tagMatch = fix.path.match(/^tags\[(\d+)\]$/);
        if (tagMatch) {
          const idx = Number(tagMatch[1]);
          if (idx >= 0 && idx < updatedMeta.tags.length) {
            updatedMeta.tags[idx] = fix.corrected;
          }
        }
      }

      const cleanUpdated = deepSanitize(updatedMeta, language);
      cleanUpdated.proofreadReport = report;
      setMetadata(cleanUpdated);
      if (nextCustomTitle !== null) {
        setCustomTitleOverride(sanitizeText(nextCustomTitle, language, { isTitle: true }));
      }
      if (report.fixes && report.fixes.length > 0) {
        setIsProofreadExpanded(true);
      }
    } catch (err: any) {
      setMetadata({
        ...metadata,
        proofreadReport: {
          checked: 0,
          fixed: 0,
          fixes: [],
          error: err?.message || 'Không thể soát chính tả lúc này.',
        },
      });
    } finally {
      setIsProofreadingManual(false);
    }
  };

  const handleRefineTitle = async (baseTitle: string) => {
    if (!metadata || isRefiningTitle) return;
    setIsRefiningTitle(true);
    setRefineSourceTitle(baseTitle);
    try {
      const selectedCountry = COUNTRIES.find((c) => c.code === country)?.name || country;
      const selectedLanguage = LANGUAGES.find((l) => l.code === language)?.name || language;
      const res = await fetch('/api/refine-title', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseTitle,
          primaryKeyword: metadata.primaryKeyword,
          selectedCountry,
          selectedLanguage,
          language,
          scriptExcerpt: script.slice(0, 1000),
          contentType,
          allowFirstPerson,
          preferredFormatIds,
        }),
      });
      if (res.ok) {
        const data = await safeParseJsonResponse<any>(res);
        const rawVariants: RefinedTitleVariant[] = deepSanitize(data.variants || [], language);
        const allVarLe10 =
          rawVariants.length > 0 &&
          rawVariants.every((v) => (Number(v?.ctrScore) || 0) <= 10) &&
          rawVariants.some((v) => (Number(v?.ctrScore) || 0) > 0);
        const normalizedVariants = rawVariants.map((v) => {
          const raw = Number(v?.ctrScore) || 0;
          return {
            ...v,
            ctrScore: Math.min(100, Math.max(0, Math.round(allVarLe10 ? raw * 10 : raw))),
          };
        });
        setRefinedVariants(normalizedVariants);
      }
    } catch {
      // Ignore refine title transient failure
    } finally {
      setIsRefiningTitle(false);
    }
  };

  const insertChaptersIntoDescription = () => {
    if (!metadata || !metadata.chapters || metadata.chapters.length === 0) return;
    const chapterBlock =
      '\n\n⏱️ TIMESTAMPS / CHAPTERS:\n' +
      metadata.chapters.map((c) => `${c.timestamp} ${c.title}`).join('\n');
    if (!metadata.description.includes(metadata.chapters[0].title)) {
      setMetadata({
        ...metadata,
        description: metadata.description.trim() + chapterBlock,
      });
      copyToClipboard(chapterBlock.trim(), 'chapters-inserted');
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    const fallbackCopy = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    };
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    } catch {
      fallbackCopy();
    }
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const exportMetadataFile = (format: 'txt' | 'json' | 'csv') => {
    if (!metadata) return;
    let content = '';
    let mime = 'text/plain;charset=utf-8';
    let ext = 'txt';

    if (format === 'json') {
      content = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          market: { country, language, channelName },
          selectedTitle: activeTitleText,
          metadata,
          trendReport,
        },
        null,
        2
      );
      mime = 'application/json;charset=utf-8';
      ext = 'json';
    } else if (format === 'csv') {
      const titlesList = metadata.titles || [];
      const tagsList = metadata.tags || [];
      const hashtagsList = metadata.hashtags || [];
      const rows = [
        ['Field', 'Localized Value', 'Vietnamese / Note', 'Score / Metric'],
        ['Selected Title', activeTitleText, titlesList[selectedTitleIndex]?.vietnamese || '', `${liveSeoScore.overall}/100`],
        ['Primary Keyword', metadata.primaryKeyword, 'Từ khóa chính', ''],
        ...titlesList.map((t, i) => [
          `Title Option #${i + 1} (${t.angle})`,
          t.localized,
          t.vietnamese,
          `CTR ${t.ctrScore}`,
        ]),
        ['Description', metadata.description, '', ''],
        ['Tags', tagsList.join(', '), '', `${tagsList.join(',').length}/500 chars`],
        ['Hashtags', hashtagsList.join(' '), '', ''],
      ];
      content =
        '\uFEFF' +
        rows
          .map((r) => r.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
          .join('\n');
      mime = 'text/csv;charset=utf-8';
      ext = 'csv';
    } else {
      const titlesList = metadata.titles || [];
      const tagsList = metadata.tags || [];
      const hashtagsList = metadata.hashtags || [];
      const chaptersStr =
        metadata.chapters && metadata.chapters.length > 0
          ? `\n=== CHƯƠNG VIDEO (TIMESTAMPS) ===\n` +
            metadata.chapters.map((c) => `${c.timestamp} ${c.title} (${c.vietnamese})`).join('\n')
          : '';
      const pinnedStr =
        metadata.pinnedComments && metadata.pinnedComments.length > 0
          ? `\n=== BÌNH LUẬN GHIM GỢI Ý (PINNED COMMENTS) ===\n` +
            metadata.pinnedComments
              .map((p, i) => `${i + 1}. [${p.strategy}] ${p.localized}\n   (Dịch: ${p.vietnamese})`)
              .join('\n')
          : '';

      content = [
        `=========================================`,
        `LINHAKAKA YOUTUBE SEO LOCALIZER REPORT`,
        `Thị trường: ${country} (${language}) | Điểm SEO: ${liveSeoScore.overall}/100${
          metadata.detectedContentType ? ` | Loại nội dung: ${metadata.detectedContentType}` : ''
        }`,
        `=========================================`,
        ``,
        `=== TIÊU ĐỀ ĐANG CHỌN ===`,
        activeTitleText,
        ``,
        `=== TẤT CẢ 5 TIÊU ĐỀ GỢI Ý ===`,
        ...titlesList.map((t, i) => {
          const fmt = typeof t.formatId === 'number' ? getTitleFormat(t.formatId) : undefined;
          const fmtPart = fmt ? ` | Công thức #${fmt.id}: ${fmt.pattern}` : '';
          return `${i + 1}. [${t.angle}${fmtPart} | CTR ${Math.round(t.ctrScore)} | ${t.complianceRisk}] ${t.localized}\n   Dịch: ${t.vietnamese}`;
        }),
        ``,
        `=== TỪ KHÓA CHÍNH ===`,
        metadata.primaryKeyword,
        ``,
        `=== MÔ TẢ VIDEO ===`,
        metadata.description,
        chaptersStr,
        pinnedStr,
        ``,
        `=== HASHTAGS ===`,
        hashtagsList.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' '),
        ``,
        `=== TAGS (${tagsList.join(',').length}/500 ký tự) ===`,
        tagsList.join(', '),
      ].join('\n');
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `youtube-seo-${country.toLowerCase()}-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-red-100 selection:text-red-900">
      {/* Top Bar Contract: 3 Zones (Brand — 4 Single-line Nav Links — 1 Primary Action) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2.5"
          >
            <Youtube className="w-6 h-6 text-red-600 shrink-0" />
            <span>Linhakaka SEO Studio</span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#workspace-input"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Thiết lập & Kịch bản
            </a>
            <button
              type="button"
              onClick={() => previewRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Mô phỏng hiển thị
            </button>
            <button
              type="button"
              onClick={() => keywordsRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Từ khóa & Chapters
            </button>
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
            >
              Lịch sử ({history.length})
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={generateMetadata}
              disabled={isGenerating}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-slate-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isGenerating
                ? genStage === 'trends'
                  ? 'Đang quét xu hướng…'
                  : 'Đang viết metadata…'
                : 'Tạo Metadata SEO'}
            </button>
          </div>
        </div>
      </header>

      {/* History Slide-Over Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end"
            onClick={() => setShowHistoryModal(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 p-6 flex flex-col justify-between overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-red-600" />
                    <h2 className="text-base font-bold text-slate-900">
                      Lịch sử tạo Metadata ({history.length})
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                {history.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    Chưa có lịch sử nào được lưu. Khi bạn tạo Metadata SEO, các bản ghi sẽ tự động lưu tại đây.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          const cleanMeta = normalizeMetadataScores(
                            deepSanitize(item.metadata, item.language || 'en-US')
                          );
                          const cleanTrend = item.trendReport
                            ? {
                                ...item.trendReport,
                                summary: sanitizeText(item.trendReport.summary, 'vi-VN', {
                                  multiline: true,
                                }),
                              }
                            : null;
                          setCountry(item.country);
                          setLanguage(item.language);
                          setChannelName(item.channelName);
                          setScript(item.fullScript);
                          setMetadata(cleanMeta);
                          setTrendReport(cleanTrend);
                          setSelectedTitleIndex(0);
                          setCustomTitleOverride(null);
                          setShowHistoryModal(false);
                        }}
                        className="p-4 rounded-xl border border-slate-200 hover:border-red-300 hover:bg-red-50/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1 tabular-nums">
                          <span>
                            {item.country} · {item.language}
                          </span>
                          <span>{item.createdAt}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 line-clamp-1 mb-1">
                          {item.metadata?.titles?.[0]?.localized || item.scriptExcerpt}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-2">{item.scriptExcerpt}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="mt-6 w-full py-2.5 px-4 text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa toàn bộ lịch sử
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main id="top" className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Configuration & Script Input */}
          <div id="workspace-input" className="lg:col-span-5 space-y-6">
            {/* Market Preset / Memory Section */}
            <section className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <Brain className="w-5 h-5 text-red-500" />
                  <h2 className="text-base font-bold tracking-tight">Bộ nhớ cấu hình kênh</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveMemory}
                    title="Lưu cấu hình hiện tại"
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer',
                      saveStatus === 'saved'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                    )}
                  >
                    {saveStatus === 'saved' ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Đã lưu
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" /> Lưu mặc định
                      </>
                    )}
                  </button>
                  <button
                    onClick={loadMemory}
                    title="Tải cấu hình đã lưu"
                    className="p-2 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-lg transition-all shrink-0 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={resetMemory}
                    title="Đặt lại mặc định"
                    className="p-2 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-lg transition-all shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Lưu quốc gia mục tiêu, ngôn ngữ, tên kênh và phong cách SEO để áp dụng tức thì cho các video tiếp theo.
              </p>
            </section>

            {/* Local Market Settings Section */}
            <section className="bg-white p-6 rounded-xl border border-slate-200 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Settings className="w-5 h-5 text-slate-700" />
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Chiến lược Thị trường & Bản địa hóa</h2>
                    <p className="text-xs text-slate-500">
                      Chuẩn tiêu đề {marketRule.titleIdealMin}–{marketRule.titleIdealMax} ký tự (tối đa {marketRule.titleHardMax}) · Hook mô tả {marketRule.descHookChars} ký tự
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Collapsible Section 1: Cơ bản (open by default) */}
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setIsBasicOpen(!isBasicOpen)}
                    className="w-full px-4 py-3 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-left">
                      <Globe className="w-4 h-4 text-red-600 shrink-0" />
                      <div>
                        <span className="text-sm font-bold text-slate-900">Cơ bản</span>
                        <span className="text-xs text-slate-500 ml-2">
                          Quốc gia, ngôn ngữ, tên kênh & kịch bản
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-slate-500 transition-transform duration-200 shrink-0',
                        isBasicOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  {isBasicOpen && (
                    <div className="p-4 space-y-4 border-t border-slate-100">
                      {/* Country & Language */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                            <Globe className="w-3.5 h-3.5 text-slate-400" />
                            Quốc gia mục tiêu
                          </label>
                          <div className="relative">
                            <select
                              value={country}
                              onChange={(e) => handleCountryChange(e.target.value)}
                              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all cursor-pointer pr-9"
                            >
                              {COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.name} ({c.code})
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                            <Search className="w-3.5 h-3.5 text-slate-400" />
                            Ngôn ngữ đầu ra
                          </label>
                          <div className="relative">
                            <select
                              value={language}
                              onChange={(e) => setLanguage(e.target.value)}
                              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all cursor-pointer pr-9"
                            >
                              {LANGUAGES.map((l) => (
                                <option key={l.code} value={l.code}>
                                  {l.name} ({l.code})
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      {/* Channel Name */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          Tên kênh YouTube
                        </label>
                        <input
                          type="text"
                          value={channelName}
                          onChange={(e) => setChannelName(e.target.value)}
                          placeholder="v.d. Linhakaka Studio"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                        />
                      </div>

                      {/* Script Input + 1-Click Sample Scripts */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            Kịch bản hoặc tóm tắt nội dung video
                          </label>
                          <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                            {scriptStats.words} từ · {scriptStats.chars} ký tự · ~{scriptStats.estMinutes}p
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium text-slate-400 mr-1">Mẫu thử nhanh:</span>
                          {SAMPLE_SCRIPTS.map((tpl) => (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => {
                                setScript(tpl.script);
                                setCountry(tpl.country);
                                setLanguage(tpl.language);
                                setError(null);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {tpl.label}
                            </button>
                          ))}
                        </div>

                        <textarea
                          value={script}
                          onChange={(e) => setScript(e.target.value)}
                          placeholder="Dán toàn bộ kịch bản video, phụ đề SRT hoặc dàn ý chi tiết vào đây..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all min-h-[180px] resize-y leading-relaxed"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Collapsible Section 2: Nâng cao (collapsed by default) */}
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                    className="w-full px-4 py-3 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-left">
                      <Sparkles className="w-4 h-4 text-slate-600 shrink-0" />
                      <div>
                        <span className="text-sm font-bold text-slate-900">Nâng cao</span>
                        <span className="text-xs text-slate-500 ml-2">
                          Kiểu tiêu đề, độ dài/cấu trúc mô tả, mật độ từ khóa, disclaimer & giọng thương hiệu
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-slate-500 transition-transform duration-200 shrink-0',
                        isAdvancedOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  {isAdvancedOpen && (
                    <div className="p-4 space-y-4 border-t border-slate-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                            <TypeIcon className="w-3.5 h-3.5 text-slate-400" />
                            Kiểu viết hoa tiêu đề
                          </label>
                          <div className="relative">
                            <select
                              value={titleStyle}
                              onChange={(e) => setTitleStyle(e.target.value)}
                              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all cursor-pointer pr-9"
                            >
                              {TITLE_STYLES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                            <Layout className="w-3.5 h-3.5 text-slate-400" />
                            Độ dài mô tả
                          </label>
                          <div className="relative">
                            <select
                              value={descriptionLength}
                              onChange={(e) => setDescriptionLength(e.target.value)}
                              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all cursor-pointer pr-9"
                            >
                              {DESCRIPTION_LENGTHS.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      {titleStyle === 'auto' && (
                        <p className="text-xs text-slate-500 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/80">
                          {getCapRuleNote(language)}
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                            <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
                            Cấu trúc mô tả
                          </label>
                          <div className="relative">
                            <select
                              value={descriptionStyle}
                              onChange={(e) => setDescriptionStyle(e.target.value)}
                              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all cursor-pointer pr-9"
                            >
                              {DESCRIPTION_STYLES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                            <Zap className="w-3.5 h-3.5 text-slate-400" />
                            Tông từ khóa SEO
                          </label>
                          <div className="relative">
                            <select
                              value={keywordTone}
                              onChange={(e) => setKeywordTone(e.target.value)}
                              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all cursor-pointer pr-9"
                            >
                              {KEYWORD_TONES.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                            Mật độ từ khóa
                          </label>
                          <div className="relative">
                            <select
                              value={keywordDensity}
                              onChange={(e) => setKeywordDensity(e.target.value)}
                              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all cursor-pointer pr-9"
                            >
                              {KEYWORD_DENSITIES.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                            <Shield className="w-3.5 h-3.5 text-slate-400" />
                            Chế độ Disclaimer
                          </label>
                          <div className="relative">
                            <select
                              value={disclaimerMode}
                              onChange={(e) => setDisclaimerMode(e.target.value)}
                              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all cursor-pointer pr-9"
                            >
                              {DISCLAIMER_MODES.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                          Giọng thương hiệu
                        </label>
                        <input
                          type="text"
                          value={brandVoice}
                          onChange={(e) => setBrandVoice(e.target.value)}
                          placeholder="v.d. Chuyên gia, gần gũi"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                        />
                      </div>

                      {/* 100 Title Format Library Settings */}
                      <div className="pt-3 border-t border-slate-100 space-y-3.5">
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                            Loại nội dung
                          </label>
                          <div className="relative">
                            <select
                              value={contentType}
                              onChange={(e) => setContentType(e.target.value as ContentType | 'AUTO')}
                              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all cursor-pointer pr-9"
                            >
                              {CONTENT_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer select-none p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 transition-colors">
                          <input
                            type="checkbox"
                            checked={allowFirstPerson}
                            onChange={(e) => setAllowFirstPerson(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                          <span className="font-medium leading-snug">
                            Kịch bản là trải nghiệm ngôi thứ nhất (cho phép công thức &apos;I ...&apos;)
                          </span>
                        </label>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-700">
                              Công thức ưu tiên ({preferredFormatIds.length}/5)
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowFormatLibraryModal(true)}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              Chọn từ 100 công thức
                            </button>
                          </div>

                          {preferredFormatIds.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {preferredFormatIds.map((id) => {
                                const fmt = getTitleFormat(id);
                                return (
                                  <span
                                    key={id}
                                    title={fmt ? `${fmt.pattern} (${fmt.archetype})` : `#${id}`}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-800 border border-red-200 text-xs font-semibold max-w-full"
                                  >
                                    <span className="truncate max-w-[210px]">
                                      #{id}{fmt ? ` · ${fmt.pattern}` : ''}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => togglePreferredFormat(id)}
                                      className="text-red-500 hover:text-red-800 cursor-pointer shrink-0"
                                      aria-label={`Bỏ ghim công thức #${id}`}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400">
                              Chưa ghim công thức nào — AI sẽ tự chọn 5 công thức tối ưu nhất theo loại nội dung.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Trend Scan Toggle */}
                <div
                  onClick={() => setUseTrends(!useTrends)}
                  className={cn(
                    'flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all',
                    useTrends ? 'bg-orange-50/70 border-orange-200' : 'bg-slate-50 border-slate-200'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'p-2 rounded-lg shrink-0',
                        useTrends ? 'bg-orange-500' : 'bg-slate-300'
                      )}
                    >
                      <Flame className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Bắt xu hướng thời gian thực (Google Search Grounding)
                      </p>
                      <p className="text-xs text-slate-500 leading-snug mt-0.5">
                        Quét chủ đề & cụm từ đang thịnh hành tại {COUNTRIES.find((c) => c.code === country)?.name} trước khi viết tiêu đề.
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'w-11 h-6 rounded-full relative transition-colors shrink-0 ml-3',
                      useTrends ? 'bg-orange-500' : 'bg-slate-300'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-xs transition-all',
                        useTrends ? 'left-[22px]' : 'left-0.5'
                      )}
                    />
                  </div>
                </div>

                {/* Automatic Spelling & Grammar Proofreading Toggle */}
                <div
                  onClick={toggleAutoProofread}
                  className={cn(
                    'flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all',
                    autoProofread
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'p-2 rounded-lg shrink-0',
                        autoProofread ? 'bg-emerald-600' : 'bg-slate-300'
                      )}
                    >
                      <ClipboardCheck className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Soát chính tả tự động
                      </p>
                      <p className="text-xs text-slate-500 leading-snug mt-0.5">
                        Kiểm tra kép dấu thanh tiếng Việt (v.d. &ldquo;hoang dã&rdquo; thay vì &ldquo;hoang dạng&rdquo;), chuẩn hóa Unicode NFC và ngữ pháp bản địa.
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'w-11 h-6 rounded-full relative transition-colors shrink-0 ml-3',
                      autoProofread ? 'bg-emerald-600' : 'bg-slate-300'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-xs transition-all',
                        autoProofread ? 'left-[22px]' : 'left-0.5'
                      )}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Sticky Generate Button at bottom of left column on desktop */}
            <div className="lg:sticky lg:bottom-4 z-10 bg-white/95 backdrop-blur-sm p-3 rounded-xl border border-slate-200 shadow-lg">
              <button
                onClick={generateMetadata}
                disabled={isGenerating}
                className={cn(
                  'w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 shadow-md shadow-red-600/15 cursor-pointer',
                  isGenerating
                    ? 'bg-slate-500 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 active:scale-[0.99]'
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {genStage === 'trends' ? 'Đang quét xu hướng…' : 'Đang viết metadata…'}
                    </span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white" />
                    <span>Tạo Metadata SEO</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Comprehensive Results Dashboard */}
          <div className="lg:col-span-7" ref={resultsRef}>
            <AnimatePresence mode="wait">
              {metadata ? (
                <motion.div
                  key="results-dashboard"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-6 pb-20"
                >
                  {/* Result Action Toolbar + Proofread Status */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="font-bold text-slate-900">Báo cáo SEO</span>
                        <span aria-hidden="true">·</span>
                        <span>{COUNTRIES.find((c) => c.code === country)?.name}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{language}</span>

                        {metadata.proofreadReport && (
                          <button
                            type="button"
                            onClick={() => setIsProofreadExpanded(!isProofreadExpanded)}
                            className={cn(
                              'ml-1 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer',
                              metadata.proofreadReport.error
                                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            )}
                            title="Nhấn để xem chi tiết các lỗi chính tả đã phát hiện và sửa"
                          >
                            {metadata.proofreadReport.error ? (
                              <span>Chưa soát được chính tả</span>
                            ) : metadata.proofreadReport.fixed > 0 ? (
                              <span>
                                ✓ Đã soát chính tả — sửa {metadata.proofreadReport.fixed} lỗi
                              </span>
                            ) : (
                              <span>✓ Chính tả chuẩn</span>
                            )}
                            {metadata.proofreadReport.fixes &&
                              metadata.proofreadReport.fixes.length > 0 && (
                                <ChevronDown
                                  className={cn(
                                    'w-3.5 h-3.5 transition-transform',
                                    isProofreadExpanded && 'rotate-180'
                                  )}
                                />
                              )}
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleManualProofread}
                          disabled={isProofreadingManual || isGenerating}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                        >
                          {isProofreadingManual ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                          ) : (
                            <ClipboardCheck className="w-3.5 h-3.5 text-emerald-700" />
                          )}
                          Soát lại chính tả
                        </button>
                        <button
                          onClick={() => exportMetadataFile('txt')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Tải .TXT
                        </button>
                        <button
                          onClick={() => exportMetadataFile('csv')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Tải .CSV
                        </button>
                        <button
                          onClick={() => exportMetadataFile('json')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          .JSON
                        </button>
                        <button
                          onClick={generateMetadata}
                          disabled={isGenerating}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <RefreshCw className={cn('w-3.5 h-3.5', isGenerating && 'animate-spin')} />
                          Tạo lại
                        </button>
                        <button
                          onClick={() => {
                            const allText = `TIÊU ĐỀ ĐÃ CHỌN:\n${activeTitleText}\n\nTẤT CẢ TIÊU ĐỀ GỢI Ý:\n${metadata.titles
                              .map((t, i) => `${i + 1}. ${t.localized} (${t.angle})`)
                              .join('\n')}\n\nMÔ TẢ:\n${metadata.description}\n\nHASHTAGS:\n${metadata.hashtags.join(
                              ' '
                            )}\n\nTAGS:\n${metadata.tags.join(', ')}`;
                            copyToClipboard(allText, 'copy-all');
                          }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {copiedField === 'copy-all' ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Đã chép
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Sao chép tất cả
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Proofread Diff List */}
                    <AnimatePresence>
                      {isProofreadExpanded && metadata.proofreadReport && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-3 border-t border-slate-100 space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span className="font-bold text-slate-700">
                                Chi tiết rà soát chính tả ({metadata.proofreadReport.checked} trường đã kiểm tra)
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsProofreadExpanded(false)}
                                className="text-slate-400 hover:text-slate-700"
                              >
                                Thu gọn
                              </button>
                            </div>
                            {metadata.proofreadReport.error ? (
                              <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                                {metadata.proofreadReport.error}
                              </p>
                            ) : (metadata.proofreadReport.fixes || []).length === 0 ? (
                              <p className="text-xs text-emerald-700 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                                Tất cả tiêu đề, mô tả, thẻ tags và bản dịch tiếng Việt đều đạt chuẩn chính tả và dấu câu.
                              </p>
                            ) : (
                              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {(metadata.proofreadReport.fixes || []).map((fix, i) => (
                                  <div
                                    key={i}
                                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                                  >
                                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                      <span className="font-mono font-semibold text-slate-700">
                                        {fix.path}
                                      </span>
                                      <span>{fix.reason}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 leading-relaxed">
                                      <span className="line-through text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                        {fix.original}
                                      </span>
                                      <span className="text-slate-400">→</span>
                                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                        {fix.corrected}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Live YouTube SERP & Mobile/Desktop Preview Simulator */}
                  <div
                    ref={previewRef}
                    className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Mô phỏng hiển thị YouTube thực tế (Live SERP Preview)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Kiểm tra điểm cắt tiêu đề và chữ Thumbnail trên giao diện người xem tại {COUNTRIES.find((c) => c.code === country)?.name}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setPreviewDevice('mobile')}
                          className={cn(
                            'px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                            previewDevice === 'mobile'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          )}
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          Mobile Feed
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewDevice('desktop')}
                          className={cn(
                            'px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                            previewDevice === 'desktop'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          )}
                        >
                          <Monitor className="w-3.5 h-3.5" />
                          Desktop Search
                        </button>
                      </div>
                    </div>

                    {/* Simulated YouTube Card */}
                    <div
                      className={cn(
                        'rounded-xl border border-slate-200 bg-slate-950 text-white p-4 transition-all',
                        previewDevice === 'mobile'
                          ? 'max-w-sm mx-auto space-y-3'
                          : 'grid grid-cols-1 sm:grid-cols-12 gap-4 items-start'
                      )}
                    >
                      {/* 16:9 Thumbnail Canvas */}
                      <div
                        className={cn(
                          'relative aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-slate-800 via-red-950 to-slate-900 border border-white/10 flex flex-col justify-between p-3.5 select-none',
                          previewDevice === 'desktop' && 'sm:col-span-5'
                        )}
                      >
                        <div className="flex items-center justify-between text-[10px] text-white/70 font-mono">
                          <span>HD · {country}</span>
                          <span className="bg-black/60 px-1.5 py-0.5 rounded text-white">
                            {metadata.chapters && metadata.chapters.length > 0 ? 'CHAPTERS' : '4K'}
                          </span>
                        </div>

                        <div className="my-auto py-2">
                          <p className="text-lg sm:text-xl font-black uppercase tracking-tight leading-none text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] text-balance">
                            {metadata.thumbnailTexts?.[selectedThumbIndex] ||
                              metadata.primaryKeyword}
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-300 truncate max-w-[70%]">
                            {channelName || 'YouTube Creator'}
                          </span>
                          <span className="bg-black/85 text-white font-mono text-[11px] font-bold px-1.5 py-0.5 rounded tabular-nums">
                            08:42
                          </span>
                        </div>
                      </div>

                      {/* Video Meta Info */}
                      <div
                        className={cn(
                          'space-y-1.5',
                          previewDevice === 'desktop' && 'sm:col-span-7'
                        )}
                      >
                        {/* Top 3 Hashtags */}
                        {metadata.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-sky-400">
                            {metadata.hashtags.slice(0, 3).map((h, i) => (
                              <span key={i}>{h.startsWith('#') ? h : `#${h}`}</span>
                            ))}
                          </div>
                        )}

                        {/* Title with truncation preview */}
                        <h4 className="text-sm sm:text-base font-bold text-white leading-snug">
                          <span>{activeTitleText.slice(0, marketRule.titleIdealMax)}</span>
                          {activeTitleText.length > marketRule.titleIdealMax && (
                            <span
                              className="text-amber-400 underline decoration-dotted"
                              title="Phần này có thể bị ẩn bằng dấu ... trên màn hình nhỏ"
                            >
                              {activeTitleText.slice(marketRule.titleIdealMax)}
                            </span>
                          )}
                        </h4>

                        <div className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span className="font-medium text-slate-300">
                            {channelName || 'Linhakaka Official'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>128N lượt xem</span>
                          <span aria-hidden="true">·</span>
                          <span>2 giờ trước</span>
                        </div>

                        {/* Description Hook Snippet */}
                        <p className="text-xs text-slate-400 leading-relaxed pt-1 line-clamp-2">
                          <span className="text-slate-200">
                            {metadata.description.slice(0, marketRule.descHookChars)}
                          </span>
                          <span className="text-slate-500">...xem thêm</span>
                        </p>
                      </div>
                    </div>

                    {/* Thumbnail Overlay Switcher & Inline Title Editor */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                          Đổi chữ Thumbnail trên bản xem trước:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {(metadata.thumbnailTexts || []).map((txt, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedThumbIndex(idx)}
                              className={cn(
                                'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer',
                                selectedThumbIndex === idx
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              )}
                            >
                              {txt}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                            <Edit3 className="w-3 h-3 text-slate-400" />
                            Chỉnh sửa trực tiếp tiêu đề đang chọn (tính điểm SEO tức thì):
                          </label>
                          <span
                            className={cn(
                              'text-[11px] font-mono font-bold tabular-nums',
                              activeTitleText.length >= marketRule.titleIdealMin &&
                                activeTitleText.length <= marketRule.titleIdealMax
                                ? 'text-emerald-600'
                                : 'text-amber-600'
                            )}
                          >
                            {activeTitleText.length}/{marketRule.titleIdealMax} ký tự
                          </span>
                        </div>
                        <input
                          type="text"
                          value={activeTitleText}
                          onChange={(e) => setCustomTitleOverride(e.target.value)}
                          onBlur={() => {
                            if (customTitleOverride !== null) {
                              setCustomTitleOverride(
                                sanitizeText(customTitleOverride, language, { isTitle: true })
                              );
                            }
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live Trend Insights (Google Search grounding) */}
                  {trendReport && (
                    <div className="bg-orange-50/60 rounded-2xl border border-orange-200 overflow-hidden">
                      <button
                        onClick={() => setIsTrendExpanded(!isTrendExpanded)}
                        className="w-full flex items-center justify-between p-4 hover:bg-orange-100/40 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 text-xs font-bold text-orange-800">
                          <Flame className="w-4 h-4 text-orange-500" />
                          <span>Báo cáo Xu hướng Thị trường ({COUNTRIES.find((c) => c.code === country)?.name})</span>
                        </div>
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 text-orange-500 transition-transform duration-200',
                            isTrendExpanded && 'rotate-180'
                          )}
                        />
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
                                <div className="p-3.5 bg-white rounded-xl border border-orange-200/80">
                                  <p className="text-[11px] font-bold text-orange-700 mb-1">
                                    Cách bộ Metadata này đón đầu xu hướng:
                                  </p>
                                  <p className="text-xs text-slate-700 leading-relaxed">
                                    {metadata.trendAlignment}
                                  </p>
                                </div>
                              )}
                              <div className="p-4 bg-white rounded-xl border border-orange-200/60 text-xs text-slate-700 leading-relaxed [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_strong]:text-slate-900 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-2 [&_li]:mb-1">
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
                                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-orange-200 rounded-lg text-[11px] font-semibold text-orange-700 hover:bg-orange-50 transition-colors max-w-[240px]"
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

                  {/* SEO Score Overview + On-Page Optimization Checklist */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-5">
                          <Gauge className="w-4 h-4 text-red-600" />
                          <span>Điểm SEO Thực Tế (Live Score)</span>
                        </div>
                        <div className="flex items-center gap-5">
                          <div className="relative w-28 h-28 shrink-0">
                            <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
                              <circle
                                cx="50"
                                cy="50"
                                r="42"
                                fill="none"
                                stroke="#f1f5f9"
                                strokeWidth="10"
                              />
                              <circle
                                cx="50"
                                cy="50"
                                r="42"
                                fill="none"
                                stroke={
                                  liveSeoScore.overall >= 80
                                    ? '#16a34a'
                                    : liveSeoScore.overall >= 50
                                    ? '#f59e0b'
                                    : '#dc2626'
                                }
                                strokeWidth="10"
                                strokeDasharray={`${(liveSeoScore.overall / 100) * 263.9} 263.9`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center tabular-nums">
                              <span className="text-2xl font-black text-slate-900">
                                {Math.round(liveSeoScore.overall)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">/ 100</span>
                            </div>
                          </div>

                          <div className="flex-1 space-y-2.5 tabular-nums">
                            {[
                              { label: 'Tiêu đề', value: liveSeoScore.title },
                              { label: 'Mô tả', value: liveSeoScore.description },
                              { label: 'Tags', value: liveSeoScore.tags },
                              { label: 'Mật độ từ khóa', value: liveSeoScore.keywordUsage },
                            ].map((s) => (
                              <div key={s.label} className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                                  <span>{s.label}</span>
                                  <span className="text-slate-900 font-bold">
                                    {Math.round(s.value)}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      s.value >= 80
                                        ? 'bg-emerald-500'
                                        : s.value >= 50
                                        ? 'bg-amber-500'
                                        : 'bg-red-500'
                                    )}
                                    style={{ width: `${Math.min(100, Math.max(0, s.value))}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
                        Tự động cập nhật khi bạn đổi tiêu đề hoặc chèn thêm Timestamps.
                      </p>
                    </div>

                    <div className="md:col-span-7 bg-white rounded-2xl border border-slate-200 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <ClipboardCheck className="w-4 h-4 text-red-600" />
                          <span>Checklist On-Page (Cập nhật tức thì)</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-600 tabular-nums">
                          {checklist.filter((c) => c.status === 'pass').length}/{checklist.length} đạt chuẩn
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {checklist.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                          >
                            {item.status === 'pass' && (
                              <CircleCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            )}
                            {item.status === 'warn' && (
                              <CircleAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            )}
                            {item.status === 'fail' && (
                              <CircleX className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <p className="text-xs font-bold text-slate-800 leading-tight">
                                {item.label}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug tabular-nums">
                                {item.detail}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 5 Archetype Title Suggestions + Instant A/B Title Refiner */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-800">
                        <TypeIcon className="w-4 h-4 text-red-600" />
                        <span>5 Gợi ý Tiêu đề theo Tâm lý học Hành vi & CTR</span>
                        {(() => {
                          const effectiveType =
                            metadata.detectedContentType ||
                            (contentType !== 'AUTO' ? contentType : null);
                          return effectiveType ? (
                            <span className="px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700 font-semibold text-[11px]">
                              Loại nội dung: {effectiveType}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowFormatLibraryModal(true)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 rounded-lg text-slate-700 border border-slate-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-red-600" />
                          <span>Thư viện công thức</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const titlesText = (metadata.titles || [])
                              .map((t, i) => `${i + 1}. ${t.localized}`)
                              .join('\n');
                            copyToClipboard(titlesText, 'titles-all');
                          }}
                          className="px-2.5 py-1 hover:bg-white rounded-lg text-slate-600 hover:text-red-600 transition-all border border-transparent hover:border-slate-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedField === 'titles-all' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Đã chép ✓</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Sao chép cả 5 tiêu đề</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="p-4 space-y-4">
                      {(() => {
                        const rawBestIdx = metadata.titles.findIndex((t) => t.isBestOverall);
                        const bestIdx = rawBestIdx !== -1 ? rawBestIdx : 0;
                        const bestTitle = metadata.titles[bestIdx];
                        const otherTitles = metadata.titles
                          .map((t, idx) => ({ title: t, idx }))
                          .filter((item) => item.idx !== bestIdx);

                        const renderTitleCard = (title: YouTubeTitle, idx: number, isHero: boolean) => {
                          const isSelected = selectedTitleIndex === idx && customTitleOverride === null;
                          const charLen = title.localized.length;
                          const charStatus =
                            charLen > marketRule.titleHardMax
                              ? 'red'
                              : charLen >= marketRule.titleIdealMin && charLen <= marketRule.titleIdealMax
                              ? 'green'
                              : 'amber';
                          const kwMatch = keywordMatchInfo(
                            title.localized,
                            metadata.primaryKeyword || '',
                            language
                          );
                          const kwInFirst40 = kwMatch.inFirst40;
                          const ctrVal = Math.min(100, Math.max(0, Math.round(title.ctrScore || 0)));

                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                setSelectedTitleIndex(idx);
                                setCustomTitleOverride(null);
                              }}
                              className={cn(
                                'group relative rounded-xl transition-all cursor-pointer flex flex-col justify-between gap-3',
                                isHero
                                  ? 'p-5 border-2 border-red-600 bg-gradient-to-br from-red-50/40 via-white to-white shadow-xs'
                                  : isSelected
                                  ? 'p-4 border-2 border-red-500 bg-red-50/30'
                                  : 'p-4 border border-slate-200 bg-white hover:border-slate-300'
                              )}
                            >
                              <div className="space-y-2.5">
                                {/* Top Badges & Indicators */}
                                <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
                                  {isHero && (
                                    <span className="px-2.5 py-0.5 rounded-md bg-red-600 text-white font-bold text-xs">
                                      Đề xuất tốt nhất
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-semibold text-xs">
                                    {title.angle || `Góc #${idx + 1}`}
                                  </span>
                                  {(() => {
                                    const fmt =
                                      typeof title.formatId === 'number'
                                        ? getTitleFormat(title.formatId)
                                        : undefined;
                                    if (!fmt) return null;
                                    return (
                                      <span
                                        title={`${fmt.pattern} (${fmt.archetype})`}
                                        className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 font-medium text-[11px] max-w-[200px] sm:max-w-[250px] truncate"
                                      >
                                        #{fmt.id} · {fmt.pattern}
                                      </span>
                                    );
                                  })()}

                                  {/* Character count vs market rule */}
                                  <span
                                    className={cn(
                                      'px-2 py-0.5 rounded-md border font-semibold text-[11px]',
                                      charStatus === 'green'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : charStatus === 'amber'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-red-50 text-red-700 border-red-200'
                                    )}
                                  >
                                    {charLen}/{marketRule.titleIdealMin}–{marketRule.titleIdealMax} ký tự
                                  </span>

                                  {/* Primary keyword in first 40 chars check */}
                                  <span
                                    title={
                                      kwMatch.found
                                        ? `Đã khớp từ khóa: "${kwMatch.matchedToken}" (${
                                            kwInFirst40 ? 'nằm trong 40 ký tự đầu' : 'nằm sau 40 ký tự đầu'
                                          })`
                                        : `Chưa tìm thấy từ khóa chính "${metadata.primaryKeyword}" trong tiêu đề`
                                    }
                                    className={cn(
                                      'px-2 py-0.5 rounded-md border font-semibold text-[11px]',
                                      kwInFirst40
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    )}
                                  >
                                    {kwInFirst40 ? '✓' : '!'} Từ khóa trong 40 ký tự đầu
                                  </span>

                                  {/* Compliance badge */}
                                  <span
                                    className={cn(
                                      'px-2 py-0.5 rounded-md border font-semibold text-[11px]',
                                      title.complianceRisk === 'Thấp'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : title.complianceRisk === 'Trung bình'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-red-50 text-red-700 border-red-200'
                                    )}
                                  >
                                    Tuân thủ: {title.complianceRisk === 'Thấp' ? 'An toàn' : title.complianceRisk}
                                  </span>
                                </div>

                                {/* Localized Title */}
                                <h3
                                  className={cn(
                                    'font-bold text-slate-900 leading-snug',
                                    isHero ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'
                                  )}
                                >
                                  {title.localized}
                                </h3>

                                {/* Vietnamese translation (small, muted) */}
                                <p className="text-xs text-slate-500 leading-relaxed">
                                  Dịch nghĩa: {title.vietnamese}
                                </p>

                                {/* Market SEO reason */}
                                {title.reason && (
                                  <p className="text-xs text-slate-500 leading-snug">
                                    Chiến thuật SEO: {title.reason}
                                  </p>
                                )}
                              </div>

                              {/* Bottom Bar: CTR Progress Bar + Actions */}
                              <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-[130px] tabular-nums">
                                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                                    CTR {ctrVal}/100
                                  </span>
                                  <div className="h-2 w-20 bg-slate-100 rounded-full overflow-hidden border border-slate-200/70">
                                    <div
                                      className={cn(
                                        'h-full rounded-full transition-all',
                                        ctrVal >= 80
                                          ? 'bg-emerald-500'
                                          : ctrVal >= 50
                                          ? 'bg-amber-500'
                                          : 'bg-red-500'
                                      )}
                                      style={{ width: `${ctrVal}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(title.localized, `title-${idx}`);
                                    }}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                                  >
                                    {copiedField === `title-${idx}` ? (
                                      <span className="text-emerald-700 font-bold">Đã chép ✓</span>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Sao chép</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTitleIndex(idx);
                                      setCustomTitleOverride(null);
                                    }}
                                    className={cn(
                                      'px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer',
                                      isSelected
                                        ? 'bg-red-600 text-white'
                                        : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                                    )}
                                  >
                                    {isSelected ? 'Đang dùng ✓' : 'Dùng tiêu đề này'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRefineTitle(title.localized);
                                    }}
                                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-900 text-slate-600 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                                    title="Tạo 5 biến thể A/B Testing từ tiêu đề này"
                                  >
                                    <Wand2 className="w-3.5 h-3.5" />
                                    <span>A/B</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div className="space-y-4">
                            {bestTitle && renderTitleCard(bestTitle, bestIdx, true)}
                            {otherTitles.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {otherTitles.map(({ title, idx }) =>
                                  renderTitleCard(title, idx, false)
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* A/B Title Refiner Results Drawer */}
                      {(isRefiningTitle || refinedVariants.length > 0) && (
                        <div className="mt-4 p-4 rounded-xl bg-slate-900 text-white space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                              <Wand2 className="w-4 h-4" />
                              <span>
                                5 Biến thể A/B Testing cho: &ldquo;{refineSourceTitle.slice(0, 55)}
                                {refineSourceTitle.length > 55 ? '…' : ''}&rdquo;
                              </span>
                            </div>
                            {refinedVariants.length > 0 && (
                              <button
                                onClick={() => setRefinedVariants([])}
                                className="text-xs text-slate-400 hover:text-white"
                              >
                                Đóng
                              </button>
                            )}
                          </div>

                          {isRefiningTitle ? (
                            <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-300">
                              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                              <span>Đang phân tích và tạo 5 biến thể A/B CTR cao...</span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {refinedVariants.map((v, i) => (
                                <div
                                  key={i}
                                  className="p-3 rounded-lg bg-white/5 border border-white/10 hover:border-amber-400/50 transition-all flex items-start justify-between gap-3"
                                >
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400 tabular-nums">
                                      <span className="font-semibold text-amber-300">{v.style}</span>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-emerald-400 font-bold">
                                        CTR {Math.round(v.ctrScore)}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                      <span>{v.localized.length} ký tự</span>
                                    </div>
                                    <p className="text-sm font-bold text-white">{v.localized}</p>
                                    <p className="text-xs text-slate-300">Dịch: {v.vietnamese}</p>
                                    <p className="text-[11px] text-slate-400">{v.whyItWorks}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      onClick={() => setCustomTitleOverride(v.localized)}
                                      className="px-2.5 py-1 bg-amber-400 text-slate-950 rounded-md text-[11px] font-bold hover:bg-amber-300 transition-colors whitespace-nowrap cursor-pointer"
                                    >
                                      Áp dụng
                                    </button>
                                    <button
                                      onClick={() => copyToClipboard(v.localized, `ab-${i}`)}
                                      className="p-1.5 bg-white/10 hover:bg-white/20 rounded-md text-white cursor-pointer"
                                    >
                                      {copiedField === `ab-${i}` ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CTR Score Comparison Chart Card */}
                  {metadata.titles && metadata.titles.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5 overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                            <TrendingUp className="w-4 h-4 text-red-600" />
                            <span>Biểu đồ So sánh Điểm CTR giữa 5 Góc Tiếp Cận</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Nhấp vào cột bất kỳ để chọn tiêu đề tương ứng và xem mô phỏng trên YouTube.
                          </p>
                        </div>
                      </div>

                      <div className="h-56 w-full min-w-0 pt-2">
                        <ResponsiveContainer
                          width="100%"
                          height={220}
                          minWidth={0}
                          debounce={50}
                          initialDimension={{ width: 520, height: 220 }}
                        >
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
                                  setCustomTitleOverride(null);
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
                                let barColor =
                                  entry.ctrScore >= 80
                                    ? '#16a34a'
                                    : entry.ctrScore >= 50
                                    ? '#d97706'
                                    : '#dc2626';
                                if (entry.isBestOverall) {
                                  barColor = '#dc2626';
                                }
                                const isCurrent = selectedTitleIndex === index;
                                return (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={barColor}
                                    stroke={isCurrent ? '#0f172a' : 'none'}
                                    strokeWidth={isCurrent ? 2 : 0}
                                    opacity={isCurrent ? 1 : 0.82}
                                  />
                                );
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Video Chapters (Timestamps) + Thumbnail Visual Concepts */}
                  <div ref={keywordsRef} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Video Chapters Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                            <Clock className="w-4 h-4 text-red-600" />
                            <span>Chia Chương Video (SEO Chapters)</span>
                          </div>
                          {metadata.chapters && metadata.chapters.length > 0 && (
                            <button
                              onClick={() => {
                                const text = metadata.chapters!
                                  .map((c) => `${c.timestamp} ${c.title}`)
                                  .join('\n');
                                copyToClipboard(text, 'chapters-copy');
                              }}
                              className="text-xs font-semibold text-slate-600 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedField === 'chapters-copy' ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Đã chép
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" /> Sao chép
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {metadata.chapters && metadata.chapters.length > 0 ? (
                          <div className="space-y-2.5">
                            {metadata.chapters.map((ch, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                              >
                                <span className="font-mono font-bold text-red-600 shrink-0 tabular-nums">
                                  {ch.timestamp}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-slate-800">{ch.title}</p>
                                  <p className="text-[11px] text-slate-500">
                                    Dịch: {ch.vietnamese}
                                    {ch.seoKeyword ? ` · Từ khóa: ${ch.seoKeyword}` : ''}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 py-6 text-center">
                            Kịch bản chưa có phân đoạn chương.
                          </p>
                        )}
                      </div>

                      {metadata.chapters && metadata.chapters.length > 0 && (
                        <button
                          type="button"
                          onClick={insertChaptersIntoDescription}
                          className="mt-4 w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          {copiedField === 'chapters-inserted'
                            ? 'Đã chèn vào cuối Mô tả & Sao chép!'
                            : 'Chèn khối Chapters vào cuối Mô tả'}
                        </button>
                      )}
                    </div>

                    {/* Thumbnail Art Direction & Visual Concepts */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <ImageIcon className="w-4 h-4 text-red-600" />
                          <span>Ý tưởng Thiết kế Thumbnail & Chữ Nổi Bật</span>
                        </div>
                        <button
                          onClick={() =>
                            copyToClipboard((metadata.thumbnailTexts || []).join('\n'), 'thumb-box')
                          }
                          className="text-xs font-semibold text-slate-600 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedField === 'thumb-box' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          Chép chữ
                        </button>
                      </div>

                      {metadata.thumbnailConcepts && metadata.thumbnailConcepts.length > 0 ? (
                        <div className="space-y-3">
                          {metadata.thumbnailConcepts.map((tc, idx) => (
                            <div
                              key={idx}
                              onClick={() => copyToClipboard(tc.textOverlay, `tc-${idx}`)}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-all cursor-pointer space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-black text-slate-900">
                                  &ldquo;{tc.textOverlay}&rdquo;
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {copiedField === `tc-${idx}` ? 'Đã chép!' : tc.vietnamese}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 leading-snug">
                                <strong className="font-semibold">Bố cục hình ảnh:</strong>{' '}
                                {tc.visualScene}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                <strong className="font-semibold">Màu sắc & Tương phản:</strong>{' '}
                                {tc.colorPsychology}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(metadata.thumbnailTexts || []).map((t, i) => (
                            <button
                              key={i}
                              onClick={() => copyToClipboard(t, `thumb-${i}`)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              {t}
                              {copiedField === `thumb-${i}` && (
                                <Check className="w-3 h-3 text-emerald-600" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Keywords Table + Pinned Comments */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Keywords Opportunity Matrix */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <KeyIcon className="w-4 h-4 text-red-600" />
                          <span>Ma trận Từ khóa & Cơ hội SEO</span>
                        </div>
                        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                          {[
                            { id: 'all', label: 'Tất cả' },
                            { id: 'high-opp', label: 'Cơ hội ≥65' },
                            { id: 'low-comp', label: 'Dễ lên Top' },
                          ].map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setKeywordFilter(tab.id as any)}
                              className={cn(
                                'px-2 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                                keywordFilter === tab.id
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              )}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-red-50/70 border border-red-100">
                        <div>
                          <span className="text-[11px] font-semibold text-red-700 block">
                            Từ khóa chính (Primary Keyword)
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            {metadata.primaryKeyword}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(metadata.primaryKeyword, 'pk-box')}
                          className="p-2 hover:bg-white rounded-lg text-red-600 transition-colors cursor-pointer"
                        >
                          {copiedField === 'pk-box' ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {filteredKeywords.map((k, i) => (
                          <div
                            key={i}
                            onClick={() => copyToClipboard(k.keyword, `kw-${i}`)}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1 tabular-nums">
                              <span className="text-xs font-bold text-slate-800 truncate">
                                {k.keyword}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-700 shrink-0">
                                Điểm: {Math.round(k.opportunityScore)}/100
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span>Lượng tìm: {k.searchVolume}</span>
                              <span aria-hidden="true">·</span>
                              <span>Cạnh tranh: {k.competition}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pinned Comments & Hashtags */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
                      {metadata.pinnedComments && metadata.pinnedComments.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                              <Pin className="w-4 h-4 text-red-600" />
                              <span>Bình luận Ghim kích hoạt tương tác</span>
                            </div>
                          </div>
                          <div className="space-y-2.5">
                            {metadata.pinnedComments.map((pc, idx) => (
                              <div
                                key={idx}
                                className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1"
                              >
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span className="font-semibold text-slate-700">
                                    Chiến thuật: {pc.strategy}
                                  </span>
                                  <button
                                    onClick={() => copyToClipboard(pc.localized, `pin-${idx}`)}
                                    className="text-slate-600 hover:text-red-600 font-semibold flex items-center gap-1 cursor-pointer"
                                  >
                                    {copiedField === `pin-${idx}` ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-600" /> Đã chép
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" /> Chép
                                      </>
                                    )}
                                  </button>
                                </div>
                                <p className="text-xs font-bold text-slate-900 leading-snug">
                                  {pc.localized}
                                </p>
                                <p className="text-[11px] text-slate-500">Dịch: {pc.vietnamese}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                            <Hash className="w-4 h-4 text-blue-600" />
                            <span>Hashtags chuẩn hiển thị trên Tiêu đề</span>
                          </div>
                          <button
                            onClick={() =>
                              copyToClipboard(metadata.hashtags.join(' '), 'hashtags-box')
                            }
                            className="text-xs font-semibold text-slate-600 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedField === 'hashtags-box' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            Sao chép
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          {metadata.hashtags.map((h, i) => (
                            <span
                              key={i}
                              className={cn(
                                'font-bold text-sm',
                                i < 3 ? 'text-blue-600' : 'text-slate-500'
                              )}
                            >
                              {h.startsWith('#') ? h : `#${h}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Final Description Card (with Live Edit Mode) */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                        <AlignLeft className="w-4 h-4 text-red-600" />
                        <span>Mô tả Video Chuẩn SEO ({metadata.description.length} ký tự)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingDescription(!isEditingDescription)}
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {isEditingDescription ? 'Xong chỉnh sửa' : 'Chỉnh sửa trực tiếp'}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(metadata.description, 'desc-box')}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedField === 'desc-box' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {copiedField === 'desc-box' ? 'Đã chép' : 'Sao chép mô tả'}
                        </button>
                      </div>
                    </div>
                    <div className="p-5">
                      {isEditingDescription ? (
                        <textarea
                          value={metadata.description}
                          onChange={(e) =>
                            setMetadata({ ...metadata, description: e.target.value })
                          }
                          onBlur={() =>
                            setMetadata(deepSanitize(metadata, language))
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 leading-relaxed min-h-[320px] outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                        />
                      ) : (
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 whitespace-pre-wrap text-sm text-slate-800 leading-relaxed max-h-[460px] overflow-y-auto">
                          {metadata.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Tags Section */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors gap-3">
                      <button
                        type="button"
                        onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                        className="flex-1 flex items-center gap-2 text-xs font-bold text-slate-800 tabular-nums text-left cursor-pointer"
                      >
                        <Tag className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>
                          Thẻ Video / Tags ({(metadata.tags || []).length} tags ·{' '}
                          {(metadata.tags || []).join(',').length}/500 ký tự)
                        </span>
                      </button>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyToClipboard((metadata.tags || []).join(', '), 'tags-box')}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedField === 'tags-box' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          Sao chép chuỗi phẩy
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                          className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          aria-label="Mở rộng hoặc thu gọn Tags"
                        >
                          <ChevronDown
                            className={cn(
                              'w-4 h-4 transition-transform duration-200',
                              isTagsExpanded && 'rotate-180'
                            )}
                          />
                        </button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {isTagsExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-0">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed font-mono">
                              {metadata.tags.join(' · ')}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Disclaimer Section */}
                  {metadata.disclaimerUsed && (
                    <div className="bg-amber-50/70 rounded-2xl border border-amber-200 overflow-hidden">
                      <button
                        onClick={() => setIsDisclaimerExpanded(!isDisclaimerExpanded)}
                        className="w-full flex items-center justify-between p-4 hover:bg-amber-100/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                          <Shield className="w-4 h-4 text-amber-600" />
                          <span>Miễn trừ trách nhiệm ({metadata.disclaimerType})</span>
                        </div>
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 text-amber-500 transition-transform duration-200',
                            isDisclaimerExpanded && 'rotate-180'
                          )}
                        />
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
                              <div className="p-4 bg-white rounded-xl border border-amber-200/80 space-y-2">
                                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                                  {metadata.disclaimerText}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Target Audience, Search Intent & SEO Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
                      <p className="text-xs font-bold text-slate-800">
                        Chân dung Khán giả & Ý định Tìm kiếm
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        <strong className="text-slate-800">Khán giả:</strong>{' '}
                        {metadata.targetAudience}
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        <strong className="text-slate-800">Search Intent:</strong>{' '}
                        {metadata.searchIntent}
                      </p>
                    </div>

                    <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 space-y-2">
                      <p className="text-xs font-bold text-red-400">
                        Ghi chú Chiến lược SEO & Lưu ý Tuân thủ
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {metadata.seoNotes}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty-dashboard"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-slate-200 min-h-[520px]"
                >
                  <div className="bg-red-50 p-4 rounded-2xl mb-5">
                    <Youtube className="w-12 h-12 text-red-600" />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 mb-2 tracking-tight text-balance">
                    Sẵn sàng tối ưu hóa SEO YouTube đa quốc gia
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-6">
                    Dán kịch bản video của bạn ở cột bên trái hoặc chọn một kịch bản mẫu bên dưới để tạo tức thì 5 tiêu đề chuẩn CTR, phân tích xu hướng Google, chia chương Timestamps, chữ Thumbnail và bình luận ghim.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SAMPLE_SCRIPTS.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          setScript(tpl.script);
                          setCountry(tpl.country);
                          setLanguage(tpl.language);
                        }}
                        className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        Thử mẫu: {tpl.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* 100 Title Format Library Modal */}
      <AnimatePresence>
        {showFormatLibraryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowFormatLibraryModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/70 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <BookOpen className="w-5 h-5 text-red-600 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-900 truncate">
                      Thư viện 100 công thức tiêu đề
                    </h2>
                    <p className="text-xs text-slate-500">
                      Đã ghim {preferredFormatIds.length}/5 công thức ưu tiên (AI dùng làm khung cấu trúc và viết lại chuẩn bản địa)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFormatLibraryModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer shrink-0"
                  aria-label="Đóng thư viện công thức"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Bar */}
              <div className="p-4 border-b border-slate-200 bg-white space-y-3 shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-5 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={formatSearch}
                      onChange={(e) => setFormatSearch(e.target.value)}
                      placeholder="Tìm theo #ID hoặc từ khóa (v.d. #13, Rise)..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>
                  <div className="sm:col-span-4 relative">
                    <select
                      value={formatArchetypeFilter}
                      onChange={(e) =>
                        setFormatArchetypeFilter(e.target.value as TitleArchetype | 'ALL')
                      }
                      className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 pr-8 cursor-pointer"
                    >
                      <option value="ALL">Tất cả góc tiếp cận</option>
                      <option value="SEO-Anchor">SEO-Anchor</option>
                      <option value="Curiosity-Gap">Curiosity-Gap</option>
                      <option value="Number / Specificity">Number / Specificity</option>
                      <option value="Contrast / Authority">Contrast / Authority</option>
                      <option value="Native-Emotional / Trend">Native-Emotional / Trend</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <div className="sm:col-span-3 relative">
                    <select
                      value={formatTypeFilter}
                      onChange={(e) =>
                        setFormatTypeFilter(e.target.value as ContentType | 'ALL')
                      }
                      className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 pr-8 cursor-pointer"
                    >
                      <option value="ALL">Tất cả loại nội dung</option>
                      {CONTENT_TYPE_OPTIONS.filter((o) => o.id !== 'AUTO').map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.id}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hideFirstPersonInModal}
                      onChange={(e) => setHideFirstPersonInModal(e.target.checked)}
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                    <span className="font-medium">Ẩn công thức ngôi thứ nhất</span>
                  </label>
                  <span className="text-slate-500 tabular-nums">
                    Hiển thị {filteredFormats.length}/{TITLE_FORMATS.length} công thức
                  </span>
                </div>
              </div>

              {/* Scrollable Format List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/40">
                {filteredFormats.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Không tìm thấy công thức phù hợp với bộ lọc hiện tại.
                  </div>
                ) : (
                  filteredFormats.map((fmt) => {
                    const isPinned = preferredFormatIds.includes(fmt.id);
                    const pinLimitReached = !isPinned && preferredFormatIds.length >= 5;
                    return (
                      <div
                        key={fmt.id}
                        className={cn(
                          'p-3.5 rounded-xl border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all',
                          isPinned ? 'border-red-300 bg-red-50/20' : 'border-slate-200 hover:border-slate-300'
                        )}
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono font-bold">
                              #{fmt.id}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-semibold">
                              {fmt.archetype}
                            </span>
                            {fmt.types.map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-semibold"
                              >
                                {t}
                              </span>
                            ))}
                            {fmt.firstPerson && (
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                                Ngôi thứ 1
                              </span>
                            )}
                            {fmt.risk === 'medium' && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                                Cần lưu ý
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-slate-900 break-words">
                            {fmt.pattern}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={pinLimitReached}
                          onClick={() => togglePreferredFormat(fmt.id)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer whitespace-nowrap',
                            isPinned
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : pinLimitReached
                              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              : 'bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white border border-slate-200'
                          )}
                          title={pinLimitReached ? 'Tối đa 5 công thức ưu tiên' : undefined}
                        >
                          <Pin className="w-3.5 h-3.5" />
                          <span>{isPinned ? 'Đã ghim' : 'Ghim'}</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
                <span className="text-xs text-slate-500">
                  Mẹo: Ghim tối đa 5 công thức để ưu tiên áp dụng cho lần tạo tiếp theo.
                </span>
                <button
                  type="button"
                  onClick={() => setShowFormatLibraryModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Xong
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quiet Footer */}
      <footer className="max-w-[1400px] mx-auto px-6 py-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400 text-xs">
        <p>© 2026 Linhakaka YouTube SEO Studio</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="hover:text-slate-700 transition-colors cursor-pointer"
          >
            Lịch sử lưu trữ ({history.length})
          </button>
          <a href="#top" className="hover:text-slate-700 transition-colors">
            Lên đầu trang
          </a>
        </div>
      </footer>
    </div>
  );
}

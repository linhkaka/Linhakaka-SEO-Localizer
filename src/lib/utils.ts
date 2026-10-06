import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { YouTubeMetadata, ChecklistItem } from '@/src/types';
import { getMarketSeoRule } from '@/src/constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Real-time, deterministic on-page optimization checklist (vidIQ-style).
 * Runs entirely client-side against the currently selected title, so it
 * updates instantly when the user picks a different title suggestion —
 * no extra AI call needed.
 */
export function buildSeoChecklist(
  metadata: YouTubeMetadata,
  languageCode: string,
  selectedTitle: string
): ChecklistItem[] {
  const rule = getMarketSeoRule(languageCode);
  const items: ChecklistItem[] = [];
  const kw = metadata.primaryKeyword?.trim().toLowerCase();

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
    detail: `${titleLen} ký tự (lý tưởng cho thị trường này: ${rule.titleIdealMin}-${rule.titleIdealMax}, tối đa ${rule.titleHardMax})`,
  });

  const titleHasKeyword = !!kw && selectedTitle.toLowerCase().includes(kw);
  items.push({
    id: 'title-keyword',
    label: 'Từ khóa chính trong tiêu đề',
    status: titleHasKeyword ? 'pass' : 'fail',
    detail: titleHasKeyword
      ? 'Từ khóa chính xuất hiện trong tiêu đề đang chọn'
      : 'Tiêu đề đang chọn chưa chứa từ khóa chính — cân nhắc chọn tiêu đề khác',
  });

  const descHook = metadata.description.slice(0, rule.descHookChars).toLowerCase();
  const hookHasKeyword = !!kw && descHook.includes(kw);
  items.push({
    id: 'desc-hook',
    label: `Từ khóa trong ${rule.descHookChars} ký tự đầu mô tả`,
    status: hookHasKeyword ? 'pass' : 'warn',
    detail: hookHasKeyword
      ? 'Từ khóa chính xuất hiện trước khi bị ẩn sau "Hiện thêm"'
      : 'Nên đưa từ khóa chính lên sớm hơn, trước khi mô tả bị thu gọn',
  });

  const descLen = metadata.description.length;
  items.push({
    id: 'desc-length',
    label: 'Độ dài mô tả',
    status: descLen >= 250 ? 'pass' : descLen >= 100 ? 'warn' : 'fail',
    detail: `${descLen} ký tự`,
  });

  const tagsCharTotal = metadata.tags.join(',').length;
  items.push({
    id: 'tags-budget',
    label: 'Ngân sách ký tự Tags (YouTube giới hạn ~500)',
    status:
      tagsCharTotal > rule.tagsCharBudget
        ? 'fail'
        : tagsCharTotal >= rule.tagsCharBudget * 0.5
        ? 'pass'
        : 'warn',
    detail: `${tagsCharTotal}/${rule.tagsCharBudget} ký tự đã dùng`,
  });

  items.push({
    id: 'tags-count',
    label: 'Số lượng Tags',
    status: metadata.tags.length >= 8 && metadata.tags.length <= 15 ? 'pass' : metadata.tags.length > 0 ? 'warn' : 'fail',
    detail: `${metadata.tags.length} tags`,
  });

  const firstTag = (metadata.tags[0] || '').trim().toLowerCase();
  const firstTagIsKeyword = !!kw && firstTag === kw;
  items.push({
    id: 'tags-first-keyword',
    label: 'Tag đầu tiên = từ khóa chính',
    status: firstTagIsKeyword ? 'pass' : 'warn',
    detail: firstTagIsKeyword
      ? 'Tag đầu tiên trùng khớp từ khóa chính (chuẩn vidIQ)'
      : 'Nên đặt từ khóa chính làm tag đầu tiên để YouTube hiểu chủ đề nhanh nhất',
  });

  items.push({
    id: 'hashtags-count',
    label: 'Hashtags (YouTube chỉ hiển thị tối đa 3 phía trên tiêu đề)',
    status: metadata.hashtags.length >= 1 && metadata.hashtags.length <= 3 ? 'pass' : metadata.hashtags.length > 3 ? 'warn' : 'fail',
    detail: `${metadata.hashtags.length} hashtags`,
  });

  return items;
}

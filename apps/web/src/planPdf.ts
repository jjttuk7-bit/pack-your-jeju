import type { TravelPlanPdfRequest } from './api';
import type { MomentId, TravelInfo, TravelPlanItem } from './types';

export interface PlanPdfDraftItem extends TravelPlanItem {
  day: number;
  order: number;
  pdfMemo: string;
}

export interface PlanPdfDraft {
  title: string;
  items: PlanPdfDraftItem[];
}

export interface PlanPdfCustomScheduleInput {
  name: string;
  day: number;
  startTime: string;
  address: string;
  note: string;
}

const PLAN_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function normalizedDays(durationDays: number): number {
  if (!Number.isFinite(durationDays)) return 1;
  return Math.max(1, Math.floor(durationDays));
}

export function buildPlanPdfCustomScheduleItem(
  input: PlanPdfCustomScheduleInput,
  id: string,
  durationDays: number,
): TravelPlanItem | null {
  const name = input.name.trim();
  const startTime = input.startTime.trim();
  if (!name || (startTime && !PLAN_TIME_PATTERN.test(startTime))) return null;

  const days = normalizedDays(durationDays);
  const requestedDay = Number.isFinite(input.day) ? Math.floor(input.day) : 1;

  return {
    id,
    name,
    moment: 'user_added',
    source: 'user_added',
    day: Math.min(days, Math.max(1, requestedDay)),
    startTime: startTime || null,
    fixed: Boolean(startTime),
    address: input.address.trim() || null,
    note: input.note.trim() || null,
  };
}

function renumberByDay(items: PlanPdfDraftItem[], durationDays?: number): PlanPdfDraftItem[] {
  const maximumDay = normalizedDays(
    durationDays ?? Math.max(1, ...items.map((item) => item.day)),
  );
  const result: PlanPdfDraftItem[] = [];
  for (let day = 1; day <= maximumDay; day += 1) {
    items
      .filter((item) => item.day === day)
      .forEach((item, index) => {
        result.push({ ...item, order: index + 1 });
      });
  }
  return result;
}

export function buildInitialPlanPdfDraft(
  items: TravelPlanItem[],
  durationDays: number,
  title = '나의 제주 여행',
): PlanPdfDraft {
  const days = normalizedDays(durationDays);
  const itemCount = items.length;
  const scheduled = items.map<PlanPdfDraftItem>((item, index) => {
    const fallbackDay = itemCount > 0
      ? Math.min(days, Math.floor((index * days) / itemCount) + 1)
      : 1;
    const currentDay = Number.isInteger(item.day) ? Number(item.day) : fallbackDay;
    const day = currentDay >= 1 && currentDay <= days ? currentDay : fallbackDay;
    return {
      ...item,
      day,
      order: 0,
      pdfMemo: item.note?.trim() ?? '',
    };
  });

  return {
    title: title.trim() || '나의 제주 여행',
    items: renumberByDay(scheduled, days),
  };
}

export function changePlanPdfItemDay(
  items: PlanPdfDraftItem[],
  itemId: string,
  nextDay: number,
  durationDays: number,
): PlanPdfDraftItem[] {
  const days = normalizedDays(durationDays);
  const targetDay = Math.min(days, Math.max(1, Math.floor(nextDay)));
  const moving = items.find((item) => item.id === itemId);
  if (!moving || moving.day === targetDay) return renumberByDay(items, days);

  const remaining = items.filter((item) => item.id !== itemId);
  const destinationEnd = remaining.reduce((lastIndex, item, index) => (
    item.day === targetDay ? index : lastIndex
  ), -1);
  const next = [...remaining];
  const insertAt = destinationEnd >= 0
    ? destinationEnd + 1
    : next.findIndex((item) => item.day > targetDay);
  next.splice(insertAt < 0 ? next.length : insertAt, 0, {
    ...moving,
    day: targetDay,
  });
  return renumberByDay(next, days);
}

export function movePlanPdfItem(
  items: PlanPdfDraftItem[],
  itemId: string,
  direction: 'up' | 'down',
): PlanPdfDraftItem[] {
  const moving = items.find((item) => item.id === itemId);
  if (!moving) return renumberByDay(items);

  const sameDay = items.filter((item) => item.day === moving.day);
  const currentIndex = sameDay.findIndex((item) => item.id === itemId);
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sameDay.length) {
    return renumberByDay(items);
  }

  const reordered = [...sameDay];
  [reordered[currentIndex], reordered[targetIndex]] = [
    reordered[targetIndex],
    reordered[currentIndex],
  ];
  let cursor = 0;
  const next = items.map((item) => (
    item.day === moving.day ? reordered[cursor++] : item
  ));
  return renumberByDay(next);
}

export function buildTravelPlanPdfRequest(
  info: TravelInfo,
  moments: MomentId[],
  draft: PlanPdfDraft,
  packingItems: string[],
): TravelPlanPdfRequest {
  return {
    title: draft.title.trim() || '나의 제주 여행',
    travel: {
      regions: [...info.regions],
      start_date: info.startDate,
      days: normalizedDays(info.durationDays),
      companion: info.companion,
      purpose: info.purpose,
      moments: [...moments],
    },
    items: draft.items.map((item) => ({
      id: item.id,
      name: item.name,
      day: item.day,
      order: item.order,
      source: item.source,
      address: item.address ?? null,
      memo: item.pdfMemo.trim() || null,
      badge: item.badge ?? null,
      source_title: item.source_title ?? null,
      source_url: item.source_url ?? null,
      checked_at: item.checked_at ?? null,
      check_required: [...(item.check_required ?? [])],
    })),
    packing_items: packingItems
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 30),
  };
}

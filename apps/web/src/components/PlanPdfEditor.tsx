import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  FileDown,
  GripVertical,
  Loader2,
  MapPin,
  NotebookPen,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';

import { downloadTravelPlanPdf } from '../api';
import {
  buildInitialPlanPdfDraft,
  buildTravelPlanPdfRequest,
  changePlanPdfItemDay,
  movePlanPdfItem,
  type PlanPdfDraft,
  type PlanPdfDraftItem,
  type PlanPdfCustomScheduleInput,
} from '../planPdf';
import type {
  HarubanPlanDraft,
  MomentId,
  TravelInfo,
  TravelPlanItem,
} from '../types';


interface Props {
  open: boolean;
  info: TravelInfo;
  selectedMomentIds: MomentId[];
  selectedPlanItems: TravelPlanItem[];
  packingItems: string[];
  initialDraft?: PlanPdfDraft | null;
  composition?: HarubanPlanDraft | null;
  pendingSourceItems?: TravelPlanItem[];
  canUndoExclude?: boolean;
  canUndoCustomSchedule?: boolean;
  savedAt?: string | null;
  workspaceRevision?: string;
  onDraftChange?: (draft: PlanPdfDraft) => void;
  onExcludeItem?: (itemId: string) => void;
  onUndoExclude?: () => void;
  onAddCustomSchedule?: (input: PlanPdfCustomScheduleInput) => void;
  onUndoCustomSchedule?: () => void;
  onAddPendingItems?: (itemIds: string[]) => void;
  onClose: () => void;
}

const SOURCE_LABELS: Record<TravelPlanItem['source'], string> = {
  public_data: '공공데이터',
  web_search: '하루방 웹검색',
  user_added: '직접 추가',
};

const SOURCE_TONES: Record<TravelPlanItem['source'], string> = {
  public_data: 'border-mint/20 bg-[#E7F4EF] text-mint',
  web_search: 'border-orange-200 bg-[#FFF0E8] text-citrus-2',
  user_added: 'border-stone-200 bg-stone-100 text-stone-600',
};


export default function PlanPdfEditor({
  open,
  info,
  selectedMomentIds,
  selectedPlanItems,
  packingItems,
  initialDraft,
  composition,
  pendingSourceItems = [],
  canUndoExclude = false,
  canUndoCustomSchedule = false,
  savedAt,
  workspaceRevision,
  onDraftChange,
  onExcludeItem,
  onUndoExclude,
  onAddCustomSchedule,
  onUndoCustomSchedule,
  onAddPendingItems,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<PlanPdfDraft>(() => (
    initialDraft
      ? structuredClone(initialDraft)
      : buildInitialPlanPdfDraft(selectedPlanItems, info.durationDays)
  ));
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [customScheduleDay, setCustomScheduleDay] = useState<number | null>(null);
  const [customScheduleInput, setCustomScheduleInput] = useState<PlanPdfCustomScheduleInput>(
    () => emptyCustomScheduleInput(1),
  );
  const [customScheduleTimeError, setCustomScheduleTimeError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const customScheduleNameInputRef = useRef<HTMLInputElement>(null);
  const customScheduleTriggerRefs = useRef(new Map<number, HTMLButtonElement>());
  const pendingIdsKey = pendingSourceItems.map((item) => item.id).join('\u0000');

  const restoreCustomScheduleTriggerFocus = (day: number) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const trigger = customScheduleTriggerRefs.current.get(day);
        if (trigger?.isConnected) trigger.focus();
      });
    });
  };

  useEffect(() => {
    if (!open) return;
    setDraft(
      initialDraft
        ? structuredClone(initialDraft)
        : buildInitialPlanPdfDraft(selectedPlanItems, info.durationDays),
    );
    setGenerating(false);
    setError(null);
    setCustomScheduleDay(null);
    setCustomScheduleInput(emptyCustomScheduleInput(1));
    setCustomScheduleTimeError(null);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => titleInputRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, info.durationDays, workspaceRevision]);

  useEffect(() => {
    if (!open) return;
    setSelectedPendingIds(pendingSourceItems.map((item) => item.id));
  }, [open, pendingIdsKey]);

  useEffect(() => {
    if (customScheduleDay === null) return;
    const focusFrame = window.requestAnimationFrame(() => {
      customScheduleNameInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [customScheduleDay]);

  useEffect(() => {
    if (!open || !onDraftChangeRef.current) return;
    onDraftChangeRef.current(structuredClone(draft));
  }, [draft, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || generating) return;
      if (customScheduleDay !== null) {
        const dayToRestore = customScheduleDay;
        event.preventDefault();
        setCustomScheduleDay(null);
        setCustomScheduleInput(emptyCustomScheduleInput(1));
        setCustomScheduleTimeError(null);
        restoreCustomScheduleTriggerFocus(dayToRestore);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, generating, customScheduleDay, onClose]);

  const itemsByDay = useMemo(() => {
    const grouped = new Map<number, PlanPdfDraftItem[]>();
    for (let day = 1; day <= info.durationDays; day += 1) grouped.set(day, []);
    draft.items.forEach((item) => {
      grouped.set(item.day, [...(grouped.get(item.day) ?? []), item]);
    });
    return grouped;
  }, [draft.items, info.durationDays]);

  const closeEditor = () => {
    if (!generating) onClose();
  };

  const openCustomScheduleForm = (day: number) => {
    setCustomScheduleDay(day);
    setCustomScheduleInput(emptyCustomScheduleInput(day));
    setCustomScheduleTimeError(null);
  };

  const closeCustomScheduleForm = () => {
    const dayToRestore = customScheduleDay;
    setCustomScheduleDay(null);
    setCustomScheduleInput(emptyCustomScheduleInput(1));
    setCustomScheduleTimeError(null);
    if (dayToRestore !== null) {
      restoreCustomScheduleTriggerFocus(dayToRestore);
    }
  };

  const addCustomSchedule = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customScheduleInput.name.trim()) return;
    if (
      customScheduleInput.startTime
      && !PLAN_TIME_PATTERN.test(customScheduleInput.startTime)
    ) {
      setCustomScheduleTimeError('시간은 00:00부터 23:59 사이로 입력해 주세요.');
      return;
    }
    onAddCustomSchedule?.(customScheduleInput);
    closeCustomScheduleForm();
  };

  const updateMemo = (itemId: string, pdfMemo: string) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (
        item.id === itemId ? { ...item, pdfMemo } : item
      )),
    }));
  };

  const changeDay = (itemId: string, nextDay: number) => {
    setDraft((current) => ({
      ...current,
      items: changePlanPdfItemDay(
        current.items,
        itemId,
        nextDay,
        info.durationDays,
      ),
    }));
  };

  const moveItem = (itemId: string, direction: 'up' | 'down') => {
    setDraft((current) => ({
      ...current,
      items: movePlanPdfItem(current.items, itemId, direction),
    }));
  };

  const makePdf = async () => {
    if (generating || draft.items.length === 0 || !draft.title.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const request = buildTravelPlanPdfRequest(
        info,
        selectedMomentIds,
        draft,
        packingItems,
      );
      const { filename, blob } = await downloadTravelPlanPdf(request);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught: any) {
      setError(caught?.message || 'PDF를 만드는 중 문제가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-basalt/55 backdrop-blur-[2px] md:items-center md:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) closeEditor();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-pdf-editor-title"
        className="flex h-[94dvh] w-full max-w-[1040px] flex-col overflow-hidden rounded-t-[30px] border border-white/70 bg-[#FBF6EA] shadow-[0_30px_90px_rgba(45,42,38,0.34)] md:h-[min(88vh,850px)] md:rounded-[32px]"
      >
        <header className="relative shrink-0 overflow-hidden border-b border-white/15 bg-[#183F47] px-5 py-5 text-white md:px-8 md:py-6">
          <div className="pointer-events-none absolute -right-8 -top-14 h-40 w-40 rounded-full border-[24px] border-[#2D6A63]/60" />
          <div className="pointer-events-none absolute right-28 top-7 h-10 w-10 rounded-full bg-citrus shadow-[0_0_0_7px_rgba(230,122,52,0.13)]" />
          <div className="relative flex items-start justify-between gap-5">
            <div>
              <p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-[#F6A268]">
                MY JEJU TRAVEL PASSPORT
              </p>
              <h2
                id="plan-pdf-editor-title"
                className="font-serif-kr text-[21px] font-bold leading-tight tracking-tight md:text-[28px]"
              >
                내 여행 플랜 다듬기
              </h2>
              <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-white/72 md:text-[13px]">
                날짜와 순서를 정하고 나만의 메모를 더하면, 고른 장소가 여행 여권처럼
                디자인된 PDF로 만들어집니다.
              </p>
            </div>
            <button
              type="button"
              onClick={closeEditor}
              disabled={generating}
              aria-label="PDF 편집창 닫기"
              className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
          {composition && (
            <section className="mb-5 rounded-[22px] border border-citrus/25 bg-[#FFF3E7] p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-citrus px-3 py-1 text-[10px] font-bold text-white">
                  하루방 추천 초안
                </span>
                <span className="text-[9.5px] font-semibold text-stone-500">
                  원본 플랜은 변경되지 않았어요
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/80 bg-white/75 px-3 py-2.5">
                  <p className="text-[9px] font-bold text-mint">날씨 확인</p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-basalt-2">
                    {composition.weather.headline}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/75 px-3 py-2.5">
                  <p className="text-[9px] font-bold text-citrus-2">동선 확인</p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-basalt-2">
                    {composition.route.headline}
                  </p>
                </div>
              </div>
              {composition.warnings.length > 0 && (
                <ul className="mt-3 space-y-1 text-[9.5px] leading-relaxed text-amber-800">
                  {composition.warnings.map((warning) => (
                    <li key={warning}>
                      확인 필요 · <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {pendingSourceItems.length > 0 && (
            <section className="mb-5 rounded-[22px] border border-mint/25 bg-[#E7F4EF] p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif-kr text-[14px] font-bold text-basalt">
                    새로 담은 장소 {pendingSourceItems.length}곳이 있어요
                  </h3>
                  <p className="mt-1 text-[10px] text-stone-600">
                    PDF 초안에 넣을 장소만 골라주세요.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={selectedPendingIds.length === 0}
                  onClick={() => onAddPendingItems?.(selectedPendingIds)}
                  className="min-h-10 rounded-xl bg-mint px-4 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  선택한 장소 초안에 추가
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {pendingSourceItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-white/80 bg-white/75 px-3 py-2 text-[11px] font-semibold text-basalt"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPendingIds.includes(item.id)}
                      onChange={(event) => {
                        setSelectedPendingIds((current) => (
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id)
                        ));
                      }}
                      aria-label={`${item.name} 초안에 추가`}
                    />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            </section>
          )}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="space-y-5">
              <label className="block rounded-[22px] border border-earth bg-white/85 p-4 shadow-sm">
                <span className="mb-2 flex items-center gap-2 text-[11px] font-bold text-citrus-2">
                  <NotebookPen className="h-4 w-4" />
                  여행 제목
                </span>
                <input
                  ref={titleInputRef}
                  value={draft.title}
                  maxLength={80}
                  onChange={(event) => (
                    setDraft((current) => ({ ...current, title: event.target.value }))
                  )}
                  className="w-full border-0 bg-transparent font-serif-kr text-[20px] font-bold text-basalt outline-none placeholder:text-stone-300 md:text-[24px]"
                  placeholder="예: 혼자 떠나는 제주시 힐링 여행"
                />
                <span className="mt-1 block text-right text-[9px] text-stone-400">
                  {draft.title.length}/80
                </span>
              </label>

              {draft.items.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-earth bg-white/70 px-6 py-16 text-center">
                  <MapPin className="mx-auto h-8 w-8 text-stone-300" />
                  <p className="mt-3 font-serif-kr text-[16px] font-bold text-stone-700">
                    PDF 초안에 담긴 장소가 없습니다
                  </p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    나가서 장소를 더 살펴보거나 제외한 장소를 되돌려 주세요.
                  </p>
                </div>
              ) : null}
              {Array.from({ length: info.durationDays }, (_, index) => index + 1).map((day) => {
                  const dayItems = itemsByDay.get(day) ?? [];
                  return (
                    <section
                      key={day}
                      className="overflow-hidden rounded-[24px] border border-earth bg-white/80 shadow-sm"
                    >
                      <div className="flex items-center justify-between border-b border-earth/80 bg-[#F0EBDD] px-4 py-3 md:px-5">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-citrus font-serif-kr text-[12px] font-bold text-white">
                            {day}
                          </span>
                          <div>
                            <h3 className="font-serif-kr text-[15px] font-bold text-basalt">
                              Day {day}
                            </h3>
                            <p className="text-[9.5px] text-stone-500">
                              {dayItems.length}곳을 담았어요
                            </p>
                          </div>
                        </div>
                        <CalendarDays className="h-4 w-4 text-mint" />
                      </div>
                      <div className="space-y-3 p-3 md:p-4">
                        {dayItems.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-earth px-4 py-7 text-center text-[11px] text-stone-400">
                            이 날은 아직 비어 있어요. 다른 장소의 Day를 바꿔보세요.
                          </p>
                        ) : (
                          dayItems.map((item, itemIndex) => (
                            <PlanItemEditor
                              key={item.id}
                              item={item}
                              durationDays={info.durationDays}
                              isFirst={itemIndex === 0}
                              isLast={itemIndex === dayItems.length - 1}
                              reasons={composition?.reasonsByItemId[item.id] ?? []}
                              onChangeDay={changeDay}
                              onMove={moveItem}
                              onChangeMemo={updateMemo}
                              onExclude={onExcludeItem}
                            />
                          ))
                        )}
                        {customScheduleDay === day ? (
                          <form
                            onSubmit={addCustomSchedule}
                            className="rounded-[20px] border border-mint/25 bg-[#E7F4EF] p-4 shadow-sm"
                            aria-label={`Day ${day} 일정 직접 추가`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-serif-kr text-[14px] font-bold text-basalt">
                                  내 일정 직접 적기
                                </p>
                                <p className="mt-1 text-[10px] leading-relaxed text-stone-600">
                                  추가하면 내 여행플랜과 PDF 초안에 함께 담겨요.
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[9px] font-bold text-mint">
                                Day {day}
                              </span>
                            </div>
                            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                              <label className="min-w-0 sm:col-span-2" htmlFor={`custom-name-${day}`}>
                                <span className="text-[10px] font-bold text-basalt">
                                  일정명 <span className="text-citrus-2">(필수)</span>
                                </span>
                                <input
                                  id={`custom-name-${day}`}
                                  aria-label="일정명"
                                  aria-describedby={
                                    !customScheduleInput.name.trim()
                                      ? `custom-name-guidance-${day}`
                                      : undefined
                                  }
                                  aria-invalid={
                                    !customScheduleInput.name.trim() ? true : undefined
                                  }
                                  ref={customScheduleNameInputRef}
                                  required
                                  maxLength={80}
                                  value={customScheduleInput.name}
                                  onChange={(event) => setCustomScheduleInput((current) => ({
                                    ...current,
                                    name: event.target.value,
                                  }))}
                                  className="mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-earth bg-white px-3 text-[12px] text-basalt outline-none placeholder:text-stone-300 focus-visible:border-mint focus-visible:ring-2 focus-visible:ring-mint/25"
                                  placeholder="예: 렌터카 반납"
                                />
                              </label>
                              <label className="min-w-0" htmlFor={`custom-day-${day}`}>
                                <span className="text-[10px] font-bold text-basalt">Day</span>
                                <select
                                  id={`custom-day-${day}`}
                                  value={customScheduleInput.day}
                                  onChange={(event) => setCustomScheduleInput((current) => ({
                                    ...current,
                                    day: Number(event.target.value),
                                  }))}
                                  className="mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-earth bg-white px-3 text-[12px] font-bold text-basalt outline-none focus-visible:border-mint focus-visible:ring-2 focus-visible:ring-mint/25"
                                >
                                  {Array.from(
                                    {length: info.durationDays},
                                    (_, index) => index + 1,
                                  ).map((optionDay) => (
                                    <option key={optionDay} value={optionDay}>Day {optionDay}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="min-w-0" htmlFor={`custom-time-${day}`}>
                                <span className="text-[10px] font-bold text-basalt">시간</span>
                                <input
                                  id={`custom-time-${day}`}
                                  type="time"
                                  value={customScheduleInput.startTime}
                                  aria-invalid={customScheduleTimeError ? true : undefined}
                                  aria-describedby={
                                    customScheduleTimeError
                                      ? `custom-time-error-${day}`
                                      : undefined
                                  }
                                  onChange={(event) => {
                                    setCustomScheduleInput((current) => ({
                                      ...current,
                                      startTime: event.target.value,
                                    }));
                                    setCustomScheduleTimeError(null);
                                  }}
                                  className="mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-earth bg-white px-3 text-[12px] text-basalt outline-none focus-visible:border-mint focus-visible:ring-2 focus-visible:ring-mint/25"
                                />
                                {customScheduleTimeError ? (
                                  <span
                                    id={`custom-time-error-${day}`}
                                    role="alert"
                                    className="mt-1.5 block text-[9.5px] font-semibold text-rose-700"
                                  >
                                    {customScheduleTimeError}
                                  </span>
                                ) : null}
                              </label>
                              <label className="min-w-0 sm:col-span-2" htmlFor={`custom-address-${day}`}>
                                <span className="text-[10px] font-bold text-basalt">장소 또는 주소</span>
                                <input
                                  id={`custom-address-${day}`}
                                  maxLength={200}
                                  value={customScheduleInput.address}
                                  onChange={(event) => setCustomScheduleInput((current) => ({
                                    ...current,
                                    address: event.target.value,
                                  }))}
                                  className="mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-earth bg-white px-3 text-[12px] text-basalt outline-none placeholder:text-stone-300 focus-visible:border-mint focus-visible:ring-2 focus-visible:ring-mint/25"
                                  placeholder="선택 입력"
                                />
                              </label>
                              <label className="min-w-0 sm:col-span-2" htmlFor={`custom-note-${day}`}>
                                <span className="text-[10px] font-bold text-basalt">일정 메모</span>
                                <textarea
                                  id={`custom-note-${day}`}
                                  maxLength={800}
                                  rows={3}
                                  value={customScheduleInput.note}
                                  onChange={(event) => setCustomScheduleInput((current) => ({
                                    ...current,
                                    note: event.target.value,
                                  }))}
                                  className="mt-1.5 min-h-20 w-full min-w-0 resize-y rounded-xl border border-earth bg-white px-3 py-2.5 text-[12px] leading-relaxed text-basalt outline-none placeholder:text-stone-300 focus-visible:border-mint focus-visible:ring-2 focus-visible:ring-mint/25"
                                  placeholder="선택 입력"
                                />
                              </label>
                            </div>
                            {!customScheduleInput.name.trim() ? (
                              <p
                                id={`custom-name-guidance-${day}`}
                                className="mt-3 text-[9.5px] font-semibold text-citrus-2"
                              >
                                일정명을 입력해 주세요.
                              </p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={closeCustomScheduleForm}
                                className="min-h-11 rounded-xl border border-earth bg-white px-4 text-[11px] font-bold text-stone-600 outline-none hover:bg-[#FDF6EA] focus-visible:ring-2 focus-visible:ring-mint/30"
                              >
                                취소
                              </button>
                              <button
                                type="submit"
                                disabled={!customScheduleInput.name.trim()}
                                className="min-h-11 rounded-xl bg-mint px-5 text-[11px] font-bold text-white outline-none hover:bg-[#245E58] focus-visible:ring-2 focus-visible:ring-mint/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                일정 추가
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            type="button"
                            ref={(element) => {
                              if (element) customScheduleTriggerRefs.current.set(day, element);
                            }}
                            aria-label={`Day ${day} 일정 직접 추가`}
                            onClick={() => openCustomScheduleForm(day)}
                            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-mint/35 bg-[#F4FAF7] px-4 text-[11px] font-bold text-mint outline-none hover:border-mint/60 hover:bg-[#E7F4EF] focus-visible:ring-2 focus-visible:ring-mint/30"
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            일정 직접 추가
                          </button>
                        )}
                      </div>
                    </section>
                  );
                })}
            </div>

            <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
              <div className="rounded-[22px] border border-mint/20 bg-[#E7F4EF] p-4">
                <div className="flex items-center gap-2 text-mint">
                  <ShieldCheck className="h-4 w-4" />
                  <h3 className="font-serif-kr text-[13px] font-bold">PDF에 함께 담기는 것</h3>
                </div>
                <ul className="mt-3 space-y-2 text-[10.5px] leading-relaxed text-basalt-2">
                  <li>· 장소별 출처와 확인 상태</li>
                  <li>· 방문 전 재확인 항목</li>
                  <li>· 지도 검색 QR 코드</li>
                  <li>· 맞춤 준비물 체크리스트</li>
                </ul>
              </div>
              <div className="rounded-[22px] border border-earth bg-white/80 p-4">
                <p className="text-[10px] font-bold text-stone-700">맞춤 준비물</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {packingItems.length > 0 ? packingItems.slice(0, 8).map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-orange-100 bg-[#FFF6EE] px-2.5 py-1 text-[9px] text-citrus-2"
                    >
                      {item}
                    </span>
                  )) : (
                    <span className="text-[10px] text-stone-400">
                      기본 출발 체크가 포함됩니다.
                    </span>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>

        <footer className="shrink-0 border-t border-earth bg-white/95 px-4 py-3 shadow-[0_-12px_35px_rgba(45,42,38,0.08)] md:px-8 md:py-4">
          {error ? (
            <p className="mb-2 text-center text-[10.5px] text-rose-700">{error}</p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p
                role="status"
                aria-live="polite"
                className="text-[10.5px] font-semibold text-mint"
              >
                변경사항 임시저장됨
                {savedAt ? <span className="sr-only"> · {savedAt}</span> : null}
                {canUndoCustomSchedule ? (
                  <span className="mt-1 block text-citrus-2">
                    일정을 내 여행플랜에도 추가했어요
                  </span>
                ) : null}
              </p>
              <p className="hidden text-[9.5px] text-stone-500 sm:block">
                {draft.items.length}곳 · {info.durationDays}일 · PDF에서 지도 QR 제공
              </p>
            </div>
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              {canUndoCustomSchedule && (
                <button
                  type="button"
                  aria-label="추가한 일정 되돌리기"
                  onClick={onUndoCustomSchedule}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-citrus/25 bg-[#FFF3E7] px-4 text-[11px] font-bold text-citrus-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  추가한 일정 되돌리기
                </button>
              )}
              {canUndoExclude && (
                <button
                  type="button"
                  onClick={onUndoExclude}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-mint/30 bg-[#E7F4EF] px-4 text-[11px] font-bold text-mint"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  제외 되돌리기
                </button>
              )}
              <button
                type="button"
                onClick={closeEditor}
                disabled={generating}
                className="min-h-11 rounded-2xl border border-earth bg-white px-4 text-[12px] font-bold text-basalt transition hover:bg-[#FDF6EA] disabled:opacity-50"
              >
                나가서 장소 더 보기
              </button>
              <button
                type="button"
                onClick={makePdf}
                disabled={generating || draft.items.length === 0 || !draft.title.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-citrus px-5 font-serif-kr text-[13px] font-bold text-white shadow-jeju-chip transition hover:bg-citrus-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    PDF 만드는 중
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    PDF 만들기
                  </>
                )}
              </button>
            </div>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}


function PlanItemEditor({
  item,
  durationDays,
  isFirst,
  isLast,
  reasons,
  onChangeDay,
  onMove,
  onChangeMemo,
  onExclude,
}: {
  item: PlanPdfDraftItem;
  durationDays: number;
  isFirst: boolean;
  isLast: boolean;
  reasons: string[];
  onChangeDay: (itemId: string, day: number) => void;
  onMove: (itemId: string, direction: 'up' | 'down') => void;
  onChangeMemo: (itemId: string, memo: string) => void;
  onExclude?: (itemId: string) => void;
}) {
  return (
    <article className="rounded-[20px] border border-earth/90 bg-[#FFFCF7] p-4">
      <div className="flex items-start gap-3">
        <GripVertical className="mt-1 h-4 w-4 shrink-0 text-stone-300" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate font-serif-kr text-[14px] font-bold text-basalt">
                {item.name}
              </h4>
              {item.startTime ? (
                <p className="mt-0.5 text-[9.5px] font-bold text-mint">
                  {item.startTime} · {item.fixed ? '고정 일정' : '시간 지정'}
                </p>
              ) : null}
              <p className="mt-0.5 flex items-center gap-1 truncate text-[9.5px] text-stone-500">
                <MapPin className="h-3 w-3 shrink-0" />
                {item.address || (
                  item.source === 'user_added'
                    ? '사용자가 직접 입력한 일정입니다.'
                    : '주소는 여행 전 확인해 주세요.'
                )}
              </p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[8.5px] font-bold ${SOURCE_TONES[item.source]}`}>
              {SOURCE_LABELS[item.source]}
            </span>
          </div>

          {reasons.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-xl bg-[#FFF3E7] px-3 py-2 text-[9.5px] leading-relaxed text-citrus-2">
              {reasons.map((reason) => <li key={reason}>하루방 · {reason}</li>)}
            </ul>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr]">
            <label className="rounded-xl border border-earth bg-white px-3 py-2">
              <span className="block text-[8.5px] font-bold text-stone-500">날짜 배치</span>
              <select
                value={item.day}
                onChange={(event) => onChangeDay(item.id, Number(event.target.value))}
                className="mt-1 w-full bg-transparent text-[11px] font-bold text-basalt outline-none"
                aria-label={`${item.name} Day 선택`}
              >
                {Array.from({ length: durationDays }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>Day {day}</option>
                ))}
              </select>
            </label>
            <label className="rounded-xl border border-earth bg-white px-3 py-2">
              <span className="block text-[8.5px] font-bold text-stone-500">여행 메모</span>
              <textarea
                value={item.pdfMemo}
                maxLength={800}
                rows={2}
                aria-label={`${item.name} 여행 메모`}
                onChange={(event) => onChangeMemo(item.id, event.target.value)}
                className="mt-1 w-full resize-none bg-transparent text-[11px] leading-relaxed text-basalt outline-none placeholder:text-stone-300"
                placeholder="이 장소에서 하고 싶은 일이나 기억할 내용을 적어보세요."
              />
            </label>
          </div>

          <div className="mt-2 flex items-center justify-end gap-1.5">
            {onExclude && (
              <button
                type="button"
                aria-label={`${item.name} 초안에서 제외`}
                onClick={() => onExclude(item.id)}
                className="mr-auto inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-[10px] font-bold text-rose-700 transition hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                초안에서 제외
              </button>
            )}
            <button
              type="button"
              disabled={isFirst}
              onClick={() => onMove(item.id, 'up')}
              className="min-h-9 rounded-xl border border-earth bg-white px-3 text-[10px] font-bold text-stone-600 transition hover:bg-[#FDF6EA] disabled:cursor-not-allowed disabled:opacity-35"
            >위로</button>
            <button
              type="button"
              disabled={isLast}
              onClick={() => onMove(item.id, 'down')}
              className="min-h-9 rounded-xl border border-earth bg-white px-3 text-[10px] font-bold text-stone-600 transition hover:bg-[#FDF6EA] disabled:cursor-not-allowed disabled:opacity-35"
            >아래로</button>
          </div>
        </div>
      </div>
    </article>
  );
}


const PLAN_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function emptyCustomScheduleInput(day: number): PlanPdfCustomScheduleInput {
  return {
    name: '',
    day,
    startTime: '',
    address: '',
    note: '',
  };
}

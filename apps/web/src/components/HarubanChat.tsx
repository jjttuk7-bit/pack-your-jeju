import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X,
  Send,
  Loader2,
  Check,
  RefreshCcw,
  ShieldCheck,
  AlertTriangle,
  Compass,
  ListChecks,
  Plus,
  PackageCheck,
  Move,
  ExternalLink,
} from 'lucide-react';
import HarubangMark from './marks/HarubangMark';
import type {
  TravelInfo,
  MomentId,
  RegionId,
  CompanionValue,
  PurposeValue,
  TravelPlanItem,
  VisitCheck,
} from '../types';
import {
  requestHarubanChat,
  requestHarubanIntro,
  type HarubanAnswerContract,
  type HarubanChatMessage,
  type HarubanFormSuggestion,
  type HarubanIntroResponse,
  type HarubanWebPlaceCandidate,
} from '../api';
import { MOMENTS } from '../data';

interface HarubanChatProps {
  info: TravelInfo;
  selectedMomentIds: MomentId[];
  selectedPlanItems: TravelPlanItem[];
  visitChecks: Record<string, VisitCheck>;
  onApplySuggestion: (
    info: Partial<TravelInfo>,
    selectedMoments: MomentId[] | null,
  ) => void;
  onAddPlanItem: (item: TravelPlanItem) => void;
  onOpenVerify: () => void;
}

// 채팅에는 봇 발화가 "텍스트만"인 경우와 "인사 + 카드 리스트"인 경우가 함께 오간다.
// 카드 리스트를 별도 슬롯으로 두어 배지·주소·근거 액션을 대화 흐름과 분리한다.
type ChatEntry =
  | { kind: 'user'; content: string }
  | {
      kind: 'assistant';
      content: string;
      contract?: HarubanAnswerContract;
      placeCandidates?: HarubanWebPlaceCandidate[];
    }
  | { kind: 'intro'; intro: HarubanIntroResponse; formSnapshot: FormStateSnapshot };

interface FormStateSnapshot {
  regions: RegionId[];
  moments: MomentId[];
  companion: CompanionValue;
  purpose: PurposeValue;
  days: number;
  startDate: string;
}

interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface PanelInteraction {
  mode: 'move' | 'resize';
  direction?: ResizeDirection;
  startX: number;
  startY: number;
  startRect: PanelRect;
}

const PANEL_MARGIN = 12;
const PANEL_MIN_WIDTH = 340;
const PANEL_MIN_HEIGHT = 420;

function initialPanelRect(): PanelRect {
  const width = Math.min(440, window.innerWidth - PANEL_MARGIN * 2);
  const height = Math.min(650, window.innerHeight - PANEL_MARGIN * 2);
  return {
    x: window.innerWidth - width - 20,
    y: window.innerHeight - height - 20,
    width,
    height,
  };
}

function clampPanelRect(rect: PanelRect): PanelRect {
  const maxWidth = Math.max(PANEL_MIN_WIDTH, window.innerWidth - PANEL_MARGIN * 2);
  const maxHeight = Math.max(PANEL_MIN_HEIGHT, window.innerHeight - PANEL_MARGIN * 2);
  const width = Math.min(Math.max(rect.width, PANEL_MIN_WIDTH), maxWidth);
  const height = Math.min(Math.max(rect.height, PANEL_MIN_HEIGHT), maxHeight);
  return {
    width,
    height,
    x: Math.min(Math.max(rect.x, PANEL_MARGIN), window.innerWidth - width - PANEL_MARGIN),
    y: Math.min(Math.max(rect.y, PANEL_MARGIN), window.innerHeight - height - PANEL_MARGIN),
  };
}

function snapshotForm(info: TravelInfo, moments: MomentId[]): FormStateSnapshot {
  return {
    regions: [...(info.regions ?? [])] as RegionId[],
    moments: [...moments],
    companion: info.companion,
    purpose: info.purpose,
    days: info.durationDays,
    startDate: info.startDate,
  };
}

function isDifferentSnapshot(a: FormStateSnapshot, b: FormStateSnapshot): boolean {
  if (a.companion !== b.companion || a.purpose !== b.purpose) return true;
  if (a.days !== b.days || a.startDate !== b.startDate) return true;
  const arrEq = (x: string[], y: string[]) =>
    x.length === y.length && x.every((v, i) => v === y[i]);
  return !arrEq(a.regions, b.regions) || !arrEq(a.moments, b.moments);
}

function formStateForApi(snap: FormStateSnapshot): Record<string, unknown> {
  return {
    regions: snap.regions,
    start_date: snap.startDate,
    days: snap.days,
    companion: snap.companion,
    purpose: snap.purpose,
    moments: snap.moments,
  };
}

/**
 * 하루방 챗 위젯 — 우측 하단 플로팅.
 *
 * 새 흐름 (실서비스 톤):
 *  - 폼에서 지역+순간이 최초로 하나 이상씩 채워지면 하루방이 인사 내용을 준비한다.
 *  - 인사에는 저희 데이터로 확인된 하이라이트 카드 리스트가 붙는다 (배지·주소·근거 URL).
 *  - 이후 폼이 바뀌면 채팅창 하단에 "다시 물어볼까요?" 재요청 인라인 버튼.
 *  - 사용자 자유 발화는 기존 /agent/chat 도구 루프로 유지.
 */
export default function HarubanChat({
  info,
  selectedMomentIds,
  selectedPlanItems,
  visitChecks,
  onApplySuggestion,
  onAddPlanItem,
  onOpenVerify,
}: HarubanChatProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [introLoading, setIntroLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [panelRect, setPanelRect] = useState<PanelRect | null>(null);
  const [pendingSuggestion, setPendingSuggestion] =
    useState<HarubanFormSuggestion | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const introRequestSeqRef = useRef(0);
  const interactionRef = useRef<PanelInteraction | null>(null);

  // 임계 도달 1회 트리거 관리.
  //  - hasTriggeredRef: 임계 첫 충족 후 인사 준비를 이미 한 번 했는지.
  //  - lastIntroSnapshotRef: 마지막 intro 요청 당시의 폼 스냅샷 (변경 감지용).
  const hasTriggeredRef = useRef(false);
  const lastIntroSnapshotRef = useRef<FormStateSnapshot | null>(null);

  const currentSnapshot = useMemo(
    () => snapshotForm(info, selectedMomentIds),
    [info, selectedMomentIds],
  );
  const currentSnapshotKey = useMemo(
    () => JSON.stringify(currentSnapshot),
    [currentSnapshot],
  );

  const isThresholdMet =
    currentSnapshot.regions.length >= 1 && currentSnapshot.moments.length >= 1;

  const hasFormChangedSinceIntro =
    lastIntroSnapshotRef.current !== null &&
    isDifferentSnapshot(currentSnapshot, lastIntroSnapshotRef.current);

  useEffect(() => {
    const syncViewport = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      if (desktop) {
        setPanelRect((current) => clampPanelRect(current ?? initialPanelRect()));
      }
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || !isDesktop) return;

      const dx = event.clientX - interaction.startX;
      const dy = event.clientY - interaction.startY;
      const start = interaction.startRect;

      if (interaction.mode === 'move') {
        setPanelRect(clampPanelRect({
          ...start,
          x: start.x + dx,
          y: start.y + dy,
        }));
        return;
      }

      const direction = interaction.direction ?? 'se';
      let next = { ...start };

      if (direction.includes('e')) {
        next.width = Math.min(
          Math.max(PANEL_MIN_WIDTH, start.width + dx),
          window.innerWidth - start.x - PANEL_MARGIN,
        );
      }
      if (direction.includes('s')) {
        next.height = Math.min(
          Math.max(PANEL_MIN_HEIGHT, start.height + dy),
          window.innerHeight - start.y - PANEL_MARGIN,
        );
      }
      if (direction.includes('w')) {
        const right = start.x + start.width;
        next.x = Math.min(
          Math.max(PANEL_MARGIN, start.x + dx),
          right - PANEL_MIN_WIDTH,
        );
        next.width = right - next.x;
      }
      if (direction.includes('n')) {
        const bottom = start.y + start.height;
        next.y = Math.min(
          Math.max(PANEL_MARGIN, start.y + dy),
          bottom - PANEL_MIN_HEIGHT,
        );
        next.height = bottom - next.y;
      }
      setPanelRect(clampPanelRect(next));
    };

    const endInteraction = () => {
      interactionRef.current = null;
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endInteraction);
    window.addEventListener('pointercancel', endInteraction);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endInteraction);
      window.removeEventListener('pointercancel', endInteraction);
      endInteraction();
    };
  }, [isDesktop]);

  const beginPanelInteraction = (
    event: React.PointerEvent,
    mode: PanelInteraction['mode'],
    direction?: ResizeDirection,
  ) => {
    if (!isDesktop || !panelRect || event.button !== 0) return;
    event.preventDefault();
    interactionRef.current = {
      mode,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startRect: panelRect,
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = mode === 'move' ? 'grabbing' : `${direction}-resize`;
  };

  // 새 메시지 도착 시 아래로 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, pendingSuggestion, loading, introLoading]);

  // 임계 최초 도달 시 하루방 인사를 미리 준비하되, 창은 사용자가 직접 열 때만 보여준다.
  useEffect(() => {
    if (!isThresholdMet) {
      // 폼이 미달로 돌아가면 다음 도달 시 다시 자동 인사할 수 있게 flag 리셋.
      hasTriggeredRef.current = false;
      lastIntroSnapshotRef.current = null;
      setEntries([]);
      setPendingSuggestion(null);
      setError(null);
      return;
    }
    if (hasTriggeredRef.current) {
      const lastSnapshot = lastIntroSnapshotRef.current;
      if (!lastSnapshot || !isDifferentSnapshot(currentSnapshot, lastSnapshot)) return;

      setEntries([]);
      setPendingSuggestion(null);
      setError(null);
      void fetchIntro(currentSnapshot, { autoOpen: false });
      return;
    }
    hasTriggeredRef.current = true;
    void fetchIntro(currentSnapshot, { autoOpen: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isThresholdMet, currentSnapshotKey]);

  const fetchIntro = async (
    snap: FormStateSnapshot,
    { autoOpen }: { autoOpen: boolean },
  ) => {
    const requestSeq = ++introRequestSeqRef.current;
    setError(null);
    setIntroLoading(true);
    try {
      const resp = await requestHarubanIntro(formStateForApi(snap));
      if (requestSeq !== introRequestSeqRef.current) return;
      lastIntroSnapshotRef.current = snap;
      if (!resp.available) {
        setError(
          resp.reason?.includes('form invalid') || resp.reason?.includes('no moments')
            ? '지역과 순간을 먼저 하나씩 골라주세요.'
            : `하루방 에이전트가 답을 못 드렸어요: ${resp.reason || 'unknown'}`,
        );
        return;
      }
      setEntries((prev) => [
        ...prev,
        { kind: 'intro', intro: resp, formSnapshot: snap },
      ]);
      if (autoOpen) setOpen(true);
    } catch (e: any) {
      if (requestSeq !== introRequestSeqRef.current) return;
      setError(e?.message || String(e));
    } finally {
      if (requestSeq === introRequestSeqRef.current) {
        setIntroLoading(false);
      }
    }
  };

  const send = async () => {
    const t = input.trim();
    if (!t || loading) return;
    setError(null);
    setPendingSuggestion(null);
    const nextEntries: ChatEntry[] = [...entries, { kind: 'user', content: t }];
    setEntries(nextEntries);
    setInput('');
    setLoading(true);
    try {
      const formState = formStateForApi(currentSnapshot);
      // /agent/chat은 role=user|assistant|tool의 평면 메시지 배열만 받는다 (intro 엔트리 제외).
      const chatHistory: HarubanChatMessage[] = nextEntries
        .filter((e): e is Extract<ChatEntry, { kind: 'user' | 'assistant' }> =>
          e.kind === 'user' || e.kind === 'assistant')
        .map((e) => ({
          role: e.kind === 'user' ? 'user' : 'assistant',
          content: e.content,
        }));
      const resp = await requestHarubanChat(chatHistory, formState);
      if (!resp.available) {
        setError(
          resp.reason?.includes('OPENAI_API_KEY')
            ? '하루방 에이전트는 아직 준비 중이에요. 곧 연결할게요.'
            : '지금은 답변 연결이 잠시 불안정해요. 같은 질문을 한 번만 다시 보내주세요.',
        );
        return;
      }
      setEntries((prev) => [
        ...prev,
        {
          kind: 'assistant',
          content: resp.reply_text,
          contract: resp.answer_contract,
          placeCandidates: resp.place_candidates ?? [],
        },
      ]);
      if (resp.form_suggestion) {
        setPendingSuggestion(resp.form_suggestion);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = () => {
    if (!pendingSuggestion) return;
    const s = pendingSuggestion;
    const nextInfo: Partial<TravelInfo> = {};
    if (Array.isArray(s.regions) && s.regions.length > 0) {
      nextInfo.regions = s.regions as RegionId[];
    }
    if (s.companion) nextInfo.companion = s.companion as CompanionValue;
    if (s.purpose) nextInfo.purpose = s.purpose as PurposeValue;
    if (typeof s.days === 'number' && s.days > 0) nextInfo.durationDays = s.days;
    if (s.start_date) nextInfo.startDate = s.start_date;
    const nextMoments = Array.isArray(s.moments) && s.moments.length > 0
      ? (s.moments as MomentId[])
      : null;
    onApplySuggestion(nextInfo, nextMoments);
    setPendingSuggestion(null);
    setEntries((prev) => [
      ...prev,
      { kind: 'assistant', content: '반영했어요. 폼에서 확인해 주세요.' },
    ]);
  };

  const dismissSuggestion = () => setPendingSuggestion(null);

  const addHighlightToPlan = (highlight: import('../api').HarubanIntroHighlight) => {
    const item = planItemFromHighlight(highlight);
    const alreadyInPlan = selectedPlanItems.some((planItem) => planItem.id === item.id);
    if (!alreadyInPlan) onAddPlanItem(item);
    setEntries((prev) => [
      ...prev,
      {
        kind: 'assistant',
        content: alreadyInPlan
          ? `${highlight.name}은 이미 내 여행플랜에 담겨 있어요.`
          : `${highlight.name}을 내 여행플랜에 담았어요. 이제 짐 목록과 공유 문구에도 반영됩니다.`,
      },
    ]);
  };

  const openVerifyFromAgent = () => {
    onOpenVerify();
    setOpen(false);
  };

  return (
    <>
      {/* 플로팅 버튼: 패널이 열렸을 때는 헤더의 하루방만 남겨 화면 겹침을 줄인다. */}
      {!open && (
        <button
          type="button"
          id="haruban-fab"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 h-[82px] w-[82px] rounded-full border-2 border-citrus/25 bg-white/95 shadow-[0_18px_42px_rgba(88,67,47,0.22)] backdrop-blur-sm flex items-center justify-center transition hover:-translate-y-1 hover:scale-[1.03] hover:border-citrus/45"
          aria-label="하루방 에이전트 열기"
        >
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full border-2 border-white bg-citrus shadow-sm" />
          <HarubangMark className="h-[66px] w-[66px]" />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            key="haruban-panel"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            style={isDesktop && panelRect ? {
              left: panelRect.x,
              top: panelRect.y,
              width: panelRect.width,
              height: panelRect.height,
            } : undefined}
            className="fixed bottom-4 left-4 right-4 z-40 flex h-[min(680px,calc(100vh-2rem))] w-auto flex-col overflow-hidden rounded-xl border-2 border-[#2D6F65] bg-white shadow-[0_24px_70px_rgba(24,52,48,0.32),0_4px_16px_rgba(24,52,48,0.18)] md:bottom-auto md:left-auto md:right-auto md:max-h-none"
            id="haruban-panel"
          >
            {/* 헤더 */}
            <div
              onPointerDown={(event) => beginPanelInteraction(event, 'move')}
              className="flex cursor-default items-center gap-3 border-b border-[#2D6F65]/35 bg-[#F8FBF9] px-4 py-3.5 select-none md:cursor-move"
              title={isDesktop ? '드래그해서 창 이동' : undefined}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-white shadow-sm">
                <HarubangMark className="h-11 w-11" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-serif-kr font-bold text-[15px] text-basalt">하루방 에이전트</div>
                <div className="text-[10.5px] text-basalt-2/70 leading-tight">
                  제주 여행을 함께 찾고 정리해드려요
                </div>
              </div>
              {isDesktop && (
                <Move className="h-4 w-4 shrink-0 text-[#2D6F65]/60" aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                onPointerDown={(event) => event.stopPropagation()}
                className="p-1.5 rounded-full hover:bg-black/5 transition"
                aria-label="닫기"
              >
                <X className="w-4 h-4 text-basalt-2/70" />
              </button>
            </div>

            {/* 메시지 목록 */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5"
              id="haruban-messages"
            >
              {entries.length === 0 && !introLoading && (
                <div className="text-[12px] text-basalt-2/70 leading-relaxed px-1">
                  제주에서 궁금한 지역이나 여행 취향을 편하게 물어보세요.
                  <br />
                  하루방 에이전트가 최신 웹 정보를 폭넓게 검색해 맛집·명소·숙소·교통을 비교해 드립니다.
                  <br />
                  <span className="text-basalt-2/50">
                    필요한 경우 비짓제주·공공데이터도 교차 확인하고 출처와 확인 시점을 함께 알려드려요.
                  </span>
                </div>
              )}

              {entries.map((entry, i) => {
                if (entry.kind === 'user') {
                  return <MessageBubble key={i} role="user" content={entry.content} />;
                }
                if (entry.kind === 'assistant') {
                  if (!entry.content) return null;
                  return (
                    <div key={i} className="space-y-2.5">
                      <MessageBubble
                        role="assistant"
                        content={entry.content}
                        contract={entry.contract}
                      />
                      {entry.placeCandidates && entry.placeCandidates.length > 0 && (
                        <WebPlaceCandidatePicker
                          candidates={entry.placeCandidates}
                          selectedPlanItems={selectedPlanItems}
                          onAddPlanItem={onAddPlanItem}
                        />
                      )}
                    </div>
                  );
                }
                // intro — 현재 폼 상태를 함께 넘겨 이미 포함된 조건은 disabled 처리.
                return (
                  <IntroBlock
                    key={i}
                    intro={entry.intro}
                    selectedMoments={currentSnapshot.moments}
                    selectedPlanItems={selectedPlanItems}
                    visitChecks={visitChecks}
                    onAddHighlightToPlan={addHighlightToPlan}
                    onOpenVerify={openVerifyFromAgent}
                  />
                );
              })}

              {introLoading && (
                <div className="flex items-center gap-1.5 text-[11px] text-basalt-2/60 px-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> 하루방 에이전트가 여행 근거를 확인하고 있어요...
                </div>
              )}
              {loading && (
                <div className="flex items-center gap-1.5 text-[11px] text-basalt-2/60 px-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> 하루방 에이전트가 질문을 해석하고 정보를 확인 중이에요...
                </div>
              )}
              {error && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[11.5px] text-amber-900">
                  {error}
                </div>
              )}
              {pendingSuggestion && (
                <SuggestionCard
                  suggestion={pendingSuggestion}
                  onApply={applySuggestion}
                  onDismiss={dismissSuggestion}
                />
              )}

              {/* 이미 인사를 한 번 냈고, 그 이후 폼이 바뀌었으면 다시 물어볼지 인라인 유도. */}
              {isThresholdMet &&
                hasTriggeredRef.current &&
                hasFormChangedSinceIntro &&
                !introLoading && (
                  <button
                    type="button"
                    onClick={() => fetchIntro(currentSnapshot, { autoOpen: false })}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-citrus/50 bg-citrus/5 text-[11.5px] text-citrus-2 hover:bg-citrus/10 transition"
                  >
                    <RefreshCcw className="w-3 h-3" />
                    조건이 바뀌었어요. 다시 물어볼까요?
                  </button>
                )}
            </div>

            {/* 입력창 */}
            <div className="px-3 py-2.5 border-t border-earth/60 bg-white rounded-b-2xl">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="예: 한림에 맛집 추천해줘"
                  rows={1}
                  className="flex-1 px-3 py-2 rounded-xl border border-earth bg-[#FDFBF7] text-basalt text-[12.5px] leading-snug resize-none focus:outline-none focus:ring-2 focus:ring-citrus/25 focus:border-citrus transition placeholder:text-basalt-2/50 max-h-[80px]"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={loading || input.trim().length === 0}
                  className="p-2.5 rounded-xl bg-citrus text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-citrus-2 transition"
                  aria-label="보내기"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {isDesktop && (
              <>
                <ResizeHandle direction="n" onPointerDown={beginPanelInteraction} />
                <ResizeHandle direction="s" onPointerDown={beginPanelInteraction} />
                <ResizeHandle direction="e" onPointerDown={beginPanelInteraction} />
                <ResizeHandle direction="w" onPointerDown={beginPanelInteraction} />
                <ResizeHandle direction="ne" onPointerDown={beginPanelInteraction} />
                <ResizeHandle direction="nw" onPointerDown={beginPanelInteraction} />
                <ResizeHandle direction="se" onPointerDown={beginPanelInteraction} />
                <ResizeHandle direction="sw" onPointerDown={beginPanelInteraction} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ResizeHandle({
  direction,
  onPointerDown,
}: {
  direction: ResizeDirection;
  onPointerDown: (
    event: React.PointerEvent,
    mode: PanelInteraction['mode'],
    direction?: ResizeDirection,
  ) => void;
}) {
  const positions: Record<ResizeDirection, string> = {
    n: 'top-0 left-4 right-4 h-1.5 cursor-n-resize',
    s: 'bottom-0 left-4 right-4 h-1.5 cursor-s-resize',
    e: 'right-0 bottom-4 top-4 w-1.5 cursor-e-resize',
    w: 'left-0 bottom-4 top-4 w-1.5 cursor-w-resize',
    ne: 'right-0 top-0 h-4 w-4 cursor-ne-resize',
    nw: 'left-0 top-0 h-4 w-4 cursor-nw-resize',
    se: 'bottom-0 right-0 h-4 w-4 cursor-se-resize',
    sw: 'bottom-0 left-0 h-4 w-4 cursor-sw-resize',
  };

  return (
    <div
      aria-hidden="true"
      onPointerDown={(event) => onPointerDown(event, 'resize', direction)}
      className={`absolute z-10 touch-none ${positions[direction]}`}
    />
  );
}

function WebPlaceCandidatePicker({
  candidates,
  selectedPlanItems,
  onAddPlanItem,
}: {
  candidates: HarubanWebPlaceCandidate[];
  selectedPlanItems: TravelPlanItem[];
  onAddPlanItem: (item: TravelPlanItem) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const planIds = useMemo(
    () => new Set(selectedPlanItems.map((item) => item.id)),
    [selectedPlanItems],
  );

  const toggleCandidate = (candidate: HarubanWebPlaceCandidate) => {
    const planId = `web-${candidate.id}`;
    if (planIds.has(planId) || addedIds.includes(candidate.id)) return;
    setSelectedIds((current) => current.includes(candidate.id)
      ? current.filter((id) => id !== candidate.id)
      : [...current, candidate.id]);
  };

  const addSelected = () => {
    const selected = candidates.filter((candidate) => selectedIds.includes(candidate.id));
    selected.forEach((candidate) => onAddPlanItem(planItemFromWebCandidate(candidate)));
    setAddedIds((current) => [...new Set([...current, ...selected.map((candidate) => candidate.id)])]);
    setSelectedIds([]);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-[#2D6F65]/35 bg-[#F4FAF7]">
      <div className="flex items-center justify-between gap-3 border-b border-[#2D6F65]/20 px-3 py-2.5">
        <div>
          <p className="text-[11.5px] font-bold text-basalt">검색한 장소를 플랜에 담기</p>
          <p className="mt-0.5 text-[9.5px] text-basalt-2/65">원문 출처와 검색 시점을 함께 보관합니다.</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9.5px] font-bold text-[#2D6F65]">
          {candidates.length}곳
        </span>
      </div>

      <div className="divide-y divide-[#2D6F65]/15">
        {candidates.map((candidate) => {
          const alreadyAdded = planIds.has(`web-${candidate.id}`) || addedIds.includes(candidate.id);
          const checked = alreadyAdded || selectedIds.includes(candidate.id);
          return (
            <label
              key={candidate.id}
              className={`flex gap-2.5 px-3 py-2.5 ${alreadyAdded ? 'bg-[#E9F4EE]' : 'cursor-pointer hover:bg-white/70'}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={alreadyAdded}
                onChange={() => toggleCandidate(candidate)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#2D6F65]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="font-bold text-[11.5px] leading-snug text-basalt">{candidate.name}</span>
                  {alreadyAdded && (
                    <span className="shrink-0 text-[9px] font-bold text-[#2D6F65]">플랜에 담김</span>
                  )}
                </span>
                {(candidate.address || candidate.note) && (
                  <span className="mt-1 block text-[10px] leading-relaxed text-basalt-2/75 line-clamp-2">
                    {candidate.address || candidate.note}
                  </span>
                )}
                <a
                  href={candidate.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="mt-1 inline-flex items-center gap-1 text-[9.5px] font-semibold text-[#A84422] underline underline-offset-2"
                >
                  {candidate.source_title || '원문 보기'}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </span>
            </label>
          );
        })}
      </div>

      <div className="border-t border-[#2D6F65]/20 bg-white/70 p-2.5">
        <button
          type="button"
          onClick={addSelected}
          disabled={selectedIds.length === 0}
          className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#2D6F65] px-3 text-[11.5px] font-bold text-white transition hover:bg-[#245B53] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PackageCheck className="h-3.5 w-3.5" />
          선택한 {selectedIds.length}곳을 플랜에 담기
        </button>
      </div>
    </section>
  );
}

function MessageBubble({
  role,
  content,
  contract,
}: {
  role: 'user' | 'assistant';
  content: string;
  contract?: HarubanAnswerContract;
}) {
  const isUser = role === 'user';
  const sourceLabel = contract ? answerSourceLabel(contract.source_type) : '';
  const confidenceLabel = contract ? confidenceLabelFor(contract.confidence) : '';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`${isUser ? 'max-w-[86%]' : 'max-w-[96%]'} px-3 py-2 rounded-2xl text-[12.5px] leading-relaxed ${
          isUser
            ? 'bg-citrus text-white rounded-br-md'
            : 'bg-[#FDF6EA] text-basalt border border-earth/60 rounded-bl-md'
        }`}
      >
        {isUser ? <div className="whitespace-pre-wrap">{content}</div> : <AssistantMarkdown content={content} />}
        {!isUser && contract && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-earth/50 pt-2 text-[10px] leading-none text-basalt-2/70">
            {sourceLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 font-bold">
                <ShieldCheck className="h-3 w-3 text-citrus-2" />
                {sourceLabel}
              </span>
            )}
            {confidenceLabel && (
              <span className="rounded-full bg-white/70 px-2 py-1 font-bold">
                {confidenceLabel}
              </span>
            )}
            {contract.limitations?.[0] && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-900">
                <AlertTriangle className="h-3 w-3" />
                {contract.limitations[0]}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h2 className="mb-2 mt-1 font-serif-kr text-[16px] font-bold leading-snug text-basalt">
            {children}
          </h2>
        ),
        h2: ({ children }) => (
          <h2 className="mb-1.5 mt-4 border-b border-earth/60 pb-1.5 font-serif-kr text-[15px] font-bold leading-snug text-basalt first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 mt-3 text-[13px] font-bold leading-snug text-basalt first:mt-0">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="my-1.5 break-words leading-[1.75] first:mt-0 last:mb-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="my-2 space-y-1 pl-4 marker:text-citrus-2" style={{ listStyleType: 'disc' }}>
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2 space-y-2.5 pl-5 marker:font-bold marker:text-citrus-2" style={{ listStyleType: 'decimal' }}>
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="pl-0.5 leading-[1.7]">{children}</li>,
        strong: ({ children }) => <strong className="font-bold text-basalt">{children}</strong>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#A84422] underline decoration-[#D97745]/50 underline-offset-2 transition-colors hover:text-citrus focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-citrus"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-citrus-2 bg-white/60 px-2.5 py-1 text-basalt-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-earth/70" />,
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto rounded-md border border-earth/70 bg-white/50">
            <table className="min-w-full border-collapse text-left text-[11px]">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="whitespace-nowrap border-b border-earth bg-[#F8EAD4] px-2 py-1.5 font-bold">{children}</th>
        ),
        td: ({ children }) => <td className="border-b border-earth/40 px-2 py-1.5 align-top">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function answerSourceLabel(sourceType: string): string {
  switch (sourceType) {
    case 'public_data':
      return '공공데이터 기준';
    case 'web':
      return '웹 출처 기준';
    case 'kma_weather':
      return '기상청 예보 기준';
    case 'stable_general':
      return '일반 제주 안내';
    default:
      return '';
  }
}

function confidenceLabelFor(confidence: string): string {
  switch (confidence) {
    case 'high':
      return '신뢰 높음';
    case 'medium':
      return '확인 필요';
    case 'low':
      return '근거 약함';
    default:
      return '';
  }
}

// ── 인사 블록: greeting 말풍선 + 플랜 코치 액션 + 데이터 부족 섹션 ──
function IntroBlock({
  intro,
  selectedMoments,
  selectedPlanItems,
  visitChecks,
  onAddHighlightToPlan,
  onOpenVerify,
}: {
  intro: HarubanIntroResponse;
  selectedMoments: string[];
  selectedPlanItems: TravelPlanItem[];
  visitChecks: Record<string, VisitCheck>;
  onAddHighlightToPlan: (highlight: import('../api').HarubanIntroHighlight) => void;
  onOpenVerify: () => void;
}) {
  const [showAllGaps, setShowAllGaps] = useState(false);
  const groupedGaps = useMemo(() => groupGapsByRegion(intro.gaps), [intro.gaps]);
  const agentState = useMemo(
    () => buildAgentState(intro, selectedMoments, selectedPlanItems, visitChecks),
    [intro, selectedMoments, selectedPlanItems, visitChecks],
  );
  const visibleGapGroups = showAllGaps ? groupedGaps : groupedGaps.slice(0, 3);
  const hiddenGapCount = Math.max(intro.gaps.length - visibleGapGroups.reduce(
    (sum, group) => sum + group.moments.length,
    0,
  ), 0);

  return (
    <div className="space-y-2.5">
      {/* greeting */}
      <div className="flex justify-start">
        <div className="max-w-[86%] px-3 py-2 rounded-2xl rounded-bl-md text-[12.5px] leading-relaxed bg-[#FDF6EA] text-basalt border border-earth/60">
          {intro.greeting}
        </div>
      </div>

      <AgentDecisionPanel
        intro={intro}
        state={agentState}
        onAddHighlightToPlan={onAddHighlightToPlan}
        onOpenVerify={onOpenVerify}
        onShowGaps={() => {
          setShowAllGaps(true);
        }}
      />

      {/* 데이터 부족 조합: 접힌 브리핑 형태로 노출 */}
      {intro.gaps.length > 0 && (
        <div className="rounded-xl border border-dashed border-amber-300/70 bg-amber-50/60 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-amber-800 uppercase tracking-wider">
                <ListChecks className="w-3 h-3" />
                데이터가 부족한 조합
              </div>
              <p className="mt-1 text-[11px] text-basalt-2 leading-relaxed">
                “없다”는 뜻이 아니라, 저희가 참조하는 공공데이터 기준으로 아직 근거가 부족한 범위예요.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white border border-amber-200 px-2 py-0.5 text-[10px] text-amber-800 font-semibold">
              {intro.gaps.length}개
            </span>
          </div>

          <div className="space-y-1.5">
            {visibleGapGroups.map((group) => (
              <div key={group.region} className="rounded-lg bg-white/75 border border-amber-100 px-2.5 py-2">
                <div className="text-[11.5px] font-bold text-basalt">
                  {group.regionLabel}
                </div>
                <div className="mt-0.5 text-[11px] text-basalt-2 leading-relaxed">
                  {group.moments.join(' · ')}
                </div>
              </div>
            ))}
            {!showAllGaps && hiddenGapCount > 0 && (
              <div className="text-[10.5px] text-basalt-2/70 px-1">
                그 외 {hiddenGapCount}개 조합은 접어두었어요.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setShowAllGaps(false)}
              className="rounded-lg border border-earth bg-white px-2.5 py-1.5 text-[11px] font-serif-kr font-bold text-basalt-2 hover:bg-[#FDF6EA] transition"
            >
              확인 후보 먼저 보기
            </button>
            <button
              type="button"
              onClick={() => setShowAllGaps((v) => !v)}
              className="rounded-lg bg-amber-100/80 px-2.5 py-1.5 text-[11px] font-serif-kr font-bold text-amber-900 hover:bg-amber-100 transition"
            >
              {showAllGaps ? '요약만 보기' : '전체 조합 펼치기'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function groupGapsByRegion(gaps: import('../api').HarubanIntroGap[]) {
  const grouped = new Map<string, { region: string; regionLabel: string; moments: string[] }>();
  gaps.forEach((gap) => {
    const current = grouped.get(gap.region) ?? {
      region: gap.region,
      regionLabel: gap.region_label,
      moments: [],
    };
    if (!current.moments.includes(gap.moment_label)) {
      current.moments.push(gap.moment_label);
    }
    grouped.set(gap.region, current);
  });
  return Array.from(grouped.values());
}

interface AgentState {
  planCount: number;
  publicPlanCount: number;
  userAddedCount: number;
  missingMomentLabels: string[];
  matchedCount: number;
  changedCount: number;
  recommendedHighlight: import('../api').HarubanIntroHighlight | null;
  recommendedAlreadyInPlan: boolean;
  strongMomentLabels: string[];
  weakMomentLabels: string[];
}

function buildAgentState(
  intro: HarubanIntroResponse,
  selectedMoments: string[],
  selectedPlanItems: TravelPlanItem[],
  visitChecks: Record<string, VisitCheck>,
): AgentState {
  const planMomentSet = new Set(
    selectedPlanItems
      .filter((item) => item.source === 'public_data')
      .map((item) => item.moment),
  );
  const missingMomentLabels = selectedMoments
    .filter((moment) => !planMomentSet.has(moment))
    .map((moment) => MOMENTS.find((m) => m.id === moment)?.title ?? moment);
  const recommendedHighlight = intro.highlights.find((highlight) => {
    const planId = `public-${highlight.external_id}-${highlight.moment}`;
    return !selectedPlanItems.some((item) => item.id === planId);
  }) ?? null;
  const strongMomentLabels = Array.from(
    new Set(intro.highlights.map((highlight) => highlight.moment_label)),
  ).slice(0, 3);
  const weakMomentLabels = Array.from(
    new Set(intro.gaps.map((gap) => gap.moment_label)),
  ).slice(0, 3);

  return {
    planCount: selectedPlanItems.length,
    publicPlanCount: selectedPlanItems.filter((item) => item.source === 'public_data').length,
    userAddedCount: selectedPlanItems.filter((item) => item.source === 'user_added').length,
    missingMomentLabels,
    matchedCount: Object.values(visitChecks).filter((check) =>
      check.status === 'visited' || check.status === 'satisfied',
    ).length,
    changedCount: Object.values(visitChecks).filter((check) =>
      check.status === 'changed' || check.status === 'info_mismatch' || check.status === 'unsatisfied',
    ).length,
    recommendedHighlight,
    recommendedAlreadyInPlan: recommendedHighlight
      ? selectedPlanItems.some((item) => item.id === `public-${recommendedHighlight.external_id}-${recommendedHighlight.moment}`)
      : false,
    strongMomentLabels,
    weakMomentLabels,
  };
}

function planItemFromHighlight(highlight: import('../api').HarubanIntroHighlight): TravelPlanItem {
  return {
    id: `public-${highlight.external_id}-${highlight.moment}`,
    name: highlight.name,
    moment: highlight.moment,
    source: 'public_data',
    badge: highlight.badge === 'verified' || highlight.badge === 'caution' || highlight.badge === 'contradicted'
      ? highlight.badge
      : 'reference',
    external_id: highlight.external_id,
    region: highlight.region,
    address: highlight.address,
    note: highlight.note,
  };
}

function planItemFromWebCandidate(candidate: HarubanWebPlaceCandidate): TravelPlanItem {
  return {
    id: `web-${candidate.id}`,
    name: candidate.name,
    moment: candidate.moment || 'web_search',
    source: 'web_search',
    badge: 'reference',
    external_id: candidate.id,
    region: candidate.region || null,
    address: candidate.address ?? null,
    note: candidate.note ?? null,
    check_required: ['operating', 'web_source'],
    source_title: candidate.source_title,
    source_url: candidate.source_url,
    checked_at: candidate.checked_at,
    search_query: candidate.search_query,
  };
}

function AgentDecisionPanel({
  intro,
  state,
  onAddHighlightToPlan,
  onOpenVerify,
  onShowGaps,
}: {
  intro: HarubanIntroResponse;
  state: AgentState;
  onAddHighlightToPlan: (highlight: import('../api').HarubanIntroHighlight) => void;
  onOpenVerify: () => void;
  onShowGaps: () => void;
}) {
  const judgement = buildAgentJudgement(intro, state);
  const planHint = buildPlanHint(state);
  const nextAction = state.recommendedHighlight
    ? `${state.recommendedHighlight.moment_label} 후보 1곳을 먼저 담아보세요.`
    : state.missingMomentLabels.length > 0
      ? `${state.missingMomentLabels[0]} 후보를 하나 더 확인하면 플랜 균형이 좋아집니다.`
      : '이제 Day별 순서와 짐 목록을 맞추면 됩니다.';

  return (
    <div className="rounded-2xl border border-basalt/10 bg-gradient-to-br from-[#FFF9ED] via-white to-[#F3FBF7] p-3 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-citrus-2 uppercase tracking-[0.14em]">
            <Compass className="w-3 h-3" />
            하루방 판단
          </div>
          <p className="mt-1 font-serif-kr text-[15px] font-bold leading-snug text-basalt">
            {judgement.title}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white border border-earth px-2 py-0.5 text-[10px] font-bold text-basalt-2">
          플랜 {state.planCount}개
        </span>
      </div>

      <p className="rounded-xl border border-earth/80 bg-white/80 px-3 py-2.5 text-[12px] leading-relaxed text-basalt">
        {judgement.body}
      </p>

      <div className="grid grid-cols-1 gap-1.5">
        <InsightLine
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
          label="좋은 점"
          text={planHint.good}
          tone="good"
        />
        <InsightLine
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          label="보완점"
          text={planHint.gap}
          tone="warn"
        />
        <InsightLine
          icon={<PackageCheck className="w-3.5 h-3.5" />}
          label="다음 행동"
          text={nextAction}
          tone="next"
        />
      </div>

      {state.changedCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900 leading-relaxed">
          방문 후 정보가 달랐다고 표시한 항목이 {state.changedCount}개 있어요. 이 신호는 나중에 수정 요청 데이터로 분리해 쌓을 수 있습니다.
        </div>
      )}

      <div className="space-y-1.5">
        {state.recommendedHighlight && (
          <ActionButton
            icon={<Plus className="w-3.5 h-3.5" />}
            title={`${state.recommendedHighlight.name} 먼저 담기`}
            desc={`${state.recommendedHighlight.region_label}의 ${state.recommendedHighlight.moment_label} 후보라 현재 조건을 보완합니다`}
            disabled={state.recommendedAlreadyInPlan}
            onClick={() => onAddHighlightToPlan(state.recommendedHighlight!)}
          />
        )}
        {state.weakMomentLabels.length > 0 && (
          <ActionButton
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            title="확인 근거 약한 순간 보기"
            desc={`${state.weakMomentLabels.join(' · ')}은 담기 전 확인이 필요합니다`}
            onClick={onShowGaps}
          />
        )}
        {state.userAddedCount > 0 && (
          <ActionButton
            icon={<ShieldCheck className="w-3.5 h-3.5" />}
            title="직접 추가 장소 검증하기"
            desc="사용자가 적어둔 장소·메모를 리뷰 검증 화면에서 확인"
            onClick={onOpenVerify}
          />
        )}
      </div>
    </div>
  );
}

function buildAgentJudgement(
  intro: HarubanIntroResponse,
  state: AgentState,
): { title: string; body: string } {
  const strong = state.strongMomentLabels.join(' · ') || '선택한 순간';
  const weak = state.weakMomentLabels.join(' · ');

  if (intro.coverage.total <= 0) {
    return {
      title: '아직은 조건을 조금 좁혀야 해요.',
      body: '제주를 담다가 확인한 공공데이터 기준으로는 현재 조합에서 바로 추천할 후보가 약합니다. 지역이나 순간을 하나만 더 구체화하면 확인 가능한 후보를 다시 찾을 수 있어요.',
    };
  }

  if (weak) {
    return {
      title: `${strong}은 괜찮고, ${weak}은 확인이 필요해요.`,
      body: `현재 조건에서는 확인 후보 ${intro.coverage.total}곳이 잡혔지만, ${weak}은 근거가 약한 편입니다. 무리해서 채우기보다 확인된 후보부터 담고 부족한 순간만 따로 보는 흐름이 좋아요.`,
    };
  }

  return {
    title: `${strong} 중심으로 플랜을 짜기 좋아요.`,
    body: `현재 조건에서는 확인 후보 ${intro.coverage.total}곳이 잡혔고, 선택한 순간을 플랜으로 옮기기 좋은 상태입니다. 이제 동선이 가까운 후보부터 1~2곳만 담아도 여행팩의 뼈대가 생겨요.`,
  };
}

function buildPlanHint(state: AgentState): { good: string; gap: string } {
  const good = state.publicPlanCount > 0
    ? `확인된 공공데이터 후보 ${state.publicPlanCount}곳이 이미 플랜에 들어왔어요.`
    : state.strongMomentLabels.length > 0
      ? `${state.strongMomentLabels.join(' · ')} 쪽은 후보를 고르기 좋은 상태예요.`
      : '먼저 지역과 순간을 기준으로 확인 후보를 잡을 수 있어요.';

  const gap = state.missingMomentLabels.length > 0
    ? `${state.missingMomentLabels.slice(0, 3).join(' · ')}은 아직 플랜에 비어 있어요.`
    : state.weakMomentLabels.length > 0
      ? `${state.weakMomentLabels.join(' · ')}은 담기 전 확인 근거를 더 보는 게 좋아요.`
      : '선택한 순간은 채워졌으니 날씨와 동선 기준으로 순서를 맞추면 좋아요.';

  return { good, gap };
}

function InsightLine({
  icon,
  label,
  text,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  tone: 'good' | 'warn' | 'next';
}) {
  const toneClass = {
    good: 'border-mint/20 bg-mint/10 text-mint',
    warn: 'border-amber-200 bg-amber-50/80 text-amber-900',
    next: 'border-citrus/20 bg-citrus/10 text-citrus-2',
  }[tone];

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="text-[10px] font-bold">{label}</div>
          <div className="mt-0.5 text-[11.5px] leading-snug text-basalt">{text}</div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  title,
  desc,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-xl border border-earth bg-white px-3 py-2.5 text-left transition hover:border-citrus/50 hover:bg-orange-50/40 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-white disabled:hover:border-earth"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded-full bg-citrus/10 text-citrus-2 p-1">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-[12px] font-bold text-basalt">{title}</span>
          <span className="block mt-0.5 text-[10.5px] text-basalt-2 leading-snug">{desc}</span>
        </span>
      </div>
    </button>
  );
}

function SuggestionCard({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: HarubanFormSuggestion;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const fields: string[] = [];
  if (suggestion.regions?.length) fields.push(`지역: ${suggestion.regions.join(', ')}`);
  if (suggestion.companion) fields.push(`동행자: ${suggestion.companion}`);
  if (suggestion.purpose) fields.push(`목적: ${suggestion.purpose}`);
  if (suggestion.moments?.length) fields.push(`순간: ${suggestion.moments.join(', ')}`);
  if (typeof suggestion.days === 'number') fields.push(`기간: ${suggestion.days}일`);
  if (suggestion.start_date) fields.push(`시작일: ${suggestion.start_date}`);

  return (
    <div className="rounded-xl border-2 border-dashed border-citrus/50 bg-citrus/5 p-3 space-y-2">
      <div className="text-[10px] font-bold text-citrus-2 uppercase tracking-wider">
        하루방 에이전트의 폼 반영 제안
      </div>
      <p className="text-[11.5px] text-basalt leading-relaxed">{suggestion.reason}</p>
      {fields.length > 0 && (
        <div className="text-[11px] text-basalt-2 space-y-0.5">
          {fields.map((f, i) => (
            <div key={i}>· {f}</div>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onApply}
          className="flex-1 px-2.5 py-1.5 rounded-lg bg-citrus text-white text-[11.5px] font-serif-kr font-bold hover:bg-citrus-2 transition flex items-center justify-center gap-1"
        >
          <Check className="w-3 h-3" /> 반영
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-2.5 py-1.5 rounded-lg border border-earth bg-white text-basalt-2 text-[11.5px] hover:bg-black/5 transition"
        >
          안 할래요
        </button>
      </div>
    </div>
  );
}

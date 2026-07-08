import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Send,
  Loader2,
  Check,
  RefreshCcw,
  ShieldCheck,
  AlertTriangle,
  Database,
  Compass,
  ListChecks,
  Plus,
  Route,
  PackageCheck,
  ClipboardCheck,
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
  type HarubanChatMessage,
  type HarubanFormSuggestion,
  type HarubanIntroResponse,
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
  | { kind: 'assistant'; content: string }
  | { kind: 'intro'; intro: HarubanIntroResponse; formSnapshot: FormStateSnapshot };

interface FormStateSnapshot {
  regions: RegionId[];
  moments: MomentId[];
  companion: CompanionValue;
  purpose: PurposeValue;
  days: number;
  startDate: string;
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
  const [pendingSuggestion, setPendingSuggestion] =
    useState<HarubanFormSuggestion | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 임계 도달 1회 트리거 관리.
  //  - hasTriggeredRef: 임계 첫 충족 후 인사 준비를 이미 한 번 했는지.
  //  - lastIntroSnapshotRef: 마지막 intro 요청 당시의 폼 스냅샷 (변경 감지용).
  const hasTriggeredRef = useRef(false);
  const lastIntroSnapshotRef = useRef<FormStateSnapshot | null>(null);

  const currentSnapshot = useMemo(
    () => snapshotForm(info, selectedMomentIds),
    [info, selectedMomentIds],
  );

  const isThresholdMet =
    currentSnapshot.regions.length >= 1 && currentSnapshot.moments.length >= 1;

  const hasFormChangedSinceIntro =
    lastIntroSnapshotRef.current !== null &&
    isDifferentSnapshot(currentSnapshot, lastIntroSnapshotRef.current);

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
      return;
    }
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    void fetchIntro(currentSnapshot, { autoOpen: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isThresholdMet]);

  const fetchIntro = async (
    snap: FormStateSnapshot,
    { autoOpen }: { autoOpen: boolean },
  ) => {
    setError(null);
    setIntroLoading(true);
    try {
      const resp = await requestHarubanIntro(formStateForApi(snap));
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
      setError(e?.message || String(e));
    } finally {
      setIntroLoading(false);
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
        { kind: 'assistant', content: resp.reply_text },
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
            className="fixed bottom-[7.25rem] right-5 z-40 w-[390px] max-w-[calc(100vw-2.5rem)] h-[570px] max-h-[calc(100vh-8rem)] rounded-2xl bg-white shadow-2xl border-2 border-earth flex flex-col"
            id="haruban-panel"
          >
            {/* 헤더 */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-earth/60 bg-[#FDF6EA] rounded-t-2xl">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-white shadow-sm">
                <HarubangMark className="h-11 w-11" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-serif-kr font-bold text-[15px] text-basalt">하루방 에이전트</div>
                <div className="text-[10.5px] text-basalt-2/70 leading-tight">
                  gpt-5-mini 공공데이터 여행 조율
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
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
                  안녕하세요. 제주 여행 준비를 돕는 하루방 에이전트입니다.
                  <br />
                  질문을 주시면 gpt-5-mini가 의도를 먼저 해석하고, 필요한 공공데이터 근거를 확인해 답변드릴게요.
                  <br />
                  <span className="text-basalt-2/50">
                    장소명·개수·운영 정보는 조회된 근거 밖에서 지어내지 않습니다.
                  </span>
                </div>
              )}

              {entries.map((entry, i) => {
                if (entry.kind === 'user') {
                  return <MessageBubble key={i} role="user" content={entry.content} />;
                }
                if (entry.kind === 'assistant') {
                  if (!entry.content) return null;
                  return <MessageBubble key={i} role="assistant" content={entry.content} />;
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
                  <Loader2 className="w-3 h-3 animate-spin" /> gpt-5-mini가 공공데이터 근거를 확인하고 있어요...
                </div>
              )}
              {loading && (
                <div className="flex items-center gap-1.5 text-[11px] text-basalt-2/60 px-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> gpt-5-mini가 질문을 해석하고 근거를 확인 중이에요...
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[86%] px-3 py-2 rounded-2xl text-[12.5px] leading-relaxed ${
          isUser
            ? 'bg-citrus text-white rounded-br-md'
            : 'bg-[#FDF6EA] text-basalt border border-earth/60 rounded-bl-md'
        }`}
      >
        {content}
      </div>
    </div>
  );
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

      {/* 에이전트 브리핑 */}
      <div className="rounded-2xl border border-earth bg-white/80 p-3 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-citrus-2 uppercase tracking-wider">
            <Compass className="w-3 h-3" />
            Agent Briefing
          </div>
          <span className="text-[10px] text-basalt-2/60">
            선택 조건 기준
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <BriefingMetric
            icon={<Database className="w-3 h-3" />}
            label="확인 후보"
            value={`${intro.coverage.total}곳`}
            tone="verified"
          />
          <BriefingMetric
            icon={<ShieldCheck className="w-3 h-3" />}
            label="신뢰 신호"
            value={`${intro.coverage.verified}`}
            tone="verified"
          />
          <BriefingMetric
            icon={<AlertTriangle className="w-3 h-3" />}
            label="데이터 부족"
            value={`${intro.coverage.gap_combos}`}
            tone={intro.coverage.gap_combos > 0 ? 'gap' : 'quiet'}
          />
        </div>
        <p className="text-[11.5px] text-basalt-2 leading-relaxed">
          하루방은 장소를 다시 나열하지 않고, 현재 플랜에서 비어 있는 순간과 다음 행동을 정리합니다.
        </p>
      </div>

      <AgentPlannerPanel
        state={agentState}
        onAddHighlightToPlan={onAddHighlightToPlan}
        onOpenVerify={onOpenVerify}
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

function BriefingMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'verified' | 'gap' | 'quiet';
}) {
  const toneClass = {
    verified: 'border-mint/30 bg-mint/10 text-mint',
    gap: 'border-amber-200 bg-amber-50 text-amber-800',
    quiet: 'border-earth bg-[#FDF6EA] text-basalt-2',
  }[tone];

  return (
    <div className={`rounded-xl border px-2 py-2 ${toneClass}`}>
      <div className="flex items-center gap-1 text-[10px] font-semibold opacity-90">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-serif-kr text-[14px] font-bold leading-none">
        {value}
      </div>
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

function AgentPlannerPanel({
  state,
  onAddHighlightToPlan,
  onOpenVerify,
}: {
  state: AgentState;
  onAddHighlightToPlan: (highlight: import('../api').HarubanIntroHighlight) => void;
  onOpenVerify: () => void;
}) {
  return (
    <div className="rounded-2xl border border-basalt/10 bg-gradient-to-br from-[#FDFBF7] to-[#F4FBF8] p-3 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-basalt uppercase tracking-wider">
          <Route className="w-3 h-3 text-citrus-2" />
          Plan Coach
        </div>
        <span className="rounded-full bg-white border border-earth px-2 py-0.5 text-[10px] font-bold text-basalt-2">
          플랜 {state.planCount}개
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <CoachMetric label="공공 후보" value={`${state.publicPlanCount}`} tone="mint" />
        <CoachMetric label="사용자 메모" value={`${state.userAddedCount}`} tone="amber" />
        <CoachMetric label="확인 완료" value={`${state.matchedCount}`} tone="stone" />
      </div>

      <div className="rounded-xl border border-earth bg-white/75 p-2.5">
        <div className="flex items-start gap-2">
          <ClipboardCheck className="w-4 h-4 text-citrus-2 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-basalt">
              {state.missingMomentLabels.length > 0
                ? '아직 플랜에 비어 있는 순간이 있어요.'
                : '선택한 순간이 플랜에 들어오기 시작했어요.'}
            </p>
            <p className="mt-0.5 text-[11px] text-basalt-2 leading-relaxed">
              {state.missingMomentLabels.length > 0
                ? state.missingMomentLabels.slice(0, 3).join(' · ')
                : '이제 Day별 균형과 짐 목록을 함께 맞추면 됩니다.'}
            </p>
          </div>
        </div>
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
            title={`${state.recommendedHighlight.name} 담기`}
            desc={`${state.recommendedHighlight.region_label} · ${state.recommendedHighlight.moment_label} 후보를 내 플랜에 바로 추가`}
            disabled={state.recommendedAlreadyInPlan}
            onClick={() => onAddHighlightToPlan(state.recommendedHighlight!)}
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
        <ActionButton
          icon={<PackageCheck className="w-3.5 h-3.5" />}
          title="짐 목록은 플랜 기준으로 보기"
          desc="중앙의 내 플랜 맞춤 짐 섹션에 선택한 장소 유형이 반영됩니다"
          disabled
          onClick={() => {}}
        />
      </div>
    </div>
  );
}

function CoachMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'mint' | 'amber' | 'stone';
}) {
  const toneClass = {
    mint: 'text-mint bg-mint/10 border-mint/20',
    amber: 'text-amber-800 bg-amber-50 border-amber-100',
    stone: 'text-basalt-2 bg-white border-earth',
  }[tone];
  return (
    <div className={`rounded-xl border px-2 py-2 ${toneClass}`}>
      <div className="text-[9.5px] font-semibold opacity-80">{label}</div>
      <div className="font-serif-kr text-[15px] font-bold leading-none mt-0.5">{value}</div>
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

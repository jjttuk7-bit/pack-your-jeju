import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Loader2, Check, RefreshCcw, ShieldCheck, AlertTriangle, ChevronDown } from 'lucide-react';
import HarubangMark from './marks/HarubangMark';
import type { TravelInfo, MomentId, RegionId, CompanionValue, PurposeValue } from '../types';
import {
  requestHarubanChat,
  requestHarubanIntro,
  type HarubanChatMessage,
  type HarubanFormSuggestion,
  type HarubanIntroResponse,
} from '../api';
import PlaceDetail from './PlaceDetail';

interface HarubanChatProps {
  info: TravelInfo;
  selectedMomentIds: MomentId[];
  onApplySuggestion: (
    info: Partial<TravelInfo>,
    selectedMoments: MomentId[] | null,
  ) => void;
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
 *  - 폼에서 지역+순간이 최초로 하나 이상씩 채워지면 하루방이 스스로 팝업 + 인사.
 *  - 인사에는 저희 데이터로 확인된 하이라이트 카드 리스트가 붙는다 (배지·주소·근거 URL).
 *  - 이후 폼이 바뀌면 채팅창 하단에 "다시 물어볼까요?" 재요청 인라인 버튼.
 *  - 사용자 자유 발화는 기존 /agent/chat 도구 루프로 유지.
 */
export default function HarubanChat({
  info,
  selectedMomentIds,
  onApplySuggestion,
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
  //  - hasTriggeredRef: 임계 첫 충족 후 자동 팝업/인사를 이미 한 번 냈는지.
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

  // 임계 최초 도달 시 하루방 자동 인사.
  useEffect(() => {
    if (!isThresholdMet) {
      // 폼이 미달로 돌아가면 다음 도달 시 다시 자동 인사할 수 있게 flag 리셋.
      hasTriggeredRef.current = false;
      lastIntroSnapshotRef.current = null;
      return;
    }
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    void fetchIntro(currentSnapshot, { autoOpen: true });
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
            : `하루방이 답을 못 드렸어요: ${resp.reason || 'unknown'}`,
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
            ? '하루방은 아직 잠들어 있어요. 곧 깨어날게요.'
            : `하루방이 답을 못 드렸어요: ${resp.reason || 'unknown'}`,
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

  // 하이라이트 카드에서 "이 곳 폼에 넣기"를 눌렀을 때: 지역+순간을 폼에 합치는 제안.
  // 이미 둘 다 있으면 상태가 그대로라 대시보드 재조립이 안 트리거 — 눈에 안 보이는 상태 방지 위해
  // 실제로 변화가 생기는 경우에만 setState + 안내. 없으면 "이미 반영되어 있어요"로 사용자에게 명시.
  const applyHighlightToForm = (regionId: string, momentId: string) => {
    const existingRegions = info.regions ?? [];
    const existingMoments = selectedMomentIds;
    const regionAlreadyIn = existingRegions.includes(regionId as RegionId);
    const momentAlreadyIn = existingMoments.includes(momentId as MomentId);

    if (regionAlreadyIn && momentAlreadyIn) {
      setEntries((prev) => [
        ...prev,
        { kind: 'assistant', content: '이 조건은 이미 폼에 있어요. 대시보드에서 확인해 주세요.' },
      ]);
      return;
    }

    const nextRegions = regionAlreadyIn
      ? existingRegions
      : ([...existingRegions, regionId] as RegionId[]);
    const nextMoments = momentAlreadyIn
      ? existingMoments
      : ([...existingMoments, momentId] as MomentId[]);
    onApplySuggestion({ regions: nextRegions }, nextMoments);

    const added: string[] = [];
    if (!regionAlreadyIn) added.push('지역');
    if (!momentAlreadyIn) added.push('순간');
    setEntries((prev) => [
      ...prev,
      { kind: 'assistant', content: `폼에 ${added.join('·')} 반영했어요.` },
    ]);
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        type="button"
        id="haruban-fab"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 w-16 h-16 rounded-full bg-white/95 backdrop-blur-sm shadow-jeju-chip border-2 border-earth flex items-center justify-center hover:-translate-y-0.5 transition"
        aria-label="하루방 열기"
      >
        <HarubangMark className="w-12 h-12" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="haruban-panel"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-5 z-40 w-[380px] max-w-[calc(100vw-2.5rem)] h-[560px] max-h-[calc(100vh-8rem)] rounded-2xl bg-white shadow-2xl border-2 border-earth flex flex-col"
            id="haruban-panel"
          >
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-earth/60 bg-[#FDF6EA] rounded-t-2xl">
              <HarubangMark className="w-8 h-8" />
              <div className="flex-1 min-w-0">
                <div className="font-serif-kr font-bold text-[14px] text-basalt">하루방</div>
                <div className="text-[10px] text-basalt-2/70 leading-tight">
                  제주 여행길 지킴이
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
                  안녕하세요. 제주 여행 준비를 돕는 하루방입니다.
                  <br />
                  아래 폼에서 <b>지역</b>과 <b>순간</b>을 골라주시면, 저희 데이터로 확인된 곳들을
                  먼저 보여드릴게요.
                  <br />
                  <span className="text-basalt-2/50">
                    저희는 공공데이터로 확인된 것만 말씀드려요. 지어내지 않아요.
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
                    currentRegions={currentSnapshot.regions}
                    currentMoments={currentSnapshot.moments}
                    onPickHighlight={applyHighlightToForm}
                  />
                );
              })}

              {introLoading && (
                <div className="flex items-center gap-1.5 text-[11px] text-basalt-2/60 px-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> 하루방이 저희 데이터를 뒤지고 있어요...
                </div>
              )}
              {loading && (
                <div className="flex items-center gap-1.5 text-[11px] text-basalt-2/60 px-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> 하루방이 확인 중이에요...
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
                  placeholder="예: 부모님이랑 가면 오름은 좀 부담스러울까요?"
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

// ── 인사 블록: greeting 말풍선 + 하이라이트 카드 리스트 + gaps 섹션 ──
function IntroBlock({
  intro,
  currentRegions,
  currentMoments,
  onPickHighlight,
}: {
  intro: HarubanIntroResponse;
  currentRegions: string[];
  currentMoments: string[];
  onPickHighlight: (regionId: string, momentId: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      {/* greeting */}
      <div className="flex justify-start">
        <div className="max-w-[86%] px-3 py-2 rounded-2xl rounded-bl-md text-[12.5px] leading-relaxed bg-[#FDF6EA] text-basalt border border-earth/60">
          {intro.greeting}
        </div>
      </div>

      {/* 커버리지 요약 (근거 있는 신호) */}
      <div className="text-[10.5px] text-basalt-2/70 px-1 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>저희 데이터 확인 {intro.coverage.total}곳</span>
        <span className="text-mint">· verified {intro.coverage.verified}</span>
        {intro.coverage.caution > 0 && (
          <span className="text-amber-700">· caution {intro.coverage.caution}</span>
        )}
        {intro.coverage.gap_combos > 0 && (
          <span className="text-basalt-2/60">
            · 확인 안 된 조합 {intro.coverage.gap_combos}
          </span>
        )}
      </div>

      {/* 하이라이트 카드 */}
      {intro.highlights.length > 0 && (
        <div className="space-y-2">
          {intro.highlights.map((h) => {
            const regionIn = currentRegions.includes(h.region);
            const momentIn = currentMoments.includes(h.moment);
            const alreadyInForm = regionIn && momentIn;
            return (
              <HighlightCard
                key={h.external_id}
                highlight={h}
                alreadyInForm={alreadyInForm}
                onPick={() => onPickHighlight(h.region, h.moment)}
              />
            );
          })}
        </div>
      )}

      {/* gaps: 정직 UX 마감 */}
      {intro.gaps.length > 0 && (
        <div className="rounded-xl border border-dashed border-basalt-2/30 bg-white/60 p-3 space-y-1.5">
          <div className="text-[10.5px] font-bold text-basalt-2/80 uppercase tracking-wider">
            아직 확인되지 않은 조합
          </div>
          {intro.gaps.map((g, i) => (
            <div key={i} className="text-[11.5px] text-basalt-2 leading-relaxed">
              · {g.note}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HighlightCard({
  highlight,
  alreadyInForm,
  onPick,
}: {
  highlight: import('../api').HarubanIntroHighlight;
  alreadyInForm: boolean;
  onPick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isVerified = highlight.badge === 'verified';
  const isCaution = highlight.badge === 'caution';
  const badgeStyle = isVerified
    ? 'bg-mint/10 text-mint border-mint/40'
    : isCaution
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-basalt-2/10 text-basalt-2 border-basalt-2/30';
  const BadgeIcon = isCaution ? AlertTriangle : ShieldCheck;
  const badgeLabel = isVerified ? '확인됨' : isCaution ? '주의' : highlight.badge;

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm transition ${
        open ? 'border-citrus/40' : 'border-earth/70'
      }`}
    >
      {/* 헤더 — 클릭 시 확장 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left p-3 space-y-1.5 focus:outline-none focus:ring-2 focus:ring-citrus/30 rounded-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-basalt-2/70 mb-0.5">
              {highlight.region_label} · {highlight.moment_label}
            </div>
            <div className="font-serif-kr font-bold text-[13.5px] text-basalt leading-snug break-keep">
              {highlight.name}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${badgeStyle}`}
            >
              <BadgeIcon className="w-2.5 h-2.5" />
              {badgeLabel}
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-basalt-2/60 transition-transform ${
                open ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>

        {highlight.address && (
          <div className="text-[11px] text-basalt-2 leading-snug break-keep">
            {highlight.address}
          </div>
        )}

        {highlight.reason && (
          <div className="text-[11px] text-basalt leading-relaxed border-l-2 border-citrus/40 pl-2 mt-1">
            {highlight.reason}
          </div>
        )}

        {!open && (
          <div className="text-[10px] text-citrus-2/80 font-semibold pt-0.5">
            자세히 보기 →
          </div>
        )}
      </button>

      {/* 확장 상세 — 근거 있는 값만. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-earth/50">
              <PlaceDetail
                externalId={highlight.external_id}
                address={highlight.address}
                category={highlight.category}
                amenities={highlight.amenities}
                freshness={highlight.freshness}
                transit={highlight.transit}
                hygieneGrade={highlight.hygiene_grade}
                note={highlight.note}
                sources={highlight.sources}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 액션 라인 — 항상 노출 */}
      <div className="flex items-center gap-2 px-3 pb-3">
        {alreadyInForm ? (
          <span className="text-[11px] px-2 py-1 rounded-md bg-mint/10 text-mint border border-mint/40 inline-flex items-center gap-1">
            <Check className="w-3 h-3" />
            이미 폼에 있어요
          </span>
        ) : (
          <button
            type="button"
            onClick={onPick}
            className="text-[11px] px-2 py-1 rounded-md bg-citrus text-white hover:bg-citrus-2 transition inline-flex items-center gap-1"
          >
            <Check className="w-3 h-3" />
            이 조건 폼에 반영
          </button>
        )}
      </div>
    </div>
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
        하루방의 폼 반영 제안
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

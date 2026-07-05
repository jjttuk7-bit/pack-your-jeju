import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Loader2, Check } from 'lucide-react';
import HarubangMark from './marks/HarubangMark';
import type { TravelInfo, MomentId, RegionId, CompanionValue, PurposeValue } from '../types';
import {
  requestHarubanChat,
  type HarubanChatMessage,
  type HarubanFormSuggestion,
} from '../api';

interface HarubanChatProps {
  info: TravelInfo;
  selectedMomentIds: MomentId[];
  onApplySuggestion: (
    info: Partial<TravelInfo>,
    selectedMoments: MomentId[] | null,
  ) => void;
}

/**
 * 하루방 챗 위젯 — 우측 하단 플로팅.
 * 사용자 폼 상태를 매 요청에 담아 보내 컨텍스트를 알려준다.
 * LLM 미가용 시(OPENAI_API_KEY 없음) 안전판 안내.
 */
export default function HarubanChat({
  info,
  selectedMomentIds,
  onApplySuggestion,
}: HarubanChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<HarubanChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSuggestion, setPendingSuggestion] =
    useState<HarubanFormSuggestion | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 새 메시지 도착 시 아래로 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingSuggestion, loading]);

  const send = async () => {
    const t = input.trim();
    if (!t || loading) return;
    setError(null);
    setPendingSuggestion(null);
    const newMessages: HarubanChatMessage[] = [
      ...messages,
      { role: 'user', content: t },
    ];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const formState = {
        regions: info.regions,
        start_date: info.startDate,
        days: info.durationDays,
        companion: info.companion,
        purpose: info.purpose,
        moments: selectedMomentIds,
      };
      const resp = await requestHarubanChat(newMessages, formState);
      if (!resp.available) {
        setError(
          resp.reason?.includes('OPENAI_API_KEY')
            ? '하루방은 아직 잠들어 있어요. 곧 깨어날게요.'
            : `하루방이 답을 못 드렸어요: ${resp.reason || 'unknown'}`,
        );
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: resp.reply_text },
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
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '반영했어요. 폼에서 확인해 주세요.' },
    ]);
  };

  const dismissSuggestion = () => setPendingSuggestion(null);

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
            className="fixed bottom-24 right-5 z-40 w-[340px] max-w-[calc(100vw-2.5rem)] h-[500px] max-h-[calc(100vh-8rem)] rounded-2xl bg-white shadow-2xl border-2 border-earth flex flex-col"
            id="haruban-panel"
          >
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-earth/60 bg-[#FDF6EA] rounded-t-2xl">
              <HarubangMark className="w-8 h-8" />
              <div className="flex-1 min-w-0">
                <div className="font-serif-kr font-bold text-[14px] text-basalt">하루방</div>
                <div className="text-[10px] text-basalt-2/70 leading-tight">
                  정직한 제주 여행 도우미
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
              {messages.length === 0 && (
                <div className="text-[12px] text-basalt-2/70 leading-relaxed px-1">
                  안녕하세요. 제주 여행 준비를 돕는 하루방입니다.
                  <br />
                  아래 폼을 채우다가 궁금한 게 있으면 저에게 물어봐 주세요.
                  <br />
                  <span className="text-basalt-2/50">
                    저는 저희 공공데이터로 확인된 것만 말씀드려요. 지어내지 않아요.
                  </span>
                </div>
              )}
              {messages.map((m, i) => (
                <MessageBubble key={i} msg={m} />
              ))}
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
                  placeholder="예: 부모님이랑 힐링이면 어느 지역이 좋을까요?"
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

function MessageBubble({ msg }: { msg: HarubanChatMessage }) {
  if (msg.role === 'tool') return null;  // 사용자 화면에 도구 결과는 숨김
  if (msg.role === 'assistant' && !msg.content) return null;
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[86%] px-3 py-2 rounded-2xl text-[12.5px] leading-relaxed ${
          isUser
            ? 'bg-citrus text-white rounded-br-md'
            : 'bg-[#FDF6EA] text-basalt border border-earth/60 rounded-bl-md'
        }`}
      >
        {msg.content}
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

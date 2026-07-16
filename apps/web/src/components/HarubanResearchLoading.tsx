import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Compass, Search, Sparkles } from 'lucide-react';
import HarubangMark from './marks/HarubangMark';

const EXPAND_AFTER_SECONDS = 8;
const GUIDE_INTERVAL_SECONDS = 4;
const TIP_INTERVAL_SECONDS = 5;

const RESEARCH_GUIDES = [
  '질문에 담긴 지역과 여행 취향을 읽고 있어요',
  '공식·플랫폼·경험 출처를 폭넓게 살펴보고 있어요',
  '서로 다른 정보를 나란히 비교하고 있어요',
  '확인한 근거를 여행자가 읽기 쉽게 정리하고 있어요',
] as const;

const JEJU_TIPS = [
  '제주에서는 같은 지역도 해안과 중산간의 날씨가 다를 수 있어요.',
  '바람이 강한 날에는 우산보다 가벼운 우비가 편할 때가 많아요.',
  '인기 장소는 운영시간뿐 아니라 마지막 입장 시간도 함께 확인해 보세요.',
  '이동 시간을 잡을 때는 지도 거리보다 제주 도로의 실제 흐름을 여유 있게 보세요.',
  '여행 중 발견한 변경 정보는 다음 여행자의 더 나은 근거가 될 수 있어요.',
] as const;

function secondsSince(startedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function SearchingDots({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-citrus/75"
          animate={reduceMotion ? undefined : { opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{
            duration: 1.2,
            delay: index * 0.18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  );
}

function JejuResearchRoute({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div
      className="relative h-[58px] overflow-hidden rounded-2xl border border-white/65 bg-white/45"
      aria-hidden="true"
    >
      <div className="absolute -left-5 top-6 h-12 w-20 rounded-[55%_45%_50%_50%] bg-mint/10 blur-sm" />
      <div className="absolute -right-4 -top-4 h-16 w-24 rounded-full bg-citrus/10 blur-md" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 58" fill="none">
        <path
          d="M18 40 C54 7 92 52 128 25 C165 -2 196 44 232 22 C260 5 282 15 304 8"
          stroke="#8BB5A7"
          strokeWidth="2"
          strokeDasharray="4 6"
          strokeLinecap="round"
        />
        <circle cx="18" cy="40" r="3" fill="#EF5B2A" opacity="0.45" />
        <circle cx="304" cy="8" r="3" fill="#4B8A78" opacity="0.55" />
        <motion.circle
          r="4.5"
          fill="#EF5B2A"
          stroke="#FFF7EB"
          strokeWidth="3"
          initial={{ cx: 18, cy: 40 }}
          animate={reduceMotion ? { cx: 160, cy: 28 } : {
            cx: [18, 74, 128, 184, 232, 272, 304],
            cy: [40, 24, 25, 22, 22, 13, 8],
          }}
          transition={{
            duration: 5.6,
            repeat: reduceMotion ? 0 : Infinity,
            ease: 'easeInOut',
          }}
        />
      </svg>
      <div className="absolute left-4 top-2 flex items-center gap-1 text-[9px] font-bold tracking-[0.14em] text-mint">
        <Compass className="h-3 w-3" />
        JEJU RESEARCH TRAIL
      </div>
      <Search className="absolute bottom-2 right-4 h-3.5 w-3.5 text-citrus/70" />
    </div>
  );
}

export default function HarubanResearchLoading({ startedAt }: { startedAt: number }) {
  const shouldReduceMotion = useReducedMotion();
  const reduceMotion = Boolean(shouldReduceMotion);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => secondsSince(startedAt));

  useEffect(() => {
    setElapsedSeconds(secondsSince(startedAt));
    const timer = window.setInterval(
      () => setElapsedSeconds(secondsSince(startedAt)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const expanded = elapsedSeconds >= EXPAND_AFTER_SECONDS;
  const guideIndex =
    Math.floor(elapsedSeconds / GUIDE_INTERVAL_SECONDS) % RESEARCH_GUIDES.length;
  const tipIndex = Math.floor(elapsedSeconds / TIP_INTERVAL_SECONDS) % JEJU_TIPS.length;

  return (
    <motion.section
      layout={!reduceMotion}
      role="status"
      aria-live="polite"
      aria-label={
        expanded
          ? '하루방 에이전트가 웹 출처를 조사하고 답변을 정리하고 있습니다.'
          : '하루방 에이전트가 질문을 살펴보고 있습니다.'
      }
      className="relative overflow-hidden rounded-[22px] border border-citrus/20 bg-[linear-gradient(145deg,rgba(255,250,240,0.98),rgba(247,239,221,0.96))] px-3.5 py-3 shadow-[0_12px_30px_rgba(91,70,43,0.10)]"
      transition={{ layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-9 h-24 w-24 rounded-full border border-citrus/10 bg-citrus/5"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-10 -left-8 h-24 w-28 rounded-[48%] bg-mint/5"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-3">
        <motion.div
          animate={reduceMotion ? undefined : { y: [0, -3, 0], rotate: [0, -1.5, 0, 1.5, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          className="relative shrink-0"
          aria-hidden="true"
        >
          <div className="absolute inset-1 rounded-full bg-white/75 blur-[1px]" />
          <HarubangMark className="relative h-11 w-11 drop-shadow-sm" />
        </motion.div>

        <div className="min-w-0 flex-1" aria-hidden="true">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black tracking-[0.14em] text-citrus-2">
              HARUBANG RESEARCH
            </span>
            <SearchingDots reduceMotion={reduceMotion} />
          </div>
          <p className="mt-1 text-[11.5px] font-bold leading-relaxed text-basalt">
            질문에 담긴 여행 조건을 살펴보고 있어요
          </p>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="research-details"
            initial={reduceMotion ? false : { opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
            aria-hidden="true"
          >
            <div className="mt-3 border-t border-earth/50 pt-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11.5px] font-extrabold leading-relaxed text-basalt">
                  {elapsedSeconds}초째 제주 곳곳의 근거를 살펴보고 있어요
                </p>
                <span className="shrink-0 rounded-full border border-mint/20 bg-mint/10 px-2 py-1 text-[8.5px] font-black tracking-[0.1em] text-mint">
                  LIVE
                </span>
              </div>

              <div className="mt-2.5">
                <JejuResearchRoute reduceMotion={reduceMotion} />
              </div>

              <div className="mt-2.5 grid gap-2">
                <div className="rounded-2xl border border-mint/15 bg-white/55 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[9px] font-black tracking-[0.12em] text-mint">
                    <Search className="h-3 w-3" />
                    조사 중 안내
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={guideIndex}
                      initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
                      transition={{ duration: 0.24 }}
                      className="mt-1.5 text-[10.5px] font-semibold leading-relaxed text-basalt-2"
                    >
                      {RESEARCH_GUIDES[guideIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>

                <div className="rounded-2xl border border-citrus/15 bg-citrus/[0.06] px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[9px] font-black tracking-[0.1em] text-citrus-2">
                    <Sparkles className="h-3 w-3" />
                    기다리는 동안 제주 한 조각
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={tipIndex}
                      initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
                      transition={{ duration: 0.24 }}
                      className="mt-1.5 text-[10.5px] leading-relaxed text-basalt-2"
                    >
                      {JEJU_TIPS[tipIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

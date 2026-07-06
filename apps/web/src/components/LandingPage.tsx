import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ShieldCheck, Sparkles, MapPin } from 'lucide-react';
import CitrusMark from './marks/CitrusMark';
import WaveLine from './marks/WaveLine';
import StoneWallPattern from './marks/StoneWallPattern';

// 시연용 문지기 — 진짜 보안이 아니라 발표 사전 접근 제어.
// 로그인 계정 시스템은 원 스코프 밖 (CLAUDE.md 스코프 가드).
const DEMO_PASSCODE = '123456';

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [entering, setEntering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entering) return;
    if (code.trim() === DEMO_PASSCODE) {
      setError(null);
      setEntering(true);
      // 짧은 진입 애니메이션 후 실제 앱으로.
      setTimeout(() => onEnter(), 380);
      return;
    }
    setError('접근 코드가 맞지 않아요. 다시 확인해 주세요.');
    setShake(true);
    setTimeout(() => setShake(false), 420);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative">
      {/* 하단 돌담 패턴 (기존 서비스 톤 재사용) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-40 -z-10 opacity-70">
        <StoneWallPattern className="w-full h-full" />
      </div>

      <AnimatePresence>
        {!entering && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-md"
          >
            {/* 헤더 브랜딩 */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.7, rotate: -12 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.65, type: 'spring' }}
                className="inline-block mb-3"
              >
                <CitrusMark className="w-[84px] h-[84px]" />
              </motion.div>
              <p className="text-[10px] font-bold text-citrus-2 tracking-[0.2em] uppercase mb-1.5">
                제주 · 신뢰 여행 준비
              </p>
              <h1 className="font-serif-kr text-[38px] font-bold text-basalt tracking-tight leading-[1.05]">
                Pack Your Jeju
              </h1>
              <p className="text-[11.5px] text-basalt-2 mt-2 font-medium tracking-wide">
                혼저옵서예. 짐 싸기 전에 확인부터.
              </p>
              <WaveLine className="w-full h-5 mt-4" />
            </div>

            {/* 한 문장 원칙 */}
            <div className="rounded-3xl bg-white/80 backdrop-blur border border-orange-100/60 shadow-pyj-card p-5 mb-4">
              <p className="font-serif-kr text-[15px] text-basalt leading-[1.85]">
                우리는 <span className="text-citrus-2 font-bold">근거 있는 것만</span> 담습니다.<br />
                없는 것은 <span className="text-mint font-bold">있는 그대로</span> 남겨둡니다.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <TinyPill icon={<ShieldCheck className="w-2.5 h-2.5" />} label="근거 검증" />
                <TinyPill icon={<Sparkles className="w-2.5 h-2.5" />} label="공공데이터" />
                <TinyPill icon={<MapPin className="w-2.5 h-2.5" />} label="제주 특화" />
              </div>
            </div>

            {/* 코드 입력 */}
            <motion.form
              onSubmit={handleSubmit}
              animate={shake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.42 }}
              className="rounded-3xl bg-white border border-orange-100/60 shadow-pyj-card p-5 space-y-3"
              id="landing-gate"
            >
              <div>
                <label
                  htmlFor="passcode"
                  className="block text-[10.5px] font-bold text-basalt-2/70 uppercase tracking-wider mb-2"
                >
                  접근 코드
                </label>
                <input
                  id="passcode"
                  ref={inputRef}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="발표 초대 코드"
                  maxLength={20}
                  className="w-full px-4 py-3 rounded-2xl border border-earth bg-[#FDFBF7] text-basalt text-[16px] tracking-[0.35em] font-serif-kr text-center focus:outline-none focus:ring-2 focus:ring-citrus/30 focus:border-citrus transition"
                />
              </div>
              {error && (
                <p className="text-[11.5px] text-rose-700 leading-relaxed px-1">{error}</p>
              )}
              <button
                type="submit"
                disabled={code.length === 0 || entering}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-citrus text-white font-serif-kr font-bold text-[14px] hover:bg-citrus-2 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-jeju-chip"
              >
                <span>여행 준비 시작하기</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-center text-[10px] text-basalt-2/60 leading-snug pt-1">
                * 아이펠톤 발표 시연용 초대 페이지입니다.
              </p>
            </motion.form>

            <p className="text-center text-[10px] text-basalt-2/50 mt-5">
              © 2026 Pack Your Jeju
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 진입 전환 애니메이션 */}
      <AnimatePresence>
        {entering && (
          <motion.div
            key="entering"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 flex items-center justify-center bg-[#FBF6EA] z-50"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.6, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.4, type: 'spring' }}
              >
                <CitrusMark className="w-[70px] h-[70px] mx-auto mb-3" />
              </motion.div>
              <p className="font-serif-kr text-[16px] text-basalt-2">
                혼저옵서예. 짐부터 확인해 볼까요?
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TinyPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1 py-1 rounded-full bg-[#FDF6EA] border border-earth/70 text-[10px] font-semibold text-basalt-2">
      <span className="text-citrus-2">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

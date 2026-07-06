import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  MapPin,
  Package,
  MessageCircleQuestion,
  BookOpenCheck,
  Search,
} from 'lucide-react';
import CitrusMark from './marks/CitrusMark';
import WaveLine from './marks/WaveLine';
import StoneWallPattern from './marks/StoneWallPattern';

// 시연용 문지기 — 진짜 보안이 아니라 발표 사전 접근 제어.
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
    // 페이지 진입 시 자동 포커스는 하지 않는다 — 사용자가 먼저 서비스 설명을
    // 읽도록 유도. 코드 필드로 스크롤은 CTA 클릭이 담당.
  }, []);

  const scrollToGate = () => {
    document.getElementById('landing-gate')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    setTimeout(() => inputRef.current?.focus(), 350);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entering) return;
    if (code.trim() === DEMO_PASSCODE) {
      setError(null);
      setEntering(true);
      setTimeout(() => onEnter(), 380);
      return;
    }
    setError('접근 코드가 맞지 않아요. 다시 확인해 주세요.');
    setShake(true);
    setTimeout(() => setShake(false), 420);
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 relative">
      {/* 하단 돌담 패턴 */}
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
            className="w-full max-w-md space-y-6"
          >
            {/* ── 헤더 브랜딩 ─────────────────────────────── */}
            <section className="text-center pt-2">
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
            </section>

            {/* ── 원칙 카드 ──────────────────────────────── */}
            <section className="rounded-3xl bg-white/80 backdrop-blur border border-orange-100/60 shadow-pyj-card p-5">
              <p className="font-serif-kr text-[15.5px] text-basalt leading-[1.85]">
                우리는 <span className="text-citrus-2 font-bold">근거 있는 것만</span> 담습니다.
                <br />
                없는 것은 <span className="text-mint font-bold">있는 그대로</span> 남겨둡니다.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <TinyPill icon={<ShieldCheck className="w-2.5 h-2.5" />} label="근거 검증" />
                <TinyPill icon={<Sparkles className="w-2.5 h-2.5" />} label="공공데이터" />
                <TinyPill icon={<MapPin className="w-2.5 h-2.5" />} label="제주 특화" />
              </div>
            </section>

            {/* ── 문제 정의 (킥3 오프닝 통계) ──────────────── */}
            <section className="rounded-3xl bg-basalt text-white p-5 relative overflow-hidden">
              <div className="relative z-10">
                <div className="text-[10px] font-bold text-citrus tracking-[0.2em] uppercase mb-2">
                  왜 새 서비스가 필요할까요
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-serif-kr text-[38px] font-bold text-citrus leading-none">
                    1,686
                  </span>
                  <span className="text-[13px] text-white/85">건</span>
                </div>
                <p className="text-[12px] leading-relaxed text-white/85">
                  제주 공식 관광 포털에 이용자가 접수한{' '}
                  <span className="text-citrus font-bold">정보 정정 요청</span> 건수입니다.
                  <br />
                  <span className="text-white/70">폐업 · 이전 · 시간 변경 · 주소 오류 …</span>
                </p>
                <p className="text-[12px] text-white/85 mt-3 leading-relaxed">
                  공식 데이터조차 이 속도로 낡습니다.
                  <br />
                  <span className="text-citrus font-bold">
                    그래서 저희는 짐 싸기 앱에 신뢰 엔진을 심었습니다.
                  </span>
                </p>
              </div>
              {/* 배경 도트 */}
              <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-citrus/10" />
              <div className="absolute -right-16 -top-6 w-24 h-24 rounded-full bg-mint/10" />
            </section>

            {/* ── 서비스 소개 카드 4개 ──────────────────── */}
            <section className="space-y-3">
              <div className="text-[10.5px] font-bold text-basalt-2/70 uppercase tracking-wider px-1">
                이 서비스가 하는 일
              </div>

              <FeatureCard
                icon={<Package className="w-4 h-4" />}
                title="근거 있는 팩 조립"
                body="지역·기간·동행자·순간을 고르면 공공데이터로 검증된 장소만 요일별로 담아 드립니다."
                tone="citrus"
              />
              <FeatureCard
                icon={<MessageCircleQuestion className="w-4 h-4" />}
                title="하루방 상담사"
                body="폼 옆에 늘 있는 캐릭터. 지역·순간을 고르면 스스로 인사하며 저희 데이터로 확인된 곳을 먼저 브리핑합니다."
                tone="mint"
              />
              <FeatureCard
                icon={<Search className="w-4 h-4" />}
                title="리뷰 팩트체크"
                body="블로그·리뷰 문장을 붙여넣으면 저희 데이터로 문장별 검증. 폐업이 확인되면 확인됐다고 알려 드립니다."
                tone="amber"
              />
              <FeatureCard
                icon={<BookOpenCheck className="w-4 h-4" />}
                title="여행 저널 저장"
                body="완성된 팩을 감성 톤 PDF로 저장. 표지 · 요일별 카드 · 근거 링크 · 확인되지 않은 조합까지 담습니다."
                tone="basalt"
              />
            </section>

            {/* ── 데이터 스택 숫자 ─────────────────────── */}
            <section className="rounded-3xl bg-white border border-orange-100/60 shadow-pyj-card p-5">
              <div className="text-[10.5px] font-bold text-basalt-2/70 uppercase tracking-wider mb-3">
                저희가 참조하는 데이터
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatBlock big="4,422" label="관광지 · 카페 · 음식점" />
                <StatBlock big="977" label="실제 사진 · 태그 (제주 ITS)" />
                <StatBlock big="5,828" label="주차장 · 정류장" />
                <StatBlock big="12 / 12" label="골든셋 게이트 통과" tone="mint" />
              </div>
              <p className="text-[10.5px] text-basalt-2/60 leading-relaxed mt-3 px-0.5">
                비짓제주 · 공공데이터포털 · 국토부 TAGO · 제주 ITS 센터
              </p>
            </section>

            {/* ── CTA 안내 ────────────────────────────── */}
            <button
              type="button"
              onClick={scrollToGate}
              className="w-full py-3 rounded-2xl border border-citrus/40 bg-citrus/5 text-citrus-2 text-[13px] font-serif-kr font-bold hover:bg-citrus/10 transition inline-flex items-center justify-center gap-1.5"
            >
              접근 코드로 여행 준비 시작하기
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* ── 코드 입력 폼 ─────────────────────────── */}
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

            <p className="text-center text-[10px] text-basalt-2/50 pb-4">
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

function FeatureCard({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: 'citrus' | 'mint' | 'amber' | 'basalt';
}) {
  const style = {
    citrus: 'bg-white border-orange-100/70 text-citrus-2',
    mint: 'bg-white border-mint/25 text-mint',
    amber: 'bg-white border-amber-100/80 text-amber-700',
    basalt: 'bg-white border-earth text-basalt-2',
  }[tone];

  return (
    <div className="rounded-2xl bg-white border border-orange-100/60 shadow-pyj-card p-4 flex items-start gap-3">
      <div className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center ${style}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-serif-kr font-bold text-[13.5px] text-basalt mb-0.5">
          {title}
        </div>
        <p className="text-[11.5px] text-basalt-2 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function StatBlock({
  big,
  label,
  tone = 'citrus',
}: {
  big: string;
  label: string;
  tone?: 'citrus' | 'mint';
}) {
  const bigColor = tone === 'mint' ? 'text-mint' : 'text-citrus-2';
  return (
    <div className="rounded-xl bg-[#FDF6EA] border border-earth/60 p-3">
      <div className={`font-serif-kr font-bold text-[22px] leading-none ${bigColor}`}>
        {big}
      </div>
      <div className="text-[10.5px] text-basalt-2 mt-1 leading-tight">{label}</div>
    </div>
  );
}

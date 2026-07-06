import type React from 'react';
import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Camera,
  CheckCircle2,
  CloudSun,
  Database,
  FileText,
  LockKeyhole,
  MapPin,
  MessageCircleQuestion,
  Package,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import CitrusMark from './marks/CitrusMark';
import WaveLine from './marks/WaveLine';
import StoneWallPattern from './marks/StoneWallPattern';

// 시연용 문지기 — 진짜 보안이 아니라 발표 사전 접근 제어.
const DEMO_PASSCODE = '123456';

interface LandingPageProps {
  onEnter: () => void;
  isUnlocked?: boolean;
}

export default function LandingPage({ onEnter, isUnlocked = false }: LandingPageProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [entering, setEntering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const enterApp = () => {
    if (entering) return;
    setEntering(true);
    setTimeout(() => onEnter(), 320);
  };

  const scrollToGate = () => {
    if (isUnlocked) {
      enterApp();
      return;
    }
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
      enterApp();
      return;
    }
    setError('접근 코드가 맞지 않아요. 다시 확인해 주세요.');
    setShake(true);
    setTimeout(() => setShake(false), 420);
  };

  return (
    <div className="pyj-landing min-h-screen text-basalt antialiased relative overflow-hidden">
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-44 -z-10 opacity-70">
        <StoneWallPattern className="w-full h-full" />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <span className="pyj-wind pyj-wind-a" />
        <span className="pyj-wind pyj-wind-b" />
        <span className="pyj-wind pyj-wind-c" />
        <span className="pyj-citrus-drift pyj-citrus-drift-a" />
        <span className="pyj-citrus-drift pyj-citrus-drift-b" />
        <span className="pyj-citrus-drift pyj-citrus-drift-c" />
        <span className="pyj-sea-haze" />
      </div>

      <AnimatePresence>
        {!entering && (
          <motion.main
            key="landing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.45 }}
            className="relative z-10"
          >
            <section className="px-5 pt-6 pb-12 lg:px-10 lg:pt-10">
              <nav className="mx-auto flex max-w-6xl items-center justify-between">
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="inline-flex items-center gap-2 rounded-full border border-earth bg-white/70 px-3 py-2 text-left shadow-sm transition hover:bg-white"
                  aria-label="Pack Your Jeju 홈"
                >
                  <span className="pyj-citrus-breathe">
                    <CitrusMark className="h-9 w-9" />
                  </span>
                  <span>
                    <span className="block font-serif-kr text-[15px] font-bold leading-none">
                      Pack Your Jeju
                    </span>
                    <span className="text-[10px] font-semibold text-basalt-2/70">
                      제주 · 신뢰 여행 준비
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={scrollToGate}
                  className="pyj-soft-cta inline-flex items-center gap-1.5 rounded-full bg-basalt px-4 py-2 text-[12px] font-bold text-white shadow-jeju-chip transition hover:bg-basalt-2"
                >
                  {isUnlocked ? '대시보드로 이동' : '여행 준비 시작'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </nav>

              <div className="mx-auto mt-14 grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full border border-citrus/25 bg-citrus/10 px-3 py-1.5 text-[11px] font-bold text-citrus-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    신뢰 기반 제주 여행팩
                  </div>
                  <h1 className="mt-5 font-serif-kr text-[44px] font-bold leading-[1.04] tracking-tight text-basalt sm:text-[58px] lg:text-[68px]">
                    이번 제주는,
                    <br />
                    설렘부터
                    <br />
                    근거 있게.
                  </h1>
                  <p className="mt-5 max-w-2xl text-[15px] leading-8 text-basalt-2 sm:text-[17px]">
                    떠나기 전부터 제주가 가까워지는 여행 준비.
                    <br className="hidden sm:block" />
                    지역, 기간, 동행자, 여행 순간을 고르면 하루방 에이전트가
                    공공데이터로 확인한 장소와 주의 신호를
                    여행팩에 차분히 담아드립니다.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={scrollToGate}
                      className="pyj-primary-cta inline-flex items-center justify-center gap-2 rounded-2xl bg-citrus px-6 py-3.5 font-serif-kr text-[15px] font-bold text-white shadow-jeju-chip transition hover:bg-citrus-2"
                    >
                      {isUnlocked ? '내 제주팩 열기' : '제주팩 만들러 가기'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <a
                      href="#trust-flow"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-earth bg-white/75 px-6 py-3.5 text-[14px] font-bold text-basalt-2 transition hover:bg-white hover:text-basalt"
                    >
                      신뢰 구조 보기
                      <ShieldCheck className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 18, rotate: -1.2 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ duration: 0.72, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="pyj-ticket-card rounded-[28px] border border-orange-100/70 bg-white/85 p-4 shadow-pyj-card backdrop-blur"
                >
                  <div className="rounded-[22px] bg-[#FDF6EA] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-citrus-2">
                          Live Preview
                        </p>
                        <h2 className="mt-1 font-serif-kr text-[23px] font-bold text-basalt">
                          구좌 근거 현황 미리보기
                        </h2>
                      </div>
                      <span className="pyj-citrus-breathe">
                        <CitrusMark className="h-14 w-14" />
                      </span>
                    </div>
                    <div className="mt-5 space-y-3">
                      <PreviewRow
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        title="오름 · 바다 산책"
                        body="확인 후보가 많아 일정에 넣기 좋습니다."
                        tone="verified"
                      />
                      <PreviewRow
                        icon={<AlertTriangle className="h-4 w-4" />}
                        title="노을 감상"
                        body="저희가 참조하는 공공데이터 기준으로 확인 근거가 부족합니다."
                        tone="caution"
                      />
                      <PreviewRow
                        icon={<MessageCircleQuestion className="h-4 w-4" />}
                        title="하루방 에이전트"
                        body="선택한 지역과 순간을 기준으로 후보를 다시 조회합니다."
                        tone="agent"
                      />
                    </div>
                    <div className="mt-5 rounded-2xl border border-earth bg-white p-4">
                      <p className="font-serif-kr text-[14px] font-bold text-basalt">
                        "구좌는 산책 후보가 충분하지만, 노을은 확인 근거가 아직 약합니다."
                      </p>
                      <p className="mt-2 text-[11.5px] leading-relaxed text-basalt-2">
                        사용자가 팩을 다 만든 뒤가 아니라, 지역을 고르는 순간 신뢰 범위를 먼저
                        보여주는 구조입니다.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </section>

            <section className="px-5 pb-16 lg:px-10">
              <div className="mx-auto grid max-w-6xl items-center gap-8 rounded-[34px] border border-orange-100/80 bg-white/55 p-4 shadow-pyj-card backdrop-blur lg:grid-cols-[0.86fr_1.14fr] lg:p-7">
                <div className="px-1 py-4 lg:px-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-citrus-2">
                    Arrival Mood
                  </p>
                  <h2 className="mt-3 font-serif-kr text-[36px] font-bold leading-tight text-basalt sm:text-[44px]">
                    비행기가 제주 위를 지날 때,
                    <br />
                    여행은 이미 시작됩니다.
                  </h2>
                  <p className="mt-4 text-[14px] leading-7 text-basalt-2 sm:text-[15px]">
                    해변의 곡선, 낮은 오름, 바람에 흔들리는 감귤나무까지.
                    Pack Your Jeju는 설렘을 누르지 않고, 필요한 확인만 조용히 더해
                    여행플랜으로 이어갑니다.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {['지역 선택', '하루방 에이전트', '내 여행플랜', '짐싸기', '방문 확인'].map((label) => (
                      <span
                        key={label}
                        className="rounded-full border border-earth bg-[#FDF6EA]/80 px-3 py-1.5 text-[11px] font-bold text-basalt-2"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <JejuArrivalScene />
              </div>
            </section>

            <section className="border-y border-orange-100/70 bg-white/60 px-5 py-7">
              <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatBlock big="4,422" label="관광지 · 카페 · 음식점" />
                <StatBlock big="1,686" label="이용자 정보 수정 요청" tone="amber" />
                <StatBlock big="5,828" label="주차장 · 정류장 접근성" />
                <StatBlock big="12 / 12" label="골든셋 게이트 통과" tone="mint" />
              </div>
            </section>

            <section id="trust-flow" className="px-5 py-16 lg:px-10">
              <div className="mx-auto max-w-6xl">
                <SectionHeader
                  eyebrow="Trust Engine"
                  title="설렘을 깨지 않도록, 먼저 확인합니다."
                  body="Pack Your Jeju의 핵심은 더 많은 장소를 채우는 것이 아니라, 확인 가능한 정보와 아직 근거가 부족한 정보를 사용자가 구분할 수 있게 만드는 것입니다."
                />
                <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <FeatureCard
                    icon={<MapPin className="h-5 w-5" />}
                    title="지역 줌인"
                    body="구좌·애월·성산처럼 지역을 고르면 순간별 근거 현황을 먼저 보여줍니다."
                  />
                  <FeatureCard
                    icon={<MessageCircleQuestion className="h-5 w-5" />}
                    title="하루방 에이전트"
                    body="대화 중에도 장소명과 주소는 DB 후보 안에서만 말하고, 근거가 없으면 확인 불가로 남깁니다."
                  />
                  <FeatureCard
                    icon={<FileText className="h-5 w-5" />}
                    title="플랜 파일"
                    body="확정된 여행팩은 PDF 여행플랜으로 저장하고, 근거 링크와 데이터가 부족한 조합까지 함께 정리합니다."
                  />
                  <FeatureCard
                    icon={<Search className="h-5 w-5" />}
                    title="리뷰 검증"
                    body="외부 리뷰 문장은 추천 근거가 아니라 검증 대상입니다. 반증이 있으면 주의 신호로 분리합니다."
                  />
                </div>
              </div>
            </section>

            <section className="bg-basalt px-5 py-16 text-white lg:px-10">
              <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-citrus">
                    Public Data Stack
                  </p>
                  <h2 className="mt-3 font-serif-kr text-[34px] font-bold leading-tight">
                    제주 공공데이터를
                    <br />
                    여행 결정의 언어로 바꿉니다.
                  </h2>
                  <p className="mt-4 text-[14px] leading-7 text-white/75">
                    비짓제주, 공공데이터포털, 국토부 TAGO, 제주 ITS 기반 데이터를
                    장소·음식·교통·수정요청 신호로 나누어 신뢰 배지와 fallback_reason으로
                    조립합니다.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DarkFeature icon={<Database />} title="DB 근거 우선" body="장소·주소·운영 관련 사실은 조회된 값만 사용합니다." />
                  <DarkFeature icon={<ShieldCheck />} title="4분기 fallback" body="out_of_scope, coverage_gap, retrieval_miss, contradicted로 비는 이유를 나눕니다." />
                  <DarkFeature icon={<Package />} title="일정 조립" body="선택 지역과 순간을 요일별 여행팩으로 정리합니다." />
                  <DarkFeature icon={<BookOpenCheck />} title="검증 기록" body="PDF에는 확인된 정보와 근거가 부족한 조합을 함께 남깁니다." />
                </div>
              </div>
            </section>

            <section className="px-5 py-16 lg:px-10">
              <div className="mx-auto max-w-6xl">
                <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-citrus-2">
                      Pack Your Jeju Trust Cycle
                    </p>
                    <h2 className="mt-3 font-serif-kr text-[36px] font-bold leading-tight text-basalt">
                      공공데이터로 계획하고,
                      <br />
                      방문 기록으로 다시 좋아집니다.
                    </h2>
                    <p className="mt-4 text-[14px] leading-7 text-basalt-2">
                      Pack Your Jeju는 추천에서 끝나지 않습니다. 공공데이터로 만든 여행플랜을
                      사용자가 실제로 실행하고, 방문 기록과 수정 신호가 다시 하루방 에이전트의
                      신뢰 신호로 돌아오는 순환형 AI 여행플랜 서비스입니다.
                    </p>
                    <div className="mt-5 rounded-2xl border border-citrus/20 bg-citrus/8 p-4">
                      <p className="font-serif-kr text-[15px] font-bold leading-relaxed text-basalt">
                        “공공데이터로 여행을 계획하고, 실제 방문 기록으로 제주 여행 신뢰도를
                        다시 키우는 서비스”
                      </p>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-[28px] border border-orange-100/80 bg-white p-4 shadow-pyj-card">
                    <div className="absolute left-1/2 top-1/2 hidden h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-citrus/35 lg:block" />
                    <div className="absolute left-1/2 top-1/2 hidden h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#FDF6EA] text-citrus-2 shadow-sm lg:flex">
                      <RefreshCw className="h-6 w-6" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <CycleNode
                        step="01"
                        icon={<CloudSun className="h-4 w-4" />}
                        title="공공데이터 API"
                        body="관광·교통·기상·수정요청 데이터를 1차 근거로 수집합니다."
                      />
                      <CycleNode
                        step="02"
                        icon={<Database className="h-4 w-4" />}
                        title="정보 기반 정리"
                        body="지역·순간별 확인 후보와 데이터 부족 범위를 나눕니다."
                      />
                      <CycleNode
                        step="03"
                        icon={<MessageCircleQuestion className="h-4 w-4" />}
                        title="하루방 에이전트"
                        body="DB 후보 안에서 상담하고, 조건에 맞는 대안을 조율합니다."
                      />
                      <CycleNode
                        step="04"
                        icon={<Route className="h-4 w-4" />}
                        title="여행플랜 생성"
                        body="Day별 플랜, 지도, PDF, 공유 텍스트로 실행 가능하게 만듭니다."
                      />
                      <CycleNode
                        step="05"
                        icon={<Camera className="h-4 w-4" />}
                        title="방문 기록"
                        body="사용자의 체크인·메모·사진·수정 요청이 구조화됩니다."
                      />
                      <CycleNode
                        step="06"
                        icon={<ShieldCheck className="h-4 w-4" />}
                        title="신뢰 신호 강화"
                        body="최근 방문 확인이 다음 여행자의 플랜과 상담에 반영됩니다."
                        tone="mint"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="px-5 py-16 lg:px-10">
              <div className="mx-auto max-w-6xl">
                <SectionHeader
                  eyebrow="How It Works"
                  title={
                    <>
                      사용자는 여행을 고르고,
                      <br />
                      시스템은 근거를 고릅니다.
                    </>
                  }
                  body="경진대회 버전의 방향성은 단순 추천앱이 아니라 지역별 근거 현황, 신뢰기반 RAG, 사용자 기록이 다시 신뢰 신호가 되는 순환 구조입니다."
                />
                <div className="mt-8 grid gap-4 lg:grid-cols-5">
                  {[
                    ['1', '지역 선택', '지역별 근거 현황과 약한 순간을 먼저 확인합니다.'],
                    ['2', '하루방 에이전트', '매 턴 DB 후보를 다시 조회해 자연어로 조립합니다.'],
                    ['3', '여행팩 생성', '근거 배지와 접근성 신호를 포함해 일정으로 묶습니다.'],
                    ['4', '여행플랜 저장', '현재 확정 버전을 따라가기 쉬운 PDF 플랜으로 정리합니다.'],
                    ['5', '방문 기록', '체크인 데이터가 다음 추천의 신뢰 신호가 됩니다.'],
                  ].map(([step, title, body]) => (
                    <div key={step} className="rounded-2xl border border-orange-100/70 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-citrus text-[13px] font-bold text-white">
                        {step}
                      </div>
                      <h3 className="font-serif-kr text-[15px] font-bold text-basalt">{title}</h3>
                      <p className="mt-2 text-[12px] leading-relaxed text-basalt-2">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="px-5 pb-16 lg:px-10">
              <div className="mx-auto grid max-w-6xl gap-6 rounded-[28px] border border-orange-100/70 bg-white/85 p-5 shadow-pyj-card backdrop-blur lg:grid-cols-[1fr_360px] lg:p-8">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-citrus/10 px-3 py-1.5 text-[11px] font-bold text-citrus-2">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Demo Access
                  </div>
                  <h2 className="mt-4 font-serif-kr text-[31px] font-bold leading-tight text-basalt">
                    이제 실제 여행팩을 만들어 볼 차례입니다.
                  </h2>
                  <p className="mt-3 max-w-2xl text-[14px] leading-7 text-basalt-2">
                    진입하면 지역 정밀 설정, 하루방 에이전트 추천, 근거 기반 장소 카드, PDF 여행플랜까지
                    한 흐름으로 확인할 수 있습니다.
                  </p>
                </div>

                {isUnlocked ? (
                  <div className="flex flex-col justify-center">
                    <button
                      type="button"
                      onClick={enterApp}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-citrus px-5 py-3.5 font-serif-kr text-[15px] font-bold text-white shadow-jeju-chip transition hover:bg-citrus-2"
                    >
                      대시보드로 이동
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <p className="mt-3 text-center text-[11px] text-basalt-2/60">
                      이미 접근 코드가 확인되었습니다.
                    </p>
                  </div>
                ) : (
                  <motion.form
                    id="landing-gate"
                    onSubmit={handleSubmit}
                    animate={shake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
                    transition={{ duration: 0.42 }}
                    className="space-y-3"
                  >
                    <label
                      htmlFor="passcode"
                      className="block text-[10.5px] font-bold uppercase tracking-wider text-basalt-2/70"
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
                      className="w-full rounded-2xl border border-earth bg-[#FDFBF7] px-4 py-3 text-center font-serif-kr text-[16px] tracking-[0.35em] text-basalt transition focus:border-citrus focus:outline-none focus:ring-2 focus:ring-citrus/30"
                    />
                    {error && <p className="text-[11.5px] leading-relaxed text-rose-700">{error}</p>}
                    <button
                      type="submit"
                      disabled={code.length === 0 || entering}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-citrus px-5 py-3.5 font-serif-kr text-[15px] font-bold text-white shadow-jeju-chip transition hover:bg-citrus-2 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      여행 준비 시작하기
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </motion.form>
                )}
              </div>
              <footer className="mt-8 text-center text-[10px] text-basalt-2/50">
                © 2026 Pack Your Jeju
              </footer>
            </section>
          </motion.main>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {entering && (
          <motion.div
            key="entering"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#FBF6EA]"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.6, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.4, type: 'spring' }}
              >
                <CitrusMark className="mx-auto mb-3 h-[70px] w-[70px]" />
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

function JejuArrivalScene() {
  return (
    <div className="pyj-arrival-scene" aria-label="비행기와 제주 해변, 오름, 감귤나무가 있는 애니메이션 장면">
      <div className="pyj-arrival-sky">
        <span className="pyj-arrival-cloud pyj-arrival-cloud-a" />
        <span className="pyj-arrival-cloud pyj-arrival-cloud-b" />
        <span className="pyj-arrival-cloud pyj-arrival-cloud-c" />
        <span className="pyj-arrival-plane" aria-hidden="true">
          <svg viewBox="0 0 88 52" role="img">
            <path
              d="M8 29c19-8 39-17 61-26 3-1 7 0 9 2 2 3 1 6-2 8L52 29l15 13c1 1 0 3-2 3l-23-8-17 10c-2 1-4 0-3-2l8-13-21 3c-5 1-6-4-1-6Z"
              fill="#FFF8EC"
              stroke="#2E3235"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <path d="M48 30 33 13" stroke="#E7683A" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M30 32 19 23" stroke="#4A8779" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      <svg className="pyj-arrival-island" viewBox="0 0 720 410" aria-hidden="true">
        <defs>
          <linearGradient id="pyjSea" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#BEE3DF" />
            <stop offset="100%" stopColor="#4A8779" />
          </linearGradient>
          <linearGradient id="pyjSand" x1="0" x2="1">
            <stop offset="0%" stopColor="#F9E4BE" />
            <stop offset="100%" stopColor="#F4C985" />
          </linearGradient>
          <linearGradient id="pyjOreum" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#7FAE89" />
            <stop offset="100%" stopColor="#4A8779" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="720" height="410" rx="34" fill="#FDF6EA" />
        <path
          className="pyj-arrival-sea"
          d="M0 250C96 214 175 246 270 223c116-28 177-88 290-67 74 14 115 64 160 80v174H0Z"
          fill="url(#pyjSea)"
        />
        <path
          className="pyj-arrival-wave pyj-arrival-wave-a"
          d="M39 276c60-18 108 9 168-5 64-15 111-51 175-43 44 5 71 29 109 30"
          fill="none"
          stroke="#FFF8EC"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.72"
        />
        <path
          className="pyj-arrival-wave pyj-arrival-wave-b"
          d="M16 326c72-14 120 19 196-1 59-15 91-42 159-33 50 7 84 32 132 31"
          fill="none"
          stroke="#FFF8EC"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.48"
        />
        <path
          d="M0 337c116-40 217-50 338-30 134 22 229-7 382-76v179H0Z"
          fill="url(#pyjSand)"
        />
        <path
          d="M119 207c42-82 124-92 174-16 47 72 101 61 144 6 43-56 111-53 150 6 26 39 60 44 133 25v55H0v-43c43 2 79-5 119-33Z"
          fill="url(#pyjOreum)"
          opacity="0.92"
        />
        <path
          d="M84 231c53-25 91-28 133-7M456 232c45-18 93-16 136 3"
          fill="none"
          stroke="#D5E9E1"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.38"
        />

        <g className="pyj-arrival-tree pyj-arrival-tree-a">
          <path d="M584 264c12 33 7 69-3 105" stroke="#6F5136" strokeWidth="10" strokeLinecap="round" />
          <path d="M539 257c9-46 54-75 98-55 46 20 52 83 8 106-42 23-95-3-106-51Z" fill="#4A8779" />
          <circle cx="571" cy="241" r="12" fill="#E7683A" />
          <circle cx="621" cy="250" r="11" fill="#E7683A" />
          <circle cx="599" cy="283" r="10" fill="#C24B26" />
        </g>
        <g className="pyj-arrival-tree pyj-arrival-tree-b">
          <path d="M91 294c9 24 7 49 0 76" stroke="#6F5136" strokeWidth="8" strokeLinecap="round" />
          <path d="M55 283c10-37 47-55 80-39 34 17 38 66 2 84-35 18-74-5-82-45Z" fill="#5C9B7F" />
          <circle cx="83" cy="270" r="9" fill="#E7683A" />
          <circle cx="113" cy="288" r="8" fill="#C24B26" />
        </g>

        <path
          d="M274 363c62 16 138 16 210-1"
          fill="none"
          stroke="#C9A97F"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-citrus-2">{eyebrow}</p>
      <h2 className="mt-3 font-serif-kr text-[32px] font-bold leading-tight text-basalt sm:text-[40px]">
        {title}
      </h2>
      <p className="mt-4 text-[14px] leading-7 text-basalt-2 sm:text-[15px]">{body}</p>
      <WaveLine className="mt-4 h-5 w-52" />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-orange-100/70 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-citrus/20 bg-citrus/10 text-citrus-2">
        {icon}
      </div>
      <h3 className="font-serif-kr text-[16px] font-bold text-basalt">{title}</h3>
      <p className="mt-2 text-[12.5px] leading-relaxed text-basalt-2">{body}</p>
    </div>
  );
}

function DarkFeature({
  icon,
  title,
  body,
}: {
  icon: React.ReactElement;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/7 p-5">
      <div className="mb-3 text-citrus">{icon}</div>
      <h3 className="font-serif-kr text-[16px] font-bold text-white">{title}</h3>
      <p className="mt-2 text-[12.5px] leading-relaxed text-white/70">{body}</p>
    </div>
  );
}

function CycleNode({
  step,
  icon,
  title,
  body,
  tone = 'citrus',
}: {
  step: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: 'citrus' | 'mint';
}) {
  const toneClass = {
    citrus: 'bg-citrus/10 text-citrus-2 border-citrus/20',
    mint: 'bg-mint/10 text-mint border-mint/25',
  }[tone];

  return (
    <div className="relative rounded-2xl border border-orange-100/80 bg-[#FDFBF7] p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${toneClass}`}>
          {icon}
        </div>
        <span className="font-serif-kr text-[22px] font-bold leading-none text-basalt/12">
          {step}
        </span>
      </div>
      <h3 className="font-serif-kr text-[15px] font-bold text-basalt">{title}</h3>
      <p className="mt-2 text-[12px] leading-relaxed text-basalt-2">{body}</p>
    </div>
  );
}

function PreviewRow({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: 'verified' | 'caution' | 'agent';
}) {
  const toneClass = {
    verified: 'bg-mint/10 text-mint border-mint/20',
    caution: 'bg-amber-50 text-amber-700 border-amber-100',
    agent: 'bg-citrus/10 text-citrus-2 border-citrus/20',
  }[tone];

  return (
    <div className="flex gap-3 rounded-2xl border border-earth bg-white p-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
        {icon}
      </div>
      <div>
        <h3 className="font-serif-kr text-[14px] font-bold text-basalt">{title}</h3>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-basalt-2">{body}</p>
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
  tone?: 'citrus' | 'mint' | 'amber';
}) {
  const color = {
    citrus: 'text-citrus-2',
    mint: 'text-mint',
    amber: 'text-amber-700',
  }[tone];

  return (
    <div className="rounded-2xl border border-orange-100/70 bg-white p-4 shadow-sm">
      <div className={`font-serif-kr text-[30px] font-bold leading-none ${color}`}>{big}</div>
      <div className="mt-2 text-[12px] leading-tight text-basalt-2">{label}</div>
    </div>
  );
}

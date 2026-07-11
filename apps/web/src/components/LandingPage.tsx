import type React from 'react';
import { useState } from 'react';
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

interface LandingPageProps {
  onEnter: () => void;
  isUnlocked?: boolean;
}

export default function LandingPage({ onEnter, isUnlocked = false }: LandingPageProps) {
  const [entering, setEntering] = useState(false);

  const enterApp = () => {
    if (entering) return;
    setEntering(true);
    setTimeout(() => onEnter(), 320);
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
                  className="pyj-landing-brand-chip inline-flex items-center gap-3 rounded-[28px] border border-earth/80 bg-white/82 px-4 py-3 text-left shadow-jeju-chip transition hover:bg-white"
                  aria-label="제주를 담다 홈"
                >
                  <span className="pyj-citrus-breathe pyj-citrus-brand-mark">
                    <CitrusMark className="h-[46px] w-[46px]" />
                  </span>
                  <span>
                    <span className="block font-serif-kr text-[20px] font-bold leading-none tracking-[-0.01em] text-basalt">
                      제주를 담다
                    </span>
                    <span className="mt-1 block text-[11.5px] font-bold text-basalt-2/78">
                      공공데이터 AI 여행 신뢰 플랫폼
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={enterApp}
                  className="pyj-soft-cta inline-flex items-center gap-1.5 rounded-full bg-basalt px-4 py-2 text-[12px] font-bold text-white shadow-jeju-chip transition hover:bg-basalt-2"
                >
                  {isUnlocked ? '서비스 대시보드' : '서비스 체험하기'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </nav>

              <div className="mx-auto mt-14 grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full border border-citrus/25 bg-citrus/10 px-3 py-1.5 text-[11px] font-bold text-citrus-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    2026 제주 공공데이터·AI 창업경진대회
                  </div>
                  <h1 className="mt-5 font-serif-kr text-[44px] font-bold leading-[1.04] tracking-tight text-basalt sm:text-[58px] lg:text-[68px]">
                    제주 여행 결정을
                    <br />
                    공공데이터와 AI로
                    <br />
                    검증합니다
                  </h1>
                  <p className="mt-5 max-w-2xl text-[15px] leading-8 text-basalt-2 sm:text-[17px]">
                    비짓제주, 기상청, 교통·주차, 콘텐츠 수정요청 데이터를 AI가 함께 읽고
                    <br className="hidden sm:block" />
                    여행자의 지역·날씨·동행 조건에 맞춰 확인 가능한 후보와 재확인할 정보를 분리합니다.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={enterApp}
                      className="pyj-primary-cta inline-flex items-center justify-center gap-2 rounded-2xl bg-citrus px-6 py-3.5 font-serif-kr text-[15px] font-bold text-white shadow-jeju-chip transition hover:bg-citrus-2"
                    >
                      {isUnlocked ? '대시보드에서 시연 보기' : '서비스 시연 시작'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <a
                      href="#trust-flow"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-earth bg-white/75 px-6 py-3.5 text-[14px] font-bold text-basalt-2 transition hover:bg-white hover:text-basalt"
                    >
                      데이터 활용 구조 보기
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
                          Competition Service Preview
                        </p>
                        <h2 className="mt-1 font-serif-kr text-[23px] font-bold text-basalt">
                          비 오는 제주 일정 판정
                        </h2>
                      </div>
                      <span className="pyj-citrus-breathe">
                        <CitrusMark className="h-14 w-14" />
                      </span>
                    </div>
                    <div className="mt-5 space-y-3">
                      <PreviewRow
                        icon={<CloudSun className="h-4 w-4" />}
                        title="기상청 예보 신호"
                        body="강수·풍속 신호를 야외 일정 위험도에 반영합니다."
                        tone="verified"
                      />
                      <PreviewRow
                        icon={<AlertTriangle className="h-4 w-4" />}
                        title="수정요청 이력"
                        body="운영·주소 변경 가능성이 있는 후보는 방문 전 재확인으로 분리합니다."
                        tone="caution"
                      />
                      <PreviewRow
                        icon={<MessageCircleQuestion className="h-4 w-4" />}
                        title="하루방 에이전트"
                        body="DB와 웹 출처를 구분해 근거 있는 답변만 조립합니다."
                        tone="agent"
                      />
                    </div>
                    <div className="mt-5 rounded-2xl border border-earth bg-white p-4">
                      <p className="font-serif-kr text-[14px] font-bold text-basalt">
                        "내일 강풍 신호가 있어 오름은 낮추고, 문화·카페·시장 후보를 먼저 보겠습니다."
                      </p>
                      <p className="mt-2 text-[11.5px] leading-relaxed text-basalt-2">
                        추천보다 먼저 기상·교통·수정요청 근거를 확인해 여행 실패 가능성을 줄이는 구조입니다.
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
                    비행기가 제주 위를
                    <br />
                    지날 때,
                    <br />
                    여행의 설렘이
                    <br />
                    시작됩니다.
                  </h2>
                  <p className="mt-4 text-[14px] leading-7 text-basalt-2 sm:text-[15px]">
                    한라산의 능선, 해변의 곡선, 바람에 흔들리는 감귤나무까지.
                    제주를 담다는 설렘을 누르지 않고, 필요한 확인만 조용히 더해
                    여행플랜으로 이어갑니다.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {['지역 선택', '하루방 에이전트', '내 여행플랜'].map((label) => (
                      <span
                        key={label}
                        className="rounded-full border border-earth bg-[#FDF6EA]/80 px-3 py-1.5 text-[11px] font-bold text-basalt-2"
                      >
                        {label}
                      </span>
                    ))}
                    <span className="basis-full" aria-hidden="true" />
                    {['짐싸기', '방문 확인'].map((label) => (
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
                  eyebrow="Public Data Assets"
                  title="이미 구조화된 제주 공공데이터를 실제 결정으로 바꿉니다."
                  body="제주를 담다는 새 장소를 만들어내는 서비스가 아니라, 비짓제주·기상청·교통·수정요청 데이터를 여행자의 조건에 맞춰 판정하고 조립하는 제품입니다."
                />
                <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <FeatureCard
                    icon={<MapPin className="h-5 w-5" />}
                    title="비짓제주 확장"
                    body="관광·음식·숙박·축제·쇼핑·문화 후보를 12종 여행 순간 카드와 연결합니다."
                  />
                  <FeatureCard
                    icon={<CloudSun className="h-5 w-5" />}
                    title="기상 리스크"
                    body="기상청 예보를 읽어 오름·바다 같은 야외 일정의 비·바람 위험 신호를 표시합니다."
                  />
                  <FeatureCard
                    icon={<Route className="h-5 w-5" />}
                    title="교통 접근성"
                    body="주차장과 정류장 반경 신호를 붙여 실제로 갈 수 있는 후보인지 확인합니다."
                  />
                  <FeatureCard
                    icon={<Search className="h-5 w-5" />}
                    title="수정요청 검증"
                    body="콘텐츠 수정요청 이력이 있는 장소는 신뢰도를 낮추고 방문 전 확인 항목을 분리합니다."
                  />
                </div>
              </div>
            </section>

            <section className="px-5 pb-16 lg:px-10">
              <div className="mx-auto max-w-6xl rounded-[34px] border border-orange-100/80 bg-[#FFF9EE] p-5 shadow-pyj-card lg:p-8">
                <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-citrus-2">
                      AI Decision Flow
                    </p>
                    <h2 className="mt-3 font-serif-kr text-[34px] font-bold leading-tight text-basalt">
                      AI가 먼저 말하지 않고,
                      <br />
                      공공데이터가 먼저 판정합니다.
                    </h2>
                    <p className="mt-4 text-[14px] leading-7 text-basalt-2">
                      이 서비스의 핵심은 AI 답변 자체가 아니라 AI가 공공데이터를 어떻게 의사결정으로
                      바꾸는지입니다. 후보 조회, 날씨·이동·수정요청 판정, 확인 불가 분리를 먼저 수행하고
                      모델은 그 결과를 사용자가 이해하기 쉬운 설명으로 정리합니다.
                    </p>
                    <div className="mt-5 rounded-3xl border border-citrus/20 bg-white p-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-citrus/10 px-2.5 py-1 text-[10px] font-bold text-citrus-2">
                        <ShieldCheck className="h-3 w-3" />
                        No Hallucination Guard
                      </span>
                      <p className="mt-3 text-[12px] leading-relaxed text-basalt-2">
                        장소명·주소·운영 정보는 조회된 데이터와 웹 출처 밖에서 만들지 않습니다. AI는
                        근거 요약, 리뷰 claim 분해, 대체 일정 설명에만 들어갑니다.
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute left-6 top-8 hidden h-[calc(100%-4rem)] w-px bg-orange-200 lg:block" />
                    <div className="space-y-3">
                      <RagFlowStep
                        number="01"
                        icon={<Search className="h-4 w-4" />}
                        title="여행 조건 구조화"
                        body="지역·기간·동행자·목적·12종 순간카드를 받아 필요한 데이터 범위를 먼저 좁힙니다."
                      />
                      <RagFlowStep
                        number="02"
                        icon={<Database className="h-4 w-4" />}
                        title="공공데이터 조회"
                        body="비짓제주, 기상청, 주차장·정류장, 수정요청 데이터에서 후보와 위험 신호를 가져옵니다."
                      />
                      <RagFlowStep
                        number="03"
                        icon={<ShieldCheck className="h-4 w-4" />}
                        title="신뢰·위험 판정"
                        body="날씨, 이동 가능성, 운영 정보, 수정요청 이력, 데이터 부족 여부를 분리합니다."
                      />
                      <RagFlowStep
                        number="04"
                        icon={<Sparkles className="h-4 w-4" />}
                        title="AI 설명 조립"
                        body="모델은 조회된 후보와 판정 결과만 받아 하루방 응답과 여행팩 설명을 조립합니다."
                      />
                      <RagFlowStep
                        number="05"
                        icon={<BookOpenCheck className="h-4 w-4" />}
                        title="시연 가능한 결과"
                        body="사용자는 출처, 확인 필요 항목, 날씨 신호, 교통 접근성, 수정요청 경고를 함께 봅니다."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="px-5 pb-16 lg:px-10">
              <div className="mx-auto max-w-6xl rounded-[30px] border border-orange-100/80 bg-white/80 p-5 shadow-pyj-card backdrop-blur lg:p-8">
                <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-citrus-2">
                      GPT vs 제주를 담다
                    </p>
                    <h2 className="mt-3 font-serif-kr text-[34px] font-bold leading-tight text-basalt">
                      그럴듯한 추천보다,
                      <br />
                      검증 가능한 추천을 보여줍니다.
                    </h2>
                    <p className="mt-4 text-[14px] leading-7 text-basalt-2">
                      기본 GPT는 여행지를 매끄럽게 말할 수 있지만, 현재 영업 여부·수정요청·지역별
                      데이터 공백을 스스로 증명하지 못합니다. 제주를 담다는 먼저 DB를 조회하고,
                      GPT는 조회된 근거를 정리하는 역할만 맡습니다.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-rose-700">
                        <AlertTriangle className="h-3 w-3" />
                        기본 GPT 답변
                      </span>
                      <p className="mt-3 font-serif-kr text-[16px] font-bold text-basalt">
                        “성산 근처 맛집과 카페를 추천해드릴게요.”
                      </p>
                      <ul className="mt-3 space-y-2 text-[11.5px] leading-relaxed text-rose-900/80">
                        <li>· 장소가 최신 공공데이터에 있는지 불명확</li>
                        <li>· 영업 변경·수정요청 이력 확인 불가</li>
                        <li>· 데이터가 부족한 조합도 그럴듯하게 채울 위험</li>
                      </ul>
                    </div>
                    <div className="rounded-3xl border border-mint/20 bg-mint/8 p-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-mint">
                        <ShieldCheck className="h-3 w-3" />
                        제주를 담다 RAG
                      </span>
                      <p className="mt-3 font-serif-kr text-[16px] font-bold text-basalt">
                        “확인 후보 126곳, 주의 신호 10곳, 데이터 부족 조합 4개.”
                      </p>
                      <ul className="mt-3 space-y-2 text-[11.5px] leading-relaxed text-basalt-2">
                        <li>· 비짓제주·교통·수정요청 DB 후보만 사용</li>
                        <li>· 신뢰도 점수와 확인 필요 항목을 분리 표시</li>
                        <li>· 방문 피드백은 수정요청 큐와 다음 신뢰 신호로 연결</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="px-5 pb-16 lg:px-10">
              <div className="mx-auto max-w-6xl overflow-hidden rounded-[30px] border border-mint/20 bg-[#F4FBF8] shadow-pyj-card">
                <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="border-b border-mint/15 p-6 lg:border-b-0 lg:border-r lg:p-8">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-mint">
                      Golden Set Gate
                    </p>
                    <h2 className="mt-3 font-serif-kr text-[34px] font-bold leading-tight text-basalt">
                      믿을 만하다는 말을,
                      <br />
                      숫자로 남겼습니다.
                    </h2>
                    <p className="mt-4 text-[14px] leading-7 text-basalt-2">
                      제주를 담다는 배포 전 골든셋을 통과해야 합니다. 검증 후보, fallback_reason,
                      주의 배지, 리뷰 검증 케이스를 같은 기준으로 반복 실행해 기본 GPT 답변보다
                      근거 추적 가능성이 높은지 확인합니다.
                    </p>
                    <div className="mt-5 rounded-2xl border border-mint/20 bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[12px] font-bold text-basalt-2">현재 게이트</span>
                        <span className="rounded-full bg-mint px-3 py-1 text-[11px] font-bold text-white">
                          12 / 12 통과
                        </span>
                      </div>
                      <p className="mt-2 text-[11.5px] leading-relaxed text-basalt-2">
                        실행: `python -m packages.eval.run --out docs/eval`
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 p-5 sm:grid-cols-3 lg:p-8">
                    {[
                      ['Verified Precision', '1.00', '근거 후보 조건 충족'],
                      ['Fallback Accuracy', '1.00', '확인 불가 사유 분리'],
                      ['Badge Accuracy', '1.00', '주의·반증 배지 판정'],
                    ].map(([label, value, body]) => (
                      <div key={label} className="rounded-3xl border border-mint/15 bg-white p-4">
                        <CheckCircle2 className="h-5 w-5 text-mint" />
                        <div className="mt-4 font-serif-kr text-[34px] font-bold leading-none text-basalt">
                          {value}
                        </div>
                        <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-mint">
                          {label}
                        </div>
                        <p className="mt-2 text-[11.5px] leading-relaxed text-basalt-2">
                          {body}
                        </p>
                      </div>
                    ))}
                  </div>
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
                      Competition Service Loop
                    </p>
                    <h2 className="mt-3 font-serif-kr text-[36px] font-bold leading-tight text-basalt">
                      시제품은 여행자에게,
                      <br />
                      근거는 심사위원에게 보입니다.
                    </h2>
                    <p className="mt-4 text-[14px] leading-7 text-basalt-2">
                      제품·서비스 개발 부문에서 중요한 것은 완성된 화면과 실제 시연입니다. 제주를 담다는
                      사용자가 여행팩을 만들고, 심사위원은 그 뒤의 공공데이터·AI 판정 흐름을 함께 볼 수 있게
                      설계했습니다.
                    </p>
                    <div className="mt-5 rounded-2xl border border-citrus/20 bg-citrus/8 p-4">
                      <p className="font-serif-kr text-[15px] font-bold leading-relaxed text-basalt">
                        “제주 공공데이터를 여행자의 선택 언어로 바꾸는 AI 서비스”
                      </p>
                    </div>
                  </div>

                  <div className="pyj-cycle-board relative overflow-hidden rounded-[28px] border border-orange-100/80 bg-white p-4 shadow-pyj-card">
                    <svg className="pyj-cycle-route" viewBox="0 0 620 360" aria-hidden="true">
                      <path
                        className="pyj-cycle-route-base"
                        d="M84 84H310H536Q568 84 568 116V244Q568 276 536 276H310H84Q52 276 52 244V116Q52 84 84 84Z"
                      />
                      <path
                        className="pyj-cycle-route-pulse"
                        d="M84 84H310H536Q568 84 568 116V244Q568 276 536 276H310H84Q52 276 52 244V116Q52 84 84 84Z"
                      />
                      <circle className="pyj-cycle-flow-dot" r="5.5">
                        <animateMotion
                          dur="13s"
                          repeatCount="indefinite"
                          path="M84 84H310H536Q568 84 568 116V244Q568 276 536 276H310H84Q52 276 52 244V116Q52 84 84 84Z"
                        />
                      </circle>
                      <circle className="pyj-cycle-flow-dot pyj-cycle-flow-dot-b" r="3.5">
                        <animateMotion
                          dur="13s"
                          begin="-6.5s"
                          repeatCount="indefinite"
                          path="M84 84H310H536Q568 84 568 116V244Q568 276 536 276H310H84Q52 276 52 244V116Q52 84 84 84Z"
                        />
                      </circle>
                    </svg>
                    <div className="pyj-cycle-core absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#FDF6EA] text-citrus-2 shadow-sm lg:flex">
                      <RefreshCw className="h-6 w-6" />
                    </div>
                    <div className="pyj-cycle-grid relative z-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <CycleNode
                        step="01"
                        icon={<CloudSun className="h-4 w-4" />}
                        title="공공데이터 자산"
                        body="비짓제주·기상청·교통·수정요청 데이터를 1차 근거로 사용합니다."
                        order={0}
                      />
                      <CycleNode
                        step="02"
                        icon={<Database className="h-4 w-4" />}
                        title="구조화·정규화"
                        body="지역·카테고리·날짜·접근성 기준으로 후보와 부족 범위를 나눕니다."
                        order={1}
                      />
                      <CycleNode
                        step="03"
                        icon={<MessageCircleQuestion className="h-4 w-4" />}
                        title="AI 의사결정"
                        body="하루방이 조건에 맞는 후보, 대체안, 재확인 항목을 설명합니다."
                        order={2}
                      />
                      <CycleNode
                        step="04"
                        icon={<Route className="h-4 w-4" />}
                        title="여행팩 생성"
                        body="날씨·교통·수정요청 신호가 붙은 실행 가능한 코스로 만듭니다."
                        order={3}
                      />
                      <CycleNode
                        step="05"
                        icon={<Camera className="h-4 w-4" />}
                        title="사용자 피드백"
                        body="방문 메모와 수정 의견은 내부 검토 신호로 분리해 저장합니다."
                        order={4}
                      />
                      <CycleNode
                        step="06"
                        icon={<ShieldCheck className="h-4 w-4" />}
                        title="사업화 확장"
                        body="지역 소비 분산, 기관 데이터 활용 사례, B2B 리포트로 확장합니다."
                        tone="mint"
                        order={5}
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
                      사용자는 여행팩을 만들고,
                      <br />
                      심사위원은 근거를 확인합니다.
                    </>
                  }
                  body="랜딩은 홍보 페이지가 아니라 제품 시연의 입구입니다. 첫 클릭부터 지역 선택, 공공데이터 후보, AI 판정, PDF 플랜까지 실제 흐름으로 이어집니다."
                />
                <div className="mt-8 grid gap-4 lg:grid-cols-5">
                  {[
                    ['1', '지역 선택', '제주 12권역별 공공데이터 후보와 약한 순간을 먼저 확인합니다.'],
                    ['2', '조건 입력', '기간·동행·목적·12종 순간 카드로 필요한 데이터 범위를 좁힙니다.'],
                    ['3', 'AI 판정', '날씨, 이동, 수정요청, 데이터 부족 신호를 분리합니다.'],
                    ['4', '여행팩 생성', '근거 배지와 접근성 신호를 포함해 일정으로 묶습니다.'],
                    ['5', '시연·제출', 'PDF 플랜과 데이터 활용 근거로 제품 완성도를 설명합니다.'],
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
                    <Sparkles className="h-3.5 w-3.5" />
                    Competition Demo
                  </div>
                  <h2 className="mt-4 font-serif-kr text-[31px] font-bold leading-tight text-basalt">
                    이제 실제 서비스 시연으로 들어갑니다.
                  </h2>
                  <p className="mt-3 max-w-2xl text-[14px] leading-7 text-basalt-2">
                    진입하면 지역 정밀 설정, 하루방 에이전트, 근거 기반 장소 카드, 날씨·교통·수정요청 신호,
                    PDF 여행플랜까지 한 흐름으로 확인할 수 있습니다.
                  </p>
                </div>

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
                    별도 접근 코드 없이 바로 체험할 수 있습니다.
                  </p>
                </div>
              </div>
              <footer className="mt-8 text-center text-[10px] text-basalt-2/50">
                © 2026 제주를 담다
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
    <div className="pyj-arrival-scene" aria-label="비행기와 한라산, 제주 해변, 감귤나무가 있는 애니메이션 장면">
      <div className="pyj-arrival-sky">
        <span className="pyj-arrival-cloud pyj-arrival-cloud-a" />
        <span className="pyj-arrival-cloud pyj-arrival-cloud-b" />
        <span className="pyj-arrival-cloud pyj-arrival-cloud-c" />
        <span className="pyj-arrival-plane" aria-hidden="true">
          <svg viewBox="0 0 132 72" role="img">
            <path
              d="M11 39c16-6 34-10 56-12l34-19c8-4 17-2 20 3 3 6-2 12-10 14L82 34l24 16c3 2 2 6-2 6L70 47 43 63c-4 2-8 0-6-4l11-18-33 4c-8 1-11-4-4-6Z"
              fill="#FFF8EC"
              stroke="#2E3235"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path
              d="M52 29c17-2 38-3 58-2"
              fill="none"
              stroke="#4A8779"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.75"
            />
            <path d="M77 35 58 14" stroke="#E7683A" strokeWidth="3" strokeLinecap="round" />
            <path d="M50 40 31 25" stroke="#4A8779" strokeWidth="3" strokeLinecap="round" />
            <path d="M98 22 112 9" stroke="#E7683A" strokeWidth="3" strokeLinecap="round" />
            <circle cx="66" cy="30" r="2.2" fill="#2E3235" opacity="0.7" />
            <circle cx="76" cy="29" r="2.1" fill="#2E3235" opacity="0.62" />
            <circle cx="86" cy="28" r="2" fill="#2E3235" opacity="0.54" />
          </svg>
        </span>
      </div>

      <svg className="pyj-arrival-island" viewBox="0 0 720 410" aria-hidden="true">
        <defs>
          <radialGradient id="pyjArrivalGlow" cx="50%" cy="33%" r="54%">
            <stop offset="0%" stopColor="#FFF0C7" stopOpacity="0.95" />
            <stop offset="58%" stopColor="#FCE1AF" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#FDF6EA" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pyjArrivalSky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#D9F1F1" />
            <stop offset="46%" stopColor="#FDF4E7" />
            <stop offset="100%" stopColor="#F8DFC0" />
          </linearGradient>
          <linearGradient id="pyjSea" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#A7D6D7" />
            <stop offset="56%" stopColor="#6AA99C" />
            <stop offset="100%" stopColor="#3D756D" />
          </linearGradient>
          <linearGradient id="pyjSand" x1="0" x2="1">
            <stop offset="0%" stopColor="#FAE7C1" />
            <stop offset="100%" stopColor="#EFC27B" />
          </linearGradient>
          <linearGradient id="pyjHallasan" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#7EAA91" />
            <stop offset="52%" stopColor="#5B917D" />
            <stop offset="100%" stopColor="#356D61" />
          </linearGradient>
          <linearGradient id="pyjHallasanShadow" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#96C2AE" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4A8779" stopOpacity="0.18" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="720" height="410" rx="34" fill="url(#pyjArrivalSky)" />
        <circle className="pyj-arrival-sun" cx="388" cy="126" r="164" fill="url(#pyjArrivalGlow)" />
        <circle cx="428" cy="132" r="25" fill="#F4A24F" opacity="0.76" />
        <path
          className="pyj-arrival-haze pyj-arrival-haze-a"
          d="M88 160c76-24 154-22 231-4 72 17 142 17 218-5 36-11 68-13 99-8"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.35"
        />
        <path
          className="pyj-arrival-haze pyj-arrival-haze-b"
          d="M24 206c86-20 155-13 221 6 78 22 161 20 253-6 69-20 126-21 180-4"
          fill="none"
          stroke="#E8F4EF"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.38"
        />
        <path
          className="pyj-arrival-hallasan"
          d="M0 262c59-21 120-35 179-47 61-12 99-35 136-72 35-35 69-62 107-67 46-6 84 28 125 69 39 39 81 66 139 79 12 3 23 5 34 8v178H0Z"
          fill="url(#pyjHallasan)"
        />
        <path
          d="M230 217c43-25 81-61 114-91 33-30 68-41 100-29 22 8 39 28 59 49-28-11-63-7-93 9-48 26-87 63-180 62Z"
          fill="url(#pyjHallasanShadow)"
          opacity="0.64"
        />
        <path
          d="M333 137c31-22 60-28 88-20 21 6 39 21 57 40"
          fill="none"
          stroke="#DDEDE4"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.54"
        />
        <path
          d="M365 123c18 6 38 6 59-1"
          fill="none"
          stroke="#F8F6EA"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.78"
        />
        <path
          d="M79 265c87-39 177-39 270-18 93 20 183 15 273-23"
          fill="none"
          stroke="#BBD8C9"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.42"
        />
        <path
          className="pyj-arrival-sea"
          d="M0 275c96-33 174-11 268-28 126-23 219-72 338-36 47 14 80 32 114 40v159H0Z"
          fill="url(#pyjSea)"
        />
        <path
          className="pyj-arrival-wave pyj-arrival-wave-a"
          d="M42 298c64-18 112 8 180-6 66-14 113-45 181-37 42 5 72 24 112 25"
          fill="none"
          stroke="#FFF8EC"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.72"
        />
        <path
          className="pyj-arrival-wave pyj-arrival-wave-b"
          d="M19 337c75-13 126 18 204-1 63-15 99-39 168-30 50 6 84 28 134 27"
          fill="none"
          stroke="#FFF8EC"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.48"
        />
        <path
          d="M0 349c119-33 218-43 340-25 136 21 234-3 380-63v149H0Z"
          fill="url(#pyjSand)"
        />
        <path
          d="M62 357c38-16 76-22 119-19 37 2 72 13 113 11"
          fill="none"
          stroke="#C49B68"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.5"
        />

        <g className="pyj-arrival-tree pyj-arrival-tree-a">
          <path d="M616 304c5 22 4 45-3 67" stroke="#6F5136" strokeWidth="8" strokeLinecap="round" />
          <path d="M574 296c13-35 51-51 86-35 34 16 41 58 11 80-34 25-84 4-97-45Z" fill="#477B68" />
          <path d="M589 288c22-19 49-23 76-9" fill="none" stroke="#77A98E" strokeWidth="5" strokeLinecap="round" opacity="0.58" />
          <circle cx="604" cy="296" r="8" fill="#E7683A" />
          <circle cx="638" cy="303" r="8" fill="#F07A3C" />
          <circle cx="622" cy="326" r="7" fill="#C24B26" />
        </g>
        <g className="pyj-arrival-tree pyj-arrival-tree-b">
          <path d="M94 324c5 16 4 32-1 49" stroke="#6F5136" strokeWidth="7" strokeLinecap="round" />
          <path d="M62 317c9-29 39-43 66-31 27 13 31 50 4 65-28 16-61-2-70-34Z" fill="#5C9B7F" />
          <circle cx="86" cy="308" r="7" fill="#E7683A" />
          <circle cx="111" cy="323" r="6" fill="#C24B26" />
        </g>

        <path
          d="M492 354c14-9 34-13 55-10 24 3 44 12 63 11"
          fill="none"
          stroke="#6F5136"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.22"
        />
        <g opacity="0.34" fill="#3E3A33">
          <circle cx="517" cy="347" r="7" />
          <circle cx="536" cy="342" r="5" />
          <circle cx="556" cy="348" r="6" />
          <circle cx="577" cy="346" r="4" />
        </g>
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

function RagFlowStep({
  number,
  icon,
  title,
  body,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="relative rounded-3xl border border-orange-100/80 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-citrus/20 bg-citrus/10 text-citrus-2">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#FDF6EA] px-2 py-0.5 text-[10px] font-bold text-citrus-2">
              {number}
            </span>
            <h3 className="font-serif-kr text-[15px] font-bold text-basalt">
              {title}
            </h3>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-basalt-2">
            {body}
          </p>
        </div>
      </div>
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
  order = 0,
}: {
  step: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: 'citrus' | 'mint';
  order?: number;
}) {
  const toneClass = {
    citrus: 'bg-citrus/10 text-citrus-2 border-citrus/20',
    mint: 'bg-mint/10 text-mint border-mint/25',
  }[tone];

  return (
    <div
      className={`pyj-cycle-node pyj-cycle-node-${step} relative rounded-2xl border border-orange-100/80 bg-[#FDFBF7] p-4 shadow-sm`}
      style={{ '--cycle-order': order } as React.CSSProperties}
    >
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

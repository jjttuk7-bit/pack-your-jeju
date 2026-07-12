import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Compass,
  Heart,
  Map,
  MapPin,
  MessageCircle,
  Route,
  Search,
  Sparkles,
} from 'lucide-react';
import CitrusMark from './marks/CitrusMark';

interface LandingPageProps {
  onEnter: () => void;
  isUnlocked?: boolean;
}

const discoveries = [
  {
    label: '바다와 오름',
    title: '걷는 순간마다 달라지는 풍경',
    body: '검은 현무암 너머의 푸른 바다, 한 걸음 올라 만나는 오름의 능선.',
    image: '/images/landing-jeju-hero.jpg',
    className: 'md:col-span-2 md:row-span-2',
  },
  {
    label: '숲과 쉼',
    title: '제주가 조용해지는 시간',
    body: '곶자왈의 깊은 초록 안에서 여행의 속도를 잠시 늦춰보세요.',
    image: '/images/landing-jeju-forest.jpg',
    className: '',
  },
  {
    label: '골목과 맛',
    title: '오늘만 만날 수 있는 한 끼',
    body: '시장 골목의 온기와 제철 제주를 내 여행에 담아보세요.',
    image: '/images/landing-jeju-market.jpg',
    className: '',
  },
];

const planningSteps = [
  {
    number: '01',
    icon: MapPin,
    title: '마음 가는 제주를 고르고',
    body: '애월의 노을, 성산의 아침, 구좌의 오름처럼 지금 끌리는 지역부터 선택해요.',
  },
  {
    number: '02',
    icon: Heart,
    title: '가고 싶은 순간을 담으면',
    body: '맛집, 바다 산책, 카페, 숲길까지 동행과 취향에 맞는 순간을 골라요.',
  },
  {
    number: '03',
    icon: Route,
    title: '나만의 여행이 완성돼요',
    body: '하루방이 최신 정보를 살펴보고 비교해, 바로 떠날 수 있는 플랜으로 정리해요.',
  },
];

export default function LandingPage({ onEnter, isUnlocked = false }: LandingPageProps) {
  const [entering, setEntering] = useState(false);

  const enterApp = () => {
    if (entering) return;
    setEntering(true);
    setTimeout(() => onEnter(), 320);
  };

  return (
    <div className="min-h-screen bg-[#F7F4EE] text-[#25292C] antialiased">
      <AnimatePresence>
        {!entering && (
          <motion.main
            key="consumer-landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.45 }}
          >
            <Hero onEnter={enterApp} isUnlocked={isUnlocked} />

            <section id="discover" className="bg-[#F7F4EE] px-5 pb-20 pt-12 sm:px-8 lg:px-12 lg:pb-28 lg:pt-16">
              <div className="mx-auto max-w-7xl">
                <SectionIntro
                  eyebrow="오늘의 제주 발견"
                  title={<>당신은 어떤 제주를<br className="hidden sm:block" /> 만나고 싶나요?</>}
                  body="한 장면만 골라도 좋아요. 마음이 머무는 순간에서 이번 여행을 시작해보세요."
                />

                <div className="mt-12 grid auto-rows-[360px] gap-4 md:grid-cols-3 md:auto-rows-[280px] lg:gap-6">
                  {discoveries.map((item, index) => (
                    <motion.article
                      key={item.label}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.6, delay: index * 0.08 }}
                      className={`group relative min-h-0 overflow-hidden ${item.className}`}
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-6 text-white lg:p-8">
                        <p className="text-[11px] font-bold tracking-[0.18em] text-white/75">{item.label}</p>
                        <h3 className="mt-2 font-serif-kr text-[24px] font-bold leading-snug lg:text-[28px]">{item.title}</h3>
                        <p className="mt-2 max-w-xl text-[13px] leading-6 text-white/80">{item.body}</p>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </div>
            </section>

            <section className="bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
              <div className="mx-auto max-w-7xl">
                <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
                  <SectionIntro
                    eyebrow="여행을 만드는 가장 쉬운 방법"
                    title={<>끌리는 순간부터<br /> 하나씩 담아보세요.</>}
                    body="복잡한 검색과 저장은 하루방에게 맡기고, 당신은 이번 제주에서 무엇을 하고 싶은지만 생각하면 돼요."
                  />
                  <p className="max-w-xl text-[14px] leading-7 text-[#5E6867] lg:justify-self-end">
                    지역과 취향을 고르면 최신 웹 정보와 출처를 살펴보고, 서로 비교할 수 있는 후보와 여행 플랜을 한곳에 모아드려요.
                  </p>
                </div>

                <div className="mt-14 grid border-y border-[#D9D5CB] md:grid-cols-3">
                  {planningSteps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <motion.div
                        key={step.number}
                        initial={{ opacity: 0, y: 18 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.35 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="border-b border-[#D9D5CB] py-9 md:border-b-0 md:border-r md:px-7 md:last:border-r-0 lg:px-10 lg:py-12"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold text-[#C6532D]">{step.number}</span>
                          <Icon className="h-5 w-5 text-[#35766B]" />
                        </div>
                        <h3 className="mt-8 font-serif-kr text-[21px] font-bold leading-snug">{step.title}</h3>
                        <p className="mt-3 text-[13px] leading-6 text-[#66706F]">{step.body}</p>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="mt-10 flex justify-center">
                  <PrimaryButton onClick={enterApp} label="내 제주 여행 만들기" />
                </div>
              </div>
            </section>

            <section className="overflow-hidden bg-[#153F3A] text-white">
              <div className="grid min-h-[620px] lg:grid-cols-2">
                <div className="relative min-h-[430px] lg:min-h-full">
                  <img
                    src="/images/landing-jeju-market.jpg"
                    alt="제주의 시장 골목과 음식"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/15" />
                </div>
                <div className="flex items-center px-6 py-16 sm:px-12 lg:px-16 xl:px-24">
                  <div className="max-w-xl">
                    <p className="text-[11px] font-bold tracking-[0.2em] text-[#F2A36D]">하루방과 함께</p>
                    <h2 className="mt-5 font-serif-kr text-[38px] font-bold leading-[1.16] sm:text-[48px]">
                      검색은 덜 하고,
                      <br />제주는 더 오래 기억하세요.
                    </h2>
                    <div className="mt-9 space-y-5">
                      <Benefit icon={Search} title="최신 제주를 찾아보고" body="맛집, 명소, 숙소, 교통 정보를 웹에서 폭넓게 살펴봐요." />
                      <Benefit icon={Compass} title="내 취향에 맞게 비교하고" body="혼자, 연인, 가족 누구와 떠나도 선택 이유가 분명한 후보를 보여줘요." />
                      <Benefit icon={Map} title="한 번에 여행으로 담아요" body="마음에 드는 순간을 골라 나만의 제주 플랜으로 이어가요." />
                    </div>
                    <button
                      type="button"
                      onClick={enterApp}
                      className="mt-10 inline-flex min-h-12 items-center gap-2 border-b border-white/60 pb-1 text-[14px] font-bold text-white transition hover:border-[#F2A36D] hover:text-[#F2A36D] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      하루방과 여행 시작하기
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="relative isolate flex min-h-[680px] items-end overflow-hidden px-5 py-16 text-white sm:px-8 lg:px-12 lg:py-20">
              <img
                src="/images/landing-jeju-forest.jpg"
                alt="제주 숲길 너머로 보이는 오름"
                className="absolute inset-0 -z-20 h-full w-full object-cover"
              />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
              <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-end">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-bold tracking-[0.2em] text-white/70">YOUR JEJU, YOUR MOMENT</p>
                  <h2 className="mt-4 font-serif-kr text-[42px] font-bold leading-[1.12] sm:text-[56px]">
                    이제, 당신의 제주를
                    <br />담아볼 시간이에요.
                  </h2>
                  <p className="mt-5 text-[15px] leading-7 text-white/80">
                    가고 싶은 순간 하나면 충분해요. 나머지는 함께 찾아볼게요.
                  </p>
                </div>
                <PrimaryButton onClick={enterApp} label="내 제주 여행 만들기" inverse />
              </div>
            </section>

            <footer className="bg-[#112E2B] px-5 py-7 text-white/65 sm:px-8 lg:px-12">
              <div className="mx-auto flex max-w-7xl flex-col gap-3 text-[11px] sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-white">
                  <CitrusMark className="h-7 w-7" />
                  <span className="font-serif-kr text-[15px] font-bold">제주를 담다</span>
                </div>
                <p>가고 싶은 제주를 발견하고, 나만의 여행으로 담아보세요.</p>
              </div>
            </footer>
          </motion.main>
        )}
      </AnimatePresence>

      {entering && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#153F3A] text-white">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <CitrusMark className="mx-auto h-14 w-14" />
            <p className="mt-4 font-serif-kr text-[18px] font-bold">당신의 제주를 펼치고 있어요</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function Hero({ onEnter, isUnlocked }: { onEnter: () => void; isUnlocked: boolean }) {
  return (
    <section id="landing-hero" className="relative isolate flex min-h-[600px] h-[84svh] max-h-[860px] flex-col overflow-hidden text-white">
      <img
        src="/images/landing-jeju-hero.jpg"
        alt="푸른 제주 바다와 오름, 한라산으로 이어지는 해안길"
        className="pyj-hero-cinematic absolute inset-0 -z-30 h-full w-full object-cover object-[62%_center] sm:object-center"
      />
      <div aria-hidden="true" className="pyj-hero-light pointer-events-none absolute inset-0 -z-20" />
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(5,27,31,0.82)_0%,rgba(5,27,31,0.48)_42%,rgba(5,27,31,0.08)_75%),linear-gradient(0deg,rgba(5,20,23,0.46)_0%,transparent_45%)]" />

      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12 lg:py-7">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="inline-flex items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          aria-label="제주를 담다 홈"
        >
          <CitrusMark className="h-10 w-10" />
          <span>
            <span className="block font-serif-kr text-[19px] font-bold leading-none">제주를 담다</span>
            <span className="mt-1 block text-[10px] font-semibold text-white/70">나만의 제주 여행 플래너</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onEnter}
          className="inline-flex min-h-11 items-center gap-2 border border-white/45 bg-black/10 px-4 text-[12px] font-bold backdrop-blur-md transition hover:border-white hover:bg-white hover:text-[#173F3B] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          {isUnlocked ? '내 여행 계속하기' : '여행 시작하기'}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </nav>

      <div className="mx-auto flex w-full max-w-7xl flex-1 items-center px-5 pb-14 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.17em] text-white/80">
            <Sparkles className="h-4 w-4 text-[#F2A36D]" />
            가고 싶은 순간에서 시작하는 제주
          </div>
          <h1 className="mt-6 font-serif-kr text-[54px] font-bold leading-[1.02] sm:text-[70px] lg:text-[82px]">
            제주를 담다
          </h1>
          <p className="mt-6 max-w-xl text-[16px] font-medium leading-8 text-white/88 sm:text-[18px]">
            가고 싶은 순간을 고르면,
            <br />나만의 제주가 여행이 됩니다.
          </p>
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <PrimaryButton onClick={onEnter} label="내 제주 여행 만들기" inverse />
            <span className="inline-flex items-center gap-2 text-[11px] text-white/72">
              <Check className="h-3.5 w-3.5 text-[#F2A36D]" />
              최신 정보와 출처까지 함께 확인해요
            </span>
          </div>
        </motion.div>
      </div>

      <a
        href="#discover"
        className="absolute bottom-6 right-5 inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] text-white/70 transition hover:text-white sm:right-8 lg:right-12"
      >
        제주 발견하기
        <ChevronDown className="h-4 w-4 animate-bounce" />
      </a>
    </section>
  );
}

function SectionIntro({ eyebrow, title, body }: { eyebrow: string; title: React.ReactNode; body: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-bold tracking-[0.2em] text-[#C6532D]">{eyebrow}</p>
      <h2 className="mt-4 font-serif-kr text-[38px] font-bold leading-[1.14] sm:text-[48px]">{title}</h2>
      <p className="mt-5 max-w-2xl text-[14px] leading-7 text-[#66706F] sm:text-[15px]">{body}</p>
    </div>
  );
}

function PrimaryButton({
  onClick,
  label,
  inverse = false,
}: {
  onClick: () => void;
  label: string;
  inverse?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-13 items-center justify-center gap-2 px-6 text-[14px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-4 ${
        inverse
          ? 'bg-white text-[#173F3B] hover:bg-[#F2A36D] hover:text-[#25292C] focus-visible:outline-white'
          : 'bg-[#E76537] text-white hover:bg-[#C6532D] focus-visible:outline-[#C6532D]'
      }`}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}

function Benefit({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Search;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4 border-b border-white/12 pb-5 last:border-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-white/25 text-[#F2A36D]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="font-serif-kr text-[17px] font-bold">{title}</h3>
        <p className="mt-1 text-[12.5px] leading-6 text-white/68">{body}</p>
      </div>
    </div>
  );
}

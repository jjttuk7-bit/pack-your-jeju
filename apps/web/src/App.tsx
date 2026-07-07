import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Home } from 'lucide-react';
import { TravelInfo, MomentId, SavedTravel, TravelPlanItem, VisitCheck, VisitCheckStatus } from './types';
import PackingDashboard from './components/PackingDashboard';
import VerifyPage from './components/VerifyPage';
import HarubanChat from './components/HarubanChat';
import LandingPage from './components/LandingPage';
import TrustMapDashboard from './components/TrustMapDashboard';
import CitrusMark from './components/marks/CitrusMark';
import WaveLine from './components/marks/WaveLine';
import StoneWallPattern from './components/marks/StoneWallPattern';

const LOCAL_STORAGE_KEY = 'pack_your_jeju_state_v1';
// 시연용 문지기 통과 여부. 로그인 계정 시스템 없음 — 발표 초대 코드 통과 표시만.
const GATE_STORAGE_KEY = 'pack_your_jeju_gate_v1';

const defaultState: SavedTravel = {
  info: {
    regions: [],
    startDate: new Date().toISOString().split('T')[0],
    durationDays: 3,
    companion: 'solo',
    purpose: 'healing',
  },
  selectedMomentIds: [],
  checkedItemIds: [],
  checkedMemoryIds: [],
  customBasicItems: [],
  customMomentItems: {} as Record<MomentId, string[]>,
  step: 'setup',
  customMemories: [],
  selectedPlanItems: [],
  visitChecks: {},
};

// legacy 상태(단일 region)에서 다중 regions로 마이그레이션.
// 이전 앱 사용자의 localStorage에는 info.region이 문자열로 저장돼 있을 수 있다.
function migrateSavedTravel(saved: any): SavedTravel {
  if (!saved || typeof saved !== 'object') return defaultState;
  const info = saved.info ?? {};
  if (!Array.isArray(info.regions)) {
    info.regions = info.region ? [info.region] : [];
    delete info.region;
  }
  return { ...defaultState, ...saved, info: { ...defaultState.info, ...info } };
}

export default function App() {
  const [state, setState] = useState<SavedTravel>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return migrateSavedTravel(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
    }
    return defaultState;
  });

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [harubanSessionKey, setHarubanSessionKey] = useState(0);

  // 시연용 문지기 상태. 초대 코드 통과 여부만 localStorage에 저장한다.
  const [authenticated, setAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GATE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  // 주소로 새로 들어오면 인증 상태와 관계없이 랜딩을 먼저 보여준다.
  // 인증이 남아 있으면 랜딩 CTA가 곧바로 대시보드 진입 버튼으로 동작한다.
  const [showLanding, setShowLanding] = useState(true);

  const handleEnter = () => {
    try {
      localStorage.setItem(GATE_STORAGE_KEY, 'true');
    } catch {}
    setAuthenticated(true);
    setShowLanding(false);
  };

  // 앱 안에서 랜딩으로 복귀. 게이트 storage는 유지한다.
  const handleGoLanding = () => {
    setShowLanding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  }, [state]);

  // 게이트 미통과 또는 홈 복귀 상태에서는 랜딩만 렌더 — 하루방 위젯 · 상단 헤더 모두 감춤.
  if (!authenticated || showLanding) {
    return <LandingPage onEnter={handleEnter} isUnlocked={authenticated} />;
  }

  const handleFormSubmit = (info: TravelInfo, selectedMoments: MomentId[]) => {
    setState(prev => ({
      ...prev,
      info,
      selectedMomentIds: selectedMoments,
      step: 'dashboard'
    }));
  };

  const goToVerify = () => setState(prev => ({ ...prev, step: 'verify' }));
  const goToDashboard = () => setState(prev => ({ ...prev, step: 'dashboard' }));

  // 하루방 폼 반영 제안 승인 시. 빈 값은 기존 값을 덮어쓰지 않는다.
  const handleHarubanApply = (
    infoPatch: Partial<TravelInfo>,
    selectedMoments: MomentId[] | null,
  ) => {
    setState(prev => ({
      ...prev,
      info: { ...prev.info, ...infoPatch },
      selectedMomentIds: selectedMoments ?? prev.selectedMomentIds,
    }));
  };

  const handleToggleItem = (itemId: string) => {
    setState(prev => {
      const checked = prev.checkedItemIds.includes(itemId)
        ? prev.checkedItemIds.filter(id => id !== itemId)
        : [...prev.checkedItemIds, itemId];
      return { ...prev, checkedItemIds: checked };
    });
  };

  const handleToggleMemory = (memoryId: string) => {
    setState(prev => {
      const checked = prev.checkedMemoryIds.includes(memoryId)
        ? prev.checkedMemoryIds.filter(id => id !== memoryId)
        : [...prev.checkedMemoryIds, memoryId];
      return { ...prev, checkedMemoryIds: checked };
    });
  };

  const handleAddCustomBasic = (itemName: string) => {
    setState(prev => {
      if (prev.customBasicItems.includes(itemName)) return prev;
      return {
        ...prev,
        customBasicItems: [...prev.customBasicItems, itemName]
      };
    });
  };

  const handleRemoveCustomBasic = (itemName: string) => {
    setState(prev => ({
      ...prev,
      customBasicItems: prev.customBasicItems.filter(item => item !== itemName),
      // Clean up checked states as well
      checkedItemIds: prev.checkedItemIds.filter(id => id !== `basic-custom-${itemName}`)
    }));
  };

  const handleAddCustomMomentItem = (momentId: MomentId, itemName: string) => {
    setState(prev => {
      const current = prev.customMomentItems[momentId] || [];
      if (current.includes(itemName)) return prev;
      return {
        ...prev,
        customMomentItems: {
          ...prev.customMomentItems,
          [momentId]: [...current, itemName]
        }
      };
    });
  };

  const handleRemoveCustomMomentItem = (momentId: MomentId, itemName: string) => {
    setState(prev => {
      const current = prev.customMomentItems[momentId] || [];
      return {
        ...prev,
        customMomentItems: {
          ...prev.customMomentItems,
          [momentId]: current.filter(item => item !== itemName)
        },
        // Clean up checked states
        checkedItemIds: prev.checkedItemIds.filter(id => id !== `moment-${momentId}-custom-${itemName}`)
      };
    });
  };

  const handleAddCustomMemory = (memoryText: string) => {
    setState(prev => {
      const current = prev.customMemories || [];
      if (current.includes(memoryText)) return prev;
      return {
        ...prev,
        customMemories: [...current, memoryText]
      };
    });
  };

  const handleTogglePlanItem = (item: TravelPlanItem) => {
    setState(prev => {
      const current = prev.selectedPlanItems || [];
      const exists = current.some(planItem => planItem.id === item.id);
      return {
        ...prev,
        selectedPlanItems: exists
          ? current.filter(planItem => planItem.id !== item.id)
          : [...current, item],
      };
    });
  };

  const handleAddCustomPlanItem = (item: TravelPlanItem) => {
    setState(prev => {
      const current = prev.selectedPlanItems || [];
      if (current.some(planItem => planItem.id === item.id)) return prev;
      return {
        ...prev,
        selectedPlanItems: [...current, item],
      };
    });
  };

  const handleRemovePlanItem = (itemId: string) => {
    setState(prev => ({
      ...prev,
      selectedPlanItems: (prev.selectedPlanItems || []).filter(item => item.id !== itemId),
      visitChecks: Object.fromEntries(
        Object.entries(prev.visitChecks || {}).filter(([id]) => id !== itemId),
      ),
    }));
  };

  const handleSetVisitCheck = (
    itemId: string,
    status: VisitCheckStatus,
    patch: Partial<VisitCheck> = {},
  ) => {
    setState(prev => ({
      ...prev,
      visitChecks: {
        ...(prev.visitChecks || {}),
        [itemId]: {
          status,
          updatedAt: new Date().toISOString(),
          ...patch,
        },
      },
    }));
  };

  const handleRemoveCustomMemory = (memoryText: string) => {
    setState(prev => {
      const current = prev.customMemories || [];
      return {
        ...prev,
        customMemories: current.filter(item => item !== memoryText),
        // Clean up checked memory status
        checkedMemoryIds: prev.checkedMemoryIds.filter(id => id !== `memory-custom-${memoryText}`)
      };
    });
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  return (
    <div className="min-h-screen text-basalt font-sans relative flex flex-col items-center px-4 pt-8 pb-4 antialiased" id="app-root">

      {/* 하단 돌담 패턴 (지역감) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-40 -z-10 opacity-70">
        <StoneWallPattern className="w-full h-full" />
      </div>

      {/* Container */}
      <div className="w-full max-w-[1500px] flex flex-col flex-1" id="app-container">

        {/* Header — 비대칭, 왼쪽 정렬, 감귤 마스코트 */}
        <header className="relative overflow-hidden pt-2 pb-8" id="app-header">
          <HeaderJourneyScene />
          <div className="relative z-10 flex items-start gap-4 mb-2">
            {/* 마스코트 클릭 = 처음 화면 (관례상 로고=홈). */}
            <motion.button
              type="button"
              onClick={handleGoLanding}
              aria-label="처음 화면으로"
              initial={{ opacity: 0, scale: 0.75, rotate: -12 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, type: 'spring' }}
              whileHover={{ scale: 1.06, rotate: -6 }}
              whileTap={{ scale: 0.95 }}
              className="shrink-0 -mt-1 rounded-full focus:outline-none focus:ring-2 focus:ring-citrus/40"
            >
              <CitrusMark className="w-[68px] h-[68px]" />
            </motion.button>
            <div className="flex-1 min-w-0">
              <motion.p
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="text-[10px] font-bold text-citrus-2 tracking-[0.2em] uppercase mb-1"
              >
                제주 · 신뢰 여행 준비
              </motion.p>
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="font-serif-kr text-[34px] font-bold text-basalt tracking-tight leading-[1.1]"
                id="brand-name"
              >
                제주를 담다
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="text-[11px] text-basalt-2 mt-1.5 font-medium tracking-wide"
              >
                혼저옵서예. 짐 싸기 전에 확인부터.
              </motion.p>
            </div>
            {/* 명시적 '처음 화면' 아이콘 버튼 (로고 클릭과 병행 — 발견성 강화). */}
            <motion.button
              type="button"
              onClick={handleGoLanding}
              aria-label="처음 화면으로"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="shrink-0 -mt-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-earth bg-white/70 hover:bg-white transition text-[10.5px] font-semibold text-basalt-2 hover:text-basalt"
            >
              <Home className="w-3 h-3" />
              <span>처음</span>
            </motion.button>
          </div>

          <WaveLine className="relative z-10 w-full h-5 mt-3" />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="relative z-10 font-serif-kr text-[15px] text-basalt mt-5 leading-[1.9] max-w-2xl"
          >
            우리는 <span className="text-citrus-2 font-bold">근거 있는 것만</span> 담고,
            <br />
            근거가 부족한 건 <span className="text-mint font-bold">분명하게</span> 알려드립니다.
          </motion.p>

          {state.step !== 'setup' && (
            <div className="relative z-10 mt-5 inline-flex items-center gap-0.5 p-1 bg-white/80 backdrop-blur rounded-full border border-earth shadow-sm">
              <button
                onClick={goToDashboard}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition ${
                  state.step === 'dashboard'
                    ? 'bg-citrus text-white shadow-jeju-chip'
                    : 'text-basalt-2 hover:text-basalt'
                }`}
              >
                내 팩
              </button>
              <button
                onClick={goToVerify}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition inline-flex items-center gap-1 ${
                  state.step === 'verify'
                    ? 'bg-citrus text-white shadow-jeju-chip'
                    : 'text-basalt-2 hover:text-basalt'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                리뷰 검증
              </button>
            </div>
          )}
        </header>

        {/* Content Flow Switcher with smooth page view animation transitions */}
        <main className="flex-1 flex flex-col justify-center" id="main-content-flow">
          <AnimatePresence mode="wait">
            {state.step === 'setup' && (
              <motion.div
                key="setup-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                <TrustMapDashboard
                  onSubmit={handleFormSubmit}
                  initialInfo={state.info.regions?.length ? state.info : undefined}
                  initialMoments={state.selectedMomentIds}
                />
              </motion.div>
            )}
            {state.step === 'dashboard' && (
              <motion.div
                key="dashboard-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                <PackingDashboard
                  info={state.info}
                  selectedMomentIds={state.selectedMomentIds}
                  checkedItemIds={state.checkedItemIds}
                  checkedMemoryIds={state.checkedMemoryIds}
                  customBasicItems={state.customBasicItems}
                  customMomentItems={state.customMomentItems}
                  customMemories={state.customMemories || []}
                  selectedPlanItems={state.selectedPlanItems || []}
                  visitChecks={state.visitChecks || {}}
                  onToggleItem={handleToggleItem}
                  onToggleMemory={handleToggleMemory}
                  onAddCustomBasic={handleAddCustomBasic}
                  onRemoveCustomBasic={handleRemoveCustomBasic}
                  onAddCustomMomentItem={handleAddCustomMomentItem}
                  onRemoveCustomMomentItem={handleRemoveCustomMomentItem}
                  onAddCustomMemory={handleAddCustomMemory}
                  onRemoveCustomMemory={handleRemoveCustomMemory}
                  onTogglePlanItem={handleTogglePlanItem}
                  onAddCustomPlanItem={handleAddCustomPlanItem}
                  onRemovePlanItem={handleRemovePlanItem}
                  onSetVisitCheck={handleSetVisitCheck}
                  onReset={handleReset}
                />
              </motion.div>
            )}
            {state.step === 'verify' && (
              <motion.div
                key="verify-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                <VerifyPage />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="text-center text-basalt-2/60 text-[10px] pt-16 pb-8 mt-auto" id="app-footer">
          <p className="font-hand text-[15px] text-basalt-2 mb-2">고맙수다.</p>
          <p>© 2026 제주를 담다</p>
        </footer>

      </div>

      {/* Modern React-based Custom Reset Confirmation Popover (replaces window.confirm for iframe reliability) */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" id="reset-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4"
              id="reset-modal-content"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 rounded-full bg-citrus/10 text-citrus mb-1" id="reset-modal-icon">
                  <CitrusMark className="w-7 h-7" />
                </div>
                <h3 className="font-serif-kr font-bold text-[17px] text-basalt">다시 시작하기</h3>
                <p className="text-[11.5px] text-basalt-2 leading-relaxed">
                  준비해둔 체크리스트가 초기화돼요.<br />
                  괜찮으시겠어요?
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-2.5 pt-1.5" id="reset-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="py-3 bg-white hover:bg-earth/10 text-basalt-2 font-bold text-xs rounded-2xl border-2 border-earth transition cursor-pointer"
                >
                  돌아가기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setState(defaultState);
                    setHarubanSessionKey((key) => key + 1);
                    setShowResetConfirm(false);
                  }}
                  className="py-3 bg-citrus hover:bg-citrus-2 text-white font-serif-kr font-bold text-[14px] rounded-2xl transition shadow-jeju-chip cursor-pointer"
                >
                  새로 시작
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 하루방 챗 위젯 — 우측 하단 상주. verify 페이지에서는 숨김 (검증 시연 화면 방해 방지). */}
      {state.step !== 'verify' && (
        <HarubanChat
          key={`haruban-${harubanSessionKey}`}
          info={state.info}
          selectedMomentIds={state.selectedMomentIds}
          selectedPlanItems={state.selectedPlanItems || []}
          visitChecks={state.visitChecks || {}}
          onApplySuggestion={handleHarubanApply}
          onAddPlanItem={handleAddCustomPlanItem}
          onOpenVerify={goToVerify}
        />
      )}

    </div>
  );
}

function HeaderJourneyScene() {
  return (
    <div
      className="pointer-events-none absolute right-0 top-0 z-0 hidden h-[168px] w-[64%] max-w-[940px] opacity-90 lg:block"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 940 168"
        className="h-full w-full"
        role="img"
        aria-label="한라산 능선과 산책하는 여행자들"
      >
        <defs>
          <linearGradient id="headerSkyFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#FBF6EA" stopOpacity="0" />
            <stop offset="58%" stopColor="#FBF6EA" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#FBF6EA" stopOpacity="0.64" />
          </linearGradient>
        </defs>

        <rect width="940" height="168" fill="url(#headerSkyFade)" />
        <path
          d="M0 97 C82 79 151 72 222 88 C302 106 367 83 452 68 C556 49 654 66 735 78 C814 89 880 72 940 58 L940 168 L0 168 Z"
          fill="#416F43"
          opacity="0.34"
        />
        <path
          d="M222 112 C342 83 443 91 548 74 C642 58 724 84 826 90 C870 93 907 83 940 74 L940 168 L222 168 Z"
          fill="#78A357"
          opacity="0.42"
        />
        <path
          d="M520 83 C570 49 606 17 662 8 C704 2 733 25 760 58 C783 86 852 91 940 78 L940 168 L487 168 Z"
          fill="#315F52"
          opacity="0.44"
        />
        <path
          d="M566 45 C604 27 658 21 716 37"
          fill="none"
          stroke="#8EA77A"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.45"
        />
        <path
          d="M704 42 C728 50 742 64 762 82"
          fill="none"
          stroke="#254C43"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.28"
        />
        <path
          d="M0 129 C118 112 195 123 298 111 C424 96 524 111 630 118 C748 125 839 109 940 113 L940 168 L0 168 Z"
          fill="#B8CD63"
          opacity="0.5"
        />
        <path
          d="M0 145 C122 132 218 143 333 133 C476 120 585 139 704 134 C802 130 870 118 940 123 L940 168 L0 168 Z"
          fill="#557E34"
          opacity="0.48"
        />
        <path
          d="M0 157 C98 147 194 153 296 147 C414 139 536 152 650 150 C762 148 842 138 940 143"
          fill="none"
          stroke="#2E5F2C"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.24"
        />

        <HikerFigure x={150} y={133} scale={0.88} shirt="#D7B08B" pants="#4A8779" pack="#B86E22" hair="#DDD4C2" pole />
        <HikerFigure x={223} y={134} scale={0.74} shirt="#E7683A" pants="#6B4E8D" pack="#7FA36A" hair="#C76B47" />
        <HikerFigure x={292} y={130} scale={0.94} shirt="#315F52" pants="#2E3235" pack="#6F8550" hair="#2E3235" pole />
        <HikerFigure x={386} y={135} scale={0.7} shirt="#4A8779" pants="#66715D" pack="#F0B36A" hair="#9A5F45" />
      </svg>
    </div>
  );
}

function HikerFigure({
  x,
  y,
  scale,
  shirt,
  pants,
  pack,
  hair,
  pole = false,
}: {
  x: number;
  y: number;
  scale: number;
  shirt: string;
  pants: string;
  pack: string;
  hair: string;
  pole?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity="0.9">
      <ellipse cx="2" cy="24" rx="29" ry="4" fill="#1E2E22" opacity="0.14" />
      {pole && (
        <path
          d="M20 -15 L29 25"
          fill="none"
          stroke="#6F5A42"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.68"
        />
      )}
      <path d="M-17 -48 C-6 -58 8 -56 17 -46 C9 -42 -5 -42 -17 -48 Z" fill={hair} />
      <circle cx="0" cy="-41" r="8.5" fill="#E9C6A3" />
      <path d="M-10 -45 C-4 -55 7 -53 13 -45 C8 -43 -3 -43 -10 -45 Z" fill={hair} />
      <path d="M-10 -32 C-14 -18 -11 -3 -4 5 C0 9 10 6 13 -1 C18 -13 14 -25 8 -34 Z" fill={shirt} />
      <path
        d="M-15 -31 C-31 -28 -34 -9 -23 1 C-17 6 -11 2 -11 -6 L-9 -30 Z"
        fill={pack}
      />
      <path
        d="M9 -27 C22 -19 25 -14 22 -6"
        fill="none"
        stroke={shirt}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M-8 -27 C-22 -19 -24 -9 -18 -1"
        fill="none"
        stroke={shirt}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M-4 4 C-13 12 -17 19 -21 25" fill="none" stroke={pants} strokeWidth="6" strokeLinecap="round" />
      <path d="M8 3 C15 12 20 18 28 21" fill="none" stroke={pants} strokeWidth="6" strokeLinecap="round" />
      <path d="M-23 25 L-33 25" fill="none" stroke="#2E3235" strokeWidth="3" strokeLinecap="round" />
      <path d="M29 21 L39 19" fill="none" stroke="#2E3235" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

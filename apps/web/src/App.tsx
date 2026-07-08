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
import { MOMENTS, REGIONS } from './data';

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
  const validRegions = new Set(REGIONS.map((region) => region.value));
  const validMoments = new Set(MOMENTS.map((moment) => moment.id));
  const regions = Array.isArray(info.regions)
    ? info.regions.filter((region: unknown) => typeof region === 'string' && validRegions.has(region as any))
    : info.region && validRegions.has(info.region)
      ? [info.region]
      : [];
  const selectedMomentIds = Array.isArray(saved.selectedMomentIds)
    ? saved.selectedMomentIds.filter((moment: unknown) => typeof moment === 'string' && validMoments.has(moment as any))
    : [];
  const step =
    saved.step === 'dashboard' && (regions.length === 0 || selectedMomentIds.length === 0)
      ? 'setup'
      : saved.step === 'dashboard' || saved.step === 'verify' || saved.step === 'setup'
        ? saved.step
        : 'setup';
  if (!Array.isArray(info.regions)) {
    delete info.region;
  }
  return {
    ...defaultState,
    ...saved,
    info: {
      ...defaultState.info,
      ...info,
      regions,
      durationDays:
        typeof info.durationDays === 'number' && Number.isFinite(info.durationDays) && info.durationDays > 0
          ? info.durationDays
          : defaultState.info.durationDays,
    },
    selectedMomentIds,
    checkedItemIds: Array.isArray(saved.checkedItemIds) ? saved.checkedItemIds : [],
    checkedMemoryIds: Array.isArray(saved.checkedMemoryIds) ? saved.checkedMemoryIds : [],
    customBasicItems: Array.isArray(saved.customBasicItems) ? saved.customBasicItems : [],
    customMomentItems:
      saved.customMomentItems && typeof saved.customMomentItems === 'object'
        ? saved.customMomentItems
        : defaultState.customMomentItems,
    customMemories: Array.isArray(saved.customMemories) ? saved.customMemories : [],
    selectedPlanItems: Array.isArray(saved.selectedPlanItems) ? saved.selectedPlanItems : [],
    visitChecks:
      saved.visitChecks && typeof saved.visitChecks === 'object'
        ? saved.visitChecks
        : {},
    step,
  };
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
    setState(prev => ({ ...prev, step: 'setup' }));
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
          <HeaderHallasanScene />
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

          <WaveLine className="relative z-20 w-full h-5 mt-3" />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="font-serif-kr text-[15px] text-basalt mt-5 leading-[1.9] max-w-2xl"
          >
            우리는 <span className="text-citrus-2 font-bold">근거 있는 것만</span> 담고,
            <br />
            근거가 부족한 건 <span className="text-mint font-bold">분명하게</span> 알려드립니다.
          </motion.p>

          {state.step !== 'setup' && (
            <div className="mt-5 inline-flex items-center gap-0.5 p-1 bg-white/80 backdrop-blur rounded-full border border-earth shadow-sm">
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

function HeaderHallasanScene() {
  return (
    <div
      className="pyj-header-hallasan pointer-events-none absolute right-0 top-4 z-0 hidden h-[90px] w-[63%] max-w-[830px] overflow-hidden lg:block"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 836 200"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="img"
        aria-label="한라산 초록 능선"
      >
        <path
          d="M-180 147 C-118 139 -62 128 0 119 C62 110 93 121 143 119 C207 116 253 96 315 111 C366 124 419 126 481 113 C551 99 611 76 681 74 C746 72 793 85 874 83 L874 200 L-180 200 Z"
          fill="#82986C"
          opacity="0.58"
        />
        <path
          d="M-180 166 C-95 158 -24 148 50 140 C126 132 195 140 264 127 C356 112 431 105 516 99 C606 93 690 96 874 112 L874 200 L-180 200 Z"
          fill="#B6C989"
          opacity="0.72"
        />
        <path
          d="M356 125 C394 107 424 88 452 61 C479 35 510 15 544 6 C571 -1 596 6 617 21 C642 39 661 61 688 80 C720 102 779 104 874 99 L874 200 L340 200 Z"
          fill="#6F8A61"
          opacity="0.76"
        />
        <path
          d="M450 64 C477 38 515 16 559 5 C576 1 590 5 604 14 C581 17 562 26 546 39 C524 58 507 77 480 91 C452 106 414 115 356 128 C384 104 419 91 450 64 Z"
          fill="#A6AF72"
          opacity="0.68"
        />
        <path
          d="M554 21 C584 12 609 17 631 34"
          fill="none"
          stroke="#8F9965"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.42"
        />
        <path
          d="M640 45 C663 63 669 81 684 98"
          fill="none"
          stroke="#57765A"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.3"
        />
        <path
          d="M697 64 C724 82 758 92 812 96"
          fill="none"
          stroke="#57765A"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.26"
        />
        <path
          d="M-180 178 C-82 171 12 164 96 160 C170 156 239 151 311 146 C438 139 553 135 665 122 C737 114 791 112 874 113 L874 200 L-180 200 Z"
          fill="#C5D47F"
          opacity="0.82"
        />
      </svg>
    </div>
  );
}

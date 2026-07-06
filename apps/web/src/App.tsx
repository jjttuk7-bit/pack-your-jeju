import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck } from 'lucide-react';
import { TravelInfo, MomentId, SavedTravel } from './types';
import TravelForm from './components/TravelForm';
import PackingDashboard from './components/PackingDashboard';
import VerifyPage from './components/VerifyPage';
import HarubanChat from './components/HarubanChat';
import LandingPage from './components/LandingPage';
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
  customMemories: []
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

  // 시연용 문지기 상태. 초대 코드 통과 여부만 localStorage에 저장한다.
  const [authenticated, setAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GATE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleEnter = () => {
    try {
      localStorage.setItem(GATE_STORAGE_KEY, 'true');
    } catch {}
    setAuthenticated(true);
  };

  // 게이트 미통과 상태에서는 랜딩만 렌더 — 하루방 위젯 · 상단 헤더 모두 감춤.
  if (!authenticated) {
    return <LandingPage onEnter={handleEnter} />;
  }

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  }, [state]);

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
      <div className="w-full max-w-lg flex flex-col flex-1" id="app-container">

        {/* Header — 비대칭, 왼쪽 정렬, 감귤 마스코트 */}
        <header className="pt-2 pb-8" id="app-header">
          <div className="flex items-start gap-4 mb-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.75, rotate: -12 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, type: 'spring' }}
              className="shrink-0 -mt-1"
            >
              <CitrusMark className="w-[68px] h-[68px]" />
            </motion.div>
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
                Pack Your Jeju
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
          </div>

          <WaveLine className="w-full h-5 mt-3" />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="font-serif-kr text-[15px] text-basalt mt-5 leading-[1.9] max-w-md"
          >
            우리는 <span className="text-citrus-2 font-bold">근거 있는 것만</span> 담고,
            <br />
            없는 건 <span className="text-mint font-bold">정직하게</span> 비워둡니다.
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
                <TravelForm
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
                  onToggleItem={handleToggleItem}
                  onToggleMemory={handleToggleMemory}
                  onAddCustomBasic={handleAddCustomBasic}
                  onRemoveCustomBasic={handleRemoveCustomBasic}
                  onAddCustomMomentItem={handleAddCustomMomentItem}
                  onRemoveCustomMomentItem={handleRemoveCustomMomentItem}
                  onAddCustomMemory={handleAddCustomMemory}
                  onRemoveCustomMemory={handleRemoveCustomMemory}
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
          <p>© 2026 Pack Your Jeju</p>
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
          info={state.info}
          selectedMomentIds={state.selectedMomentIds}
          onApplySuggestion={handleHarubanApply}
        />
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Luggage, ShieldCheck } from 'lucide-react';
import { TravelInfo, MomentId, SavedTravel } from './types';
import TravelForm from './components/TravelForm';
import PackingDashboard from './components/PackingDashboard';
import VerifyPage from './components/VerifyPage';

const LOCAL_STORAGE_KEY = 'pack_your_jeju_state_v1';

const defaultState: SavedTravel = {
  info: {
    region: 'jeju_city',
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

export default function App() {
  const [state, setState] = useState<SavedTravel>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
    }
    return defaultState;
  });

  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans relative flex flex-col items-center px-4 py-8 antialiased selection:bg-orange-100 selection:text-orange-900" id="app-root">
      
      {/* Background Decorative Grayish Slate Accent */}
      <div className="absolute top-0 left-0 w-full h-80 bg-gradient-to-b from-slate-100 to-transparent pointer-events-none -z-10" />
      
      {/* Container */}
      <div className="w-full max-w-lg flex flex-col flex-1" id="app-container">
        
        {/* Header Block with App Identity */}
        <header className="text-center pt-4 pb-8" id="app-header">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-orange-50 rounded-full border border-orange-100 mb-3"
          >
            <Luggage className="w-4 h-4 text-orange-650" />
            <span className="text-[10px] font-bold text-orange-650 uppercase tracking-widest">
              Trust-Verified Jeju Trip Prep
            </span>
          </motion.div>

          {/* Main Logo & Copy Title */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-3xl font-extrabold text-stone-900 tracking-tight"
            id="brand-name"
          >
            Pack Your Jeju 🍊
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-xs font-medium text-stone-500 mt-2 max-w-xs mx-auto leading-relaxed"
            id="main-subtitle-copy"
          >
            "짐을 싸기 전에, 그 순간이 진짜인지부터 확인합니다."
          </motion.p>

          {state.step !== 'setup' && (
            <div className="mt-4 flex items-center justify-center gap-1.5">
              <button
                onClick={goToDashboard}
                className={`px-3 py-1.5 rounded-full text-[10px] font-semibold border transition ${
                  state.step === 'dashboard'
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                내 팩
              </button>
              <button
                onClick={goToVerify}
                className={`px-3 py-1.5 rounded-full text-[10px] font-semibold border transition inline-flex items-center gap-1 ${
                  state.step === 'verify'
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
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
                  initialInfo={state.info.region ? state.info : undefined}
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

        {/* Brand-consistent clean and humble footer (No low-quality slop telemetry or diagnostic print lines) */}
        <footer className="text-center text-stone-400 text-[10px] py-10 mt-auto border-t border-stone-200/40" id="app-footer">
          <p>© 2026 Pack Your Jeju. 근거 있는 것만, 정직하게.</p>
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
                <div className="inline-flex p-3.5 rounded-full bg-orange-50 text-orange-600 mb-1" id="reset-modal-icon">
                  <Luggage className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">새롭게 여행 준비하기</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  정말로 새 여행 준비를 시작하시겠습니까?<br />
                  기존에 준비 해둔 체크리스트와 기록들이 모두 정리됩니다.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-2.5 pt-1.5" id="reset-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-2xl border border-slate-200 transition cursor-pointer"
                >
                  돌아가기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setState(defaultState);
                    setShowResetConfirm(false);
                  }}
                  className="py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-2xl transition shadow-md shadow-orange-100 cursor-pointer"
                >
                  새로 시작
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

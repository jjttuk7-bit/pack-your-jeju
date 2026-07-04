import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Users,
  Compass,
  Sparkles,
  Check,
  ArrowRight,
} from 'lucide-react';
import type { TravelInfo, MomentId, RegionId, CompanionValue, PurposeValue } from '../types';
import { COMPANIONS, PURPOSES, MOMENTS } from '../data';
import RegionChips from './RegionChips';

interface TravelFormProps {
  onSubmit: (info: TravelInfo, selectedMoments: MomentId[]) => void;
  initialInfo?: TravelInfo;
  initialMoments?: MomentId[];
}

export default function TravelForm({ onSubmit, initialInfo, initialMoments }: TravelFormProps) {
  const [region, setRegion] = useState<RegionId | ''>(initialInfo?.region || '');
  const [startDate, setStartDate] = useState(
    initialInfo?.startDate || new Date().toISOString().split('T')[0]
  );
  const [durationDays, setDurationDays] = useState<number>(initialInfo?.durationDays || 3);
  const [companion, setCompanion] = useState<CompanionValue>(initialInfo?.companion || 'solo');
  const [purpose, setPurpose] = useState<PurposeValue>(initialInfo?.purpose || 'healing');
  const [selectedMomentIds, setSelectedMomentIds] = useState<MomentId[]>(initialMoments || []);
  const [activeTab, setActiveTab] = useState<'basic' | 'moments'>('basic');
  const [errorMsg, setErrorMsg] = useState('');

  const toggleMoment = (id: MomentId) => {
    setSelectedMomentIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleNextToMoments = () => {
    if (!region) {
      setErrorMsg('제주 안에서 어디로 가실지 지역을 하나 골라 주세요.');
      return;
    }
    setErrorMsg('');
    setActiveTab('moments');
  };

  const handleSubmitAll = () => {
    if (!region) {
      setErrorMsg('지역을 다시 확인해 주세요.');
      setActiveTab('basic');
      return;
    }
    if (selectedMomentIds.length === 0) {
      setErrorMsg('제주에서 기대되는 순간을 최소 하나만 골라 주세요. ✨');
      return;
    }
    setErrorMsg('');
    onSubmit(
      { region: region as RegionId, startDate, durationDays, companion, purpose },
      selectedMomentIds
    );
  };

  return (
    <div className="w-full max-w-md mx-auto card-jeju p-6 sm:p-8" id="travel-form">
      <div className="relative flex items-center mb-8 pb-3" id="form-tab-nav">
        <button
          onClick={() => setActiveTab('basic')}
          className={`relative flex-1 text-center pb-2 text-[13px] font-semibold transition ${
            activeTab === 'basic' ? 'text-basalt' : 'text-basalt-2/60 hover:text-basalt-2'
          }`}
          id="tab-basic-btn"
        >
          <span className="font-serif-kr">떠나기 전에</span>
          {activeTab === 'basic' && (
            <motion.div
              layoutId="tab-underline"
              className="absolute left-1/4 right-1/4 -bottom-[7px] h-[2px] bg-citrus rounded-full z-10"
            />
          )}
        </button>
        <button
          onClick={handleNextToMoments}
          className={`relative flex-1 text-center pb-2 text-[13px] font-semibold transition ${
            activeTab === 'moments' ? 'text-basalt' : 'text-basalt-2/60 hover:text-basalt-2'
          }`}
          id="tab-moments-btn"
        >
          <span className="font-serif-kr">순간 고르기</span>{' '}
          <span className={`text-[11px] ${activeTab === 'moments' ? 'text-citrus-2' : 'text-basalt-2/60'}`}>
            {selectedMomentIds.length}
          </span>
          {activeTab === 'moments' && (
            <motion.div
              layoutId="tab-underline"
              className="absolute left-1/4 right-1/4 -bottom-[7px] h-[2px] bg-citrus rounded-full z-10"
            />
          )}
        </button>
        <div className="absolute left-0 right-0 bottom-0 h-px bg-earth/50" />
      </div>

      {activeTab === 'basic' ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-7"
          id="form-step-basic"
        >
          <div>
            <p className="font-hand text-[16px] text-citrus-2 mb-1">잠깐,</p>
            <h2 className="font-serif-kr text-[24px] font-bold text-basalt tracking-tight leading-snug">
              이번 제주는 <br />어떤 얼굴로 만나실래요?
            </h2>
            <p className="text-[11.5px] text-basalt-2 mt-2 leading-relaxed">
              지역·기간·동행을 알려주세요. 나머지는 공공데이터에 물어봅니다.
            </p>
          </div>

          <RegionChips value={region} onChange={setRegion} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-bold text-basalt-2 mb-1.5 flex items-center gap-1 uppercase tracking-[0.14em]">
                <Calendar className="w-3 h-3 text-basalt-2/60" /> 언제부터
              </label>
              <input
                id="form-start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-earth bg-white/60 text-basalt text-sm focus:outline-none focus:ring-2 focus:ring-citrus/25 focus:border-citrus transition"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-bold text-basalt-2 mb-1.5 flex items-center gap-1 uppercase tracking-[0.14em]">
                <Calendar className="w-3 h-3 text-basalt-2/60" /> 며칠간
              </label>
              <div className="flex items-center border border-earth rounded-xl bg-white/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDurationDays((d) => Math.max(1, d - 1))}
                  className="w-9 py-2.5 text-basalt-2 hover:bg-citrus/10 transition text-base font-medium"
                >
                  −
                </button>
                <span className="flex-1 text-center text-[13px] font-semibold text-basalt font-serif-kr">
                  {durationDays - 1 > 0 ? `${durationDays - 1}박 ${durationDays}일` : '당일치기'}
                </span>
                <button
                  type="button"
                  onClick={() => setDurationDays((d) => Math.min(14, d + 1))}
                  className="w-9 py-2.5 text-basalt-2 hover:bg-citrus/10 transition text-base font-medium"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-bold text-basalt-2 mb-2.5 flex items-center gap-1 uppercase tracking-[0.14em]">
              <Users className="w-3 h-3 text-basalt-2/60" /> 옆에 함께 있는 사람
            </label>
            <div className="grid grid-cols-2 gap-2" id="grid-companions">
              {COMPANIONS.map((item) => {
                const active = companion === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    id={`companion-btn-${item.value}`}
                    onClick={() => setCompanion(item.value)}
                    className={`px-3.5 py-2.5 rounded-xl border-2 text-[12.5px] text-left transition-all duration-200 flex items-center justify-between hover:-translate-y-px ${
                      active
                        ? 'border-citrus bg-citrus/8 text-citrus-2 font-bold shadow-jeju-chip'
                        : 'border-earth bg-white/70 text-basalt-2 hover:border-citrus/50 hover:bg-citrus/5'
                    }`}
                  >
                    <span>{item.label}</span>
                    {active && (
                      <span className="w-4 h-4 rounded-full bg-citrus flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-white stroke-[4]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-bold text-basalt-2 mb-2.5 flex items-center gap-1 uppercase tracking-[0.14em]">
              <Compass className="w-3 h-3 text-basalt-2/60" /> 가장 하고 싶은 것
            </label>
            <div className="space-y-1.5" id="list-purposes">
              {PURPOSES.map((item) => {
                const active = purpose === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    id={`purpose-btn-${item.value}`}
                    onClick={() => setPurpose(item.value)}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-[13px] text-left transition-all duration-200 flex items-center justify-between ${
                      active
                        ? 'border-citrus bg-citrus/8 text-citrus-2 font-bold shadow-jeju-chip'
                        : 'border-earth bg-white/70 text-basalt-2 hover:border-citrus/50 hover:bg-citrus/5'
                    }`}
                  >
                    <span>{item.label}</span>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                        active ? 'bg-citrus border-citrus' : 'border-earth bg-white'
                      }`}
                    >
                      {active && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <p
              className="text-[12px] text-rose-700 font-medium bg-rose-50 p-3 rounded-xl border border-rose-100"
              id="basic-error-msg"
            >
              ⚠️ {errorMsg}
            </p>
          )}

          <button
            type="button"
            id="btn-goto-moments"
            onClick={handleNextToMoments}
            className="w-full mt-2 py-3.5 rounded-2xl bg-citrus hover:bg-citrus-2 text-white font-serif-kr font-bold text-[15px] transition shadow-jeju-chip flex items-center justify-center gap-2 cursor-pointer"
          >
            어떤 순간을 담을지 고르기
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
          id="form-step-moments"
        >
          <div>
            <p className="font-hand text-[16px] text-citrus-2 mb-1">담고 싶은 것,</p>
            <h2 className="font-serif-kr text-[24px] font-bold text-basalt tracking-tight leading-snug">
              어떤 순간을 챙길까요?
            </h2>
            <p className="text-[11.5px] text-basalt-2 mt-2 leading-relaxed">
              공공데이터로 검증된 곳만 골라 드립니다.
              <span className="text-citrus-2 font-semibold"> · 여러 개 선택</span>
            </p>
          </div>

          <div
            className="space-y-2 max-h-[400px] overflow-y-auto pr-1 select-none"
            id="moments-list-viewport"
          >
            {MOMENTS.map((moment) => {
              const isSelected = selectedMomentIds.includes(moment.id);
              return (
                <div
                  key={moment.id}
                  id={`moment-card-selector-${moment.id}`}
                  onClick={() => toggleMoment(moment.id)}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer flex gap-3 items-start relative ${
                    isSelected
                      ? 'border-citrus bg-citrus/8 shadow-jeju-chip'
                      : 'border-earth bg-white/70 hover:border-citrus/50 hover:bg-citrus/5'
                  }`}
                >
                  <span className="text-2xl mt-0.5 leading-none">{moment.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-serif-kr font-bold text-[14px] tracking-tight ${isSelected ? 'text-citrus-2' : 'text-basalt'}`}>
                      {moment.title}
                    </h3>
                    <p className="text-[11.5px] text-basalt-2 line-clamp-2 mt-0.5 leading-relaxed">
                      {moment.description}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-citrus border-citrus text-white' : 'border-earth bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[4]" />}
                  </div>
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <p
              className="text-[12px] text-rose-700 font-medium bg-rose-50 p-3 rounded-xl border border-rose-100"
              id="moments-error-msg"
            >
              ⚠️ {errorMsg}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2">
            <button
              type="button"
              id="btn-back-to-basic"
              onClick={() => setActiveTab('basic')}
              className="py-3 rounded-2xl border-2 border-earth bg-white/70 hover:bg-white text-basalt-2 font-medium text-xs transition text-center cursor-pointer"
            >
              이전
            </button>
            <button
              type="button"
              id="btn-generate-list"
              onClick={handleSubmitAll}
              className="col-span-2 py-3.5 rounded-2xl bg-citrus hover:bg-citrus-2 text-white font-serif-kr font-bold text-[15px] transition shadow-jeju-chip flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-white/70" />
              근거 있는 팩 받기
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Users,
  Compass,
  Sparkles,
  Check,
  ArrowRight,
  Palmtree,
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
    <div
      className="w-full max-w-md mx-auto bg-white rounded-[28px] border border-orange-100/60 shadow-pyj-card p-6 sm:p-8"
      id="travel-form"
    >
      <div className="relative flex items-center mb-8 pb-3" id="form-tab-nav">
        <button
          onClick={() => setActiveTab('basic')}
          className={`relative flex-1 text-center pb-2 text-[13px] font-semibold transition ${
            activeTab === 'basic' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
          }`}
          id="tab-basic-btn"
        >
          1. 여행 계획하기
          {activeTab === 'basic' && (
            <motion.div
              layoutId="tab-underline"
              className="absolute left-1/4 right-1/4 -bottom-[7px] h-[2px] bg-orange-600 rounded-full z-10"
            />
          )}
        </button>
        <button
          onClick={handleNextToMoments}
          className={`relative flex-1 text-center pb-2 text-[13px] font-semibold transition ${
            activeTab === 'moments' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
          }`}
          id="tab-moments-btn"
        >
          2. 순간 고르기{' '}
          <span className={`text-[11px] ${activeTab === 'moments' ? 'text-orange-600' : 'text-stone-400'}`}>
            ({selectedMomentIds.length})
          </span>
          {activeTab === 'moments' && (
            <motion.div
              layoutId="tab-underline"
              className="absolute left-1/4 right-1/4 -bottom-[7px] h-[2px] bg-orange-600 rounded-full z-10"
            />
          )}
        </button>
        {/* 회색 기본 트랙 (오렌지 밑줄이 이 위에 얹힘) */}
        <div className="absolute left-0 right-0 bottom-0 h-px bg-stone-100" />
      </div>

      {activeTab === 'basic' ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
          id="form-step-basic"
        >
          <div className="text-center mb-2">
            <span className="inline-flex p-3 rounded-2xl bg-orange-50 text-orange-600 mb-3 border border-orange-100">
              <Palmtree className="w-5 h-5" />
            </span>
            <h2 className="text-[22px] font-bold text-stone-900 tracking-tight leading-snug">
              제주에서 어떤 시간을 보내실까요?
            </h2>
            <p className="text-[11.5px] text-stone-500 mt-2 leading-relaxed">
              머릿속 가벼운 스케치를 들려주세요.<br />
              근거가 있는 것만 준비해 드립니다.
            </p>
          </div>

          <RegionChips value={region} onChange={setRegion} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1.5 flex items-center gap-1 uppercase tracking-wide">
                <Calendar className="w-3 h-3 text-stone-400" /> 출발일
              </label>
              <input
                id="form-start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-[#FDFBF7] text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1.5 flex items-center gap-1 uppercase tracking-wide">
                <Calendar className="w-3 h-3 text-stone-400" /> 기간
              </label>
              <div className="flex items-center border border-stone-200 rounded-xl bg-[#FDFBF7] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDurationDays((d) => Math.max(1, d - 1))}
                  className="w-9 py-2.5 text-stone-500 hover:bg-stone-100 transition text-base font-medium"
                >
                  −
                </button>
                <span className="flex-1 text-center text-[13px] font-semibold text-stone-900">
                  {durationDays - 1 > 0 ? `${durationDays - 1}박 ${durationDays}일` : '당일치기'}
                </span>
                <button
                  type="button"
                  onClick={() => setDurationDays((d) => Math.min(14, d + 1))}
                  className="w-9 py-2.5 text-stone-500 hover:bg-stone-100 transition text-base font-medium"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-stone-500 mb-2 flex items-center gap-1 uppercase tracking-wide">
              <Users className="w-3 h-3 text-stone-400" /> 동행자
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
                        ? 'border-orange-500 bg-orange-50 text-orange-950 font-semibold shadow-pyj-chip'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-orange-200 hover:bg-orange-50/30'
                    }`}
                  >
                    <span>{item.label}</span>
                    {active && (
                      <span className="w-4 h-4 rounded-full bg-orange-600 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-white stroke-[4]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-slate-400" /> 이번 여행의 가장 큰 목적은?
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
                        ? 'border-orange-500 bg-orange-50 text-orange-950 font-semibold shadow-pyj-chip'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-orange-200 hover:bg-orange-50/30'
                    }`}
                  >
                    <span>{item.label}</span>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                        active ? 'bg-orange-600 border-orange-600' : 'border-stone-300 bg-white'
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
            className="w-full mt-2 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition-all duration-200 shadow-pyj-chip flex items-center justify-center gap-2 cursor-pointer"
          >
            기대되는 순간 고르러 가기
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
          <div className="text-center mb-2">
            <span className="inline-flex p-3 rounded-2xl bg-orange-50 text-orange-600 mb-3 border border-orange-100">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-[22px] font-bold text-stone-900 tracking-tight leading-snug">
              어떤 순간을 원하시나요?
            </h2>
            <p className="text-[11.5px] text-stone-500 mt-2 leading-relaxed">
              공공데이터로 검증된 곳만 골라 보여드립니다.<br />
              <span className="text-orange-600 font-semibold">(다중 선택 가능)</span>
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
                  className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex gap-3 items-start relative ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50/60 shadow-pyj-chip'
                      : 'border-stone-200 bg-white hover:border-orange-200 hover:bg-orange-50/20'
                  }`}
                >
                  <span className="text-2xl mt-0.5 leading-none">{moment.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-[13.5px] tracking-tight ${isSelected ? 'text-orange-950' : 'text-stone-900'}`}>
                      {moment.title}
                    </h3>
                    <p className="text-[11.5px] text-stone-500 line-clamp-2 mt-0.5 leading-relaxed">
                      {moment.description}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-orange-600 border-orange-600 text-white' : 'border-stone-300 bg-white'
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
              className="py-3 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 font-medium text-xs transition text-center cursor-pointer"
            >
              이전
            </button>
            <button
              type="button"
              id="btn-generate-list"
              onClick={handleSubmitAll}
              className="col-span-2 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition shadow-pyj-chip flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-orange-100" />
              근거 있는 팩 받기
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

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
      className="w-full max-w-md mx-auto bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 p-6 sm:p-8"
      id="travel-form"
    >
      <div className="flex items-center justify-between mb-8 pb-3 border-b border-slate-100" id="form-tab-nav">
        <button
          onClick={() => setActiveTab('basic')}
          className={`flex-1 text-center pb-2 text-sm font-semibold transition-all duration-300 ${
            activeTab === 'basic'
              ? 'text-orange-650 border-b-2 border-orange-600'
              : 'text-slate-400 font-normal hover:text-slate-600'
          }`}
          id="tab-basic-btn"
        >
          1. 여행 계획하기
        </button>
        <button
          onClick={handleNextToMoments}
          className={`flex-1 text-center pb-2 text-sm font-semibold transition-all duration-300 ${
            activeTab === 'moments'
              ? 'text-orange-650 border-b-2 border-orange-600'
              : 'text-slate-400 font-normal hover:text-slate-600'
          }`}
          id="tab-moments-btn"
        >
          2. 순간 고르기 ({selectedMomentIds.length})
        </button>
      </div>

      {activeTab === 'basic' ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
          id="form-step-basic"
        >
          <div className="text-center mb-6">
            <span className="inline-flex p-3 rounded-2xl bg-orange-50 text-orange-600 mb-2">
              <Palmtree className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              제주에서 어떤 시간을 보내실까요?
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              머릿속 가벼운 스케치를 들려주세요. 근거가 있는 것만 준비해 드립니다.
            </p>
          </div>

          <RegionChips value={region} onChange={setRegion} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> 언제 떠나나요?
              </label>
              <input
                id="form-start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 bg-[#FAF9F6] text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> 며칠간 머무나요?
              </label>
              <div className="flex items-center border border-slate-200 rounded-2xl bg-[#FAF9F6] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDurationDays((d) => Math.max(1, d - 1))}
                  className="px-3 py-2 text-slate-500 hover:bg-slate-200 transition font-bold"
                >
                  -
                </button>
                <span className="flex-1 text-center text-sm font-semibold text-slate-800">
                  {durationDays}일간 (
                  {durationDays - 1 > 0 ? `${durationDays - 1}박 ${durationDays}일` : '당일치기'})
                </span>
                <button
                  type="button"
                  onClick={() => setDurationDays((d) => Math.min(14, d + 1))}
                  className="px-3 py-2 text-slate-500 hover:bg-slate-200 transition font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" /> 누구와 함께 하나요?
            </label>
            <div className="grid grid-cols-2 gap-2" id="grid-companions">
              {COMPANIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  id={`companion-btn-${item.value}`}
                  onClick={() => setCompanion(item.value)}
                  className={`px-3 py-2.5 rounded-xl border text-xs text-left transition-all duration-200 flex items-center justify-between ${
                    companion === item.value
                      ? 'border-orange-500 bg-orange-50 text-orange-950 font-semibold shadow-sm shadow-orange-50'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>{item.label}</span>
                  {companion === item.value && <Check className="w-3.5 h-3.5 text-orange-600 stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-slate-400" /> 이번 여행의 가장 큰 목적은?
            </label>
            <div className="space-y-1.5" id="list-purposes">
              {PURPOSES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  id={`purpose-btn-${item.value}`}
                  onClick={() => setPurpose(item.value)}
                  className={`w-full px-4 py-3 rounded-xl border text-xs text-left transition-all duration-200 flex items-center justify-between ${
                    purpose === item.value
                      ? 'border-orange-500 bg-orange-50 text-orange-950 font-semibold'
                      : 'border-slate-200 bg-white text-slate-650 hover:border-slate-300'
                  }`}
                >
                  <span>{item.label}</span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      purpose === item.value ? 'bg-orange-600 border-orange-600' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {purpose === item.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <p
              className="text-xs text-red-650 font-medium bg-red-50 p-2.5 rounded-xl border border-red-100"
              id="basic-error-msg"
            >
              ⚠️ {errorMsg}
            </p>
          )}

          <button
            type="button"
            id="btn-goto-moments"
            onClick={handleNextToMoments}
            className="w-full mt-2 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition-all duration-200 shadow-md shadow-orange-100 flex items-center justify-center gap-2 cursor-pointer"
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
          <div className="text-center mb-4">
            <span className="inline-flex p-3 rounded-2xl bg-orange-50 text-orange-600 mb-2">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </span>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              제주에서 어떤 순간을 원하시나요?
            </h2>
            <p className="text-xs text-slate-555 mt-1">
              공공데이터로 검증된 곳만 골라 보여드립니다.{' '}
              <br />
              <span className="text-orange-600 font-semibold">(다중 선택 가능)</span>
            </p>
          </div>

          <div
            className="space-y-3 max-h-[360px] overflow-y-auto pr-1 select-none scrollbar-thin scrollbar-thumb-slate-200"
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
                      ? 'border-orange-500 bg-orange-50/40 shadow-inner'
                      : 'border-slate-250 bg-white hover:border-slate-350'
                  }`}
                >
                  <span className="text-2xl mt-0.5">{moment.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-slate-800">{moment.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                      {moment.description}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border shrink-0 mt-1 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-orange-600 border-orange-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <p
              className="text-xs text-red-650 font-medium bg-red-50 p-2.5 rounded-xl border border-red-100"
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
              className="py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium text-xs transition duration-200 text-center cursor-pointer"
            >
              이전 단계
            </button>
            <button
              type="button"
              id="btn-generate-list"
              onClick={handleSubmitAll}
              className="col-span-2 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition duration-205 shadow-md shadow-orange-100 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 fill-orange-100/20 text-orange-200 animate-pulse" />
              근거 있는 팩 받기
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { MapPin, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { REGIONS, LANDMARK_HINTS } from '../data';
import type { RegionId } from '../types';

interface RegionChipsProps {
  value: RegionId | '';
  onChange: (region: RegionId) => void;
}

/**
 * 제주 12지역 칩 UI.
 * 자유입력을 만들지 않아 region_normalized 정규화 오류를 원천 차단 (D-10).
 * 대신 대표 관광지 힌트를 두 자리에 노출해 사용자 UX 보완:
 *   - 선택된 지역 아래에 그 지역 대표 관광지 3개
 *   - 하단에 접기/펼치기 "관광지로 지역 찾기" (역방향 매핑)
 */
export default function RegionChips({ value, onChange }: RegionChipsProps) {
  const [showHints, setShowHints] = useState(false);
  const selected = REGIONS.find((r) => r.value === value);

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
        <MapPin className="w-3.5 h-3.5 text-slate-400" /> 제주 어디로 가시나요?
      </label>
      <div className="flex flex-wrap gap-1.5" id="region-chips">
        {REGIONS.map((r) => {
          const active = value === r.value;
          return (
            <button
              key={r.value}
              type="button"
              id={`region-chip-${r.value}`}
              onClick={() => onChange(r.value)}
              className={`px-3 py-2 rounded-full text-xs font-semibold border transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                active
                  ? 'border-orange-500 bg-orange-50 text-orange-950 shadow-sm shadow-orange-50'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <span>{r.emoji}</span>
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-2 text-[11px] text-orange-800 bg-orange-50/60 border border-orange-100 rounded-xl px-3 py-2 leading-relaxed">
          <span className="font-semibold">{selected.label} 대표 명소</span> ·{' '}
          {selected.landmarks.join(' · ')}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowHints((v) => !v)}
        className="mt-2 flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 transition"
      >
        <HelpCircle className="w-3 h-3" />
        관광지 이름으로 지역 찾기
        {showHints ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {showHints && (
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
          {LANDMARK_HINTS.map((h) => (
            <div key={h.name} className="flex items-center justify-between gap-2">
              <span className="truncate">{h.name}</span>
              <span className="font-semibold text-orange-700 shrink-0">→ {h.regionLabel}</span>
            </div>
          ))}
          <p className="col-span-2 mt-1 text-[10px] text-slate-400">
            여기 없는 관광지도 12지역 중 한 곳에 속해요. 근처 지명으로 유추해 보세요.
          </p>
        </div>
      )}
    </div>
  );
}

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
      <label className="block text-[10.5px] font-bold text-basalt-2 mb-2.5 flex items-center gap-1 uppercase tracking-[0.14em]">
        <MapPin className="w-3 h-3 text-basalt-2/60" /> 제주 어디로
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
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all duration-200 flex items-center gap-1 cursor-pointer hover:-translate-y-px ${
                active
                  ? 'border-citrus bg-citrus text-white shadow-jeju-chip'
                  : 'border-earth bg-white/70 text-basalt hover:border-citrus/60 hover:text-citrus-2 hover:shadow-sm'
              }`}
            >
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-3 text-[11.5px] card-citrus px-3.5 py-2.5 leading-relaxed">
          <span className="font-serif-kr font-bold text-citrus-2 text-[13px]">{selected.label}</span>
          <span className="text-basalt-2 mx-1.5">에는</span>
          <span className="text-basalt">{selected.landmarks.join(' · ')}</span>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowHints((v) => !v)}
        className="mt-2 flex items-center gap-1 text-[10.5px] text-basalt-2 hover:text-citrus-2 transition"
      >
        <HelpCircle className="w-3 h-3" />
        관광지 이름으로 지역 찾기
        {showHints ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {showHints && (
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px] text-basalt-2 bg-white/70 border border-earth rounded-xl px-3 py-2.5">
          {LANDMARK_HINTS.map((h) => (
            <div key={h.name} className="flex items-center justify-between gap-2">
              <span className="truncate">{h.name}</span>
              <span className="font-semibold text-citrus-2 shrink-0">→ {h.regionLabel}</span>
            </div>
          ))}
          <p className="col-span-2 mt-1.5 pt-1.5 border-t border-earth/50 text-[10px] text-basalt-2/70 leading-relaxed">
            여기 없는 곳도 12지역 중 하나에 속해요.
          </p>
        </div>
      )}
    </div>
  );
}

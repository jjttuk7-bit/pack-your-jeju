import { MapPin } from 'lucide-react';
import { REGIONS } from '../data';
import type { RegionId } from '../types';

interface RegionChipsProps {
  value: RegionId | '';
  onChange: (region: RegionId) => void;
}

/**
 * 제주 12지역 칩 UI.
 * 원본 destination 자유입력을 완전 대체 (D-10 · MOMENT_CARDS 프론트 지침).
 * 자유입력 자체를 만들지 않아 region_normalized 정규화 오류를 원천 차단.
 */
export default function RegionChips({ value, onChange }: RegionChipsProps) {
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
      <p className="text-[10px] text-slate-400 mt-1.5">
        제주 전용 서비스라 12지역 중에서만 선택할 수 있어요.
      </p>
    </div>
  );
}

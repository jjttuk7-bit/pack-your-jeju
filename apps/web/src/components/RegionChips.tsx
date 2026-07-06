import { useEffect, useState } from 'react';
import {
  MapPin,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Check,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { REGIONS, LANDMARK_HINTS } from '../data';
import type { RegionEntry } from '../data';
import type { RegionCoveragePreview, RegionId } from '../types';
import { requestRegionCoveragePreview } from '../api';

interface RegionChipsProps {
  value: RegionId[];                       // 다중 선택
  onChange: (regions: RegionId[]) => void;
}

const REGION_MAP_POINTS: Record<RegionId, { x: number; y: number; short: string }> = {
  jeju_city: { x: 48, y: 27, short: '제주시' },
  aewol: { x: 28, y: 35, short: '애월' },
  hallim: { x: 17, y: 49, short: '한림' },
  jocheon: { x: 62, y: 31, short: '조천' },
  gujwa: { x: 75, y: 36, short: '구좌' },
  seongsan: { x: 84, y: 52, short: '성산' },
  udo: { x: 91, y: 42, short: '우도' },
  pyoseon: { x: 73, y: 66, short: '표선' },
  namwon: { x: 58, y: 74, short: '남원' },
  seogwipo: { x: 45, y: 78, short: '서귀포' },
  andeok: { x: 28, y: 75, short: '안덕' },
  daejeong: { x: 15, y: 69, short: '대정' },
};

/**
 * 제주 12지역 칩 UI — 다중 선택.
 * 자유입력을 만들지 않아 region_normalized 정규화 오류를 원천 차단 (D-10).
 * 제주 여행 실제 UX 반영: 대부분 여행자는 여러 지역을 다니므로 다중 선택.
 * 백엔드 dispatch_itinerary가 선택 지역별로 요일을 그룹핑한다.
 */
export default function RegionChips({ value, onChange }: RegionChipsProps) {
  const [showHints, setShowHints] = useState(false);
  const [previews, setPreviews] = useState<Record<string, RegionCoveragePreview>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const selected = REGIONS.filter((r) => value.includes(r.value));
  const regionSignature = value.join('|');

  useEffect(() => {
    const missing = value.filter((r) => !previews[r] && !loading[r] && !unavailable.has(r));
    if (missing.length === 0) return;

    let cancelled = false;
    for (const region of missing) {
      setLoading((prev) => ({ ...prev, [region]: true }));
      requestRegionCoveragePreview(region)
        .then((preview) => {
          if (cancelled) return;
          setPreviews((prev) => ({ ...prev, [region]: preview }));
        })
        .catch(() => {
          // 프리뷰 실패가 지역 선택 자체를 막으면 안 된다.
          if (!cancelled) {
            setUnavailable((prev) => {
              const next = new Set(prev);
              next.add(region);
              return next;
            });
          }
        })
        .finally(() => {
          if (cancelled) return;
          setLoading((prev) => ({ ...prev, [region]: false }));
        });
    }

    return () => {
      cancelled = true;
    };
    // 선택 지역이 바뀔 때 새로 필요한 프리뷰만 요청한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionSignature]);

  const toggle = (r: RegionId) => {
    if (value.includes(r)) {
      onChange(value.filter((x) => x !== r));
    } else {
      onChange([...value, r]);
    }
  };

  return (
    <div>
      <label className="block text-[10.5px] font-bold text-basalt-2 mb-2.5 flex items-center gap-1 uppercase tracking-[0.14em]">
        <MapPin className="w-3 h-3 text-basalt-2/60" /> 제주 어디로
        <span className="ml-auto normal-case tracking-normal text-[10px] text-basalt-2/60 font-normal">
          여러 지역 선택 가능 · <span className="text-citrus-2 font-semibold">{value.length}곳</span>
        </span>
      </label>

      <JejuRegionMap
        regions={REGIONS}
        selected={value}
        onToggle={toggle}
      />

      <div className="flex flex-wrap gap-1.5" id="region-chips">
        {REGIONS.map((r) => {
          const active = value.includes(r.value);
          return (
            <button
              key={r.value}
              type="button"
              id={`region-chip-${r.value}`}
              onClick={() => toggle(r.value)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all duration-200 flex items-center gap-1 cursor-pointer hover:-translate-y-px ${
                active
                  ? 'border-citrus bg-citrus text-white shadow-jeju-chip'
                  : 'border-earth bg-white/70 text-basalt hover:border-citrus/60 hover:text-citrus-2 hover:shadow-sm'
              }`}
            >
              {active && <Check className="w-3 h-3 stroke-[4]" />}
              <span>{r.label}</span>
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="mt-3 text-[11.5px] card-citrus px-3.5 py-2.5 leading-relaxed space-y-1.5">
          {selected.map((s) => (
            <RegionCoverageCard
              key={s.value}
              label={s.label}
              landmarks={s.landmarks}
              preview={previews[s.value]}
              loading={!!loading[s.value]}
            />
          ))}
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

function RegionCoverageCard({
  label,
  landmarks,
  preview,
  loading,
}: {
  label: string;
  landmarks: string[];
  preview?: RegionCoveragePreview;
  loading: boolean;
}) {
  const strong = preview?.recommended_moments
    .map((id) => preview.moments.find((m) => m.moment === id)?.moment_label)
    .filter(Boolean)
    .slice(0, 3) as string[] | undefined;
  const weak = preview?.weak_moments
    .map((id) => preview.moments.find((m) => m.moment === id)?.moment_label)
    .filter(Boolean)
    .slice(0, 2) as string[] | undefined;

  return (
    <div className="border-b border-citrus/20 last:border-b-0 pb-2 last:pb-0">
      <div>
        <span className="font-serif-kr font-bold text-citrus-2 text-[13px]">{label}</span>
        <span className="text-basalt-2 mx-1.5">에는</span>
        <span className="text-basalt">{landmarks.join(' · ')}</span>
      </div>

      {loading && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-[10.5px] text-basalt-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          공공데이터 근거 현황을 확인하는 중
        </div>
      )}

      {preview && (
        <div className="mt-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 border border-citrus/30 text-[10.5px] text-basalt">
              <ShieldCheck className="w-3 h-3 text-mint" />
              확인 후보 {preview.total_places}곳
            </span>
            {strong && strong.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 border border-mint/30 text-[10.5px] text-basalt">
                강점 {strong.join(' · ')}
              </span>
            )}
            {weak && weak.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 border border-citrus/30 text-[10.5px] text-basalt">
                <AlertTriangle className="w-3 h-3 text-citrus-2" />
                미확인 {weak.join(' · ')}
              </span>
            )}
          </div>
          <p className="text-[10.5px] text-basalt-2 leading-relaxed">
            {preview.briefing}
          </p>
        </div>
      )}
    </div>
  );
}

function JejuRegionMap({
  regions,
  selected,
  onToggle,
}: {
  regions: RegionEntry[];
  selected: RegionId[];
  onToggle: (region: RegionId) => void;
}) {
  return (
    <div className="mb-3 rounded-2xl border border-earth bg-white/65 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <p className="font-serif-kr text-[13px] font-bold text-basalt">
            지도에서 고르기
          </p>
          <p className="text-[10.5px] text-basalt-2 leading-relaxed">
            제주 권역을 눌러 여행 범위를 먼저 잡아보세요.
          </p>
        </div>
        <span className="rounded-full bg-citrus/10 px-2 py-1 text-[10px] font-bold text-citrus-2">
          {selected.length}곳 선택
        </span>
      </div>

      <div
        className="relative aspect-[1.65/1] overflow-hidden rounded-[18px] border border-orange-100/70 bg-[#FDF6EA]"
        aria-label="제주 지역 지도 선택"
      >
        <svg
          viewBox="0 0 360 220"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="제주도 권역 배경"
        >
          <defs>
            <linearGradient id="jeju-map-land" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#FFF8EC" />
              <stop offset="55%" stopColor="#F8E5C8" />
              <stop offset="100%" stopColor="#F2D2AA" />
            </linearGradient>
            <radialGradient id="jeju-map-center" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#4A8779" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#4A8779" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path
            d="M31 121C42 80 83 48 135 39c58-10 131 4 170 33 35 26 42 68 17 97-29 33-92 45-157 37-67-8-123-33-137-66-3-7-3-13 3-19Z"
            fill="#D5E9E1"
            opacity="0.55"
          />
          <path
            d="M42 116C56 82 94 58 141 49c54-10 117 1 154 27 32 22 38 58 15 82-25 26-79 39-137 34-61-5-116-27-130-57-3-7-3-13-1-19Z"
            fill="url(#jeju-map-land)"
            stroke="#C9A97F"
            strokeWidth="2"
          />
          <path
            d="M63 119C78 94 111 78 151 72c45-7 95 2 124 21"
            fill="none"
            stroke="#E7683A"
            strokeOpacity="0.18"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M72 145C116 166 204 177 288 146"
            fill="none"
            stroke="#4A8779"
            strokeOpacity="0.18"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="179" cy="117" r="40" fill="url(#jeju-map-center)" />
          <circle cx="328" cy="84" r="10" fill="#F6E0BE" stroke="#C9A97F" strokeWidth="1.5" />
        </svg>

        {regions.map((region) => {
          const point = REGION_MAP_POINTS[region.value];
          const active = selected.includes(region.value);
          return (
            <button
              key={region.value}
              type="button"
              aria-pressed={active}
              aria-label={`${region.label} ${active ? '선택 해제' : '선택'}`}
              onClick={() => onToggle(region.value)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-[10.5px] font-bold shadow-sm transition-all duration-200 hover:-translate-y-[58%] focus:outline-none focus:ring-2 focus:ring-citrus/30 ${
                active
                  ? 'border-citrus bg-citrus text-white shadow-jeju-chip'
                  : 'border-earth bg-white/85 text-basalt hover:border-citrus/60 hover:text-citrus-2'
              }`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
            >
              {active && <Check className="mr-0.5 inline h-2.5 w-2.5 stroke-[4]" />}
              {point.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

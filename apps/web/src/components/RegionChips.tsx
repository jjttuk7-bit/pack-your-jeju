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
  aewol: { x: 30, y: 32, short: '애월' },
  hallim: { x: 19, y: 42, short: '한림' },
  jocheon: { x: 64, y: 30, short: '조천' },
  gujwa: { x: 77, y: 36, short: '구좌' },
  seongsan: { x: 87, y: 48, short: '성산' },
  udo: { x: 94, y: 34, short: '우도' },
  pyoseon: { x: 76, y: 64, short: '표선' },
  namwon: { x: 61, y: 73, short: '남원' },
  seogwipo: { x: 45, y: 76, short: '서귀포' },
  andeok: { x: 29, y: 70, short: '안덕' },
  daejeong: { x: 16, y: 62, short: '대정' },
};

const isString = (value: string | undefined): value is string => Boolean(value);

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
    <div className="space-y-3">
      <section className="rounded-[26px] border border-earth bg-gradient-to-br from-white via-[#FFF9EF] to-[#F6E7D2] p-3.5 sm:p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <label className="flex items-center gap-1.5 text-[10.5px] font-bold text-citrus-2 uppercase tracking-[0.16em]">
              <MapPin className="w-3.5 h-3.5" /> Jeju Area Board
            </label>
            <h3 className="mt-1 font-serif-kr text-[18px] font-bold leading-tight text-basalt">
              지도에서 여행 범위를 먼저 잡아보세요.
            </h3>
          </div>
          <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[10.5px] font-bold text-citrus-2 ring-1 ring-citrus/20">
            {value.length}곳 선택
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1.38fr)_minmax(205px,0.9fr)]">
          <JejuRegionMap
            regions={REGIONS}
            selected={value}
            onToggle={toggle}
          />
          <RegionInsightPanel
            selected={selected}
            previews={previews}
            loading={loading}
          />
        </div>

        <div className="mt-3 rounded-2xl border border-white/70 bg-white/55 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-basalt-2/70">
              빠른 선택
            </p>
            <p className="text-[10px] text-basalt-2/60">
              여러 지역 선택 가능
            </p>
          </div>
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
                      : 'border-earth bg-white/80 text-basalt hover:border-citrus/60 hover:text-citrus-2 hover:shadow-sm'
                  }`}
                >
                  {active && <Check className="w-3 h-3 stroke-[4]" />}
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

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

function RegionInsightPanel({
  selected,
  previews,
  loading,
}: {
  selected: RegionEntry[];
  previews: Record<string, RegionCoveragePreview>;
  loading: Record<string, boolean>;
}) {
  const loadedPreviews = selected
    .map((s) => previews[s.value])
    .filter(Boolean);
  const totalPlaces = loadedPreviews.reduce((sum, preview) => sum + preview.total_places, 0);
  const strongLabels = Array.from(new Set(
    loadedPreviews.flatMap((preview) =>
      preview.recommended_moments
        .map((id) => preview.moments.find((m) => m.moment === id)?.moment_label)
        .filter(isString),
    ),
  )).slice(0, 3);
  const weakLabels = Array.from(new Set(
    loadedPreviews.flatMap((preview) =>
      preview.weak_moments
        .map((id) => preview.moments.find((m) => m.moment === id)?.moment_label)
        .filter(isString),
    ),
  )).slice(0, 2);
  const isLoading = selected.some((s) => loading[s.value]);

  return (
    <aside className="rounded-[22px] border border-earth bg-white/78 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-basalt-2/70">
        선택 해석
      </p>

      {selected.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-earth bg-[#FFF9EF] px-3 py-4 text-center">
          <p className="font-serif-kr text-[15px] font-bold text-basalt">
            아직 지역을 고르지 않았어요.
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-basalt-2">
            지도나 빠른 선택에서 지역을 누르면, 하루방 에이전트가 참고할 데이터 범위가 정리됩니다.
          </p>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <div>
            <p className="font-serif-kr text-[18px] font-bold leading-tight text-basalt">
              {selected.map((s) => s.label).join(' · ')}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-basalt-2">
              선택한 권역을 기준으로 후보와 데이터 부족 조합을 먼저 확인합니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-mint/20 bg-mint/5 px-3 py-2">
              <p className="text-[10px] text-basalt-2">확인 후보</p>
              <p className="mt-0.5 font-serif-kr text-[20px] font-bold text-mint">
                {loadedPreviews.length > 0 ? totalPlaces.toLocaleString() : isLoading ? '...' : '-'}
              </p>
            </div>
            <div className="rounded-2xl border border-citrus/20 bg-citrus/5 px-3 py-2">
              <p className="text-[10px] text-basalt-2">선택 지역</p>
              <p className="mt-0.5 font-serif-kr text-[20px] font-bold text-citrus-2">
                {selected.length}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {strongLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {strongLabels.map((label) => (
                  <span key={label} className="inline-flex items-center gap-1 rounded-full border border-mint/25 bg-white px-2 py-0.5 text-[10.5px] text-basalt">
                    <ShieldCheck className="h-3 w-3 text-mint" />
                    {label}
                  </span>
                ))}
              </div>
            )}
            {weakLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {weakLabels.map((label) => (
                  <span key={label} className="inline-flex items-center gap-1 rounded-full border border-citrus/25 bg-white px-2 py-0.5 text-[10.5px] text-basalt">
                    <AlertTriangle className="h-3 w-3 text-citrus-2" />
                    {label} 미확인
                  </span>
                ))}
              </div>
            )}
            {isLoading && (
              <div className="inline-flex items-center gap-1.5 text-[10.5px] text-basalt-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                근거 현황 확인 중
              </div>
            )}
          </div>

          <div className="max-h-[190px] space-y-2 overflow-y-auto pr-1">
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
        </div>
      )}
    </aside>
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
    <div className="h-full rounded-[22px] border border-earth bg-white/65 p-3 shadow-sm">
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
        className="relative aspect-[1.75/1] overflow-hidden rounded-[18px] border border-orange-100/70 bg-[#FDF6EA]"
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
              <stop offset="0%" stopColor="#FFF7E8" />
              <stop offset="45%" stopColor="#F5DFB9" />
              <stop offset="100%" stopColor="#EBC58F" />
            </linearGradient>
            <radialGradient id="jeju-map-center" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#557B69" stopOpacity="0.34" />
              <stop offset="48%" stopColor="#7EA18D" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#4A8779" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="jeju-map-sea" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#BFE3DE" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#7FB7AA" stopOpacity="0.34" />
            </linearGradient>
            <filter id="jeju-map-soft-shadow" x="-12%" y="-18%" width="124%" height="138%">
              <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#8B6D43" floodOpacity="0.16" />
            </filter>
          </defs>
          <path
            d="M21 132C29 109 51 91 82 75c37-19 84-30 132-33 53-4 105 3 143 20 34 15 52 36 50 60-2 22-24 42-61 57-40 16-92 24-148 23-54-1-103-10-138-27-28-14-43-31-42-49 0-3 1-5 3-6Z"
            fill="url(#jeju-map-sea)"
            opacity="0.78"
          />
          <path
            d="M29 126C35 104 58 86 91 72c34-15 77-24 124-26 52-2 103 5 139 21 31 14 48 33 48 54 0 18-17 34-47 47-27 12-64 20-106 24-43 4-91 1-131-7-38-8-69-21-84-38-6-7-7-14-5-21Z"
            fill="url(#jeju-map-land)"
            stroke="#C9A97F"
            strokeWidth="2.4"
            filter="url(#jeju-map-soft-shadow)"
          />
          <path
            d="M48 123C70 97 112 78 162 70c62-10 128 1 178 23"
            fill="none"
            stroke="#8E6B3F"
            strokeOpacity="0.14"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M54 151C88 171 142 181 206 181c55 0 106-8 146-26"
            fill="none"
            stroke="#4A8779"
            strokeOpacity="0.16"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M121 127C139 94 158 81 181 79c26-2 48 14 65 48-37 13-83 14-125 0Z"
            fill="url(#jeju-map-center)"
          />
          <path
            d="M136 126C147 106 162 95 181 94c20-1 36 9 48 31"
            fill="none"
            stroke="#557B69"
            strokeOpacity="0.22"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M36 96c16-7 34-12 53-15M308 69c18 8 33 18 44 31M72 176c29 11 65 18 105 20M232 198c35-3 67-12 94-25"
            fill="none"
            stroke="#6EA99D"
            strokeOpacity="0.24"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="338" cy="75" r="10" fill="#F6E0BE" stroke="#C9A97F" strokeWidth="1.5" />
          <circle cx="338" cy="75" r="15" fill="none" stroke="#7FB7AA" strokeOpacity="0.22" strokeWidth="3" />
          <path
            d="M23 145c11 9 29 17 51 23M318 164c17-7 31-17 40-30"
            fill="none"
            stroke="#F07A3B"
            strokeOpacity="0.16"
            strokeWidth="2"
            strokeLinecap="round"
          />
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

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  Compass,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  CompanionValue,
  MomentId,
  PackResponse,
  PurposeValue,
  RegionCoveragePreview,
  RegionId,
  TravelInfo,
} from '../types';
import { COMPANIONS, MOMENTS, PURPOSES, REGIONS } from '../data';
import { requestPack, requestRegionCoveragePreview } from '../api';
import Badge from './Badge';
import MomentIcon from './marks/MomentIcon';

interface TrustMapDashboardProps {
  onSubmit: (info: TravelInfo, selectedMoments: MomentId[]) => void;
  initialInfo?: TravelInfo;
  initialMoments?: MomentId[];
}

type RegionTone = 'verified' | 'caution' | 'gap' | 'loading';

interface RegionShape {
  id: RegionId;
  path: string;
  labelX: number;
  labelY: number;
}

const DEFAULT_MOMENTS: MomentId[] = ['oreum', 'beach_walk', 'local_food'];
const NOTES_MAX = 300;

const REGION_SHAPES: RegionShape[] = [
  {
    id: 'hallim',
    path: 'M52 155 L76 128 L118 109 L153 145 L122 195 L77 218 L54 190 Z',
    labelX: 91,
    labelY: 164,
  },
  {
    id: 'aewol',
    path: 'M118 109 L168 88 L228 105 L223 153 L183 174 L153 145 Z',
    labelX: 172,
    labelY: 130,
  },
  {
    id: 'jeju_city',
    path: 'M168 88 L263 62 L318 84 L305 146 L223 153 L228 105 Z',
    labelX: 265,
    labelY: 112,
  },
  {
    id: 'jocheon',
    path: 'M263 62 L351 48 L389 75 L367 141 L305 146 L318 84 Z',
    labelX: 334,
    labelY: 96,
  },
  {
    id: 'gujwa',
    path: 'M351 48 L432 39 L500 75 L462 123 L389 145 L367 141 L389 75 Z',
    labelX: 435,
    labelY: 82,
  },
  {
    id: 'udo',
    path: 'M519 72 C534 66 548 76 548 91 C548 105 536 113 522 107 C511 101 509 82 519 72 Z',
    labelX: 535,
    labelY: 91,
  },
  {
    id: 'seongsan',
    path: 'M462 123 L525 101 L550 146 L527 179 L472 174 Z',
    labelX: 507,
    labelY: 146,
  },
  {
    id: 'pyoseon',
    path: 'M389 145 L462 123 L472 174 L433 222 L356 239 L351 172 Z',
    labelX: 427,
    labelY: 184,
  },
  {
    id: 'namwon',
    path: 'M305 146 L389 145 L351 172 L356 239 L292 253 L266 203 Z',
    labelX: 342,
    labelY: 214,
  },
  {
    id: 'seogwipo',
    path: 'M223 153 L305 146 L266 203 L292 253 L214 266 L187 231 L183 174 Z',
    labelX: 246,
    labelY: 226,
  },
  {
    id: 'andeok',
    path: 'M122 195 L183 174 L187 231 L214 266 L148 257 L106 233 Z',
    labelX: 158,
    labelY: 218,
  },
  {
    id: 'daejeong',
    path: 'M54 190 L77 218 L106 233 L148 257 L112 286 L66 270 L36 236 Z',
    labelX: 90,
    labelY: 248,
  },
];

export default function TrustMapDashboard({
  onSubmit,
  initialInfo,
  initialMoments,
}: TrustMapDashboardProps) {
  const [selectedRegions, setSelectedRegions] = useState<RegionId[]>(initialInfo?.regions ?? []);
  const [activeRegion, setActiveRegion] = useState<RegionId>(
    initialInfo?.regions?.[0] ?? 'seongsan',
  );
  const [selectedMoments, setSelectedMoments] = useState<MomentId[]>(
    initialMoments?.length ? initialMoments : DEFAULT_MOMENTS,
  );
  const [startDate, setStartDate] = useState(
    initialInfo?.startDate || new Date().toISOString().split('T')[0],
  );
  const [durationDays, setDurationDays] = useState(initialInfo?.durationDays ?? 3);
  const [companion, setCompanion] = useState<CompanionValue>(initialInfo?.companion ?? 'solo');
  const [purpose, setPurpose] = useState<PurposeValue>(initialInfo?.purpose ?? 'healing');
  const [specialNotes, setSpecialNotes] = useState(initialInfo?.specialNotes ?? '');
  const [previews, setPreviews] = useState<Record<string, RegionCoveragePreview>>({});
  const [previewLoading, setPreviewLoading] = useState(true);
  const [packPreview, setPackPreview] = useState<PackResponse | null>(null);
  const [packLoading, setPackLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);
    Promise.allSettled(REGIONS.map((region) => requestRegionCoveragePreview(region.value)))
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, RegionCoveragePreview> = {};
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            next[result.value.region] = result.value;
          }
        });
        setPreviews(next);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedMoments.length === 0) {
      setPackPreview(null);
      return;
    }
    let cancelled = false;
    setPackLoading(true);
    requestPack(buildTravelInfo([activeRegion]), selectedMoments)
      .then((resp) => {
        if (!cancelled) setPackPreview(resp);
      })
      .catch(() => {
        if (!cancelled) setPackPreview(null);
      })
      .finally(() => {
        if (!cancelled) setPackLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRegion, selectedMoments.join('|'), startDate, durationDays, companion, purpose, specialNotes]);

  const activeEntry = REGIONS.find((region) => region.value === activeRegion) ?? REGIONS[0];
  const activePreview = previews[activeRegion];
  const activeTone = getRegionTone(activePreview, selectedMoments, previewLoading);
  const recommendedPlaces = collectRecommendedPlaces(packPreview);
  const selectedLabels = selectedRegions
    .map((id) => REGIONS.find((region) => region.value === id)?.label ?? id)
    .join(' · ');
  const coverageSummary = useMemo(
    () => summarizeSelectedRegions(selectedRegions, previews),
    [selectedRegions, previews],
  );

  function buildTravelInfo(regions: RegionId[] = selectedRegions): TravelInfo {
    return {
      regions,
      startDate,
      durationDays,
      companion,
      purpose,
      specialNotes: specialNotes.trim() || undefined,
    };
  }

  const inspectRegion = (region: RegionId) => {
    setActiveRegion(region);
  };

  const toggleRegion = (region: RegionId) => {
    setActiveRegion(region);
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((id) => id !== region) : [...prev, region],
    );
  };

  const toggleMoment = (moment: MomentId) => {
    setSelectedMoments((prev) =>
      prev.includes(moment) ? prev.filter((id) => id !== moment) : [...prev, moment],
    );
  };

  const submitPlan = () => {
    const regions = selectedRegions.length ? selectedRegions : [activeRegion];
    const moments = selectedMoments.length ? selectedMoments : DEFAULT_MOMENTS;
    onSubmit(buildTravelInfo(regions), moments);
  };

  return (
    <div className="w-full max-w-6xl mx-auto" id="trust-map-dashboard">
      <section className="overflow-hidden rounded-[30px] border border-earth bg-[#FFF9F0] shadow-pyj-card">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="relative bg-gradient-to-br from-[#FFF9F0] via-[#FDF1DE] to-[#F6DFC1] p-4 sm:p-6 lg:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-citrus-2">
                  제주를 담다 · 지역 근거 현황
                </p>
                <h1 className="mt-1 font-serif-kr text-[29px] font-bold leading-tight tracking-tight text-basalt sm:text-[38px]">
                  제주 지도에서 먼저 고르고,
                  <br className="hidden sm:block" />
                  공공데이터 근거로 담습니다.
                </h1>
                <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-basalt-2">
                  이 화면의 후보·강점·미확인 항목은 기존 API가 조회한 값만 사용합니다.
                  데이터가 부족한 조합은 추천으로 채우지 않고 그대로 표시합니다.
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/74 px-3 py-2 text-right shadow-sm">
                <p className="text-[10px] text-basalt-2">플랜 후보</p>
                <p className="font-serif-kr text-[18px] font-bold text-citrus-2">
                  {selectedRegions.length}곳
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-white/80 bg-white/48 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-5">
              <MapLegend />
              <JejuSilhouetteMap
                activeRegion={activeRegion}
                selectedRegions={selectedRegions}
                previews={previews}
                loading={previewLoading}
                selectedMoments={selectedMoments}
                onInspect={inspectRegion}
                onToggle={toggleRegion}
              />
            </div>

            <div className="mt-4 grid gap-3 rounded-[24px] border border-earth bg-white/72 p-3 md:grid-cols-[1.15fr_0.85fr]">
              <TripFields
                startDate={startDate}
                durationDays={durationDays}
                companion={companion}
                purpose={purpose}
                onStartDate={setStartDate}
                onDuration={setDurationDays}
                onCompanion={setCompanion}
                onPurpose={setPurpose}
              />
              <label className="rounded-2xl border border-earth bg-[#FFF9F0] px-3 py-2">
                <span className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-basalt-2">
                  <Sparkles className="h-3 w-3" /> 특별한 요청
                </span>
                <textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value.slice(0, NOTES_MAX))}
                  rows={3}
                  placeholder="예: 부모님과 가니 계단 적은 곳 위주로."
                  className="w-full resize-none bg-transparent text-[12px] leading-relaxed text-basalt outline-none placeholder:text-basalt-2/50"
                />
                <span className="block text-right text-[10px] text-basalt-2/55">
                  {specialNotes.length}/{NOTES_MAX}
                </span>
              </label>
            </div>

            <div className="mt-4 rounded-[24px] border border-earth bg-white/72 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-basalt-2">
                  담고 싶은 순간
                </p>
                <p className="text-[10px] text-basalt-2">{selectedMoments.length}개 선택</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {MOMENTS.map((moment) => {
                  const active = selectedMoments.includes(moment.id);
                  return (
                    <button
                      key={moment.id}
                      type="button"
                      onClick={() => toggleMoment(moment.id)}
                      className={`rounded-2xl border px-2.5 py-2 text-left transition ${
                        active
                          ? 'border-citrus bg-citrus/10 text-citrus-2 shadow-sm'
                          : 'border-earth bg-white/70 text-basalt-2 hover:border-citrus/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MomentIcon id={moment.id} className="h-7 w-7 shrink-0" />
                        <span className="text-[11px] font-bold leading-tight">{moment.title}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </main>

          <aside className="border-t border-earth bg-white/82 p-4 sm:p-5 lg:border-l lg:border-t-0">
            <RegionPanel
              region={activeEntry}
              preview={activePreview}
              tone={activeTone}
              previewLoading={previewLoading}
              packLoading={packLoading}
              recommendedPlaces={recommendedPlaces}
              selected={selectedRegions.includes(activeRegion)}
              selectedLabels={selectedLabels}
              coverageSummary={coverageSummary}
              onToggle={() => toggleRegion(activeRegion)}
              onSubmit={submitPlan}
            />
          </aside>
        </div>
      </section>
    </div>
  );
}

function JejuSilhouetteMap({
  activeRegion,
  selectedRegions,
  previews,
  loading,
  selectedMoments,
  onInspect,
  onToggle,
}: {
  activeRegion: RegionId;
  selectedRegions: RegionId[];
  previews: Record<string, RegionCoveragePreview>;
  loading: boolean;
  selectedMoments: MomentId[];
  onInspect: (region: RegionId) => void;
  onToggle: (region: RegionId) => void;
}) {
  return (
    <div className="relative mx-auto mt-4 aspect-[567/312] w-full max-w-4xl overflow-hidden rounded-[26px] border border-orange-100/70 bg-[#F8F2E7]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,249,240,0.78))]" />
      <svg
        viewBox="0 0 567 312"
        role="img"
        aria-label="제주 행정구역 선택 지도"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <filter id="jejuRegionShadow" x="-8%" y="-8%" width="116%" height="116%">
            <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#8B6C49" floodOpacity="0.12" />
          </filter>
          <linearGradient id="jejuRoad" x1="42" y1="190" x2="519" y2="116" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.72" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        <g filter="url(#jejuRegionShadow)">
          {REGION_SHAPES.map((shape) => {
            const region = REGIONS.find((r) => r.value === shape.id);
            const active = activeRegion === shape.id;
            const selected = selectedRegions.includes(shape.id);
            const tone = getRegionTone(previews[shape.id], selectedMoments, loading);
            return (
              <path
                key={shape.id}
                d={shape.path}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`${region?.label ?? shape.id} 근거 보기`}
                onClick={() => onInspect(shape.id)}
                onDoubleClick={() => onToggle(shape.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onInspect(shape.id);
                  }
                }}
                className={`cursor-pointer stroke-white stroke-[2.5] transition duration-200 outline-none hover:brightness-105 focus:stroke-citrus focus:stroke-[4] ${regionFillClass(
                  tone,
                  active,
                  selected,
                )}`}
              />
            );
          })}
        </g>

        <path
          d="M40 205 C73 187 77 225 114 206 C170 177 198 157 245 162 C296 168 304 141 355 139 C403 137 391 126 435 110 C467 98 492 88 520 82"
          fill="none"
          stroke="url(#jejuRoad)"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.92"
        />
        <path
          d="M61 150 C86 178 99 191 123 196 M168 91 C172 120 182 143 220 153 M263 64 C261 97 272 125 304 146 M351 51 C341 83 350 114 367 141 M459 124 C443 144 443 160 471 174 M306 148 C318 182 330 210 292 252 M185 175 C174 205 170 230 148 257"
          fill="none"
          stroke="#FFFFFF"
          strokeDasharray="3 5"
          strokeLinecap="round"
          strokeWidth="1.5"
          opacity="0.72"
        />

        {REGION_SHAPES.map((shape) => {
          const region = REGIONS.find((r) => r.value === shape.id);
          const active = activeRegion === shape.id;
          const selected = selectedRegions.includes(shape.id);
          return (
            <g key={`${shape.id}-label`} className="pointer-events-none">
              {selected && (
                <circle
                  cx={shape.labelX - 23}
                  cy={shape.labelY - 4}
                  r="7"
                  className="fill-citrus stroke-white stroke-[2]"
                />
              )}
              {selected && (
                <path
                  d={`M${shape.labelX - 26} ${shape.labelY - 4} l2.6 2.8 l5.4 -6`}
                  fill="none"
                  className="stroke-white stroke-[2] [stroke-linecap:round] [stroke-linejoin:round]"
                />
              )}
              <text
                x={shape.labelX}
                y={shape.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`select-none text-[13px] font-bold ${
                  selected ? 'fill-white' : active ? 'fill-citrus-2' : 'fill-basalt'
                }`}
              >
                {region?.label}
              </text>
            </g>
          );
        })}

        <g className="fill-[#C8DDF0] text-[12px] font-semibold text-basalt-2">
          <path d="M20 58 C31 51 43 56 52 66 C40 73 28 70 20 58 Z" />
          <text x="55" y="68" className="fill-basalt-2 text-[12px]">추자도</text>
          <path d="M88 287 L100 282 L109 291 L99 299 Z" className="fill-stone-300" />
          <text x="52" y="296" className="fill-basalt-2 text-[11px]">가파도</text>
          <path d="M119 301 L129 296 L139 303 L129 309 Z" className="fill-stone-300" />
          <text x="108" y="309" className="fill-basalt-2 text-[11px]">마라도</text>
        </g>
      </svg>

      <div className="absolute bottom-3 right-3 max-w-[240px] rounded-2xl border border-earth bg-white/82 px-3 py-2 text-[10.5px] leading-relaxed text-basalt-2 shadow-sm backdrop-blur">
        지역 면을 누르면 우측 근거가 바뀝니다. 선택은 우측 버튼으로 플랜 후보에 담습니다.
      </div>
    </div>
  );
}

function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-semibold text-basalt-2">
      <LegendDot className="bg-mint" label="확인 후보 있음" />
      <LegendDot className="bg-amber-400" label="확인 필요" />
      <LegendDot className="bg-stone-300" label="데이터 부족" />
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-earth bg-white/70 px-2 py-1">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function TripFields({
  startDate,
  durationDays,
  companion,
  purpose,
  onStartDate,
  onDuration,
  onCompanion,
  onPurpose,
}: {
  startDate: string;
  durationDays: number;
  companion: CompanionValue;
  purpose: PurposeValue;
  onStartDate: (value: string) => void;
  onDuration: (value: number) => void;
  onCompanion: (value: CompanionValue) => void;
  onPurpose: (value: PurposeValue) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="rounded-2xl border border-earth bg-[#FFF9F0] px-3 py-2">
        <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-basalt-2">
          <Calendar className="h-3 w-3" /> 언제부터
        </span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDate(e.target.value)}
          className="w-full bg-transparent text-[12px] font-semibold text-basalt outline-none"
        />
      </label>
      <div className="rounded-2xl border border-earth bg-[#FFF9F0] px-3 py-2">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-basalt-2">
          며칠간
        </span>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => onDuration(Math.max(1, durationDays - 1))}>-</button>
          <span className="font-serif-kr text-[13px] font-bold text-basalt">
            {durationDays - 1 > 0 ? `${durationDays - 1}박 ${durationDays}일` : '당일치기'}
          </span>
          <button type="button" onClick={() => onDuration(Math.min(14, durationDays + 1))}>+</button>
        </div>
      </div>
      <SelectLine
        icon={<Users className="h-3.5 w-3.5" />}
        label="동행"
        value={companion}
        options={COMPANIONS}
        onChange={(value) => onCompanion(value as CompanionValue)}
      />
      <SelectLine
        icon={<Compass className="h-3.5 w-3.5" />}
        label="목적"
        value={purpose}
        options={PURPOSES}
        onChange={(value) => onPurpose(value as PurposeValue)}
      />
    </div>
  );
}

function SelectLine({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-2xl border border-earth bg-[#FFF9F0] px-3 py-2">
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-basalt-2">
        {icon} {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[12px] font-bold text-basalt outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RegionPanel({
  region,
  preview,
  tone,
  previewLoading,
  packLoading,
  recommendedPlaces,
  selected,
  selectedLabels,
  coverageSummary,
  onToggle,
  onSubmit,
}: {
  region: (typeof REGIONS)[number];
  preview?: RegionCoveragePreview;
  tone: RegionTone;
  previewLoading: boolean;
  packLoading: boolean;
  recommendedPlaces: Array<{ name: string; badge: string; note: string | null; source: string }>;
  selected: boolean;
  selectedLabels: string;
  coverageSummary: { totalPlaces: number; strongMoments: string[]; weakMoments: string[] };
  onToggle: () => void;
  onSubmit: () => void;
}) {
  const recommended = preview?.recommended_moments
    .map((id) => preview.moments.find((m) => m.moment === id)?.moment_label)
    .filter(Boolean)
    .slice(0, 4) ?? [];
  const weak = preview?.weak_moments
    .map((id) => preview.moments.find((m) => m.moment === id)?.moment_label)
    .filter(Boolean)
    .slice(0, 3) ?? [];
  const regionObjectLabel = withObjectParticle(region.label);

  return (
    <div className="flex h-full flex-col">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-citrus-2">
          선택 지역 근거
        </p>
        <h2 className="mt-1 font-serif-kr text-[27px] font-bold leading-tight text-basalt">
          {regionObjectLabel} 담아볼까요?
        </h2>
      </div>

      <div className={`mt-4 rounded-2xl border p-3 text-[12px] leading-relaxed ${panelToneClass(tone)}`}>
        {previewLoading ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            지역 근거를 확인하는 중입니다.
          </span>
        ) : (
          preview?.briefing || '저희가 참조하는 공공데이터 기준으로 확인된 지역 요약이 아직 없습니다.'
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="확인 후보" value={preview ? preview.total_places.toLocaleString() : '-'} />
        <Metric label="선택 후보" value={selected ? '담김' : '미선택'} />
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-basalt-2">
          추천 가능한 순간
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(recommended.length ? recommended : ['근거 확인 중']).map((label) => (
            <span key={label} className="rounded-full border border-mint/25 bg-mint/8 px-2 py-1 text-[10.5px] font-bold text-mint">
              <ShieldCheck className="mr-1 inline h-3 w-3" />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-basalt-2">
          확인 필요 항목
        </p>
        <div className="mt-2 space-y-1.5">
          {weak.length ? weak.map((label) => (
            <div key={label} className="flex items-start gap-1.5 rounded-xl border border-amber-100 bg-amber-50/70 px-2.5 py-2 text-[11px] leading-relaxed text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{label}은 저희가 참조하는 공공데이터 기준으로 확인되지 않습니다.</span>
            </div>
          )) : (
            <div className="flex items-center gap-1.5 rounded-xl border border-mint/20 bg-mint/7 px-2.5 py-2 text-[11px] text-mint">
              <ShieldCheck className="h-3.5 w-3.5" />
              선택 지역에서 큰 데이터 공백이 낮게 관측됩니다.
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-basalt-2">
            실제 후보
          </p>
          {packLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-citrus-2" />}
        </div>
        <div className="space-y-2">
          {recommendedPlaces.length ? recommendedPlaces.map((place) => (
            <div key={place.name} className="rounded-2xl border border-earth bg-[#FFF9F0] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-serif-kr text-[13px] font-bold text-basalt">{place.name}</p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-basalt-2">
                    {place.note || place.source}
                  </p>
                </div>
                <Badge kind={place.badge as any} />
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-earth bg-[#FFF9F0] p-4 text-center text-[11px] leading-relaxed text-basalt-2">
              선택한 순간과 지역으로 실제 후보를 조회하는 중입니다.
            </div>
          )}
        </div>
      </div>

      {selectedLabels && (
        <div className="mt-5 rounded-2xl border border-citrus/20 bg-citrus/7 p-3 text-[11px] leading-relaxed text-basalt-2">
          <p className="font-bold text-basalt">현재 플랜 후보: {selectedLabels}</p>
          <p className="mt-1">
            합산 확인 후보 {coverageSummary.totalPlaces.toLocaleString()}곳 ·
            강점 {coverageSummary.strongMoments.slice(0, 3).join(' · ') || '확인 중'} ·
            미확인 {coverageSummary.weakMoments.slice(0, 2).join(' · ') || '낮음'}
          </p>
        </div>
      )}

      <div className="mt-auto pt-5">
        <button
          type="button"
          onClick={onToggle}
          className={`mb-2 w-full rounded-2xl border px-4 py-3 font-serif-kr text-[13px] font-bold transition ${
            selected
              ? 'border-mint bg-mint/10 text-mint'
              : 'border-citrus/30 bg-white text-citrus-2 hover:bg-orange-50'
          }`}
        >
          {selected ? `${region.label}은 플랜 후보에 담겼어요` : `${regionObjectLabel} 플랜 후보에 담기`}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-citrus px-4 py-3.5 font-serif-kr text-[15px] font-bold text-white shadow-jeju-chip transition hover:bg-citrus-2"
        >
          {selectedLabels || region.label} 제주팩 받기
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-earth bg-[#FFF9F0] px-3 py-2">
      <p className="text-[10px] text-basalt-2">{label}</p>
      <p className="mt-0.5 font-serif-kr text-[20px] font-bold text-basalt">{value}</p>
    </div>
  );
}

function getRegionTone(
  preview: RegionCoveragePreview | undefined,
  selectedMoments: MomentId[],
  loading: boolean,
): RegionTone {
  if (loading && !preview) return 'loading';
  if (!preview || preview.total_places === 0) return 'gap';
  const selected = selectedMoments.length ? selectedMoments : DEFAULT_MOMENTS;
  const selectedStats = selected
    .map((id) => preview.moments.find((m) => m.moment === id))
    .filter(Boolean);
  if (selectedStats.length === 0) return 'gap';
  const gaps = selectedStats.filter((m) => m?.coverage_gap).length;
  if (gaps === selectedStats.length) return 'gap';
  if (gaps > 0) return 'caution';
  return 'verified';
}

function regionFillClass(tone: RegionTone, active: boolean, selected: boolean): string {
  if (selected) return 'fill-[#EF6A3B]';
  if (active) return 'fill-[#B7E2D8]';
  if (tone === 'verified') return 'fill-[#D8EFE8]';
  if (tone === 'caution') return 'fill-[#F4E1B8]';
  if (tone === 'gap') return 'fill-[#E6E3DD]';
  return 'fill-[#EFE2D0]';
}

function withObjectParticle(label: string): string {
  const lastChar = label.trim().at(-1);
  if (!lastChar) return label;
  const code = lastChar.charCodeAt(0);
  const hangulStart = 0xac00;
  const hangulEnd = 0xd7a3;
  if (code < hangulStart || code > hangulEnd) return `${label}를`;
  const hasFinalConsonant = (code - hangulStart) % 28 !== 0;
  return `${label}${hasFinalConsonant ? '을' : '를'}`;
}

function panelToneClass(tone: RegionTone): string {
  if (tone === 'verified') return 'border-mint/20 bg-mint/7 text-mint';
  if (tone === 'caution') return 'border-amber-100 bg-amber-50/70 text-amber-900';
  if (tone === 'gap') return 'border-stone-200 bg-stone-50 text-stone-700';
  return 'border-citrus/20 bg-citrus/8 text-basalt';
}

function collectRecommendedPlaces(pack: PackResponse | null) {
  if (!pack) return [];
  const seen = new Set<string>();
  const items = pack.sections.flatMap((section) => section.items);
  return items
    .filter((item) => {
      const key = item.external_id || item.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map((item) => ({
      name: item.name,
      badge: item.badge,
      note: item.note,
      source: item.sources?.[0]?.name ?? '공공데이터 근거',
    }));
}

function summarizeSelectedRegions(
  selectedRegions: RegionId[],
  previews: Record<string, RegionCoveragePreview>,
) {
  const selectedPreviews = selectedRegions
    .map((id) => previews[id])
    .filter(Boolean);
  const totalPlaces = selectedPreviews.reduce((sum, preview) => sum + preview.total_places, 0);
  const strongMoments = Array.from(new Set(
    selectedPreviews.flatMap((preview) =>
      preview.recommended_moments
        .map((id) => preview.moments.find((m) => m.moment === id)?.moment_label)
        .filter(Boolean),
    ),
  )) as string[];
  const weakMoments = Array.from(new Set(
    selectedPreviews.flatMap((preview) =>
      preview.weak_moments
        .map((id) => preview.moments.find((m) => m.moment === id)?.moment_label)
        .filter(Boolean),
    ),
  )) as string[];
  return { totalPlaces, strongMoments, weakMoments };
}

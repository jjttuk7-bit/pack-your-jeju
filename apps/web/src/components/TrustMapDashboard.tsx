import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  CloudRain,
  Compass,
  Loader2,
  MapPinned,
  ShieldCheck,
  Sparkles,
  Users,
  Wind,
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

type WeatherMode = 'clear' | 'rain' | 'wind';
type MobilityMode = 'car' | 'walk';
type RegionStatus = 'strong' | 'watch' | 'risk' | 'gap';

interface RegionShape {
  id: RegionId;
  d: string;
  labelX: number;
  labelY: number;
  clusterX: number;
  clusterY: number;
}

const DEFAULT_MOMENTS: MomentId[] = ['oreum', 'beach_walk', 'local_food'];

const REGION_SHAPES: RegionShape[] = [
  { id: 'hallim', d: 'M50 97 L89 76 L122 84 L115 119 L74 127 L45 116 Z', labelX: 83, labelY: 103, clusterX: 62, clusterY: 87 },
  { id: 'aewol', d: 'M90 75 L141 59 L178 68 L169 105 L116 119 L123 84 Z', labelX: 137, labelY: 88, clusterX: 150, clusterY: 67 },
  { id: 'jeju_city', d: 'M142 58 L205 49 L247 55 L239 95 L169 105 L178 68 Z', labelX: 207, labelY: 76, clusterX: 225, clusterY: 59 },
  { id: 'jocheon', d: 'M247 56 L302 68 L318 102 L276 122 L239 95 Z', labelX: 279, labelY: 92, clusterX: 307, clusterY: 82 },
  { id: 'gujwa', d: 'M302 68 L359 87 L388 119 L349 148 L318 102 Z', labelX: 347, labelY: 112, clusterX: 365, clusterY: 93 },
  { id: 'udo', d: 'M392 82 L416 91 L421 113 L401 126 L383 111 Z', labelX: 405, labelY: 106, clusterX: 416, clusterY: 88 },
  { id: 'seongsan', d: 'M350 149 L388 120 L407 143 L388 172 L347 178 L329 161 Z', labelX: 371, labelY: 154, clusterX: 397, clusterY: 147 },
  { id: 'pyoseon', d: 'M276 123 L318 103 L349 149 L328 162 L278 169 L254 148 Z', labelX: 304, labelY: 146, clusterX: 323, clusterY: 128 },
  { id: 'namwon', d: 'M214 142 L254 148 L278 169 L247 190 L200 183 L185 159 Z', labelX: 231, labelY: 167, clusterX: 250, clusterY: 184 },
  { id: 'seogwipo', d: 'M143 143 L185 159 L199 183 L159 201 L111 185 L112 155 Z', labelX: 153, labelY: 174, clusterX: 177, clusterY: 192 },
  { id: 'andeok', d: 'M75 128 L115 120 L143 143 L112 155 L110 185 L71 174 L56 150 Z', labelX: 99, labelY: 151, clusterX: 79, clusterY: 168 },
  { id: 'daejeong', d: 'M32 122 L74 128 L56 150 L70 174 L37 181 L16 158 Z', labelX: 45, labelY: 153, clusterX: 28, clusterY: 136 },
];

const WEATHER_OPTIONS: Array<{ value: WeatherMode; label: string; icon: typeof CloudRain | typeof Wind | typeof Sparkles }> = [
  { value: 'clear', label: '맑음', icon: Sparkles },
  { value: 'rain', label: '비', icon: CloudRain },
  { value: 'wind', label: '바람', icon: Wind },
];

const MOBILITY_OPTIONS: Array<{ value: MobilityMode; label: string }> = [
  { value: 'car', label: '렌터카' },
  { value: 'walk', label: '뚜벅이' },
];

const MOMENT_WEATHER_RISK: Partial<Record<MomentId, WeatherMode[]>> = {
  oreum: ['rain', 'wind'],
  beach_walk: ['rain', 'wind'],
  sunset: ['rain', 'wind'],
  gotjawal: ['rain'],
  citrus: ['rain'],
};

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
  const [companion, setCompanion] = useState<CompanionValue>(initialInfo?.companion ?? 'parents');
  const [purpose, setPurpose] = useState<PurposeValue>(initialInfo?.purpose ?? 'healing');
  const [weather, setWeather] = useState<WeatherMode>('wind');
  const [mobility, setMobility] = useState<MobilityMode>('car');
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
  }, [activeRegion, selectedMoments.join('|'), startDate, durationDays, companion, purpose]);

  const regionScores = useMemo(() => {
    const entries = REGIONS.map((region) => {
      const preview = previews[region.value];
      return [region.value, scoreRegion(preview, selectedMoments, weather, mobility, companion)] as const;
    });
    return Object.fromEntries(entries) as Record<RegionId, ReturnType<typeof scoreRegion>>;
  }, [previews, selectedMoments, weather, mobility, companion]);

  const activeEntry = REGIONS.find((region) => region.value === activeRegion) ?? REGIONS[0];
  const activePreview = previews[activeRegion];
  const activeScore = regionScores[activeRegion];
  const recommendedPlaces = collectRecommendedPlaces(packPreview);
  const selectedLabels = selectedRegions
    .map((id) => REGIONS.find((region) => region.value === id)?.label ?? id)
    .join(' · ');

  function buildTravelInfo(regions: RegionId[] = selectedRegions): TravelInfo {
    const condition = [
      weather === 'rain' ? '비 오는 날' : weather === 'wind' ? '바람 강한 날' : '맑은 날',
      mobility === 'walk' ? '뚜벅이 이동' : '렌터카 이동',
    ].join(' · ');
    return {
      regions,
      startDate,
      durationDays,
      companion,
      purpose,
      specialNotes: `신뢰 지도 조건: ${condition}`,
    };
  }

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
      <div className="overflow-hidden rounded-[26px] border border-earth bg-[#FFF9F0] shadow-pyj-card">
        <div className="grid min-h-[720px] lg:grid-cols-[164px_minmax(0,1fr)_300px]">
          <aside className="hidden border-r border-earth/60 bg-white/62 p-4 lg:block">
            <div className="mb-8">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-citrus text-white shadow-jeju-chip">
                <MapPinned className="h-5 w-5" />
              </div>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-citrus-2">
                Trust Intelligence
              </p>
              <h2 className="mt-1 font-serif-kr text-[18px] font-bold leading-tight text-basalt">
                제주 신뢰 지도
              </h2>
            </div>

            <nav className="space-y-2 text-[11px] font-bold text-basalt-2">
              {['Map View', 'Data Explorer', 'Saved Regions', 'Signal Lab'].map((item, idx) => (
                <div
                  key={item}
                  className={`rounded-xl px-3 py-2.5 ${
                    idx === 0 ? 'bg-citrus text-white shadow-jeju-chip' : 'bg-white/55'
                  }`}
                >
                  {item}
                </div>
              ))}
            </nav>

            <button
              type="button"
              onClick={submitPlan}
              className="mt-10 w-full rounded-2xl bg-citrus px-3 py-3 font-serif-kr text-[13px] font-bold text-white shadow-jeju-chip transition hover:bg-citrus-2"
            >
              Generate Pack
            </button>
          </aside>

          <main className="relative border-r border-earth/60 bg-[#FFF6EA] p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-citrus-2">
                  제주를 담다 · Trust Map Dashboard
                </p>
                <h1 className="mt-1 font-serif-kr text-[28px] font-bold tracking-tight text-basalt sm:text-[34px]">
                  지역을 먼저 믿고, 그 다음 플랜에 담기
                </h1>
                <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-basalt-2">
                  색은 공공데이터 커버리지와 현재 여행 조건을 합성한 신뢰 신호입니다.
                  회색은 추천 불가가 아니라 확인 근거가 부족하다는 뜻입니다.
                </p>
              </div>
              <div className="rounded-2xl border border-citrus/20 bg-white/74 px-3 py-2 text-right">
                <p className="text-[10px] text-basalt-2">선택 지역</p>
                <p className="font-serif-kr text-[16px] font-bold text-citrus-2">
                  {selectedRegions.length || 1}곳
                </p>
              </div>
            </div>

            <div className="relative mt-6 rounded-[28px] border border-white/70 bg-gradient-to-br from-white/45 to-[#F3E2CB]/50 p-3 sm:p-6">
              <TrustLegend />
              <svg
                viewBox="0 0 440 250"
                className="mx-auto mt-4 block w-full max-w-3xl drop-shadow-[0_18px_30px_rgba(121,81,40,0.16)]"
                role="img"
                aria-label="제주 12권역 신뢰 지도"
              >
                <defs>
                  <filter id="trust-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#D56A35" floodOpacity="0.16" />
                  </filter>
                </defs>
                <path
                  d="M18 130C32 99 72 75 125 58c55-18 124-25 185-13 59 12 99 39 111 72 9 26-9 53-51 75-45 24-117 34-190 26-73-8-131-30-154-63-6-8-9-16-8-25Z"
                  fill="#F7E5CF"
                  opacity="0.72"
                />
                {REGION_SHAPES.map((shape) => {
                  const active = activeRegion === shape.id;
                  const selected = selectedRegions.includes(shape.id);
                  const score = regionScores[shape.id];
                  const region = REGIONS.find((r) => r.value === shape.id);
                  return (
                    <g key={shape.id}>
                      <motion.path
                        d={shape.d}
                        initial={false}
                        animate={{ scale: active ? 1.018 : 1 }}
                        onClick={() => toggleRegion(shape.id)}
                        className="cursor-pointer transition"
                        fill={statusColor(score.status)}
                        stroke={active ? '#FFFFFF' : '#FDF6EA'}
                        strokeWidth={active ? 4 : 2}
                        filter={active ? 'url(#trust-glow)' : undefined}
                        opacity={selected ? 1 : 0.9}
                      />
                      <text
                        x={shape.labelX}
                        y={shape.labelY}
                        textAnchor="middle"
                        className="pointer-events-none select-none fill-basalt font-serif-kr text-[10px] font-bold"
                      >
                        {region?.label}
                      </text>
                      <g className="pointer-events-none">
                        <circle
                          cx={shape.clusterX}
                          cy={shape.clusterY}
                          r="12"
                          fill="white"
                          opacity="0.88"
                          stroke={active ? '#E86F3A' : '#E6CDB0'}
                        />
                        <text
                          x={shape.clusterX}
                          y={shape.clusterY + 3}
                          textAnchor="middle"
                          className="select-none fill-citrus-2 text-[9px] font-bold"
                        >
                          {score.display}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>
            </div>

            <FilterDock
              startDate={startDate}
              durationDays={durationDays}
              companion={companion}
              purpose={purpose}
              weather={weather}
              mobility={mobility}
              onStartDate={setStartDate}
              onDuration={setDurationDays}
              onCompanion={setCompanion}
              onPurpose={setPurpose}
              onWeather={setWeather}
              onMobility={setMobility}
            />

            <div className="mt-4 rounded-[22px] border border-earth bg-white/68 p-3">
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

          <aside className="bg-white/78 p-4 sm:p-5">
            <RegionPanel
              region={activeEntry}
              preview={activePreview}
              score={activeScore}
              previewLoading={previewLoading}
              packLoading={packLoading}
              recommendedPlaces={recommendedPlaces}
              selected={selectedRegions.includes(activeRegion)}
              selectedLabels={selectedLabels}
              onToggle={() => toggleRegion(activeRegion)}
              onSubmit={submitPlan}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function TrustLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-semibold text-basalt-2">
      <LegendDot color="#42B883" label="믿고 담기" />
      <LegendDot color="#F4C95D" label="확인하고 담기" />
      <LegendDot color="#E56B5D" label="오늘은 주의" />
      <LegendDot color="#C9C1B4" label="데이터 부족" />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-earth bg-white/70 px-2 py-1">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function FilterDock({
  startDate,
  durationDays,
  companion,
  purpose,
  weather,
  mobility,
  onStartDate,
  onDuration,
  onCompanion,
  onPurpose,
  onWeather,
  onMobility,
}: {
  startDate: string;
  durationDays: number;
  companion: CompanionValue;
  purpose: PurposeValue;
  weather: WeatherMode;
  mobility: MobilityMode;
  onStartDate: (value: string) => void;
  onDuration: (value: number) => void;
  onCompanion: (value: CompanionValue) => void;
  onPurpose: (value: PurposeValue) => void;
  onWeather: (value: WeatherMode) => void;
  onMobility: (value: MobilityMode) => void;
}) {
  return (
    <div className="mt-5 rounded-[24px] border border-earth bg-white/74 p-3">
      <div className="grid gap-3 md:grid-cols-[1.1fr_1fr_1fr]">
        <div className="grid grid-cols-2 gap-2">
          <label className="rounded-2xl border border-earth bg-[#FFF9F0] px-3 py-2">
            <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-basalt-2">
              <Calendar className="h-3 w-3" /> 날짜
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDate(e.target.value)}
              className="w-full bg-transparent text-[12px] font-semibold text-basalt outline-none"
            />
          </label>
          <label className="rounded-2xl border border-earth bg-[#FFF9F0] px-3 py-2">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-basalt-2">
              기간
            </span>
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => onDuration(Math.max(1, durationDays - 1))}>-</button>
              <span className="font-serif-kr text-[13px] font-bold text-basalt">{durationDays}일</span>
              <button type="button" onClick={() => onDuration(Math.min(14, durationDays + 1))}>+</button>
            </div>
          </label>
        </div>

        <Segmented
          icon={<CloudRain className="h-3.5 w-3.5" />}
          label="날씨"
          value={weather}
          options={WEATHER_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          onChange={(v) => onWeather(v as WeatherMode)}
        />
        <Segmented
          icon={<Compass className="h-3.5 w-3.5" />}
          label="이동"
          value={mobility}
          options={MOBILITY_OPTIONS}
          onChange={(v) => onMobility(v as MobilityMode)}
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <SelectLine
          icon={<Users className="h-3.5 w-3.5" />}
          label="동행"
          value={companion}
          options={COMPANIONS}
          onChange={(v) => onCompanion(v as CompanionValue)}
        />
        <SelectLine
          icon={<Compass className="h-3.5 w-3.5" />}
          label="목적"
          value={purpose}
          options={PURPOSES}
          onChange={(value) => onPurpose(value as PurposeValue)}
        />
      </div>
    </div>
  );
}

function Segmented({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-earth bg-[#FFF9F0] p-2">
      <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-basalt-2">
        {icon} {label}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-xl px-2 py-1.5 text-[11px] font-bold transition ${
              value === option.value ? 'bg-citrus text-white' : 'bg-white/70 text-basalt-2'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
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
  icon: ReactNode;
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
  score,
  previewLoading,
  packLoading,
  recommendedPlaces,
  selected,
  selectedLabels,
  onToggle,
  onSubmit,
}: {
  region: (typeof REGIONS)[number];
  preview?: RegionCoveragePreview;
  score: ReturnType<typeof scoreRegion>;
  previewLoading: boolean;
  packLoading: boolean;
  recommendedPlaces: Array<{ name: string; badge: string; note: string | null; source: string }>;
  selected: boolean;
  selectedLabels: string;
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-citrus-2">
            Region Intelligence
          </p>
          <h2 className="mt-1 font-serif-kr text-[28px] font-bold text-basalt">
            {region.label}을 담아도 될까요?
          </h2>
        </div>
        <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-citrus/20 bg-[#FFF9F0]">
          <span className="font-serif-kr text-[20px] font-bold text-citrus-2">
            {score.display}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-citrus/18 bg-citrus/8 p-3 text-[12px] leading-relaxed text-basalt">
        {previewLoading ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            지역 근거를 확인하는 중입니다.
          </span>
        ) : (
          panelComment(region.label, score.status, recommended, weak)
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="확인 후보" value={preview ? preview.total_places.toLocaleString() : '-'} />
        <Metric label="데이터 부족" value={weak.length ? `${weak.length}개` : '낮음'} />
      </div>

      <div className="mt-4 space-y-2">
        <ScoreBar label="공공데이터 커버리지" value={score.breakdown.coverage} />
        <ScoreBar label="현재 조건 적합도" value={score.breakdown.condition} />
        <ScoreBar label="운영 정보 안정성" value={score.breakdown.operation} />
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-basalt-2">
          추천 가능한 순간
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(recommended.length ? recommended : ['근거 확인 중']).map((label) => (
            <span key={label} className="rounded-full border border-mint/25 bg-mint/8 px-2 py-1 text-[10.5px] font-bold text-mint">
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
            <div key={label} className="flex items-center gap-1.5 rounded-xl border border-amber-100 bg-amber-50/70 px-2.5 py-2 text-[11px] text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5" />
              {label}은 저희가 참조하는 공공데이터 기준으로 확인되지 않습니다.
            </div>
          )) : (
            <div className="flex items-center gap-1.5 rounded-xl border border-mint/20 bg-mint/7 px-2.5 py-2 text-[11px] text-mint">
              <ShieldCheck className="h-3.5 w-3.5" />
              선택 조건에서 큰 데이터 공백이 낮게 관측됩니다.
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-basalt-2">
            대표 후보
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
              선택한 순간과 지역으로 대표 후보를 확인하는 중입니다.
            </div>
          )}
        </div>
      </div>

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
          {selected ? '이 지역은 플랜 후보에 담겼어요' : '이 지역을 플랜 후보에 담기'}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-citrus px-4 py-3.5 font-serif-kr text-[15px] font-bold text-white shadow-jeju-chip transition hover:bg-citrus-2"
        >
          {selectedLabels || region.label} 여행팩 생성
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

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10.5px] font-semibold text-basalt-2">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-earth">
        <div
          className="h-full rounded-full bg-citrus transition-all"
          style={{ width: `${Math.max(8, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function scoreRegion(
  preview: RegionCoveragePreview | undefined,
  selectedMoments: MomentId[],
  weather: WeatherMode,
  mobility: MobilityMode,
  companion: CompanionValue,
) {
  if (!preview) {
    return {
      value: 42,
      display: '-',
      status: 'gap' as RegionStatus,
      breakdown: { coverage: 35, condition: 45, operation: 40 },
    };
  }

  const selected = selectedMoments.length ? selectedMoments : DEFAULT_MOMENTS;
  const moments = selected
    .map((id) => preview.moments.find((m) => m.moment === id))
    .filter(Boolean);
  const totalSelected = Math.max(1, moments.length);
  const covered = moments.filter((m) => !m?.coverage_gap).length;
  const caution = moments.reduce((sum, m) => sum + (m?.caution ?? 0), 0);
  const verified = moments.reduce((sum, m) => sum + (m?.verified ?? 0), 0);
  const riskyMoments = selected.filter((id) => MOMENT_WEATHER_RISK[id]?.includes(weather)).length;
  const mobilityPenalty = mobility === 'walk' && preview.region === 'udo' ? 10 : mobility === 'walk' ? 4 : 0;
  const companionPenalty = companion === 'parents' && riskyMoments > 0 ? 5 : companion === 'kids' && riskyMoments > 0 ? 4 : 0;

  const coverage = Math.round((covered / totalSelected) * 100);
  const condition = Math.max(25, 92 - riskyMoments * 14 - mobilityPenalty - companionPenalty);
  const operation = Math.max(30, Math.min(96, 88 - caution * 3 + Math.min(12, verified * 2)));
  const value = Math.round(coverage * 0.48 + condition * 0.34 + operation * 0.18);
  const status: RegionStatus =
    coverage < 36 ? 'gap' : value >= 78 ? 'strong' : value >= 58 ? 'watch' : 'risk';

  return {
    value,
    display: String(value),
    status,
    breakdown: { coverage, condition, operation },
  };
}

function statusColor(status: RegionStatus): string {
  if (status === 'strong') return '#42B883';
  if (status === 'watch') return '#F4C95D';
  if (status === 'risk') return '#E56B5D';
  return '#C9C1B4';
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

function panelComment(
  regionLabel: string,
  status: RegionStatus,
  recommended: Array<string | undefined>,
  weak: Array<string | undefined>,
) {
  if (status === 'strong') {
    const topics = recommended.filter(Boolean).slice(0, 2).join(' · ');
    return `${regionLabel}은 ${topics || '선택한 순간'} 쪽 공공데이터 근거가 비교적 안정적입니다. 지금 조건에서 플랜에 담기 좋은 후보입니다.`;
  }
  if (status === 'watch') {
    return `${regionLabel}은 담을 수 있는 후보가 있지만 일부 순간은 확인이 필요합니다. 운영 정보와 날씨 변수를 함께 보고 담는 편이 좋습니다.`;
  }
  if (status === 'risk') {
    return `${regionLabel}은 현재 조건에서 야외·이동 변수의 영향이 큽니다. 대체 지역이나 실내 순간을 함께 담는 것이 안전합니다.`;
  }
  const gaps = weak.filter(Boolean).slice(0, 2).join(' · ');
  return `${regionLabel}은 ${gaps || '선택 조건'}이 저희가 참조하는 공공데이터 기준으로 충분히 확인되지 않습니다. 없다고 단정하지 않고 데이터 부족으로 표시합니다.`;
}

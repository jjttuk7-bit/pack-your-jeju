import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
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

interface RegionHotspot {
  id: RegionId;
  x: number;
  y: number;
  align?: 'left' | 'center' | 'right';
}

const DEFAULT_MOMENTS: MomentId[] = ['oreum', 'beach_walk', 'local_food'];
const NOTES_MAX = 300;

const REGION_HOTSPOTS: RegionHotspot[] = [
  { id: 'hallim', x: 14, y: 50 },
  { id: 'aewol', x: 25, y: 42 },
  { id: 'jeju_city', x: 47, y: 34 },
  { id: 'jocheon', x: 62, y: 40 },
  { id: 'gujwa', x: 76, y: 46 },
  { id: 'udo', x: 90, y: 38 },
  { id: 'seongsan', x: 85, y: 57 },
  { id: 'pyoseon', x: 75, y: 67 },
  { id: 'namwon', x: 60, y: 73 },
  { id: 'seogwipo', x: 47, y: 76 },
  { id: 'andeok', x: 29, y: 72 },
  { id: 'daejeong', x: 17, y: 67 },
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
    <div className="relative mx-auto mt-4 aspect-[567/312] w-full max-w-4xl overflow-hidden rounded-[26px] border border-orange-100/70 bg-[#F7E6CC]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.85),rgba(255,247,232,0.25)_45%,rgba(222,178,124,0.15))]" />
      <img
        src="/jeju_silhouette_refined.svg"
        alt="제주도 실루엣"
        className="absolute inset-[5%] h-[90%] w-[90%] object-contain opacity-[0.18] [filter:sepia(1)_saturate(1.7)_hue-rotate(336deg)]"
      />
      <div className="absolute inset-[7%] rounded-[50%] border border-citrus/10 bg-citrus/5 blur-2xl" />

      {REGION_HOTSPOTS.map((spot) => {
        const region = REGIONS.find((r) => r.value === spot.id);
        const active = activeRegion === spot.id;
        const selected = selectedRegions.includes(spot.id);
        const tone = getRegionTone(previews[spot.id], selectedMoments, loading);
        return (
          <button
            key={spot.id}
            type="button"
            onClick={() => onInspect(spot.id)}
            onDoubleClick={() => onToggle(spot.id)}
            aria-pressed={selected}
            aria-label={`${region?.label ?? spot.id} 근거 보기`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1.5 text-[11px] font-bold shadow-sm transition hover:-translate-y-[55%] focus:outline-none focus:ring-2 focus:ring-citrus/35 ${
              selected
                ? 'border-citrus bg-citrus text-white shadow-jeju-chip'
                : active
                  ? 'border-citrus bg-white text-citrus-2'
                  : 'border-white/90 bg-white/86 text-basalt hover:border-citrus/50'
            }`}
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          >
            <span
              className={`mr-1 inline-block h-2 w-2 rounded-full ${toneDotClass(tone)}`}
              aria-hidden="true"
            />
            {selected && <Check className="mr-0.5 inline h-2.5 w-2.5 stroke-[4]" />}
            {region?.label}
          </button>
        );
      })}

      <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/80 bg-white/72 px-3 py-2 text-[10.5px] leading-relaxed text-basalt-2 backdrop-blur">
        한 번 누르면 근거를 보고, 선택 버튼으로 플랜 후보에 담습니다. 숫자 점수는 만들지 않고 실제 커버리지와 후보만 표시합니다.
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

  return (
    <div className="flex h-full flex-col">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-citrus-2">
          선택 지역 근거
        </p>
        <h2 className="mt-1 font-serif-kr text-[27px] font-bold leading-tight text-basalt">
          {region.label}을 담아볼까요?
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
          {selected ? '이 지역은 플랜 후보에 담겼어요' : '이 지역을 플랜 후보에 담기'}
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

function toneDotClass(tone: RegionTone): string {
  if (tone === 'verified') return 'bg-mint';
  if (tone === 'caution') return 'bg-amber-400';
  if (tone === 'gap') return 'bg-stone-300';
  return 'bg-citrus/40';
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

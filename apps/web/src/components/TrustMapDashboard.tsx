import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  PurposeValue,
  RegionCoverageMomentDto,
  RegionCoveragePreview,
  RegionId,
  TravelInfo,
} from '../types';
import { COMPANIONS, MOMENTS, PURPOSES, REGIONS } from '../data';
import { requestRegionCoveragePreview } from '../api';
import { normalizeTripStartDate } from '../date';
import {
  buildRegionMomentCombinations,
  combinationKey,
  countReviewedCombinations,
} from '../regionMomentInspector';
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

const REGION_INTROS: Record<RegionId, { title: string; body: string; moods: string[] }> = {
  hallim: {
    title: '바다와 마을 산책을 느슨하게 엮기 좋은 서쪽 권역',
    body: '한림은 해안 산책, 조용한 카페, 마을 풍경을 천천히 담기 좋은 지역입니다. 일정 첫날이나 마지막 날에 부담 없이 넣기 좋습니다.',
    moods: ['서쪽 바다', '카페', '느린 동선'],
  },
  aewol: {
    title: '해안 드라이브와 카페 동선이 자연스럽게 이어지는 권역',
    body: '애월은 바다를 보며 쉬는 일정과 카페 시간을 함께 잡기 좋습니다. 사람이 많은 시간대는 피하고 여유 시간을 넉넉히 두는 편이 좋습니다.',
    moods: ['해안 풍경', '카페', '가벼운 산책'],
  },
  jeju_city: {
    title: '공항 접근성과 도심 편의가 좋은 시작점',
    body: '제주시는 도착 직후나 출발 전 일정에 넣기 좋습니다. 식사, 시장, 짧은 산책처럼 이동 부담이 낮은 순간을 조합하기 쉽습니다.',
    moods: ['공항 접근', '도심 편의', '시장'],
  },
  jocheon: {
    title: '동쪽으로 넘어가기 전 숲과 바다를 고르기 좋은 권역',
    body: '조천은 조용한 카페, 바다 산책, 숲길을 함께 보기 좋은 지역입니다. 동쪽 일정으로 이동하기 전 완충 지점으로 쓰기 좋습니다.',
    moods: ['동쪽 초입', '숲길', '바다'],
  },
  gujwa: {
    title: '오름과 해안 풍경을 함께 담기 좋은 동북쪽 권역',
    body: '구좌는 오름, 바다 산책, 조용한 마을 풍경을 엮기 좋습니다. 날씨와 바람에 따라 실내 쉬는 시간을 같이 잡으면 안정적입니다.',
    moods: ['오름', '해안', '마을'],
  },
  udo: {
    title: '섬 안에서 바다와 걷는 시간을 크게 느끼는 권역',
    body: '우도는 이동 자체가 일정의 일부가 됩니다. 배편과 날씨 영향을 먼저 보고, 하루 중 무리하지 않는 범위로 담는 편이 좋습니다.',
    moods: ['섬 여행', '바다', '이동 확인'],
  },
  seongsan: {
    title: '동쪽 대표 풍경과 바다 일정을 압축하기 좋은 권역',
    body: '성산은 바다 풍경, 오름, 현지 식사를 함께 담기 좋습니다. 일정이 짧다면 동쪽 하루의 중심지로 잡기 쉽습니다.',
    moods: ['동쪽 풍경', '오름', '바다'],
  },
  pyoseon: {
    title: '해안과 조용한 마을 분위기를 넓게 쓰기 좋은 남동쪽 권역',
    body: '표선은 바다 산책과 조용한 시간을 담기 좋습니다. 사람 많은 동선보다 여백 있는 하루를 만들 때 잘 어울립니다.',
    moods: ['남동 해안', '조용한 산책', '여백'],
  },
  namwon: {
    title: '한라산 남쪽 숲과 바다가 가까운 조용한 권역',
    body: '남원은 큰 관광지를 빠르게 찍기보다 숲길, 해안 산책, 감귤 마을, 조용한 카페를 느슨하게 엮기 좋습니다. “제주에 머문다”는 느낌을 만들기 좋은 지역입니다.',
    moods: ['숲길', '바다 산책', '감귤'],
  },
  seogwipo: {
    title: '남쪽 도심 편의와 자연 풍경을 함께 쓰는 권역',
    body: '서귀포는 식사, 카페, 해안 산책, 짧은 자연 코스를 함께 잡기 좋습니다. 숙소가 남쪽이라면 하루의 기준점으로 쓰기 쉽습니다.',
    moods: ['남쪽 중심', '식사', '자연'],
  },
  andeok: {
    title: '차분한 남서쪽 풍경과 쉬는 시간을 만들기 좋은 권역',
    body: '안덕은 조용한 카페, 바다, 산책을 여유 있게 조합하기 좋습니다. 일정의 밀도를 낮추고 싶을 때 잘 맞습니다.',
    moods: ['남서쪽', '카페', '휴식'],
  },
  daejeong: {
    title: '제주 서남쪽의 넓은 바다와 마을 풍경을 담는 권역',
    body: '대정은 바다 산책과 마을 분위기를 함께 보기 좋습니다. 서쪽 끝 동선이라 이동 시간을 먼저 확인하고 넣는 편이 안정적입니다.',
    moods: ['서남쪽 바다', '마을', '동선 확인'],
  },
};

const MOMENT_REGION_GUIDES: Record<MomentId, { focus: string; tip: string; check: string }> = {
  oreum: {
    focus: '높낮이와 바람을 함께 보는 순간',
    tip: '한 곳을 깊게 보고 내려온 뒤 쉬는 시간을 붙이면 일정이 안정적입니다.',
    check: '풍속, 주차·정류장 접근성',
  },
  beach_walk: {
    focus: '해안선과 걷기 시간을 함께 보는 순간',
    tip: '오전이나 늦은 오후처럼 햇빛과 바람 부담이 낮은 시간대로 잡으면 좋습니다.',
    check: '바람, 해안 접근성',
  },
  sunset: {
    focus: '시간이 정해진 풍경을 기다리는 순간',
    tip: '후보를 많이 넣기보다 한 지점에 머물 여유를 남기는 편이 좋습니다.',
    check: '일몰 전 이동 여유, 날씨',
  },
  local_market: {
    focus: '먹거리와 현지 리듬을 한 번에 보는 순간',
    tip: '식사와 기념품, 짧은 산책을 묶어 비 오는 날 대체 일정으로도 쓰기 좋습니다.',
    check: '운영일, 주차·정류장',
  },
  local_food: {
    focus: '한 끼를 기준으로 주변 동선을 붙이는 순간',
    tip: '점심 또는 저녁 한 끼를 먼저 정하고 가까운 산책 후보를 붙이면 자연스럽습니다.',
    check: '주소 확인, 수정요청 이력',
  },
  quiet_cafe: {
    focus: '일정 사이 체력을 회복하는 순간',
    tip: '혼자 여행이거나 긴 이동 뒤라면 다음 일정 전 완충 시간으로 넣기 좋습니다.',
    check: '영업 정보, 혼잡 시간',
  },
  gotjawal: {
    focus: '숲길 상태와 날씨를 함께 보는 순간',
    tip: '비 온 뒤에는 길 상태를 확인하고 가벼운 바람막이와 걷기 편한 신발을 챙기면 좋습니다.',
    check: '강수, 탐방로 상태',
  },
  citrus: {
    focus: '계절과 운영 여부가 중요한 체험 순간',
    tip: '체험형 일정이라 예약 가능 시간과 계절 적합성을 먼저 보는 편이 안전합니다.',
    check: '운영 기간, 예약 필요 여부',
  },
  stay: {
    focus: '하루 동선의 기준점을 잡는 순간',
    tip: '숙소 후보는 관광지처럼 소비하기보다 이동 기준점으로 보고 주변 일정을 붙이면 좋습니다.',
    check: '주소, 체크인 전 짐 보관 가능 여부',
  },
  festival_event: {
    focus: '날짜와 운영 여부가 중요한 순간',
    tip: '축제·행사는 여행 기간과 맞는지 먼저 보고, 날씨와 현장 공지를 한 번 더 확인하세요.',
    check: '운영 기간, 현장 변경 공지',
  },
  souvenir_shopping: {
    focus: '돌아가는 동선과 짐 부피를 함께 보는 순간',
    tip: '마지막 날이나 숙소 복귀 전에 배치하면 보관과 이동 부담을 줄이기 좋습니다.',
    check: '주소, 포장·보관 필요 여부',
  },
  culture_stop: {
    focus: '날씨 대체와 제주 이야기를 함께 보는 순간',
    tip: '비·바람이 있는 날 야외 일정을 줄이고 전시·문화 공간을 넣으면 일정이 덜 흔들립니다.',
    check: '운영 정보, 휴관 여부',
  },
};

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

const JEJU_ISLAND_PATH =
  'M36 236 L54 190 L52 155 L76 128 L118 109 L168 88 L263 62 L351 48 L432 39 L500 75 L525 101 L550 146 L527 179 L472 174 L433 222 L356 239 L292 253 L214 266 L148 257 L112 286 L66 270 Z';

export default function TrustMapDashboard({
  onSubmit,
  initialInfo,
  initialMoments,
}: TrustMapDashboardProps) {
  const [selectedRegions, setSelectedRegions] = useState<RegionId[]>(initialInfo?.regions ?? []);
  const [activeRegion, setActiveRegion] = useState<RegionId | null>(
    initialInfo?.regions?.[0] ?? null,
  );
  const [selectedMoments, setSelectedMoments] = useState<MomentId[]>(
    initialMoments?.length ? initialMoments : [],
  );
  const [activeMoment, setActiveMoment] = useState<MomentId | null>(
    initialMoments?.[0] ?? null,
  );
  const [reviewedCombinations, setReviewedCombinations] = useState<Set<string>>(
    () => new Set(),
  );
  const [showUnreviewedOnly, setShowUnreviewedOnly] = useState(false);
  const [startDate, setStartDate] = useState(
    normalizeTripStartDate(initialInfo?.startDate),
  );
  const [durationDays, setDurationDays] = useState(initialInfo?.durationDays ?? 2);
  const [companion, setCompanion] = useState<CompanionValue>(initialInfo?.companion ?? 'solo');
  const [purpose, setPurpose] = useState<PurposeValue>(initialInfo?.purpose ?? 'healing');
  const [specialNotes, setSpecialNotes] = useState(initialInfo?.specialNotes ?? '');
  const [previews, setPreviews] = useState<Record<string, RegionCoveragePreview>>({});
  const [previewLoading, setPreviewLoading] = useState(true);

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

  const activeEntry = activeRegion
    ? REGIONS.find((region) => region.value === activeRegion)
    : undefined;
  const activePreview = activeRegion ? previews[activeRegion] : undefined;
  const activeTone = activeRegion
    ? getRegionTone(activePreview, selectedMoments, previewLoading)
    : 'loading';
  const selectedLabels = selectedRegions
    .map((id) => REGIONS.find((region) => region.value === id)?.label ?? id)
    .join(' · ');
  const coverageSummary = useMemo(
    () => summarizeSelectedRegions(selectedRegions, previews),
    [selectedRegions, previews],
  );
  const dashboardSummary = useMemo(
    () => summarizeDashboardPreviews(previews),
    [previews],
  );
  const combinations = useMemo(
    () => buildRegionMomentCombinations(selectedRegions, selectedMoments),
    [selectedRegions, selectedMoments],
  );
  const reviewedCount = countReviewedCombinations(
    combinations,
    reviewedCombinations,
  );
  const activeCombinationIndex = combinations.findIndex(
    ({ region, moment }) => region === activeRegion && moment === activeMoment,
  );

  const inspectCombination = useCallback((region: RegionId, moment: MomentId) => {
    setActiveRegion(region);
    setActiveMoment(moment);
    setReviewedCombinations((current) => {
      const key = combinationKey(region, moment);
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    const region = activeRegion && selectedRegions.includes(activeRegion)
      ? activeRegion
      : selectedRegions[0];
    const moment = activeMoment && selectedMoments.includes(activeMoment)
      ? activeMoment
      : selectedMoments[0];

    if (region && moment) {
      inspectCombination(region, moment);
    }
  }, [
    activeMoment,
    activeRegion,
    inspectCombination,
    selectedMoments,
    selectedRegions,
  ]);

  const inspectCombinationAt = (index: number) => {
    const combination = combinations[index];
    if (combination) {
      inspectCombination(combination.region, combination.moment);
    }
  };

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
    if (selectedMoments.length === 0) return;
    const regions = selectedRegions.length ? selectedRegions : activeRegion ? [activeRegion] : [];
    if (regions.length === 0) return;
    onSubmit(buildTravelInfo(regions), selectedMoments);
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
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-basalt-2">
                    담고 싶은 순간
                  </p>
                  <p className="mt-0.5 text-[10px] text-basalt-2">
                    1개 이상 고르면 제주팩을 만들 수 있어요.
                  </p>
                </div>
                <p className="rounded-full border border-earth bg-[#FFF9F0] px-2 py-1 text-[10px] font-bold text-basalt-2">
                  {selectedMoments.length > 0 ? `현재 ${selectedMoments.length}개 담김` : '1개 이상 선택'}
                </p>
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
            {activeEntry && activeRegion ? (
              <RegionPanel
                region={activeEntry}
                preview={activePreview}
                tone={activeTone}
                previewLoading={previewLoading}
                selectedMoments={selectedMoments}
                selectedRegions={selectedRegions}
                activeMoment={activeMoment}
                reviewedCount={reviewedCount}
                combinationCount={combinations.length}
                activeCombinationPosition={
                  activeCombinationIndex >= 0 ? activeCombinationIndex + 1 : 0
                }
                reviewedCombinations={reviewedCombinations}
                showUnreviewedOnly={showUnreviewedOnly}
                selected={selectedRegions.includes(activeRegion)}
                selectedLabels={selectedLabels}
                coverageSummary={coverageSummary}
                canSubmit={selectedMoments.length > 0}
                onInspectCombination={inspectCombination}
                onPreviousCombination={() => inspectCombinationAt(activeCombinationIndex - 1)}
                onNextCombination={() => inspectCombinationAt(activeCombinationIndex + 1)}
                hasPreviousCombination={activeCombinationIndex > 0}
                hasNextCombination={
                  activeCombinationIndex >= 0 &&
                  activeCombinationIndex < combinations.length - 1
                }
                onToggleUnreviewedOnly={() =>
                  setShowUnreviewedOnly((current) => !current)
                }
                onToggle={() => toggleRegion(activeRegion)}
                onSubmit={submitPlan}
              />
            ) : (
              <DashboardStartPanel
                previewLoading={previewLoading}
                summary={dashboardSummary}
                selectedMomentCount={selectedMoments.length}
              />
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

function JejuMapDefs() {
  return (
    <defs>
      <linearGradient id="jejuSeaDepth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FBFEFD" />
        <stop offset="0.55" stopColor="#E6F3F0" />
        <stop offset="1" stopColor="#CDE4DF" />
      </linearGradient>
      <radialGradient id="hallasanRelief" cx="50%" cy="48%" r="48%">
        <stop offset="0" stopColor="#3F7669" stopOpacity="0.32" />
        <stop offset="0.42" stopColor="#74A496" stopOpacity="0.17" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      <filter id="jejuIslandDepth" x="-15%" y="-20%" width="130%" height="150%">
        <feDropShadow
          dx="0"
          dy="13"
          stdDeviation="10"
          floodColor="#44665F"
          floodOpacity="0.24"
        />
      </filter>
      <filter id="jejuRegionShadow" x="-8%" y="-8%" width="116%" height="116%">
        <feDropShadow
          dx="0"
          dy="5"
          stdDeviation="4"
          floodColor="#44665F"
          floodOpacity="0.1"
        />
      </filter>
      <filter id="jejuSelectedGlow" x="-24%" y="-24%" width="148%" height="158%">
        <feDropShadow
          dx="0"
          dy="5"
          stdDeviation="4"
          floodColor="#E65F2F"
          floodOpacity="0.62"
        />
      </filter>
      <filter id="jejuIsletDepth" x="-35%" y="-35%" width="170%" height="190%">
        <feDropShadow
          dx="0"
          dy="3"
          stdDeviation="2.5"
          floodColor="#52766E"
          floodOpacity="0.2"
        />
      </filter>
      <linearGradient
        id="jejuRoad"
        x1="42"
        y1="190"
        x2="519"
        y2="116"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FFFFFF" stopOpacity="0.95" />
        <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.72" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.95" />
      </linearGradient>
      <clipPath id="jejuIslandClip">
        <path d={JEJU_ISLAND_PATH} />
      </clipPath>
    </defs>
  );
}

function JejuSeaLayer() {
  return (
    <g data-testid="jeju-sea-layer" aria-hidden="true" pointerEvents="none">
      <rect width="567" height="312" fill="url(#jejuSeaDepth)" />
      <path
        d="M-24 92 C72 61 143 74 224 50 C316 22 406 27 590 72"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.7"
        strokeWidth="2"
      />
      <path
        d="M-18 270 C84 239 141 278 233 286 C337 295 429 263 592 230"
        fill="none"
        stroke="#99C7BE"
        strokeDasharray="3 8"
        strokeLinecap="round"
        strokeOpacity="0.44"
        strokeWidth="1.5"
      />
      <path
        d="M-22 117 C60 101 101 87 158 59 M392 299 C466 279 523 265 591 250"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.5"
        strokeWidth="1"
      />
    </g>
  );
}

function JejuCoastLayer() {
  return (
    <g data-testid="jeju-coast-layer" aria-hidden="true" pointerEvents="none">
      <path d={JEJU_ISLAND_PATH} fill="#FFFFFF" fillOpacity="0.52" filter="url(#jejuIslandDepth)" />
      <path
        d={JEJU_ISLAND_PATH}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.92"
        strokeWidth="6"
      />
    </g>
  );
}

function HallasanTerrainLayer() {
  return (
    <g
      data-testid="hallasan-terrain-layer"
      aria-hidden="true"
      pointerEvents="none"
      clipPath="url(#jejuIslandClip)"
    >
      <ellipse cx="292" cy="163" rx="148" ry="96" fill="url(#hallasanRelief)" />
      <ellipse
        cx="292"
        cy="163"
        rx="119"
        ry="73"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.34"
        strokeWidth="1.5"
      />
      <ellipse
        cx="292"
        cy="163"
        rx="83"
        ry="50"
        fill="none"
        stroke="#376B60"
        strokeDasharray="2 5"
        strokeLinecap="round"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
      <ellipse
        cx="292"
        cy="163"
        rx="45"
        ry="25"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.38"
        strokeWidth="1.2"
      />
    </g>
  );
}

function OffshoreIslands() {
  return (
    <g
      data-testid="jeju-offshore-islands"
      aria-hidden="true"
      pointerEvents="none"
      filter="url(#jejuIsletDepth)"
      className="font-semibold"
    >
      <path
        d="M18 57 C29 48 43 52 54 64 C43 74 28 72 18 57 Z"
        fill="#B9D8E8"
        stroke="#FFFFFF"
        strokeOpacity="0.78"
        strokeWidth="1.5"
      />
      <path
        d="M31 48 C36 43 42 45 46 50 C41 54 35 54 31 48 Z"
        fill="#CDE4EE"
        opacity="0.9"
      />
      <text
        x="58"
        y="65"
        fill="#52706A"
        stroke="#FFFFFF"
        strokeOpacity="0.65"
        strokeWidth="2"
        paintOrder="stroke"
        className="text-[11px]"
      >
        추자도
      </text>

      <path
        d="M87 287 L100 281 L111 291 L100 300 L87 295 Z"
        fill="#AFCBC5"
        stroke="#FFFFFF"
        strokeOpacity="0.8"
        strokeWidth="1.5"
      />
      <text
        x="49"
        y="296"
        fill="#607B74"
        stroke="#FFFFFF"
        strokeOpacity="0.68"
        strokeWidth="2"
        paintOrder="stroke"
        className="hidden text-[10px] sm:block"
      >
        가파도
      </text>

      <path
        d="M118 301 L130 295 L141 303 L130 310 L118 306 Z"
        fill="#96B9B1"
        stroke="#FFFFFF"
        strokeOpacity="0.82"
        strokeWidth="1.5"
      />
      <text
        x="107"
        y="309"
        fill="#607B74"
        stroke="#FFFFFF"
        strokeOpacity="0.68"
        strokeWidth="2"
        paintOrder="stroke"
        className="hidden text-[10px] sm:block"
      >
        마라도
      </text>
    </g>
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
  activeRegion: RegionId | null;
  selectedRegions: RegionId[];
  previews: Record<string, RegionCoveragePreview>;
  loading: boolean;
  selectedMoments: MomentId[];
  onInspect: (region: RegionId) => void;
  onToggle: (region: RegionId) => void;
}) {
  return (
    <div className="mx-auto mt-4 w-full max-w-4xl">
      <div className="relative aspect-[567/312] w-full overflow-hidden rounded-[26px] border border-[#CDE5DF] bg-[#E6F3F0] shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
        <svg
          viewBox="0 0 567 312"
          role="img"
          aria-label="제주 행정구역 선택 지도"
          className="absolute inset-0 h-full w-full"
        >
        <JejuMapDefs />
        <JejuSeaLayer />
        <JejuCoastLayer />

        <g filter="url(#jejuRegionShadow)">
          {REGION_SHAPES.map((shape) => {
            const region = REGIONS.find((r) => r.value === shape.id);
            const active = activeRegion === shape.id;
            const selected = selectedRegions.includes(shape.id);
            const tone = getRegionTone(previews[shape.id], selectedMoments, loading);
            return (
              <g key={shape.id}>
                {selected && (
                  <path
                    data-testid={`${shape.id}-selection-glow`}
                    aria-hidden="true"
                    pointerEvents="none"
                    d={shape.path}
                    fill="none"
                    stroke="#F06A3B"
                    strokeOpacity="0.84"
                    strokeWidth="6"
                    filter="url(#jejuSelectedGlow)"
                  />
                )}
                <path
                  d={shape.path}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={`${region?.label ?? shape.id} 근거 보기`}
                  data-region-id={shape.id}
                  data-tone={tone}
                  data-active={String(active)}
                  data-selected={String(selected)}
                  filter={selected ? 'url(#jejuSelectedGlow)' : undefined}
                  onClick={() => onInspect(shape.id)}
                  onDoubleClick={() => onToggle(shape.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onInspect(shape.id);
                    }
                  }}
                  className={`cursor-pointer stroke-white stroke-[2.5] transition duration-200 ease-out outline-none hover:brightness-105 focus-visible:stroke-citrus focus-visible:stroke-[4] motion-reduce:transition-none ${regionFillClass(
                    tone,
                    active,
                    selected,
                  )}`}
                />
              </g>
            );
          })}
        </g>

        <HallasanTerrainLayer />

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
          const tone = getRegionTone(previews[shape.id], selectedMoments, loading);
          const status = regionMapStatus(previews[shape.id], tone, loading);
          return (
            <g
              key={`${shape.id}-label`}
              role="status"
              aria-label={`${region?.label ?? shape.id} 지도 상태`}
              className="pointer-events-none"
            >
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
                y={shape.id === 'udo' ? shape.labelY : shape.labelY - 3}
                textAnchor="middle"
                dominantBaseline="middle"
                className={`select-none text-[13px] font-bold [paint-order:stroke] [stroke-width:2.5px] ${
                  selected ? 'fill-white' : active ? 'fill-citrus-2' : 'fill-basalt'
                } ${selected ? 'stroke-citrus-2/30' : 'stroke-white/55'}`}
              >
                {region?.label}
              </text>
              {shape.id !== 'udo' && (
                <text
                  x={shape.labelX}
                  y={shape.labelY + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`select-none text-[7.5px] font-semibold tracking-[-0.02em] [paint-order:stroke] [stroke-width:2px] ${
                    selected
                      ? 'fill-white stroke-citrus-2/35'
                      : active
                        ? 'fill-[#9D431F] stroke-white/60'
                        : 'fill-[#4A675F] stroke-white/60'
                  }`}
                >
                  {status}
                </text>
              )}
            </g>
          );
        })}

        <OffshoreIslands />
        </svg>

        <div
          data-testid="desktop-map-instruction"
          className="absolute bottom-3 right-3 hidden max-w-[240px] rounded-2xl border border-earth bg-white/82 px-3 py-2 text-[10.5px] leading-relaxed text-basalt-2 shadow-sm backdrop-blur sm:block"
        >
          지역 면을 누르면 우측 근거가 바뀝니다. 선택은 우측 버튼으로 플랜 후보에 담습니다.
        </div>
      </div>

      <div
        data-testid="mobile-map-instruction"
        className="mt-2 rounded-2xl border border-earth bg-white/82 px-3 py-2 text-[11px] leading-relaxed text-basalt-2 shadow-sm sm:hidden"
      >
        지역 면을 누르면 아래 근거가 바뀝니다. 선택은 아래 버튼으로 플랜 후보에 담습니다.
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
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B8D8D1] bg-white/70 px-2 py-1">
        <span
          aria-hidden="true"
          className="h-2.5 w-6 rounded-full bg-gradient-to-r from-[#D9EDE8] via-[#8DB9AD] to-[#4F7F73]"
        />
        중앙 음영은 지형 표현
      </span>
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
  selectedMoments,
  selectedRegions,
  activeMoment,
  reviewedCount,
  combinationCount,
  activeCombinationPosition,
  reviewedCombinations,
  showUnreviewedOnly,
  selected,
  selectedLabels,
  coverageSummary,
  canSubmit,
  onInspectCombination,
  onPreviousCombination,
  onNextCombination,
  hasPreviousCombination,
  hasNextCombination,
  onToggleUnreviewedOnly,
  onToggle,
  onSubmit,
}: {
  region: (typeof REGIONS)[number];
  preview?: RegionCoveragePreview;
  tone: RegionTone;
  previewLoading: boolean;
  selectedMoments: MomentId[];
  selectedRegions: RegionId[];
  activeMoment: MomentId | null;
  reviewedCount: number;
  combinationCount: number;
  activeCombinationPosition: number;
  reviewedCombinations: ReadonlySet<string>;
  showUnreviewedOnly: boolean;
  selected: boolean;
  selectedLabels: string;
  coverageSummary: { totalPlaces: number; strongMoments: string[]; weakMoments: string[] };
  canSubmit: boolean;
  onInspectCombination: (region: RegionId, moment: MomentId) => void;
  onPreviousCombination: () => void;
  onNextCombination: () => void;
  hasPreviousCombination: boolean;
  hasNextCombination: boolean;
  onToggleUnreviewedOnly: () => void;
  onToggle: () => void;
  onSubmit: () => void;
}) {
  const recommended = preview?.recommended_moments
    .map((id) => preview.moments.find((m) => m.moment === id)?.moment_label)
    .filter(Boolean)
    .slice(0, 4) ?? [];
  const regionObjectLabel = withObjectParticle(region.label);
  const intro = REGION_INTROS[region.value];
  const activeMomentEntry = activeMoment
    ? MOMENTS.find((item) => item.id === activeMoment)
    : undefined;
  const activeMomentStat = activeMoment
    ? preview?.moments.find((item) => item.moment === activeMoment)
    : undefined;
  const activeStory = activeMoment && activeMomentEntry
    ? {
        id: activeMoment,
        title: activeMomentEntry.title,
        body: buildRegionMomentStory(region, activeMoment, activeMomentStat),
        meta: buildRegionMomentMeta(activeMomentStat),
      }
    : null;
  const visibleMoments = selectedMoments.filter(
    (moment) =>
      !showUnreviewedOnly ||
      !reviewedCombinations.has(combinationKey(region.value, moment)),
  );

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
        <Metric
          label="공공데이터 확인 후보"
          value={preview ? preview.total_places.toLocaleString() : '-'}
          helper="장소명·주소 조회"
        />
        <Metric
          label="선택 후보"
          value={selected ? '담김' : '미선택'}
          helper={selected ? '제주팩에 포함' : '아직 미포함'}
        />
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
          {region.label} 소개
        </p>
        <div className="mt-2 rounded-2xl border border-mint/20 bg-mint/7 p-3">
          <p className="font-serif-kr text-[14px] font-bold leading-snug text-basalt">{intro.title}</p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-basalt-2">{intro.body}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {intro.moods.map((mood) => (
              <span key={mood} className="rounded-full border border-mint/20 bg-white/80 px-2 py-1 text-[10px] font-bold text-mint">
                {mood}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-basalt-2">
              선택한 순간으로 보기
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-basalt-2/80">
              자세한 장소 후보와 확인 이력은 다음 팩 만들기에서 봅니다.
            </p>
          </div>
        </div>
        <section
          data-testid="region-moment-inspector"
          aria-label="지역별 순간 조합 확인"
          className="mb-3 rounded-2xl border border-earth bg-white/70 p-3"
        >
          <p className="text-[10px] font-bold text-basalt-2">
            {selectedRegions.length}개 지역 · {selectedMoments.length}개 순간 · 총 {combinationCount}개 조합
          </p>
          <p className="mt-1 text-[11px] font-bold text-mint">
            확인 {reviewedCount} / {combinationCount}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-basalt-2">
              현재 {activeCombinationPosition} / {combinationCount}
            </p>
            <button
              type="button"
              aria-pressed={showUnreviewedOnly}
              onClick={onToggleUnreviewedOnly}
              className="rounded-full border border-earth bg-white px-2 py-1 text-[10px] font-bold text-basalt-2"
            >
              {showUnreviewedOnly ? '전체 보기' : '미확인만 보기'}
            </button>
          </div>

          <nav aria-label="선택 지역 조합" className="mt-3 flex flex-wrap gap-1.5">
            {selectedRegions.map((regionId) => {
              const label = REGIONS.find((item) => item.value === regionId)?.label ?? regionId;
              return (
                <button
                  key={regionId}
                  type="button"
                  aria-current={regionId === region.value ? 'page' : undefined}
                  aria-label={`${label} 지역 조합 보기`}
                  onClick={() => {
                    const moment = activeMoment ?? selectedMoments[0];
                    if (moment) onInspectCombination(regionId, moment);
                  }}
                  className="rounded-full border border-earth bg-white px-2 py-1 text-[10px] font-bold text-basalt-2"
                >
                  {label}
                </button>
              );
            })}
          </nav>

          <div aria-label={`${region.label} 선택 순간`} className="mt-3 flex flex-wrap gap-1.5">
            {visibleMoments.map((momentId) => {
              const moment = MOMENTS.find((item) => item.id === momentId);
              if (!moment) return null;
              return (
                <button
                  key={momentId}
                  type="button"
                  aria-pressed={momentId === activeMoment}
                  aria-label={`${region.label}에서 ${moment.title} 조합 확인`}
                  onClick={() => onInspectCombination(region.value, momentId)}
                  className="rounded-xl border border-earth bg-[#FFF9F0] px-2 py-1.5 text-[10px] font-bold text-basalt-2"
                >
                  {moment.title}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!hasPreviousCombination}
              onClick={onPreviousCombination}
              className="flex-1 rounded-xl border border-earth bg-white px-2 py-1.5 text-[10px] font-bold text-basalt-2 disabled:opacity-40"
            >
              이전 조합
            </button>
            <button
              type="button"
              disabled={!hasNextCombination}
              onClick={onNextCombination}
              className="flex-1 rounded-xl border border-earth bg-white px-2 py-1.5 text-[10px] font-bold text-basalt-2 disabled:opacity-40"
            >
              다음 조합
            </button>
          </div>
        <div className="mt-3 space-y-2">
          {activeStory ? (
            <div key={activeStory.id} className="rounded-2xl border border-earth bg-[#FFF9F0] p-3">
              <div className="flex gap-2.5">
                <MomentIcon id={activeStory.id} className="h-8 w-8 shrink-0" />
                <div>
                  <p className="font-serif-kr text-[13px] font-bold text-basalt">
                    {region.label}에서 {activeStory.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-basalt-2">{activeStory.body}</p>
                  <p className="mt-2 text-[10px] font-bold leading-relaxed text-mint">
                    {activeStory.meta}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-earth bg-[#FFF9F0] p-4 text-center text-[11px] leading-relaxed text-basalt-2">
              아래에서 담고 싶은 순간을 고르면, 이 지역에서 어떤 여행감으로 볼 수 있는지 먼저 정리해드립니다.
            </div>
          )}
        </div>
        </section>
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
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-citrus px-4 py-3.5 font-serif-kr text-[15px] font-bold text-white shadow-jeju-chip transition hover:bg-citrus-2 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-white/80 disabled:shadow-none"
        >
          {canSubmit ? `${selectedLabels || region.label} 제주팩 받기` : '순간을 1개 이상 골라주세요'}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function DashboardStartPanel({
  previewLoading,
  summary,
  selectedMomentCount,
}: {
  previewLoading: boolean;
  summary: { totalPlaces: number; loadedRegions: number; strongMoments: string[]; weakMoments: string[] };
  selectedMomentCount: number;
}) {
  const topStrong = summary.strongMoments.slice(0, 3);
  const topWeak = summary.weakMoments.slice(0, 3);

  return (
    <div className="flex h-full flex-col">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-citrus-2">
          지역 선택 전
        </p>
        <h2 className="mt-1 font-serif-kr text-[27px] font-bold leading-tight text-basalt">
          지도를 누르면,
          <br />
          근거가 열립니다.
        </h2>
        <p className="mt-3 text-[12px] leading-relaxed text-basalt-2">
          처음 화면에서는 특정 지역을 고정하지 않습니다. 지도에서 지역을 고르면 오른쪽에
          확인 후보, 주의 신호, 데이터 공백을 나눠 보여드립니다.
        </p>
      </div>

      <div className="mt-5 rounded-[24px] border border-mint/25 bg-gradient-to-br from-mint/10 via-white to-[#FFF8EC] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-mint shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-serif-kr text-[15px] font-bold text-basalt">공공데이터 근거 미리보기</p>
            <p className="mt-1 text-[11px] leading-relaxed text-basalt-2">
              후보를 억지로 채우지 않고, 확인된 것과 확인이 필요한 것을 분리합니다.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric
          label="불러온 지역"
          value={previewLoading ? '-' : `${summary.loadedRegions}곳`}
          helper="지도 전체 기준"
        />
        <Metric
          label="확인 후보"
          value={previewLoading ? '-' : `${summary.totalPlaces.toLocaleString()}곳`}
          helper="공공데이터 합산"
        />
      </div>

      <div className="mt-5 space-y-3">
        <div className="rounded-2xl border border-earth bg-[#FFF9F0] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-basalt-2">
            선택 후 보이는 것
          </p>
          <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-basalt-2">
            <GuideStep index="01" title="지역 근거 요약" body="선택한 지역의 확인 후보 수와 강한 순간을 먼저 보여드립니다." />
            <GuideStep index="02" title="확인 필요 항목" body="주의 표시는 이유를 함께 보여주고, 부족한 근거는 그대로 분리합니다." />
            <GuideStep index="03" title="플랜 후보 담기" body="지역과 순간을 고른 뒤에만 제주팩 생성으로 이어집니다." />
          </div>
        </div>

        <div className="rounded-2xl border border-citrus/15 bg-citrus/7 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-citrus-2">
            지금 고른 순간
          </p>
          <p className="mt-1 font-serif-kr text-[18px] font-bold text-basalt">
            {selectedMomentCount > 0 ? `${selectedMomentCount}개 담김` : '아직 없음'}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-basalt-2">
            순간을 먼저 골라도 괜찮습니다. 지역을 클릭하면 해당 조합의 근거만 오른쪽에 열립니다.
          </p>
        </div>
      </div>

      <div className="mt-auto pt-5">
        <div className="rounded-2xl border border-dashed border-earth bg-white/70 p-4 text-center text-[11px] leading-relaxed text-basalt-2">
          지도에서 제주 지역을 한 번 눌러보세요. 선택한 지역의 근거 패널이 이 자리에 나타납니다.
        </div>
      </div>

      {(topStrong.length > 0 || topWeak.length > 0) && (
        <div className="sr-only">
          강점 {topStrong.join(', ')} / 확인 필요 {topWeak.join(', ')}
        </div>
      )}
    </div>
  );
}

function GuideStep({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex h-5 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-bold text-citrus-2">
        {index}
      </span>
      <span>
        <b className="text-basalt">{title}</b>
        <span className="block">{body}</span>
      </span>
    </div>
  );
}

function Metric({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-earth bg-[#FFF9F0] px-3 py-2">
      <p className="text-[10px] text-basalt-2">{label}</p>
      <p className="mt-0.5 font-serif-kr text-[20px] font-bold text-basalt">{value}</p>
      {helper && <p className="mt-1 text-[9.5px] leading-snug text-basalt-2/75">{helper}</p>}
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

function regionMapStatus(
  preview: RegionCoveragePreview | undefined,
  tone: RegionTone,
  loading: boolean,
): string {
  if (loading && !preview) return '조회 중';
  if (tone === 'gap') return '데이터 부족';
  if (tone === 'caution') return '확인 필요';
  const total = preview?.total_places ?? 0;
  return total > 0 ? `후보 ${total}` : '근거 보기';
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

function buildRegionMomentStory(
  region: (typeof REGIONS)[number],
  momentId: MomentId,
  stat?: RegionCoverageMomentDto,
): string {
  const guide = MOMENT_REGION_GUIDES[momentId];
  const landmarks = region.landmarks.slice(0, 2).join('·');
  const coverage = stat
    ? stat.coverage_gap
      ? '아직 확인 후보가 약한 편이라 다음 화면에서 실제 후보를 꼭 확인해야 합니다.'
      : `공공데이터 기준 확인 후보 ${stat.verified.toLocaleString()}곳을 먼저 비교할 수 있습니다.`
    : '선택한 조건으로 후보를 확인하는 중입니다.';

  return `${region.label}은 ${landmarks} 같은 지역 힌트를 기준으로 동선을 잡기 좋습니다. ${guide.focus}이라 ${coverage} ${guide.tip}`;
}

function buildRegionMomentMeta(stat?: RegionCoverageMomentDto): string {
  const guide = stat
    ? MOMENT_REGION_GUIDES[stat.moment as MomentId]
    : undefined;
  const countLabel = stat
    ? stat.coverage_gap
      ? '확인 후보 부족'
      : `확인 후보 ${stat.verified.toLocaleString()}곳`
    : '후보 확인 중';
  return `${countLabel} · 먼저 볼 것: ${guide?.check ?? '근거 확인'}`;
}

function panelToneClass(tone: RegionTone): string {
  if (tone === 'verified') return 'border-mint/20 bg-mint/7 text-mint';
  if (tone === 'caution') return 'border-amber-100 bg-amber-50/70 text-amber-900';
  if (tone === 'gap') return 'border-stone-200 bg-stone-50 text-stone-700';
  return 'border-citrus/20 bg-citrus/8 text-basalt';
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

function summarizeDashboardPreviews(previews: Record<string, RegionCoveragePreview>) {
  const loadedPreviews = Object.values(previews);
  const totalPlaces = loadedPreviews.reduce((sum, preview) => sum + preview.total_places, 0);
  const strongMoments = Array.from(new Set(
    loadedPreviews.flatMap((preview) =>
      preview.recommended_moments
        .map((id) => preview.moments.find((m) => m.moment === id)?.moment_label)
        .filter(Boolean),
    ),
  )) as string[];
  const weakMoments = Array.from(new Set(
    loadedPreviews.flatMap((preview) =>
      preview.weak_moments
        .map((id) => preview.moments.find((m) => m.moment === id)?.moment_label)
        .filter(Boolean),
    ),
  )) as string[];
  return {
    loadedRegions: loadedPreviews.length,
    totalPlaces,
    strongMoments,
    weakMoments,
  };
}

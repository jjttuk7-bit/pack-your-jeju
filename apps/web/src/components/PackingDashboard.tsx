import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2,
  MapPin,
  Calendar,
  Users,
  Compass,
  RotateCcw,
  ExternalLink,
  ParkingCircle,
  Bus,
  ShieldAlert,
  Sparkles,
  CheckSquare,
  Square,
  ChevronDown,
  Download,
  BookOpenCheck,
  Share2,
  MapPinned,
  Copy,
  Check,
  Plus,
  Trash2,
  ClipboardCheck,
  CloudSun,
} from 'lucide-react';
import type {
  TravelInfo,
  MomentId,
  PackResponse,
  SectionDto,
  ItineraryDayDto,
  ItineraryItemDto,
  PackItemDto,
  TravelPlanItem,
  VisitCheck,
  VisitCheckStatus,
  WeatherSnapshotDto,
} from '../types';
import { MOMENTS, REGIONS, COMPANIONS, PURPOSES } from '../data';
import { requestPack, requestVisitSignal } from '../api';
import Badge from './Badge';
import MomentIcon from './marks/MomentIcon';
import PlaceDetail from './PlaceDetail';

interface Props {
  info: TravelInfo;
  selectedMomentIds: MomentId[];
  checkedItemIds: string[];
  checkedMemoryIds: string[];
  customBasicItems: string[];
  customMomentItems: Record<MomentId, string[]>;
  customMemories: string[];
  selectedPlanItems: TravelPlanItem[];
  visitChecks: Record<string, VisitCheck>;
  onToggleItem: (itemId: string) => void;
  onToggleMemory: (memoryId: string) => void;
  onAddCustomBasic: (itemName: string) => void;
  onRemoveCustomBasic: (itemName: string) => void;
  onAddCustomMomentItem: (momentId: MomentId, itemName: string) => void;
  onRemoveCustomMomentItem: (momentId: MomentId, itemName: string) => void;
  onAddCustomMemory: (memoryText: string) => void;
  onRemoveCustomMemory: (memoryText: string) => void;
  onTogglePlanItem: (item: TravelPlanItem) => void;
  onAddCustomPlanItem: (item: TravelPlanItem) => void;
  onRemovePlanItem: (itemId: string) => void;
  onSetVisitCheck: (itemId: string, status: VisitCheckStatus, patch?: Partial<VisitCheck>) => void;
  onReset: () => void;
}

// 짐 체크리스트 — 하드코딩 (제주 여행 기본).
// 원본의 조건부 분기(국내/해외)를 삭제. 제주 전용이라 해외 조건이 무의미.
const BASIC_CHECKLIST: string[] = [
  '신분증 · 여권 (렌터카·항공권 확인용)',
  '충전기 및 보조배터리',
  '트레킹화 or 편한 운동화',
  '얇은 바람막이 (해안 저녁은 서늘)',
  '자외선 차단제',
  '개인 상비약 (진통제·소화제)',
  '충분한 현금 (오일장·노점 대비)',
  '휴대용 물티슈',
  '재사용 물병 · 텀블러',
  '방수 지퍼백 (해수욕장·감귤 체험 대비)',
];

type PlanPackingSuggestion = {
  item: string;
  reason: string;
};

const PLAN_PACKING_ITEMS: Record<string, PlanPackingSuggestion[]> = {
  beach_walk: [
    { item: '모래 털기 쉬운 샌들', reason: '바다 산책 뒤 모래와 물기를 빠르게 털어내기 좋아요.' },
    { item: '작은 수건', reason: '해변에서 손·발을 닦거나 바람이 찰 때 가볍게 쓰기 좋아요.' },
    { item: '선글라스', reason: '해안 반사광이 강한 시간대에 눈부심을 줄여줘요.' },
  ],
  oreum: [
    { item: '미끄럽지 않은 운동화', reason: '오름 길은 흙길·경사 구간이 있어 접지력이 중요해요.' },
    { item: '500ml 이상 물', reason: '오름 코스는 그늘이 적은 구간이 있어 수분 보충이 필요해요.' },
    { item: '가벼운 바람막이', reason: '능선 위에서는 바람이 더 세게 느껴질 수 있어요.' },
  ],
  gotjawal: [
    { item: '긴 바지 또는 레깅스', reason: '곶자왈 숲길의 풀·가지 스침을 줄여줘요.' },
    { item: '벌레 기피제', reason: '숲 산책 일정에서는 벌레 노출이 늘어날 수 있어요.' },
    { item: '작은 손전등', reason: '숲길 그늘이나 늦은 시간 이동 때 확인용으로 좋아요.' },
  ],
  sunset: [
    { item: '해 질 무렵 걸칠 겉옷', reason: '노을 시간에는 해안 바람과 체감온도가 내려갈 수 있어요.' },
    { item: '보조배터리', reason: '사진과 지도 확인이 늘어나는 일정이라 배터리 여유가 필요해요.' },
    { item: '사진용 거치대', reason: '노을 감상이나 함께 찍는 사진을 안정적으로 남기기 좋아요.' },
  ],
  local_market: [
    { item: '접이식 장바구니', reason: '시장 투어에서 간식·기념품을 담기 편해요.' },
    { item: '현금 또는 지역화폐', reason: '소규모 노점이나 시장 결제 상황에 대비할 수 있어요.' },
    { item: '물티슈', reason: '길거리 음식이나 손에 묻는 간식 뒤 정리하기 좋아요.' },
  ],
  local_food: [
    { item: '소화제', reason: '맛집 동선이 이어질 때 속을 편하게 관리하기 좋아요.' },
    { item: '입가심용 물', reason: '이동 중 음식점 간 텀이 길어질 때 유용해요.' },
    { item: '예약 확인 메모', reason: '식당 운영 정보가 바뀔 수 있어 방문 전 확인을 돕습니다.' },
  ],
  quiet_cafe: [
    { item: '읽을 책이나 이어폰', reason: '조용한 카페 일정에서 혼자 쉬는 시간을 더 잘 쓰게 해줘요.' },
    { item: '충전 케이블', reason: '카페 체류 시간이 길어질 때 휴대폰 배터리를 보완해요.' },
    { item: '노트 앱 메모', reason: '여행 중 찾은 장소나 수정할 정보를 바로 기록하기 좋아요.' },
  ],
  citrus: [
    { item: '얼룩이 덜 보이는 옷', reason: '감귤 체험 중 과즙이나 흙이 묻을 수 있어요.' },
    { item: '손 세정 티슈', reason: '체험 후 손을 바로 정리하기 좋아요.' },
    { item: '사진 저장 공간', reason: '체험형 일정은 사진을 많이 남기게 되기 쉬워요.' },
  ],
};

export default function PackingDashboard(props: Props) {
  const {
    info,
    selectedMomentIds,
    checkedItemIds,
    selectedPlanItems,
    visitChecks,
    onToggleItem,
    onTogglePlanItem,
    onAddCustomPlanItem,
    onRemovePlanItem,
    onSetVisitCheck,
    onReset,
  } = props;

  const [packResp, setPackResp] = useState<PackResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // 뷰 스위처: 순간별(기본) vs 요일별. 응답의 itinerary가 있어야 요일별 활성.
  const [viewMode, setViewMode] = useState<'moments' | 'itinerary'>('moments');
  // PDF 저장 상태
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const handleDownloadPlan = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const filename = `pack-your-jeju-plan_${info.startDate}.txt`;
      const blob = new Blob([shareText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setPdfError(e?.message || String(e));
    } finally {
      setPdfLoading(false);
    }
  };

  const regionLabel = useMemo(
    () => info.regions
      .map((r) => REGIONS.find((x) => x.value === r)?.label ?? r)
      .join(' · '),
    [info.regions]
  );
  const companionLabel = useMemo(
    () => COMPANIONS.find((c) => c.value === info.companion)?.label ?? info.companion,
    [info.companion]
  );
  const purposeLabel = useMemo(
    () => PURPOSES.find((p) => p.value === info.purpose)?.label ?? info.purpose,
    [info.purpose]
  );
  const packItems = useMemo(() => collectPackItems(packResp), [packResp]);
  const currentPlanItemsForMap = useMemo(
    () => filterPlanItemsForCurrentPack(selectedPlanItems, packItems),
    [selectedPlanItems, packItems],
  );
  const mapPlanItems = useMemo(
    () => enrichPlanItemsWithCoordinates(currentPlanItemsForMap, packItems),
    [currentPlanItemsForMap, packItems],
  );
  const selectedPlanIds = useMemo(
    () => new Set(selectedPlanItems.map((item) => item.id)),
    [selectedPlanItems],
  );
  const planPackingItems = useMemo(
    () => buildPlanPackingItems(selectedPlanItems),
    [selectedPlanItems],
  );
  const shareText = useMemo(
    () => packResp ? buildShareText(info, selectedMomentIds, packResp, selectedPlanItems, visitChecks) : '',
    [info, selectedMomentIds, packResp, selectedPlanItems, visitChecks]
  );
  const hasPackInput = info.regions.length > 0 && selectedMomentIds.length > 0;

  const handleCopyShare = async () => {
    if (!shareText) return;
    setShareCopied(false);
    setShareError(null);
    try {
      await navigator.clipboard.writeText(shareText);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch (_e) {
      setShareError('브라우저에서 복사를 허용하지 않았어요.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function fetchPack() {
      setLoading(true);
      setError(null);
      try {
        const resp = await requestPack(info, selectedMomentIds);
        if (!cancelled) setPackResp(resp);
      } catch (e: any) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (hasPackInput) fetchPack();
    else {
      setPackResp(null);
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(info.regions),
    info.startDate,
    info.durationDays,
    info.companion,
    info.purpose,
    hasPackInput,
    JSON.stringify(selectedMomentIds),
  ]);

  return (
    <div className="w-full max-w-[1500px] mx-auto" id="packing-dashboard">
      <div className="grid gap-5 xl:gap-7 lg:grid-cols-[460px_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2 pyj-side-scroll">
      {/* 요약 카드 */}
      <div
        className="rounded-[24px] border border-orange-100/60 bg-white shadow-pyj-card p-5 space-y-3"
        id="trip-summary"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">이번 제주 여행</h2>
          <button
            onClick={onReset}
            className="text-[10.5px] font-semibold text-stone-500 hover:text-stone-900 inline-flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3 h-3" /> 다시 세우기
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] text-stone-700">
          <SummaryLine icon={<MapPin className="w-3.5 h-3.5" />} label={regionLabel} />
          <SummaryLine
            icon={<Calendar className="w-3.5 h-3.5" />}
            label={`${info.startDate.slice(5)} · ${info.durationDays}일`}
          />
          <SummaryLine icon={<Users className="w-3.5 h-3.5" />} label={companionLabel} />
          <SummaryLine icon={<Compass className="w-3.5 h-3.5" />} label={purposeLabel} />
        </div>

        {/* 이 여행을 저장 — 근거 기반 여행플랜 PDF 다운로드. 사실은 서버가 조립하고
            프론트는 파일만 받아 저장한다. LLM 없이도 항상 동작. */}
        {packResp && !loading && !error && (
          <div className="pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDownloadPlan}
                disabled={pdfLoading}
                className="rounded-2xl px-3 py-3 bg-citrus text-white font-serif-kr font-bold text-[13px] hover:bg-citrus-2 transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 shadow-jeju-chip"
              >
                {pdfLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    플랜 생성 중
                  </>
                ) : (
                  <>
                    <BookOpenCheck className="w-4 h-4" />
                    내 플랜 저장
                    <Download className="w-3.5 h-3.5 opacity-80" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCopyShare}
                className="rounded-2xl px-3 py-3 border border-earth bg-white/80 text-basalt font-serif-kr font-bold text-[13px] hover:bg-[#FDF6EA] transition inline-flex items-center justify-center gap-1.5"
              >
                {shareCopied ? (
                  <>
                    <Check className="w-4 h-4 text-mint" />
                    복사 완료
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-citrus-2" />
                    플랜 공유
                    <Copy className="w-3.5 h-3.5 text-basalt-2/70" />
                  </>
                )}
              </button>
            </div>
            <p className="mt-1.5 text-[10.5px] text-stone-500 text-center leading-snug">
              플랜에 담은 장소와 직접 추가한 메모만 저장·공유합니다.
            </p>
            {pdfError && (
              <p className="mt-1.5 text-[10.5px] text-rose-700 text-center">
                {pdfError}
              </p>
            )}
            {shareError && (
              <p className="mt-1.5 text-[10.5px] text-rose-700 text-center">
                {shareError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Intro 문구 (LLM 조립 or 템플릿 폴백) */}
      {packResp?.intro && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50/60 border border-orange-100/70 p-4 text-[12.5px] text-orange-950 leading-relaxed"
          id="intro-copy"
        >
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-700 mb-1.5 uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            {packResp.intro.llm_used ? 'AI 조립 문구' : '템플릿 문구'}
          </span>
          <p>{packResp.intro.text}</p>
        </motion.div>
      )}

      {packResp?.weather && (
        <WeatherSignalCard weather={packResp.weather} />
      )}

      {packResp && !loading && !error && (
        <TripMapCard
          items={mapPlanItems.length > 0 ? mapPlanItems : packItems}
          regions={info.regions}
          isPlanMap={mapPlanItems.length > 0}
        />
      )}

      {packResp && !loading && !error && (
        <PlanBuilderCard
          planItems={selectedPlanItems}
          visitChecks={visitChecks}
          onAddCustomPlanItem={onAddCustomPlanItem}
          onRemovePlanItem={onRemovePlanItem}
          onSetVisitCheck={onSetVisitCheck}
        />
      )}

      {packResp && !loading && !error && (
        <TrustFeedbackLoopCard
          planItems={selectedPlanItems}
          visitChecks={visitChecks}
        />
      )}
        </aside>

        <main className="space-y-5">
      {packResp && !loading && !error && (
        <CandidateWorkbenchHeader
          packResp={packResp}
          planCount={selectedPlanItems.length}
          viewMode={viewMode}
        />
      )}

      {/* 로딩 · 에러 */}
      {loading && (
        <div className="text-center py-14 text-stone-500 text-[12px]" id="pack-loading">
          <Loader2 className="w-5 h-5 mx-auto mb-2.5 animate-spin text-orange-500" />
          공공데이터에서 근거를 모으는 중…
        </div>
      )}
      {error && (
        <div
          className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-[12px] text-rose-800 space-y-2"
          id="pack-error"
        >
          <div className="flex items-center gap-1.5 font-bold">
            <ShieldAlert className="w-4 h-4" />
            서버 연결 실패
          </div>
          <div className="font-mono text-[10px] break-all bg-white/70 rounded p-2">{error}</div>
          <p className="text-[10.5px] leading-relaxed text-rose-700">
            <code className="bg-white/70 rounded px-1">VITE_API_BASE_URL</code>이 올바른 Railway URL인지 확인해 주세요.
          </p>
        </div>
      )}
      {!loading && !error && !packResp && !hasPackInput && (
        <div
          className="rounded-[24px] border border-orange-100 bg-white p-6 text-center shadow-pyj-card"
          id="pack-empty-state"
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-citrus">
            <MapPin className="h-5 w-5" />
          </div>
          <h2 className="font-serif-kr text-[18px] font-bold text-basalt">
            지역과 여행 순간을 먼저 골라주세요
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-basalt-2">
            저장된 여행팩 조건이 비어 있어 공공데이터 후보를 불러오지 않았습니다.
            상단의 처음 화면에서 지역과 순간 카드를 다시 선택하면 대시보드가 열립니다.
          </p>
        </div>
      )}

      {/* 뷰 스위처: 순간별 vs 요일별 */}
      {packResp && !loading && !error && (packResp.itinerary?.length ?? 0) > 0 && (
        <div
          className="flex items-center gap-1 p-1 rounded-2xl bg-[#FDF6EA] border border-earth"
          id="view-mode-tabs"
        >
          <button
            type="button"
            onClick={() => setViewMode('moments')}
            className={`flex-1 py-2 rounded-xl text-[12px] font-semibold transition ${
              viewMode === 'moments'
                ? 'bg-white text-basalt shadow-jeju-chip'
                : 'text-basalt-2/70 hover:text-basalt'
            }`}
          >
            순간별로
          </button>
          <button
            type="button"
            onClick={() => setViewMode('itinerary')}
            className={`flex-1 py-2 rounded-xl text-[12px] font-semibold transition ${
              viewMode === 'itinerary'
                ? 'bg-white text-basalt shadow-jeju-chip'
                : 'text-basalt-2/70 hover:text-basalt'
            }`}
          >
            요일별로 (Day 1–{info.durationDays})
          </button>
        </div>
      )}

      {/* 순간별 뷰 */}
      {viewMode === 'moments' && packResp?.sections?.map((section) => (
        <React.Fragment key={section.moment}>
          <SectionCard
            section={section}
            selectedPlanIds={selectedPlanIds}
            onTogglePlanItem={onTogglePlanItem}
          />
        </React.Fragment>
      ))}

      {/* 요일별 뷰 (검증된 items를 규칙 기반 재배치) */}
      {viewMode === 'itinerary' && packResp?.itinerary?.map((day) => (
        <ItineraryDayCard
          key={day.day}
          day={day}
          selectedPlanIds={selectedPlanIds}
          onTogglePlanItem={onTogglePlanItem}
        />
      ))}

      {planPackingItems.length > 0 && (
        <div
          className="rounded-[24px] border border-mint/20 bg-[#F4FBF8] shadow-pyj-card p-5 space-y-3"
          id="plan-based-checklist"
        >
          <div>
            <h2 className="text-[14.5px] font-bold text-stone-900 tracking-tight">내 플랜 맞춤 짐</h2>
            <p className="text-[10.5px] text-stone-500 mt-0.5">
              플랜에 담은 장소 유형과 이유를 함께 보여드립니다.
            </p>
          </div>
          <div className="space-y-2">
            {planPackingItems.map((suggestion, idx) => {
              const id = `plan-pack-${idx}-${suggestion.item}`;
              const checked = checkedItemIds.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onToggleItem(id)}
                  className={`w-full flex items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    checked
                      ? 'border-mint/25 bg-white/70'
                      : 'border-mint/10 bg-white/55 hover:bg-white/85'
                  }`}
                >
                  {checked ? (
                    <CheckSquare className="mt-0.5 w-4 h-4 text-mint shrink-0" />
                  ) : (
                    <Square className="mt-0.5 w-4 h-4 text-stone-300 shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span className={`block text-[12.5px] font-bold ${checked ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                      {suggestion.item}
                    </span>
                    <span className={`mt-1 block text-[10.5px] leading-relaxed ${checked ? 'text-stone-400' : 'text-basalt-2/72'}`}>
                      {suggestion.reason}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 기본 체크리스트 */}
      <div
        className="rounded-[24px] border border-orange-100/60 bg-white shadow-pyj-card p-5 space-y-3"
        id="basic-checklist"
      >
        <div>
          <h2 className="text-[14.5px] font-bold text-stone-900 tracking-tight">기본 짐 체크리스트</h2>
          <p className="text-[10.5px] text-stone-500 mt-0.5">제주 여행 공통 · 개인 취향으로 체크</p>
        </div>
        <div className="space-y-1">
          {BASIC_CHECKLIST.map((item, idx) => {
            const id = `basic-${idx}`;
            const checked = checkedItemIds.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggleItem(id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-orange-50/50 transition text-left"
              >
                {checked ? (
                  <CheckSquare className="w-4 h-4 text-orange-600 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-stone-300 shrink-0" />
                )}
                <span
                  className={`text-[12.5px] ${
                    checked ? 'line-through text-stone-400' : 'text-stone-700'
                  }`}
                >
                  {item}
                </span>
              </button>
            );
          })}
        </div>
      </div>
        </main>
      </div>
    </div>
  );
}

// ─── 하위 컴포넌트 ─────────────────────────────────────

function collectPackItems(packResp: PackResponse | null): PackItemDto[] {
  if (!packResp) return [];
  const source = packResp.itinerary?.length
    ? packResp.itinerary.flatMap((day) => day.items)
    : packResp.sections.flatMap((section) => section.items);
  const seen = new Set<string>();
  return source.filter((item) => {
    const key = item.external_id || item.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePlaceKey(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, '').toLowerCase();
}

function filterPlanItemsForCurrentPack(
  planItems: TravelPlanItem[],
  packItems: PackItemDto[],
): TravelPlanItem[] {
  if (planItems.length === 0 || packItems.length === 0) return planItems;

  const currentExternalIds = new Set(
    packItems.map((item) => item.external_id).filter(Boolean),
  );
  const currentNames = new Set(packItems.map((item) => normalizePlaceKey(item.name)));

  return planItems.filter((item) => {
    if (item.source === 'user_added') return true;
    if (item.external_id && currentExternalIds.has(item.external_id)) return true;
    return currentNames.has(normalizePlaceKey(item.name));
  });
}

function enrichPlanItemsWithCoordinates(
  planItems: TravelPlanItem[],
  packItems: PackItemDto[],
): TravelPlanItem[] {
  if (planItems.length === 0) return [];

  const byExternalId = new Map<string, PackItemDto>();
  const byName = new Map<string, PackItemDto>();
  packItems.forEach((item) => {
    if (item.external_id) byExternalId.set(item.external_id, item);
    byName.set(item.name, item);
  });

  return planItems.map((item) => {
    if (resolveItemCoordinate(item)) return item;
    const source =
      (item.external_id ? byExternalId.get(item.external_id) : null) ??
      byName.get(item.name);
    const coord = source ? resolveItemCoordinate(source) : null;
    if (!coord) return item;
    return {
      ...item,
      latitude: coord.lat,
      longitude: coord.lng,
    };
  });
}

function CandidateWorkbenchHeader({
  packResp,
  planCount,
  viewMode,
}: {
  packResp: PackResponse;
  planCount: number;
  viewMode: 'moments' | 'itinerary';
}) {
  const signals = countPackSignals(packResp);
  const sourceLabel = viewMode === 'itinerary' ? 'Day별 일정 후보' : '순간별 추천 후보';
  return (
    <section
      className="rounded-[28px] border border-orange-100/70 bg-white/88 p-5 shadow-pyj-card backdrop-blur-sm"
      id="candidate-workbench-header"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-citrus-2">
            <BookOpenCheck className="h-3 w-3" />
            Evidence Workbench
          </span>
          <h2 className="mt-1 font-serif-kr text-[25px] font-bold leading-tight text-basalt">
            후보를 고르고, 근거를 확인하고, 플랜에 담습니다.
          </h2>
          <p className="mt-1.5 max-w-2xl text-[11.5px] leading-relaxed text-basalt-2">
            장소명과 주소는 조회된 데이터만 사용하고, 날씨·이동·수정요청 신호는 카드 안에서 확인 필요 항목으로 분리합니다.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
          <WorkbenchMetric label={sourceLabel} value={`${signals.total}곳`} tone="base" />
          <WorkbenchMetric label="확인 후보" value={`${signals.verified}곳`} tone="mint" />
          <WorkbenchMetric label="내 플랜" value={`${planCount}곳`} tone="citrus" />
        </div>
      </div>
    </section>
  );
}

function WorkbenchMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'base' | 'mint' | 'citrus';
}) {
  const toneClass = {
    base: 'border-earth bg-[#FDF6EA] text-basalt',
    mint: 'border-mint/25 bg-mint/10 text-mint',
    citrus: 'border-citrus/25 bg-citrus/10 text-citrus-2',
  }[tone];
  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${toneClass}`}>
      <div className="text-[9.5px] font-bold uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-0.5 font-serif-kr text-[18px] font-bold leading-none">{value}</div>
    </div>
  );
}

function buildPlanPackingItems(planItems: TravelPlanItem[]): PlanPackingSuggestion[] {
  const seen = new Map<string, string[]>();
  planItems.forEach((item) => {
    (PLAN_PACKING_ITEMS[item.moment] ?? []).forEach((packingItem) => {
      const reasons = seen.get(packingItem.item) ?? [];
      if (!reasons.includes(packingItem.reason)) {
        reasons.push(packingItem.reason);
      }
      seen.set(packingItem.item, reasons);
    });
  });
  return Array.from(seen.entries()).map(([item, reasons]) => ({
    item,
    reason: reasons.slice(0, 2).join(' '),
  })).slice(0, 12);
}

function toPlanItem(item: PackItemDto | ItineraryItemDto, day?: ItineraryDayDto): TravelPlanItem {
  const maybeMoment = (item as ItineraryItemDto).moment;
  const moment = maybeMoment ?? item.category ?? 'custom';
  const coord = resolveItemCoordinate(item);
  return {
    id: `public-${item.external_id || item.name}-${moment}`,
    name: item.name,
    moment,
    source: 'public_data',
    badge: item.badge,
    external_id: item.external_id,
    region: item.region ?? null,
    address: item.address ?? null,
    note: item.note ?? null,
    day: day?.day ?? null,
    date: day?.date ?? null,
    latitude: coord?.lat ?? null,
    longitude: coord?.lng ?? null,
    trust_score: item.trust_score,
    score_breakdown: item.score_breakdown,
    check_required: item.check_required,
  };
}

function PlanBuilderCard({
  planItems,
  visitChecks,
  onAddCustomPlanItem,
  onRemovePlanItem,
  onSetVisitCheck,
}: {
  planItems: TravelPlanItem[];
  visitChecks: Record<string, VisitCheck>;
  onAddCustomPlanItem: (item: TravelPlanItem) => void;
  onRemovePlanItem: (itemId: string) => void;
  onSetVisitCheck: (itemId: string, status: VisitCheckStatus, patch?: Partial<VisitCheck>) => void;
}) {
  const [customName, setCustomName] = useState('');
  const [customMemo, setCustomMemo] = useState('');

  const handleAdd = () => {
    const name = customName.trim();
    if (!name) return;
    onAddCustomPlanItem({
      id: `user-${Date.now()}-${name}`,
      name,
      moment: 'user_added',
      source: 'user_added',
      note: customMemo.trim() || null,
    });
    setCustomName('');
    setCustomMemo('');
  };

  return (
    <div className="card-jeju p-5 space-y-4" id="my-plan-builder">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-citrus-2 uppercase tracking-wider mb-1.5">
            <ClipboardCheck className="w-3 h-3" />
            My Travel Plan
          </span>
          <h3 className="font-serif-kr font-bold text-[16px] text-basalt tracking-tight">
            내 여행플랜에 담은 것
          </h3>
          <p className="mt-1 text-[11px] text-basalt-2 leading-relaxed">
            후보 중 실제로 갈 곳만 담고, 다른 곳에서 찾은 정보도 검증 전 메모로 함께 보관합니다.
          </p>
        </div>
        <span className="rounded-full border border-earth bg-[#FDF6EA] px-2.5 py-1 text-[10px] font-bold text-basalt-2">
          {planItems.length}개
        </span>
      </div>

      {planItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-earth bg-[#FDF6EA]/70 px-4 py-5 text-center">
          <p className="text-[12px] font-semibold text-basalt">아직 담은 장소가 없습니다.</p>
          <p className="mt-1 text-[10.5px] text-basalt-2 leading-relaxed">
            아래 추천 후보에서 `플랜에 담기`를 누르면 이곳에 일정 후보가 쌓입니다.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {planItems.map((item) => (
            <PlanItemRow
              key={item.id}
              item={item}
              visitCheck={visitChecks[item.id]}
              onRemovePlanItem={onRemovePlanItem}
              onSetVisitCheck={onSetVisitCheck}
            />
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-earth bg-white/80 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold text-basalt">내가 찾은 장소 추가</p>
          <span className="text-[9.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
            검증 전 메모
          </span>
        </div>
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="예: 친구가 추천한 카페, 숙소 근처 식당"
          className="w-full rounded-xl border border-earth bg-[#FDFBF7] px-3 py-2 text-[12px] text-basalt placeholder:text-basalt-2/40 focus:outline-none focus:ring-2 focus:ring-citrus/25"
        />
        <input
          value={customMemo}
          onChange={(e) => setCustomMemo(e.target.value)}
          placeholder="출처나 메모를 적어두세요"
          className="w-full rounded-xl border border-earth bg-[#FDFBF7] px-3 py-2 text-[12px] text-basalt placeholder:text-basalt-2/40 focus:outline-none focus:ring-2 focus:ring-citrus/25"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!customName.trim()}
          className="w-full rounded-xl bg-basalt text-white py-2.5 text-[12px] font-bold inline-flex items-center justify-center gap-1.5 hover:bg-basalt-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          플랜에 직접 추가
        </button>
      </div>
    </div>
  );
}

function PlanItemRow({
  item,
  visitCheck,
  onRemovePlanItem,
  onSetVisitCheck,
}: {
  item: TravelPlanItem;
  visitCheck?: VisitCheck;
  onRemovePlanItem: (itemId: string) => void;
  onSetVisitCheck: (itemId: string, status: VisitCheckStatus, patch?: Partial<VisitCheck>) => void;
}) {
  const moment = MOMENTS.find((m) => m.id === item.moment);
  const visitLabel = visitCheck ? visitStatusLabel(visitCheck.status) : '방문 후 확인 전';
  const [saving, setSaving] = useState<VisitCheckStatus | null>(null);
  const [feedbackText, setFeedbackText] = useState(visitCheck?.memo ?? '');
  const previousScore = item.trust_score ?? visitCheck?.previousTrustScore ?? 70;
  const previewUpdate = simulateVisitTrustUpdate(previousScore, visitCheck?.status ?? 'visited');

  const handleVisit = async (status: VisitCheckStatus) => {
    const fallback = simulateVisitTrustUpdate(previousScore, status);
    const feedback = feedbackText.trim();
    setSaving(status);
    if (!item.external_id || item.source !== 'public_data') {
      onSetVisitCheck(item.id, status, {
        previousTrustScore: fallback.previous,
        updatedTrustScore: fallback.updated,
        trustDelta: fallback.delta,
        saved: false,
        memo: feedback || undefined,
        publicDataQueued: false,
        publicDataStatus: 'local_only',
      });
      setSaving(null);
      return;
    }
    try {
      const resp = await requestVisitSignal({
        external_id: item.external_id,
        place_name: item.name,
        status,
        mismatch_reason: status === 'info_mismatch' ? 'hours_wrong' : status === 'changed' ? 'changed' : undefined,
        memo: feedback || undefined,
        feedback_text: feedback || undefined,
        previous_trust_score: previousScore,
        score_breakdown: item.score_breakdown,
      });
      onSetVisitCheck(item.id, status, {
        previousTrustScore: resp.previous_trust_score,
        updatedTrustScore: resp.updated_trust_score,
        trustDelta: resp.trust_delta,
        saved: resp.saved,
        memo: feedback || undefined,
        publicDataQueued: resp.public_data_report.queued,
        publicDataStatus: resp.public_data_report.delivery_status,
      });
    } catch {
      onSetVisitCheck(item.id, status, {
        previousTrustScore: fallback.previous,
        updatedTrustScore: fallback.updated,
        trustDelta: fallback.delta,
        saved: false,
        memo: feedback || undefined,
        publicDataQueued: false,
        publicDataStatus: 'request_failed',
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-2xl border border-earth bg-[#FDFBF7] p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold border ${
              item.source === 'public_data'
                ? 'bg-mint/10 text-mint border-mint/20'
                : 'bg-amber-50 text-amber-700 border-amber-100'
            }`}>
              {item.source === 'public_data' ? '공공데이터 후보' : '사용자 추가'}
            </span>
            {moment && (
              <span className="text-[9.5px] font-semibold text-citrus-2 bg-citrus/10 rounded-full px-2 py-0.5">
                {moment.title}
              </span>
            )}
            {item.day && (
              <span className="text-[9.5px] font-semibold text-basalt-2 bg-white border border-earth rounded-full px-2 py-0.5">
                Day {item.day}
              </span>
            )}
          </div>
          <p className="font-bold text-[13px] text-basalt leading-snug">{item.name}</p>
          {(item.address || item.note) && (
            <p className="mt-0.5 text-[10.5px] text-basalt-2 leading-relaxed line-clamp-2">
              {item.address || item.note}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRemovePlanItem(item.id)}
          aria-label={`${item.name} 플랜에서 제거`}
          className="shrink-0 rounded-full p-1.5 text-basalt-2/50 hover:text-rose-600 hover:bg-rose-50 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[9.5px] font-semibold text-basalt-2 mr-0.5">{visitLabel}</span>
        <VisitButton
          label="방문함"
          active={visitCheck?.status === 'visited'}
          loading={saving === 'visited'}
          onClick={() => handleVisit('visited')}
        />
        <VisitButton
          label="방문 안 함"
          active={visitCheck?.status === 'not_visited'}
          loading={saving === 'not_visited'}
          onClick={() => handleVisit('not_visited')}
        />
        <VisitButton
          label="변경함"
          active={visitCheck?.status === 'changed'}
          loading={saving === 'changed'}
          onClick={() => handleVisit('changed')}
        />
        <VisitButton
          label="정보 다름"
          active={visitCheck?.status === 'info_mismatch'}
          loading={saving === 'info_mismatch'}
          onClick={() => handleVisit('info_mismatch')}
        />
        <VisitButton
          label="만족"
          active={visitCheck?.status === 'satisfied'}
          loading={saving === 'satisfied'}
          onClick={() => handleVisit('satisfied')}
        />
        <VisitButton
          label="불만족"
          active={visitCheck?.status === 'unsatisfied'}
          loading={saving === 'unsatisfied'}
          onClick={() => handleVisit('unsatisfied')}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-basalt-2">
          방문 후 피드백
        </label>
        <textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value.slice(0, 500))}
          rows={2}
          placeholder="예: 운영시간이 달랐어요, 주차장이 공사 중이었어요, 부모님 동선에는 계단이 많았어요."
          className="w-full resize-none rounded-xl border border-earth bg-white/82 px-3 py-2 text-[11.5px] leading-relaxed text-basalt outline-none placeholder:text-basalt-2/45 focus:ring-2 focus:ring-citrus/25"
        />
        <p className="text-[9.5px] leading-relaxed text-basalt-2/70">
          이 메모는 신뢰도 업데이트와 별도로 `공공데이터 수정요청 큐`에 전달 대기 상태로 저장됩니다.
        </p>
      </div>

      <div className="rounded-xl border border-earth bg-white/78 px-3 py-2 text-[10.5px] text-basalt-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-basalt">신뢰도 업데이트</span>
          <span className={`font-bold ${visitCheck?.trustDelta && visitCheck.trustDelta < 0 ? 'text-rose-700' : 'text-mint'}`}>
            {visitCheck?.updatedTrustScore != null
              ? `${visitCheck.previousTrustScore ?? previousScore} → ${visitCheck.updatedTrustScore}점`
              : `${previewUpdate.previous} → ${previewUpdate.updated}점 예측`}
          </span>
        </div>
        {visitCheck?.trustDelta != null ? (
          <p className="mt-1 leading-relaxed">
            방문 신호가 다음 신뢰도 판단에 반영됩니다.
            {visitCheck.saved === false && ' 서버 저장은 대기 상태라 로컬에 먼저 보관했습니다.'}
          </p>
        ) : (
          <p className="mt-1 leading-relaxed">
            버튼을 누르면 기존 점수에서 방문 신호 축이 어떻게 바뀌는지 기록합니다.
          </p>
        )}
        {visitCheck?.publicDataStatus && (
          <div className={`mt-2 rounded-lg px-2 py-1 font-semibold ${
            visitCheck.publicDataQueued
              ? 'bg-mint/10 text-mint'
              : 'bg-amber-50 text-amber-800'
          }`}>
            공공데이터 전달 상태: {publicDataStatusLabel(visitCheck.publicDataStatus)}
          </div>
        )}
      </div>
    </div>
  );
}

function WeatherSignalCard({ weather }: { weather: WeatherSnapshotDto }) {
  const labels = weather.labels?.length ? weather.labels : ['날씨 정보 확인 중'];
  const isCaution = weather.risk_level === 'caution' || weather.risk_level === 'watch';
  const isUnavailable = !weather.available;
  const daily = weather.daily_forecasts ?? [];
  return (
    <div className={`rounded-[24px] border p-5 shadow-pyj-card ${
      isCaution || isUnavailable
        ? 'border-amber-100 bg-amber-50/75'
        : 'border-mint/20 bg-[#F4FBF8]'
    }`}>
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
        isCaution || isUnavailable ? 'text-amber-700' : 'text-mint'
      }`}>
        <CloudSun className="h-3 w-3" />
        KMA Weather Signal
      </span>
      <h3 className="mt-2 font-serif-kr text-[16px] font-bold text-basalt">
        {isUnavailable ? '여행 기간 날씨 판단은 보류합니다.' : '여행 기간 예보를 함께 봅니다.'}
      </h3>
      <p className="mt-1 text-[10.5px] font-semibold text-basalt-2/75">
        {daily.length > 1
          ? `${daily[0]?.date_label ?? '출발일'}부터 ${daily.length}일 예보`
          : weather.issued_at_label ?? (isUnavailable ? '기상청 API 연결 확인 · 예보 문장 미확인' : '기상청 최신 발표 기준')}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {labels.map((label) => (
          <span
            key={label}
            className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-[10.5px] font-bold text-basalt-2"
          >
            {label}
          </span>
        ))}
      </div>
      {daily.length > 0 && (
        <div className="mt-3 grid gap-2">
          {daily.map((day) => {
            const forecast = day.forecast ?? {};
            const dayLabels = day.labels?.length ? day.labels.slice(0, 3) : ['예보 확인'];
            return (
              <div
                key={day.date ?? day.issued_at_label}
                className="rounded-2xl border border-white/80 bg-white/78 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[12px] font-bold text-basalt">
                      {day.date_label ?? day.issued_at_label ?? '여행일'}
                    </div>
                    <div className="mt-0.5 text-[10px] font-semibold text-basalt-2/65">
                      {day.issued_at_label ?? '기상청 단기예보 기준'}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {dayLabels.map((label) => (
                      <span
                        key={`${day.date}-${label}`}
                        className="rounded-full bg-[#FDF6EA] px-2 py-0.5 text-[10px] font-bold text-basalt-2"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-basalt-2">
                  {[
                    forecast.sky,
                    forecast.precipitation_probability != null ? `강수확률 ${forecast.precipitation_probability}%` : null,
                    forecast.temperature != null ? `기온 ${forecast.temperature}도` : null,
                    forecast.wind_speed != null ? `풍속 ${forecast.wind_speed}m/s` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {weather.summary && daily.length === 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-basalt-2/90">
          {weather.summary}
        </p>
      )}
      {!weather.available && (
        <p className="mt-3 text-[10.5px] leading-relaxed text-amber-800">
          비·바람 여부를 단정하지 않고, 야외 장소는 보수적으로 확인 필요로 표시합니다.
        </p>
      )}
    </div>
  );
}

type FeedbackDashboardEntry = {
  itemId: string;
  name: string;
  status: VisitCheckStatus;
  statusLabel: string;
  memo?: string;
  scoreLabel?: string;
  queueLabel?: string;
  queued: boolean;
  updatedAt: string;
};

type FeedbackDashboardSummary = {
  total: number;
  queued: number;
  changed: number;
  scoreDelta: number;
  entries: FeedbackDashboardEntry[];
};

function TrustFeedbackLoopCard({
  planItems,
  visitChecks,
}: {
  planItems: TravelPlanItem[];
  visitChecks: Record<string, VisitCheck>;
}) {
  const dashboard = buildFeedbackDashboard(planItems, visitChecks);
  const hasEntries = dashboard.total > 0;
  return (
    <div className="rounded-[24px] border border-mint/20 bg-[#F4FBF8] p-5 shadow-pyj-card">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-mint">
        <ClipboardCheck className="h-3 w-3" />
        Feedback Dashboard
      </span>
      <h3 className="mt-2 font-serif-kr text-[16px] font-bold text-basalt">
        피드백이 내부 신뢰 기록으로 쌓입니다.
      </h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <FeedbackMetric label="기록" value={`${dashboard.total}건`} tone="mint" />
        <FeedbackMetric label="수정요청 큐" value={`${dashboard.queued}건`} tone="amber" />
        <FeedbackMetric
          label="신뢰도 변화"
          value={`${dashboard.scoreDelta >= 0 ? '+' : ''}${dashboard.scoreDelta}`}
          tone={dashboard.scoreDelta < 0 ? 'rose' : 'mint'}
        />
      </div>

      {hasEntries ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mint">
              Recent Signals
            </p>
            <span className="rounded-full border border-mint/20 bg-white/80 px-2 py-0.5 text-[9.5px] font-bold text-mint">
              내부 대시보드 기록
            </span>
          </div>
          {dashboard.entries.map((entry) => (
            <div
              key={`${entry.itemId}-${entry.updatedAt}`}
              className="rounded-2xl border border-mint/15 bg-white/78 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-bold text-basalt">{entry.name}</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-basalt-2/70">
                    {entry.statusLabel}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                  entry.queued
                    ? 'bg-mint/10 text-mint'
                    : 'bg-amber-50 text-amber-800'
                }`}>
                  {entry.queueLabel ?? '로컬 기록'}
                </span>
              </div>
              {entry.memo && (
                <p className="mt-2 line-clamp-2 rounded-xl bg-[#FDF6EA] px-2.5 py-1.5 text-[10.5px] leading-relaxed text-basalt-2">
                  “{entry.memo}”
                </p>
              )}
              {entry.scoreLabel && (
                <div className="mt-2 text-[10px] font-bold text-mint">
                  신뢰도 변화 {entry.scoreLabel}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-2 text-[11px] font-semibold text-basalt-2">
          {[
            ['1', '방문 후 피드백 작성'],
            ['2', '신뢰도 점수 업데이트'],
            ['3', '공공데이터 수정요청 큐 저장'],
            ['4', '다음 여행팩 판단에 반영'],
          ].map(([step, label]) => (
            <div key={step} className="flex items-center gap-2 rounded-2xl border border-mint/15 bg-white/78 px-3 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint text-[10px] font-bold text-white">
                {step}
              </span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[10.5px] leading-relaxed text-basalt-2">
        사용자 메모는 원본 공공데이터를 바로 수정하지 않고, 내부 방문 신호와 수정요청 큐로 분리해 기록합니다.
      </p>
    </div>
  );
}

function FeedbackMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'mint' | 'amber' | 'rose';
}) {
  const toneClass = {
    mint: 'border-mint/25 bg-white/82 text-mint',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  }[tone];
  return (
    <div className={`rounded-2xl border px-2.5 py-2 ${toneClass}`}>
      <div className="text-[9px] font-bold leading-none opacity-80">{label}</div>
      <div className="mt-1 font-serif-kr text-[16px] font-bold leading-none">{value}</div>
    </div>
  );
}

function VisitButton({
  label,
  active,
  loading = false,
  onClick,
}: {
  label: string;
  active: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`rounded-full border px-2 py-1 text-[9.5px] font-bold transition ${
        active
          ? 'border-mint bg-mint text-white'
          : 'border-earth bg-white text-basalt-2 hover:border-mint/50'
      } disabled:opacity-60`}
    >
      {loading ? '저장 중' : label}
    </button>
  );
}

function visitStatusLabel(status: VisitCheckStatus): string {
  if (status === 'not_visited') return '방문하지 않음';
  if (status === 'changed') return '방문 확인 · 변경함';
  if (status === 'info_mismatch') return '방문 확인 · 정보 다름';
  if (status === 'satisfied') return '방문 확인 · 만족';
  if (status === 'unsatisfied') return '방문 확인 · 불만족';
  return '방문 확인됨';
}

function simulateVisitTrustUpdate(previousScore: number, status: VisitCheckStatus) {
  const deltas: Record<VisitCheckStatus, number> = {
    visited: 4,
    not_visited: -2,
    changed: -12,
    info_mismatch: -14,
    satisfied: 8,
    unsatisfied: -9,
  };
  const previous = Math.max(0, Math.min(100, Math.round(previousScore)));
  const updated = Math.max(0, Math.min(100, previous + deltas[status]));
  return { previous, updated, delta: updated - previous };
}

function publicDataStatusLabel(status: string): string {
  if (status === 'queued') return '수정요청 큐에 저장됨';
  if (status === 'no_feedback_text') return '피드백 메모 없음';
  if (status === 'local_only') return '로컬 보관';
  if (status === 'save_failed') return '서버 저장 실패';
  if (status === 'request_failed') return '전송 실패';
  return status;
}

function buildFeedbackDashboard(
  planItems: TravelPlanItem[],
  visitChecks: Record<string, VisitCheck>,
): FeedbackDashboardSummary {
  const itemById = new Map(planItems.map((item) => [item.id, item]));
  const entries = Object.entries(visitChecks)
    .map(([itemId, check]) => {
      const item = itemById.get(itemId);
      const previous = check.previousTrustScore;
      const updated = check.updatedTrustScore;
      const scoreLabel = previous != null && updated != null
        ? `${previous} → ${updated}점`
        : undefined;
      return {
        itemId,
        name: item?.name ?? '플랜에서 제거된 장소',
        status: check.status,
        statusLabel: visitStatusLabel(check.status),
        memo: check.memo,
        scoreLabel,
        queueLabel: check.publicDataStatus ? publicDataStatusLabel(check.publicDataStatus) : undefined,
        queued: Boolean(check.publicDataQueued),
        updatedAt: check.updatedAt,
      };
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const changedStatuses = new Set<VisitCheckStatus>([
    'changed',
    'info_mismatch',
    'unsatisfied',
  ]);
  return {
    total: entries.length,
    queued: entries.filter((entry) => entry.queued).length,
    changed: entries.filter((entry) => changedStatuses.has(entry.status)).length,
    scoreDelta: Object.values(visitChecks).reduce((sum, check) => sum + (check.trustDelta ?? 0), 0),
    entries: entries.slice(0, 4),
  };
}

function infoTypeLabel(infoType: string): string {
  const labels: Record<string, string> = {
    static: '기본 공공데이터',
    public_data: '공공데이터 근거',
    weather: '기상청 예보 반영',
    movement: '이동 접근성 확인',
    visit_signal: '방문 신호 반영',
    correction_request: '수정요청 이력',
    user_feedback: '사용자 피드백',
  };
  return labels[infoType] ?? infoType.replace(/_/g, ' ');
}

function checkRequiredLabel(key: string): string {
  const labels: Record<string, string> = {
    public_data: '공공데이터 반증 확인',
    user_condition: '동행자 조건 확인',
    weather: '날씨 영향 확인',
    'weather:heavy_rain': '호우 영향 확인',
    'weather:rain': '비 예보 확인',
    'weather:wind': '강풍 영향 확인',
    'weather:wave': '풍랑 영향 확인',
    'weather:fog': '안개 영향 확인',
    'weather:heat': '더위 영향 확인',
    'weather:snow': '눈 예보 확인',
    movement: '이동·주차 확인',
    operation_info: '운영 정보 확인',
    visit_feedback: '방문 피드백 확인',
    recency: '최신성 확인',
  };
  return labels[key] ?? key;
}

function checkRequiredText(keys: string[] | undefined): string {
  return (keys ?? []).map(checkRequiredLabel).join(' · ');
}

function buildShareText(
  info: TravelInfo,
  selectedMomentIds: MomentId[],
  packResp: PackResponse,
  planItems: TravelPlanItem[],
  visitChecks: Record<string, VisitCheck>,
): string {
  const regions = info.regions
    .map((r) => REGIONS.find((x) => x.value === r)?.label ?? r)
    .join(' · ');
  const moments = selectedMomentIds
    .map((id) => MOMENTS.find((m) => m.id === id)?.title ?? id)
    .join(' · ');
  const companion = COMPANIONS.find((c) => c.value === info.companion)?.label ?? info.companion;
  const purpose = PURPOSES.find((p) => p.value === info.purpose)?.label ?? info.purpose;
  const signals = countPackSignals(packResp);
  const planLines = planItems.length > 0
    ? buildSelectedPlanLines(planItems, visitChecks)
    : buildItineraryShareLines(packResp);
  const packingLines = planItems.length > 0
    ? buildPlanPackingItems(planItems).slice(0, 8).map((suggestion) => (
      `- ${suggestion.item}: ${suggestion.reason}`
    ))
    : [];
  const gapLines = collectUnavailableCombos(packResp).slice(0, 5);
  const url = typeof window !== 'undefined' ? window.location.href : 'https://pack-your-jeju.vercel.app/';
  return [
    '제주를 담다 여행플랜',
    `지역: ${regions || '선택 전'}`,
    `일정: ${info.startDate}부터 ${info.durationDays}일`,
    `동행: ${companion}`,
    `목적: ${purpose}`,
    `순간: ${moments || '선택 전'}`,
    '',
    '하루방 에이전트 브리핑',
    `확인 후보 ${signals.total}곳 · 신뢰 신호 ${signals.verified} · 주의 신호 ${signals.caution} · 데이터 부족 조합 ${signals.gaps}개`,
    '',
    'Day별 여행플랜',
    ...(planLines.length > 0 ? planLines : ['아직 내 여행플랜에 담은 장소가 없습니다.']),
    ...(packingLines.length > 0 ? ['', '내 플랜 맞춤 짐', ...packingLines] : []),
    ...(gapLines.length > 0 ? ['', '데이터가 부족한 조합 메모', ...gapLines.map((x) => `- ${x}`)] : []),
    '',
    '장소별 근거와 주의 신호는 제주를 담다에서 확인할 수 있어요.',
    url,
  ].join('\n');
}

function countPackSignals(packResp: PackResponse): { total: number; verified: number; caution: number; gaps: number } {
  const items = collectPackItems(packResp);
  return {
    total: items.length,
    verified: items.filter((item) => item.badge === 'verified').length,
    caution: items.filter((item) => item.badge === 'caution').length,
    gaps: collectUnavailableCombos(packResp).length,
  };
}

function buildSelectedPlanLines(
  planItems: TravelPlanItem[],
  visitChecks: Record<string, VisitCheck>,
): string[] {
  const byDay = new Map<string, TravelPlanItem[]>();
  planItems.forEach((item) => {
    const key = item.day ? `Day ${item.day}${item.date ? ` (${item.date})` : ''}` : '직접 담은 항목';
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  });

  const lines: string[] = [];
  byDay.forEach((items, dayLabel) => {
    lines.push(dayLabel);
    items.forEach((item) => {
      const moment = MOMENTS.find((m) => m.id === item.moment)?.title
        ?? (item.source === 'user_added' ? '사용자 추가' : String(item.moment));
      const source = item.source === 'public_data' ? shareBadgeLabel(item.badge ?? 'reference') : '검증 전 메모';
      const visit = visitChecks[item.id];
      lines.push(`- ${item.name}`);
      lines.push(`  · 순간: ${moment}`);
      lines.push(`  · 근거 상태: ${source}`);
      if (typeof item.trust_score === 'number') {
        const scoreText = visit?.updatedTrustScore != null
          ? `${visit.previousTrustScore ?? item.trust_score}점 → ${visit.updatedTrustScore}점`
          : `${item.trust_score}점`;
        lines.push(`  · 신뢰도: ${scoreText}`);
      }
      if (item.check_required?.length) {
        lines.push(`  · 확인 필요: ${checkRequiredText(item.check_required)}`);
      }
      if (item.address) lines.push(`  · 주소: ${item.address}`);
      if (item.note) lines.push(`  · 주의 메모: ${item.note}`);
      if (visit) {
        lines.push(`  · 방문 피드백: ${visitStatusLabel(visit.status)}${visit.memo ? ` - ${visit.memo}` : ''}`);
        if (visit.publicDataStatus) {
          lines.push(`  · 수정요청 큐: ${publicDataStatusLabel(visit.publicDataStatus)}`);
        }
      }
    });
  });
  return lines;
}

function buildItineraryShareLines(packResp: PackResponse): string[] {
  const days = packResp.itinerary ?? [];
  if (days.length === 0) return [];
  return days.flatMap(buildShareDayLines);
}

function buildShareDayLines(day: ItineraryDayDto): string[] {
  const regionLabel = (day.regions ?? [])
    .map((r) => REGIONS.find((x) => x.value === r)?.label ?? r)
    .join(' · ');
  const header = `Day ${day.day} (${day.date}${regionLabel ? ` · ${regionLabel}` : ''})`;
  const itemLines = (day.items ?? []).slice(0, 4).map((item, idx) => {
    const moment = MOMENTS.find((m) => m.id === item.moment)?.title ?? item.moment;
    const checks = item.check_required?.length ? ` · 확인 필요: ${checkRequiredText(item.check_required)}` : '';
    const score = typeof item.trust_score === 'number' ? ` · 신뢰도 ${item.trust_score}점` : '';
    const address = item.address ? ` · 주소: ${item.address}` : '';
    return `- ${shareSlotLabel(item, idx)}: ${item.name} (${moment} · ${shareBadgeLabel(item.badge)}${score}${checks}${address})`;
  });
  const rest = Math.max((day.items?.length ?? 0) - itemLines.length, 0);
  return [
    header,
    ...itemLines,
    ...(rest > 0 ? [`- 그 외 후보 ${rest}곳은 링크에서 확인`] : []),
  ];
}

function collectUnavailableCombos(packResp: PackResponse): string[] {
  const combos = new Set<string>();
  (packResp.itinerary ?? []).forEach((day) => {
    (day.unavailable_moments ?? []).forEach((item) => {
      const region = REGIONS.find((x) => x.value === item.region)?.label ?? item.region;
      const moment = MOMENTS.find((m) => m.id === item.moment)?.title ?? item.moment;
      combos.add(`${region} · ${moment}`);
    });
  });
  return Array.from(combos);
}

function shareBadgeLabel(badge: PackItemDto['badge']): string {
  if (badge === 'verified') return '신뢰 신호';
  if (badge === 'caution') return '주의 신호';
  if (badge === 'contradicted') return '변경 확인';
  return '근거 참고';
}

function shareSlotLabel(item: ItineraryItemDto, index: number): string {
  const moment = item.moment;
  if (moment === 'local_food') return '점심·저녁 후보';
  if (moment === 'quiet_cafe' || moment === 'local_market' || moment === 'citrus') return '오후 후보';
  if (moment === 'sunset') return '저녁 후보';
  if (moment === 'oreum' || moment === 'beach_walk' || moment === 'gotjawal') return '오전·오후 후보';
  return ['오전 후보', '점심 후보', '오후 후보', '저녁 후보'][Math.min(index, 3)];
}

type MappableItem = PackItemDto | TravelPlanItem;
type MapMarkerItem = { item: MappableItem; coord: { lat: number; lng: number } };

function resolveItemCoordinate(item: MappableItem): { lat: number; lng: number } | null {
  const raw = item as any;
  const amenities = ('amenities' in item ? item.amenities ?? {} : {}) as Record<string, unknown>;
  const lat = toNumber(
    raw.latitude ?? raw.lat ?? amenities.latitude ?? amenities.lat ?? amenities.mapy ?? amenities.y,
  );
  const lng = toNumber(
    raw.longitude ?? raw.lng ?? raw.lon ?? amenities.longitude ?? amenities.lng ?? amenities.lon ?? amenities.mapx ?? amenities.x,
  );
  if (lat == null || lng == null) return null;
  if (lat < 32 || lat > 34 || lng < 125 || lng > 128) return null;
  return { lat, lng };
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function TripMapCard({
  items,
  regions,
  isPlanMap,
}: {
  items: MappableItem[];
  regions: TravelInfo['regions'];
  isPlanMap: boolean;
}) {
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const [mapStatus, setMapStatus] = useState<'idle' | 'ready' | 'fallback'>('idle');
  const naverKey = import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined;
  const markerItems = useMemo(
    () => items
      .map((item) => ({ item, coord: resolveItemCoordinate(item) }))
      .filter((x): x is MapMarkerItem => !!x.coord)
      .slice(0, 12),
    [items],
  );

  useEffect(() => {
    if (!naverKey || !mapRef.current) {
      setMapStatus('fallback');
      return;
    }

    let cancelled = false;
    let markers: any[] = [];
    let authCheckTimer: number | null = null;

    const ensureScript = () =>
      new Promise<void>((resolve, reject) => {
        const w = window as any;
        if (w.naver?.maps) {
          resolve();
          return;
        }
        const existing = document.getElementById('naver-map-sdk');
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('naver map load failed')), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.id = 'naver-map-sdk';
        script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(naverKey)}`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('naver map load failed'));
        document.head.appendChild(script);
      });

    ensureScript()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const w = window as any;
        const center = markerItems[0]?.coord ?? { lat: 33.38, lng: 126.53 };
        const map = new w.naver.maps.Map(mapRef.current, {
          center: new w.naver.maps.LatLng(center.lat, center.lng),
          zoom: markerItems.length > 0 ? 10 : 9,
          minZoom: 8,
          mapDataControl: false,
          scaleControl: false,
          logoControlOptions: {
            position: w.naver.maps.Position.BOTTOM_LEFT,
          },
        });
        markers = markerItems.map(({ item, coord }, idx) => new w.naver.maps.Marker({
          position: new w.naver.maps.LatLng(coord.lat, coord.lng),
          map,
          title: item.name,
          icon: {
            content: `<div style="width:26px;height:26px;border-radius:999px;background:#E7683A;color:#fff;border:2px solid #fff;box-shadow:0 6px 14px rgba(46,50,53,.18);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">${idx + 1}</div>`,
            size: new w.naver.maps.Size(26, 26),
            anchor: new w.naver.maps.Point(13, 13),
          },
        }));
        if (markerItems.length > 1) {
          const bounds = new w.naver.maps.LatLngBounds();
          markerItems.forEach(({ coord }) => bounds.extend(new w.naver.maps.LatLng(coord.lat, coord.lng)));
          map.fitBounds(bounds, { top: 36, right: 36, bottom: 36, left: 36 });
        }
        authCheckTimer = window.setTimeout(() => {
          if (cancelled || !mapRef.current) return;
          const mapText = mapRef.current.textContent ?? '';
          if (mapText.includes('인증') && mapText.includes('실패')) {
            mapRef.current.innerHTML = '';
            setMapStatus('fallback');
            return;
          }
          setMapStatus('ready');
        }, 700);
      })
      .catch(() => {
        if (!cancelled) setMapStatus('fallback');
      });

    return () => {
      cancelled = true;
      if (authCheckTimer) window.clearTimeout(authCheckTimer);
      markers.forEach((marker) => marker.setMap(null));
      markers = [];
    };
  }, [naverKey, markerItems]);

  return (
    <div className="card-jeju p-5 space-y-3" id="trip-map-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-citrus-2 uppercase tracking-wider mb-1.5">
            <MapPinned className="w-3 h-3" />
            이번 여행 지도
          </span>
          <h3 className="font-serif-kr font-bold text-[15px] text-basalt tracking-tight">
            {isPlanMap ? '내 플랜 장소를 한눈에 보기' : '선택한 제주를 한눈에 보기'}
          </h3>
        </div>
        <span className="rounded-full border border-earth bg-[#FDF6EA] px-2 py-1 text-[10px] font-semibold text-basalt-2">
          {isPlanMap ? '플랜 마커' : '마커'} {markerItems.length}곳
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-earth bg-[#FDF6EA]">
        <div ref={mapRef} className="h-[220px] w-full">
          {mapStatus !== 'ready' && <FallbackJejuMap regions={regions} markers={markerItems} />}
        </div>
      </div>

      <p className="text-[10.5px] text-basalt-2 leading-relaxed">
        {isPlanMap
          ? '플랜에 담은 장소 중 좌표가 확인된 곳만 지도 마커로 표시합니다. 직접 추가했거나 좌표가 없는 장소는 카드의 주소에서 확인해 주세요.'
          : '좌표가 확인된 장소만 지도 마커로 표시합니다. 좌표가 없는 장소는 아래 장소 카드의 근거와 주소에서 확인해 주세요.'}
      </p>
    </div>
  );
}

function FallbackJejuMap({
  regions,
  markers,
}: {
  regions: TravelInfo['regions'];
  markers: MapMarkerItem[];
}) {
  const labels = regions
    .map((r) => REGIONS.find((x) => x.value === r)?.label ?? r)
    .slice(0, 4);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#FDF6EA]">
      <svg viewBox="0 0 360 220" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path
          d="M31 121C42 80 83 48 135 39c58-10 131 4 170 33 35 26 42 68 17 97-29 33-92 45-157 37-67-8-123-33-137-66-3-7-3-13 3-19Z"
          fill="#D5E9E1"
          opacity="0.55"
        />
        <path
          d="M42 116C56 82 94 58 141 49c54-10 117 1 154 27 32 22 38 58 15 82-25 26-79 39-137 34-61-5-116-27-130-57-3-7-3-13-1-19Z"
          fill="#FFF8EC"
          stroke="#C9A97F"
          strokeWidth="2"
        />
        <path
          d="M73 146C118 166 205 177 287 146"
          fill="none"
          stroke="#4A8779"
          strokeOpacity="0.22"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {markers.map(({ item, coord }, idx) => {
          const point = projectJejuCoordinate(coord);
          return (
            <g key={`${item.name}-${idx}`} transform={`translate(${point.x} ${point.y})`}>
              <circle r="11" fill="#E7683A" stroke="#fff" strokeWidth="2.5" />
              <text
                y="4"
                textAnchor="middle"
                fill="#fff"
                fontSize="10"
                fontWeight="800"
                fontFamily="Arial, sans-serif"
              >
                {idx + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
        <p className="font-serif-kr text-[15px] font-bold text-basalt">
          {markers.length > 0
            ? `플랜 장소 ${markers.length}곳 표시`
            : `${labels.length > 0 ? labels.join(' · ') : '제주'} 중심 여행팩`}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-basalt-2">
          {markers.length > 0
            ? '네이버 지도 인증 전에도 좌표가 확인된 장소를 간이 지도에 표시합니다.'
            : '네이버 지도 키 또는 좌표가 준비되면 이 영역에 장소 마커가 표시됩니다.'}
        </p>
      </div>
    </div>
  );
}

function projectJejuCoordinate(coord: { lat: number; lng: number }): { x: number; y: number } {
  const lngMin = 126.1;
  const lngMax = 126.98;
  const latMin = 33.1;
  const latMax = 33.58;
  const x = 34 + ((coord.lng - lngMin) / (lngMax - lngMin)) * 292;
  const y = 48 + ((latMax - coord.lat) / (latMax - latMin)) * 132;
  return {
    x: Math.min(330, Math.max(30, x)),
    y: Math.min(190, Math.max(36, y)),
  };
}

function SummaryLine({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-orange-500 shrink-0">{icon}</span>
      <span className="font-medium truncate">{label}</span>
    </div>
  );
}

const FALLBACK_MEAN: Record<string, { label: string; tint: string; emoji: string }> = {
  coverage_gap:   { label: '공공데이터 커버리지 밖', tint: 'from-amber-50 to-orange-50/60 border-amber-100 text-amber-950',  emoji: '🟠' },
  contradicted:   { label: '반증이 확인됩니다',       tint: 'from-rose-50 to-orange-50/60 border-rose-100 text-rose-950',     emoji: '🔴' },
  retrieval_miss: { label: '검색 결과 없음',           tint: 'from-stone-50 to-orange-50/60 border-stone-100 text-stone-800', emoji: '⚪' },
  out_of_scope:   { label: '제주 여행 범위 밖',       tint: 'from-stone-50 to-orange-50/60 border-stone-100 text-stone-800', emoji: '⚪' },
};

function ItineraryDayCard({
  day,
  selectedPlanIds,
  onTogglePlanItem,
}: {
  day: ItineraryDayDto;
  selectedPlanIds: Set<string>;
  onTogglePlanItem: (item: TravelPlanItem) => void;
}) {
  // 여행 날짜를 사람에게 읽기 좋은 형태로 표시. 데이터 지어내지 않는 표준 포맷.
  const dateFmt = new Date(day.date + 'T00:00:00').toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', weekday: 'short',
  });
  const regionLabels = (day.regions ?? [])
    .map((r) => REGIONS.find((x) => x.value === r)?.label ?? r)
    .filter(Boolean);
  return (
    <div className="card-jeju p-5 space-y-3" id={`itinerary-day-${day.day}`}>
      <div className="border-b border-earth/50 pb-2.5">
        <div className="flex items-baseline gap-2.5">
          <span className="font-serif-kr font-bold text-[18px] text-basalt tracking-tight">
            Day {day.day}
          </span>
          <span className="text-[11.5px] text-basalt-2/70 font-medium">{dateFmt}</span>
          <span className="ml-auto text-[10.5px] font-bold text-basalt-2/60 uppercase tracking-wider">
            {day.items.length}곳
          </span>
        </div>
        {regionLabels.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <MapPin className="w-3 h-3 text-citrus-2/70 shrink-0" />
            {regionLabels.map((label) => (
              <span
                key={label}
                className="px-1.5 py-0.5 rounded-md bg-citrus/10 text-citrus-2 text-[10.5px] font-semibold"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {day.items.length > 0 && (
        <div className="space-y-2">
          {day.items.map((it) => (
            <ItineraryItemRow
              key={`${it.external_id}-${day.day}`}
              it={it}
              day={day}
              selectedPlanIds={selectedPlanIds}
              onTogglePlanItem={onTogglePlanItem}
            />
          ))}
        </div>
      )}

      <UnavailableNote unavailable={day.unavailable_moments ?? []} hasItems={day.items.length > 0} />
    </div>
  );
}

// (region x moment) 조합 중 items로 채워지지 않은 항목을 근거 부족 안내로 노출.
// TRUST_ENGINE.md §2 인식론 규칙: "coverage_gap일 때 절대 '없다'로 단언하지 않는다."
function UnavailableNote({
  unavailable,
  hasItems,
}: {
  unavailable: { region: string; moment: string }[];
  hasItems: boolean;
}) {
  if (unavailable.length === 0) return null;

  // 지역별로 미확인 순간들을 그룹핑 → "성산에서는 조용한 카페가..." 형태로 조립.
  const byRegion = new Map<string, string[]>();
  for (const u of unavailable) {
    const arr = byRegion.get(u.region) ?? [];
    arr.push(u.moment);
    byRegion.set(u.region, arr);
  }

  const lines: string[] = [];
  byRegion.forEach((moments, region) => {
    const regionLabel = REGIONS.find((r) => r.value === region)?.label ?? region;
    const momentLabels = moments
      .map((m) => MOMENTS.find((x) => x.id === m)?.title ?? m)
      .join(' · ');
    lines.push(
      `${regionLabel}에서는 ${momentLabels}이(가) 저희가 참조하는 공공데이터 기준으로 확인되지 않았습니다.`,
    );
  });

  return (
    <div
      className={`rounded-2xl border p-3 text-[11.5px] leading-relaxed ${
        hasItems
          ? 'border-amber-100 bg-amber-50/60 text-amber-900'
          : 'border-stone-100 bg-[#FDF6EA] text-stone-700'
      }`}
    >
      <div className="flex items-start gap-1.5">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-700/80" />
        <div className="space-y-0.5">
          {lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function ItineraryItemRow({
  it,
  day,
  selectedPlanIds,
  onTogglePlanItem,
}: {
  it: ItineraryItemDto;
  day: ItineraryDayDto;
  selectedPlanIds: Set<string>;
  onTogglePlanItem: (item: TravelPlanItem) => void;
}) {
  const moment = MOMENTS.find((m) => m.id === it.moment);
  const momentTitle = moment?.title ?? String(it.moment);
  const momentHeader = (
    <div className="flex items-center gap-1.5 text-[10px] text-orange-700/80 font-semibold uppercase tracking-wider mb-0.5">
      {moment && <MomentIcon id={moment.id as any} className="w-3.5 h-3.5" />}
      <span>{momentTitle}</span>
    </div>
  );
  const planItem = toPlanItem(it, day);
  return (
    <PackItemCard
      it={it}
      header={momentHeader}
      planItem={planItem}
      inPlan={selectedPlanIds.has(planItem.id)}
      onTogglePlanItem={onTogglePlanItem}
    />
  );
}

// 팩 아이템 하나 = 클릭 시 확장. 헤더(장소명·배지·요약 뱃지)만 접혀 있고, 열면 PlaceDetail 노출.
// 요일별 뷰와 순간별 뷰가 공유. 순간 라벨은 부모(요일별 뷰)에서 header prop으로 주입.
function PackItemCard({
  it,
  header,
  planItem,
  inPlan = false,
  onTogglePlanItem,
}: {
  it: PackItemDto;
  header?: React.ReactNode;
  planItem?: TravelPlanItem;
  inPlan?: boolean;
  onTogglePlanItem?: (item: TravelPlanItem) => void;
}) {
  const [open, setOpen] = useState(false);
  // 썸네일: 제주 ITS API로 병합된 visitjeju CDN 이미지. 결측 시 렌더 안 함.
  const thumbnail = (it.amenities as any)?.thumbnail_path as string | undefined;
  return (
    <div
      className={`rounded-2xl border bg-[#FDFBF7] transition overflow-hidden ${
        open ? 'border-orange-200 shadow-sm' : 'border-stone-100 hover:border-orange-200'
      }`}
    >
      {thumbnail && (
        <div className="relative w-full aspect-[16/9] bg-stone-100 overflow-hidden">
          <img
            src={thumbnail}
            alt={it.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              // 로드 실패 시 조용히 숨김 (원 없는 척 안 함).
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = 'none';
            }}
          />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left p-3.5 focus:outline-none focus:ring-2 focus:ring-citrus/30 rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            {header}
            <div className="font-bold text-[13.5px] text-stone-900 leading-snug">
              {it.name}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {typeof it.trust_score === 'number' && (
              <span className="rounded-full border border-earth bg-white px-2 py-0.5 text-[10px] font-bold text-basalt">
                신뢰 {it.trust_score}
              </span>
            )}
            <Badge kind={it.badge} note={it.note} />
            <ChevronDown
              className={`w-4 h-4 text-basalt-2/60 transition-transform ${
                open ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-stone-500">
          {it.transit.parking && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-stone-200">
              <ParkingCircle className="w-3 h-3 text-stone-500" />
              <span className="font-medium">주차 {it.transit.parking_count}</span>
            </span>
          )}
          {it.transit.bus_walkable && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-stone-200">
              <Bus className="w-3 h-3 text-stone-500" />
              <span className="font-medium">정류장 근접</span>
            </span>
          )}
          {it.freshness?.info_type && (
            <span className="rounded-full bg-[#F8F1E4] px-2 py-0.5 font-medium text-basalt-2/70">
              {infoTypeLabel(it.freshness.info_type)}
            </span>
          )}
          {!open && (
            <span className="ml-auto text-[10px] text-citrus-2/80 font-semibold">
              자세히 보기 →
            </span>
          )}
        </div>
        {(it.check_required?.length ?? 0) > 0 && (
          <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/70 px-2.5 py-1.5 text-[10.5px] font-semibold text-amber-900">
            확인 필요: {checkRequiredText(it.check_required)}
          </div>
        )}
      </button>

      {planItem && onTogglePlanItem && (
        <div className="px-3.5 pb-3.5 -mt-1">
          <button
            type="button"
            onClick={() => onTogglePlanItem(planItem)}
            className={`w-full rounded-xl border px-3 py-2 text-[11.5px] font-bold inline-flex items-center justify-center gap-1.5 transition ${
              inPlan
                ? 'border-mint bg-mint/10 text-mint hover:bg-mint/15'
                : 'border-citrus/30 bg-white text-citrus-2 hover:bg-orange-50'
            }`}
          >
            {inPlan ? (
              <>
                <Check className="w-3.5 h-3.5" />
                내 여행플랜에 담김
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                플랜에 담기
              </>
            )}
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 pt-1 border-t border-stone-100">
              <PlaceDetail
                externalId={it.external_id}
                address={it.address}
                category={it.category}
                amenities={it.amenities}
                freshness={it.freshness}
                transit={it.transit}
                hygieneGrade={it.hygiene_grade}
                note={it.note}
                sources={it.sources}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionCard({
  section,
  selectedPlanIds,
  onTogglePlanItem,
}: {
  section: SectionDto;
  selectedPlanIds: Set<string>;
  onTogglePlanItem: (item: TravelPlanItem) => void;
}) {
  const moment = MOMENTS.find((m) => m.id === section.moment);
  const title = moment?.title ?? section.moment;
  const fb = section.fallback ? FALLBACK_MEAN[section.fallback.reason] : null;

  return (
    <div
      className="card-jeju p-5 space-y-3"
      id={`section-${section.moment}`}
    >
      <div className="flex items-center gap-2.5">
        {moment && (
          <div className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center p-1 bg-[#FDF6EA]">
            <MomentIcon id={moment.id as any} className="w-full h-full" />
          </div>
        )}
        <h3 className="font-serif-kr font-bold text-[15px] text-basalt tracking-tight">{title}</h3>
        {!section.fallback && section.items.length > 0 && (
          <span className="ml-auto text-[10.5px] font-bold text-basalt-2/60 uppercase tracking-wider">
            {section.items.length}곳
          </span>
        )}
      </div>

      {section.fallback && fb ? (
        <div className={`rounded-2xl border bg-gradient-to-br ${fb.tint} p-4`}>
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider mb-2">
            <span>{fb.emoji}</span>
            <span>{fb.label}</span>
          </div>
          <p className="text-[13px] leading-relaxed font-medium">
            {section.fallback.message}
          </p>
        </div>
      ) : section.items.length === 0 ? (
        <p className="text-xs text-stone-400">결과가 없습니다.</p>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {section.items.map((it) => {
            const planItem = toPlanItem({ ...it, moment: section.moment } as ItineraryItemDto);
            return (
              <PackItemCard
                key={it.external_id}
                it={it}
                planItem={planItem}
                inPlan={selectedPlanIds.has(planItem.id)}
                onTogglePlanItem={onTogglePlanItem}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

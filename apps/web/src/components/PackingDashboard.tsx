import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
  GripVertical,
  Clock3,
  LockKeyhole,
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
  WeatherChangeProposal,
  WeatherReportResponse,
  Daypart,
  RouteChangeProposal,
  RouteLocation,
  RouteMode,
  RoutePlanResponse,
  HarubanPlanDraft,
} from '../types';
import { MOMENTS, REGIONS, COMPANIONS, PURPOSES } from '../data';
import { requestCandidatePage, requestPack, requestRoutePlan, requestVisitSignal, requestWeatherReport } from '../api';
import {
  planFingerprint,
  schedulePlanItemsForWeather,
  toWeatherReportItems,
} from '../weatherProposal';
import { hasFinishedCandidateSection, mergeCandidateSection } from '../candidatePagination';
import Badge from './Badge';
import MomentIcon from './marks/MomentIcon';
import PlaceDetail from './PlaceDetail';
import WeatherDecisionReport from './WeatherDecisionReport';
import TravelRouteCard from './TravelRouteCard';
import TravelRouteMap from './TravelRouteMap';
import PackJourneyGuide from './PackJourneyGuide';
import {
  advancePackJourneyStep,
  derivePackJourneyState,
  type PackJourneyStepId,
} from '../packJourneyGuide';
import { createHarubanPlanDraft } from '../harubanPlanComposer';
import {
  addPendingPlanPdfItems,
  createPlanPdfWorkspace,
  excludePlanPdfWorkspaceItem,
  findPendingPlanPdfSourceItems,
  syncRemovedPlanPdfSourceItems,
  undoExcludedPlanPdfWorkspaceItem,
  updatePlanPdfWorkspaceDraft,
  type PlanPdfWorkspace,
} from '../planPdfWorkspace';

const PlanPdfEditor = lazy(() => import('./PlanPdfEditor'));

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
  weatherDismissedFingerprints: string[];
  weatherUndoAvailable: boolean;
  weatherActionMessage: string | null;
  routeDismissedFingerprints: string[];
  routeUndoAvailable: boolean;
  routeActionMessage: string | null;
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
  onUpdatePlanSchedule: (
    itemId: string,
    patch: Partial<Pick<TravelPlanItem, 'day' | 'daypart' | 'startTime' | 'fixed'>>,
  ) => void;
  onApplyWeatherProposal: (proposal: WeatherChangeProposal) => void;
  onDismissWeatherProposal: (proposal: WeatherChangeProposal) => void;
  onUndoWeatherProposal: () => void;
  onApplyRouteProposal: (proposal: RouteChangeProposal) => void;
  onDismissRouteProposal: (proposal: RouteChangeProposal) => void;
  onUndoRouteProposal: () => void;
  onSetVisitCheck: (itemId: string, status: VisitCheckStatus, patch?: Partial<VisitCheck>) => void;
  onOpenFeedback: () => void;
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

const PLAN_SIDEBAR_STORAGE_KEY = 'pyj-plan-sidebar-width';
const PLAN_SIDEBAR_DEFAULT_WIDTH = 460;
const PLAN_SIDEBAR_MIN_WIDTH = 360;
const PLAN_SIDEBAR_MAX_WIDTH = 680;
const PLAN_CONTENT_MIN_WIDTH = 520;
const DAYPART_OPTIONS: Array<{value: Daypart; label: string; startTime: string}> = [
  {value: 'morning', label: '오전', startTime: '09:00'},
  {value: 'afternoon', label: '오후', startTime: '14:00'},
  {value: 'evening', label: '저녁', startTime: '18:00'},
];

function savedPlanSidebarWidth(): number {
  const saved = Number(window.localStorage.getItem(PLAN_SIDEBAR_STORAGE_KEY));
  if (!Number.isFinite(saved)) return PLAN_SIDEBAR_DEFAULT_WIDTH;
  return Math.min(Math.max(saved, PLAN_SIDEBAR_MIN_WIDTH), PLAN_SIDEBAR_MAX_WIDTH);
}

export default function PackingDashboard(props: Props) {
  const {
    info,
    selectedMomentIds,
    checkedItemIds,
    selectedPlanItems,
    visitChecks,
    weatherDismissedFingerprints,
    weatherUndoAvailable,
    weatherActionMessage,
    routeDismissedFingerprints,
    routeUndoAvailable,
    routeActionMessage,
    onToggleItem,
    onTogglePlanItem,
    onAddCustomPlanItem,
    onRemovePlanItem,
    onUpdatePlanSchedule,
    onApplyWeatherProposal,
    onDismissWeatherProposal,
    onUndoWeatherProposal,
    onApplyRouteProposal,
    onDismissRouteProposal,
    onUndoRouteProposal,
    onSetVisitCheck,
    onOpenFeedback,
    onReset,
  } = props;

  const [packResp, setPackResp] = useState<PackResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [candidatePageState, setCandidatePageState] = useState<
    Record<string, { loading: boolean; error: string | null }>
  >({});
  // 뷰 스위처: 순간별(기본) vs 요일별. 응답의 itinerary가 있어야 요일별 활성.
  const [viewMode, setViewMode] = useState<'moments' | 'itinerary'>('moments');
  const [planPdfEditorOpen, setPlanPdfEditorOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [planSidebarWidth, setPlanSidebarWidth] = useState(savedPlanSidebarWidth);
  const [weatherReport, setWeatherReport] = useState<WeatherReportResponse | null>(null);
  const [weatherReportLoading, setWeatherReportLoading] = useState(false);
  const [weatherReportError, setWeatherReportError] = useState<string | null>(null);
  const [routeMode, setRouteMode] = useState<RouteMode>('driving');
  const [routeActiveDay, setRouteActiveDay] = useState(1);
  const [routeResponse, setRouteResponse] = useState<RoutePlanResponse | null>(null);
  const [routeBasisFingerprint, setRouteBasisFingerprint] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [pdfWorkspace, setPdfWorkspace] = useState<PlanPdfWorkspace | null>(null);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [harubanCompositionStatus, setHarubanCompositionStatus] = useState<
    'idle' | 'weather' | 'route' | 'done'
  >('idle');
  const [harubanCompositionError, setHarubanCompositionError] = useState<string | null>(null);
  const [packJourneyStepId, setPackJourneyStepId] =
    useState<PackJourneyStepId>('candidates');
  const dashboardRef = useRef<HTMLDivElement>(null);
  const resizingSidebarRef = useRef(false);
  const previousPlanItemCountRef = useRef(selectedPlanItems.length);
  const currentPlanFingerprintRef = useRef(planFingerprint(selectedPlanItems));
  currentPlanFingerprintRef.current = planFingerprint(selectedPlanItems);

  useEffect(() => {
    const finishResize = () => {
      if (!resizingSidebarRef.current) return;
      resizingSidebarRef.current = false;
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
    const resizeSidebar = (event: PointerEvent) => {
      if (!resizingSidebarRef.current || !dashboardRef.current) return;
      const bounds = dashboardRef.current.getBoundingClientRect();
      const availableMaximum = bounds.width - PLAN_CONTENT_MIN_WIDTH - 28;
      const maximum = Math.max(
        PLAN_SIDEBAR_MIN_WIDTH,
        Math.min(PLAN_SIDEBAR_MAX_WIDTH, availableMaximum),
      );
      const nextWidth = Math.min(
        Math.max(event.clientX - bounds.left, PLAN_SIDEBAR_MIN_WIDTH),
        maximum,
      );
      setPlanSidebarWidth(Math.round(nextWidth));
    };

    window.addEventListener('pointermove', resizeSidebar);
    window.addEventListener('pointerup', finishResize);
    window.addEventListener('pointercancel', finishResize);
    return () => {
      window.removeEventListener('pointermove', resizeSidebar);
      window.removeEventListener('pointerup', finishResize);
      window.removeEventListener('pointercancel', finishResize);
      finishResize();
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PLAN_SIDEBAR_STORAGE_KEY, String(planSidebarWidth));
  }, [planSidebarWidth]);

  useEffect(() => {
    const previousCount = previousPlanItemCountRef.current;
    previousPlanItemCountRef.current = selectedPlanItems.length;
    if (selectedPlanItems.length <= previousCount) return;

    setPackJourneyStepId((currentStepId) =>
      advancePackJourneyStep(currentStepId, 'plan_item_added'),
    );
  }, [selectedPlanItems.length]);

  useEffect(() => {
    const fitSidebarToViewport = () => {
      if (!dashboardRef.current || window.innerWidth < 1024) return;
      const maximum = Math.max(
        PLAN_SIDEBAR_MIN_WIDTH,
        Math.min(
          PLAN_SIDEBAR_MAX_WIDTH,
          dashboardRef.current.getBoundingClientRect().width - PLAN_CONTENT_MIN_WIDTH - 28,
        ),
      );
      setPlanSidebarWidth((current) => Math.min(current, Math.round(maximum)));
    };
    fitSidebarToViewport();
    window.addEventListener('resize', fitSidebarToViewport);
    return () => window.removeEventListener('resize', fitSidebarToViewport);
  }, []);

  const beginSidebarResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    resizingSidebarRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const resetSidebarWidth = () => setPlanSidebarWidth(PLAN_SIDEBAR_DEFAULT_WIDTH);

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
  const packJourneyState = useMemo(
    () => derivePackJourneyState(packJourneyStepId),
    [packJourneyStepId],
  );
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
  const scheduledPlanItems = useMemo(
    () => schedulePlanItemsForWeather(info, selectedPlanItems),
    [info, selectedPlanItems],
  );
  const weatherPlanItems = useMemo(
    () => toWeatherReportItems(info, scheduledPlanItems),
    [info, scheduledPlanItems],
  );
  const scheduledPlanFingerprint = useMemo(
    () => planFingerprint(scheduledPlanItems),
    [scheduledPlanItems],
  );
  const harubanDraft = pdfWorkspace?.composition ?? null;
  const pendingPlanPdfSourceItems = useMemo(
    () => pdfWorkspace
      ? findPendingPlanPdfSourceItems(pdfWorkspace, selectedPlanItems)
      : [],
    [pdfWorkspace, selectedPlanItems],
  );
  useEffect(() => {
    if (!pdfWorkspace) return;
    const nextWorkspace = syncRemovedPlanPdfSourceItems(
      pdfWorkspace,
      selectedPlanItems,
    );
    if (nextWorkspace === pdfWorkspace) return;
    setPdfWorkspace(nextWorkspace);
    setWorkspaceRevision((value) => value + 1);
  }, [pdfWorkspace, selectedPlanItems]);
  const visibleWeatherReport = useMemo(() => {
    if (!weatherReport) return null;
    const dismissed = new Set(weatherDismissedFingerprints);
    return {
      ...weatherReport,
      proposals: weatherReport.proposals.filter(
        (proposal) => !dismissed.has(proposal.fingerprint),
      ),
    };
  }, [weatherReport, weatherDismissedFingerprints]);
  const routePlanItems = useMemo(
    () => enrichPlanItemsWithCoordinates(scheduledPlanItems, packItems).filter(
      (item) => Boolean(resolveItemCoordinate(item)),
    ),
    [scheduledPlanItems, packItems],
  );
  const routeDays = useMemo(
    () => Array.from(new Set(
      routePlanItems
        .map((item) => item.day)
        .filter((day): day is number => typeof day === 'number' && day > 0),
    )).sort((a, b) => a - b),
    [routePlanItems],
  );
  const routeEndpoint = useMemo<RouteLocation | null>(() => {
    const endpointItem = routePlanItems.find((item) => item.moment === 'stay')
      ?? routePlanItems[0];
    const coordinate = endpointItem ? resolveItemCoordinate(endpointItem) : null;
    if (!endpointItem || !coordinate) return null;
    return {
      label: endpointItem.moment === 'stay'
        ? endpointItem.name
        : `${endpointItem.name} 기준`,
      lat: coordinate.lat,
      lng: coordinate.lng,
    };
  }, [routePlanItems]);
  const visibleRouteResponse = useMemo(() => {
    if (!routeResponse?.proposal) return routeResponse;
    if (!routeDismissedFingerprints.includes(routeResponse.proposal.fingerprint)) {
      return routeResponse;
    }
    return {...routeResponse, proposal: null};
  }, [routeResponse, routeDismissedFingerprints]);
  const activeRouteDay = useMemo(
    () => visibleRouteResponse?.days.find((day) => day.day === routeActiveDay) ?? null,
    [visibleRouteResponse, routeActiveDay],
  );
  const activePlanItems = pdfWorkspace?.draft.items ?? selectedPlanItems;
  const shareText = useMemo(
    () => packResp ? buildShareText(info, selectedMomentIds, packResp, activePlanItems, visitChecks) : '',
    [activePlanItems, info, selectedMomentIds, packResp, visitChecks]
  );
  const hasPackInput = info.regions.length > 0 && selectedMomentIds.length > 0;

  const navigateToPackSection = (targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ?? false;
    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    target.focus({ preventScroll: true });
    if (targetId === 'candidate-workbench-header') {
      setPackJourneyStepId((currentStepId) =>
        advancePackJourneyStep(currentStepId, 'candidates_viewed'),
      );
    }
  };

  const handleUpdatePlanSchedule: Props['onUpdatePlanSchedule'] = (itemId, patch) => {
    onUpdatePlanSchedule(itemId, patch);
    setPackJourneyStepId((currentStepId) =>
      advancePackJourneyStep(currentStepId, 'schedule_updated'),
    );
  };

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

  const openPlanPdfEditor = () => {
    setPdfWorkspace((current) => current ?? createPlanPdfWorkspace({
      sourceItems: selectedPlanItems,
      durationDays: info.durationDays,
    }));
    setPlanPdfEditorOpen(true);
  };

  const handleComposeHarubanPlan = async () => {
    if (selectedPlanItems.length === 0 || harubanCompositionStatus === 'weather'
      || harubanCompositionStatus === 'route') return;

    const sourceItems = structuredClone(selectedPlanItems);
    const sourceFingerprint = planFingerprint(sourceItems);
    let freshWeatherReport: WeatherReportResponse | null = null;
    let freshRouteReport: RoutePlanResponse | null = null;
    let weatherError: string | null = null;
    let routeErrorMessage: string | null = null;

    setPdfWorkspace(null);
    setHarubanCompositionError(null);
    setHarubanCompositionStatus('weather');

    const weatherScheduledItems = schedulePlanItemsForWeather(info, sourceItems);
    const reportItems = toWeatherReportItems(info, weatherScheduledItems);
    try {
      freshWeatherReport = await requestWeatherReport({
        startDate: info.startDate,
        days: info.durationDays,
        regions: Array.from(new Set(reportItems.map((item) => item.region))),
        items: reportItems,
        dismissedProposalFingerprints: [],
      });
    } catch (compositionWeatherError: unknown) {
      weatherError = compositionWeatherError instanceof Error
        ? compositionWeatherError.message
        : '날씨 정보를 확인하지 못했어요.';
    }

    setHarubanCompositionStatus('route');
    const weatherDraft = createHarubanPlanDraft({
      info,
      items: sourceItems,
      weatherReport: freshWeatherReport,
      weatherError,
    });
    const compositionRouteItems = enrichPlanItemsWithCoordinates(weatherDraft.items, packItems)
      .filter((item) => Boolean(resolveItemCoordinate(item)));
    const endpointItem = compositionRouteItems.find((item) => item.moment === 'stay')
      ?? compositionRouteItems[0];
    const endpointCoordinate = endpointItem ? resolveItemCoordinate(endpointItem) : null;
    const hasComparableDay = Array.from(new Set(compositionRouteItems.map((item) => item.day)))
      .some((day) => compositionRouteItems.filter((item) => item.day === day).length >= 2);

    if (!endpointItem || !endpointCoordinate || !hasComparableDay) {
      routeErrorMessage = '같은 Day에 위치가 확인된 장소가 2곳 이상 없어 동선은 유지했어요.';
    } else {
      const weatherStatusByItem = new Map(
        (freshWeatherReport?.impacts ?? []).map((impact) => [impact.item_id, impact.status]),
      );
      const endpoint: RouteLocation = {
        label: endpointItem.moment === 'stay' ? endpointItem.name : `${endpointItem.name} 기준`,
        lat: endpointCoordinate.lat,
        lng: endpointCoordinate.lng,
      };
      try {
        const routeResult = await requestRoutePlan({
          mode: routeMode,
          origin: endpoint,
          destination: endpoint,
          items: compositionRouteItems.flatMap((item) => {
            const coordinate = resolveItemCoordinate(item);
            if (!coordinate || !item.day || !item.daypart) return [];
            return [{
              id: item.id,
              label: item.name,
              lat: coordinate.lat,
              lng: coordinate.lng,
              day: item.day,
              daypart: item.daypart,
              fixed: item.fixed ?? false,
              weatherStatus: weatherStatusByItem.get(item.id) ?? null,
              operatingCheckRequired: Boolean(item.check_required?.length),
            }];
          }),
          dismissedProposalFingerprints: [],
        });
        freshRouteReport = {
          ...routeResult,
          proposal: routeResult.proposal
            ? {
              ...routeResult.proposal,
              basePlanFingerprint: planFingerprint(weatherDraft.items),
            }
            : null,
        };
      } catch (compositionRouteError: unknown) {
        routeErrorMessage = compositionRouteError instanceof Error
          ? compositionRouteError.message
          : '동선을 계산하지 못했어요.';
      }
    }

    if (currentPlanFingerprintRef.current !== sourceFingerprint) {
      setHarubanCompositionStatus('idle');
      setHarubanCompositionError('플랜이 변경되어 조합을 멈췄어요. 다시 눌러 주세요.');
      return;
    }

    const nextDraft = createHarubanPlanDraft({
      info,
      items: sourceItems,
      weatherReport: freshWeatherReport,
      routeReport: freshRouteReport,
      weatherError,
      routeError: routeErrorMessage,
    });
    setPdfWorkspace(createPlanPdfWorkspace({
      sourceItems,
      durationDays: info.durationDays,
      initialDraft: nextDraft,
      composition: nextDraft,
    }));
    setWorkspaceRevision((value) => value + 1);
    setHarubanCompositionStatus('done');
  };

  const handleRequestRoute = async () => {
    const endpoint = routeEndpoint;
    const currentDayCount = routePlanItems.filter((item) => item.day === routeActiveDay).length;
    if (!endpoint || currentDayCount < 2) {
      setRouteError('같은 Day에 좌표가 확인된 장소를 2곳 이상 담아 주세요.');
      return;
    }

    const weatherStatusByItem = new Map(
      (visibleWeatherReport?.impacts ?? []).map((impact) => [impact.item_id, impact.status]),
    );
    setRouteLoading(true);
    setRouteError(null);
    try {
      const response = await requestRoutePlan({
        mode: routeMode,
        origin: endpoint,
        destination: endpoint,
        items: routePlanItems.flatMap((item) => {
          const coordinate = resolveItemCoordinate(item);
          if (!coordinate || !item.day || !item.daypart) return [];
          return [{
            id: item.id,
            label: item.name,
            lat: coordinate.lat,
            lng: coordinate.lng,
            day: item.day,
            daypart: item.daypart,
            fixed: item.fixed ?? false,
            weatherStatus: weatherStatusByItem.get(item.id) ?? null,
            operatingCheckRequired: Boolean(item.check_required?.length),
          }];
        }),
        dismissedProposalFingerprints: routeDismissedFingerprints,
      });
      const proposal = response.proposal
        ? {...response.proposal, basePlanFingerprint: scheduledPlanFingerprint}
        : null;
      setRouteResponse({...response, proposal});
      setRouteBasisFingerprint(scheduledPlanFingerprint);
    } catch (routeRequestError: unknown) {
      setRouteResponse(null);
      setRouteBasisFingerprint(null);
      setRouteError(
        routeRequestError instanceof Error
          ? routeRequestError.message
          : '동선을 계산하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setRouteLoading(false);
    }
  };

  const handleLoadMoreCandidates = async (section: SectionDto) => {
    if (!section.next_cursor || candidatePageState[section.moment]?.loading) return;
    setCandidatePageState((current) => ({
      ...current,
      [section.moment]: { loading: true, error: null },
    }));
    try {
      const page = await requestCandidatePage(
        info,
        selectedMomentIds,
        section.moment,
        section.next_cursor,
      );
      setPackResp((previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          sections: previous.sections.map((current) => {
            if (current.moment !== section.moment) return current;
            return mergeCandidateSection(current, page);
          }),
        };
      });
      setCandidatePageState((current) => ({
        ...current,
        [section.moment]: { loading: false, error: null },
      }));
    } catch (candidateError: any) {
      setCandidatePageState((current) => ({
        ...current,
        [section.moment]: {
          loading: false,
          error: candidateError?.message || '다른 후보를 불러오지 못했습니다.',
        },
      }));
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function fetchPack() {
      setLoading(true);
      setError(null);
      try {
        const resp = await requestPack(info, selectedMomentIds);
        if (!cancelled) {
          setPackResp(resp);
          setCandidatePageState({});
        }
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

  useEffect(() => {
    let cancelled = false;
    if (weatherPlanItems.length === 0) {
      setWeatherReport(null);
      setWeatherReportError(null);
      setWeatherReportLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setWeatherReportLoading(true);
    setWeatherReportError(null);
    requestWeatherReport({
      startDate: info.startDate,
      days: info.durationDays,
      regions: Array.from(new Set(weatherPlanItems.map((item) => item.region))),
      items: weatherPlanItems,
      dismissedProposalFingerprints: weatherDismissedFingerprints,
    })
      .then((report) => {
        if (cancelled) return;
        const basePlanFingerprint = scheduledPlanFingerprint;
        setWeatherReport({
          ...report,
          proposals: report.proposals.map((proposal) => ({
            ...proposal,
            basePlanFingerprint,
          })),
        });
      })
      .catch((weatherError: unknown) => {
        if (cancelled) return;
        setWeatherReport(null);
        setWeatherReportError(
          weatherError instanceof Error
            ? weatherError.message
            : '날씨 리포트를 불러오지 못했습니다.',
        );
      })
      .finally(() => {
        if (!cancelled) setWeatherReportLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    info.startDate,
    info.durationDays,
    JSON.stringify(weatherPlanItems),
    JSON.stringify(weatherDismissedFingerprints),
    scheduledPlanFingerprint,
  ]);

  useEffect(() => {
    if (routeDays.length === 0) {
      setRouteActiveDay(1);
      return;
    }
    if (!routeDays.includes(routeActiveDay)) {
      setRouteActiveDay(routeDays[0]);
    }
  }, [routeDays, routeActiveDay]);

  useEffect(() => {
    if (!routeBasisFingerprint || routeBasisFingerprint === scheduledPlanFingerprint) return;
    setRouteResponse(null);
    setRouteBasisFingerprint(null);
    setRouteError(null);
  }, [routeBasisFingerprint, scheduledPlanFingerprint]);

  return (
    <div
      ref={dashboardRef}
      className="w-full max-w-[1500px] mx-auto"
      id="packing-dashboard"
      style={{ '--plan-sidebar-width': `${planSidebarWidth}px` } as React.CSSProperties}
    >
      <div className="grid gap-5 xl:gap-7 lg:grid-cols-[var(--plan-sidebar-width)_minmax(0,1fr)] lg:items-start">
        <div className="relative lg:sticky lg:top-6">
        <aside className="space-y-5 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2 pyj-side-scroll">
      {/* 요약 카드 */}
      <div
        className="rounded-[24px] border border-orange-100/60 bg-white shadow-pyj-card p-5 space-y-3"
        id="trip-summary"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">이번 제주 여행</h2>
          <button
            onClick={onReset}
            className="pyj-supporting-text inline-flex items-center gap-1 font-semibold transition hover:text-stone-900"
          >
            <RotateCcw className="w-3 h-3" /> 다시 세우기
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] text-stone-700">
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
          <div
            className="scroll-mt-6 pt-1 focus:outline-none"
            id="plan-export-actions"
            tabIndex={-1}
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={openPlanPdfEditor}
                disabled={selectedPlanItems.length === 0}
                className="rounded-2xl px-3 py-3 bg-citrus text-white font-serif-kr font-bold text-[13px] hover:bg-citrus-2 transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 shadow-jeju-chip"
              >
                <BookOpenCheck className="w-4 h-4" />
                여행 플랜 PDF
                <Download className="w-3.5 h-3.5 opacity-80" />
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
              PDF를 만들기 전에 Day·순서·여행 메모를 직접 다듬을 수 있어요.
            </p>
            {shareError && (
              <p className="mt-1.5 text-[10.5px] text-rose-700 text-center">
                {shareError}
              </p>
            )}
          </div>
        )}
      </div>

      {packResp && !loading && !error && (
        <PackJourneyGuide
          state={packJourneyState}
          onNavigate={navigateToPackSection}
        />
      )}

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

      {weatherPlanItems.length > 0 && (
        <WeatherDecisionReport
          report={visibleWeatherReport}
          planItems={selectedPlanItems}
          loading={weatherReportLoading}
          error={weatherReportError}
          onApply={onApplyWeatherProposal}
          onDismiss={onDismissWeatherProposal}
          canUndo={weatherUndoAvailable}
          onUndo={onUndoWeatherProposal}
          actionMessage={weatherActionMessage}
        />
      )}

      {packResp?.weather && (!visibleWeatherReport || weatherReportError) && (
        <WeatherSignalCard weather={packResp.weather} />
      )}

      {packResp && !loading && !error && (
        <TripMapCard
          items={mapPlanItems.length > 0 ? mapPlanItems : packItems}
          regions={info.regions}
          isPlanMap={mapPlanItems.length > 0}
        />
      )}

      {packResp && !loading && !error && routePlanItems.length > 0 && routeEndpoint && (
        <TravelRouteCard
          planItems={routePlanItems}
          activeDay={routeActiveDay}
          mode={routeMode}
          originLabel={routeEndpoint.label}
          destinationLabel={routeEndpoint.label}
          response={visibleRouteResponse}
          loading={routeLoading}
          error={routeError}
          canUndo={routeUndoAvailable}
          actionMessage={routeActionMessage}
          mapContent={activeRouteDay ? (
            <TravelRouteMap
              activeDay={routeActiveDay}
              dayRoute={activeRouteDay}
              planItems={routePlanItems}
              origin={routeEndpoint}
              destination={routeEndpoint}
              showRecommended
            />
          ) : undefined}
          onActiveDayChange={setRouteActiveDay}
          onModeChange={(mode) => {
            setRouteMode(mode);
            setRouteResponse(null);
            setRouteBasisFingerprint(null);
            setRouteError(null);
          }}
          onRequest={handleRequestRoute}
          onApply={onApplyRouteProposal}
          onDismiss={onDismissRouteProposal}
          onUndo={onUndoRouteProposal}
        />
      )}

      {packResp && !loading && !error && (
        <PlanBuilderCard
          planItems={selectedPlanItems}
          durationDays={info.durationDays}
          visitChecks={visitChecks}
          harubanDraft={harubanDraft}
          compositionStatus={harubanCompositionStatus}
          compositionError={harubanCompositionError}
          onComposeHarubanPlan={handleComposeHarubanPlan}
          onOpenHarubanDraft={openPlanPdfEditor}
          onDiscardHarubanDraft={() => {
            setPdfWorkspace(null);
            setWorkspaceRevision((value) => value + 1);
            setHarubanCompositionStatus('idle');
            setHarubanCompositionError(null);
          }}
          onAddCustomPlanItem={onAddCustomPlanItem}
          onRemovePlanItem={onRemovePlanItem}
          onUpdatePlanSchedule={handleUpdatePlanSchedule}
          onSetVisitCheck={onSetVisitCheck}
        />
      )}

      {packResp && !loading && !error && (
        <FeedbackSummaryCard
          planItems={selectedPlanItems}
          visitChecks={visitChecks}
          onOpenFeedback={onOpenFeedback}
        />
      )}
        </aside>
        <button
          type="button"
          onPointerDown={beginSidebarResize}
          onDoubleClick={resetSidebarWidth}
          className="absolute -right-[18px] top-0 bottom-0 z-20 hidden w-5 touch-none cursor-col-resize items-center justify-center lg:flex"
          title="드래그해서 플랜 영역 너비 조절 · 더블클릭으로 초기화"
          aria-label="플랜 영역 너비 조절"
        >
          <span className="flex h-16 w-4 items-center justify-center rounded-full border border-[#2D6F65]/35 bg-white/95 text-[#2D6F65] shadow-md transition hover:border-[#2D6F65]/65 hover:bg-[#F4FAF7]">
            <GripVertical className="h-4 w-4" />
          </span>
        </button>
        </div>

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
          className="scroll-mt-6 flex items-center gap-1 p-1 rounded-2xl bg-[#FDF6EA] border border-earth focus:outline-none"
          id="view-mode-tabs"
          tabIndex={-1}
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
            pageState={candidatePageState[section.moment]}
            onLoadMore={handleLoadMoreCandidates}
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
      {planPdfEditorOpen && (
        <Suspense fallback={<PdfEditorLoadingFallback />}>
          <PlanPdfEditor
            open
            info={info}
            selectedMomentIds={selectedMomentIds}
            selectedPlanItems={selectedPlanItems}
            packingItems={planPackingItems.map((suggestion) => suggestion.item)}
            initialDraft={pdfWorkspace?.draft}
            composition={harubanDraft}
            pendingSourceItems={pendingPlanPdfSourceItems}
            canUndoExclude={Boolean(pdfWorkspace?.excludedItems.length)}
            savedAt={pdfWorkspace?.updatedAt ?? null}
            workspaceRevision={String(workspaceRevision)}
            onDraftChange={(nextDraft) => {
              setPdfWorkspace((current) => current
                ? updatePlanPdfWorkspaceDraft(current, nextDraft)
                : current);
            }}
            onExcludeItem={(itemId) => {
              setPdfWorkspace((current) => current
                ? excludePlanPdfWorkspaceItem(current, itemId)
                : current);
              setWorkspaceRevision((value) => value + 1);
            }}
            onUndoExclude={() => {
              setPdfWorkspace((current) => current
                ? undoExcludedPlanPdfWorkspaceItem(
                  current,
                  info.durationDays,
                )
                : current);
              setWorkspaceRevision((value) => value + 1);
            }}
            onAddPendingItems={(itemIds) => {
              setPdfWorkspace((current) => current
                ? addPendingPlanPdfItems(
                  current,
                  selectedPlanItems,
                  itemIds,
                  info.durationDays,
                )
                : current);
              setWorkspaceRevision((value) => value + 1);
            }}
            onClose={() => setPlanPdfEditorOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

function PdfEditorLoadingFallback() {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-basalt/35 p-4 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="rounded-3xl border border-orange-100 bg-[#FFFDF8] px-7 py-6 text-center shadow-2xl">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-citrus" aria-hidden="true" />
        <p className="font-serif-kr text-[14px] font-bold text-basalt">여행 플랜 PDF 편집기를 준비하고 있어요…</p>
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
    if (item.source !== 'public_data') return true;
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
      className="scroll-mt-6 rounded-[28px] border border-orange-100/70 bg-white/88 p-5 shadow-pyj-card backdrop-blur-sm focus:outline-none"
      id="candidate-workbench-header"
      tabIndex={-1}
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
          <p className="pyj-supporting-text mt-1.5 max-w-2xl">
            장소명과 주소는 조회된 데이터만 사용하고, 날씨·이동·수정요청 신호는 카드 안에서 확인 필요 항목으로 분리합니다.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
          <WorkbenchMetric label={sourceLabel} value={`${signals.total}곳`} tone="base" />
          <WorkbenchMetric
            label="공공데이터 확인 후보"
            value={`${signals.verified}곳`}
            tone="mint"
            caption="장소명·주소 확인"
          />
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
  caption,
}: {
  label: string;
  value: string;
  tone: 'base' | 'mint' | 'citrus';
  caption?: string;
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
      {caption && <div className="mt-1 text-[9.5px] leading-snug opacity-70">{caption}</div>}
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
  durationDays,
  visitChecks,
  harubanDraft,
  compositionStatus,
  compositionError,
  onComposeHarubanPlan,
  onOpenHarubanDraft,
  onDiscardHarubanDraft,
  onAddCustomPlanItem,
  onRemovePlanItem,
  onUpdatePlanSchedule,
  onSetVisitCheck,
}: {
  planItems: TravelPlanItem[];
  durationDays: number;
  visitChecks: Record<string, VisitCheck>;
  harubanDraft: HarubanPlanDraft | null;
  compositionStatus: 'idle' | 'weather' | 'route' | 'done';
  compositionError: string | null;
  onComposeHarubanPlan: () => void;
  onOpenHarubanDraft: () => void;
  onDiscardHarubanDraft: () => void;
  onAddCustomPlanItem: (item: TravelPlanItem) => void;
  onRemovePlanItem: (itemId: string) => void;
  onUpdatePlanSchedule: (
    itemId: string,
    patch: Partial<Pick<TravelPlanItem, 'day' | 'daypart' | 'startTime' | 'fixed'>>,
  ) => void;
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
    <div
      className="card-jeju scroll-mt-6 p-5 space-y-4 focus:outline-none"
      id="my-plan-builder"
      tabIndex={-1}
    >
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

      <div className="overflow-hidden rounded-2xl border border-[#E6B48D] bg-gradient-to-br from-[#FFF4E8] via-white to-[#EDF7F2]">
        {harubanDraft ? (
          <div className="p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-citrus text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-extrabold text-basalt">
                  하루방이 여행 플랜 초안을 만들었어요.
                </p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-basalt-2">
                  <span className="block">날씨와 이동 동선을 반영한 추천안입니다.</span>
                  <span className="block">원본 플랜은 그대로 유지됩니다.</span>
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onOpenHarubanDraft}
                className="col-span-2 rounded-xl bg-citrus px-3 py-2.5 text-[11px] font-bold text-white transition hover:bg-citrus-2"
              >
                초안 확인하기
              </button>
              <button
                type="button"
                onClick={onComposeHarubanPlan}
                className="rounded-xl border border-earth bg-white px-3 py-2 text-[10.5px] font-bold text-basalt-2 transition hover:border-citrus"
              >
                다시 조합
              </button>
              <button
                type="button"
                onClick={onDiscardHarubanDraft}
                className="rounded-xl border border-earth bg-white px-3 py-2 text-[10.5px] font-bold text-basalt-2 transition hover:border-citrus"
              >
                내 플랜으로 돌아가기
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <button
              type="button"
              onClick={onComposeHarubanPlan}
              disabled={planItems.length === 0 || compositionStatus === 'weather'
                || compositionStatus === 'route'}
              className="flex w-full items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-citrus text-white shadow-sm">
                {compositionStatus === 'weather' || compositionStatus === 'route'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Sparkles className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-extrabold text-basalt">
                  {compositionStatus === 'weather'
                    ? '날씨를 확인하고 있어요'
                    : compositionStatus === 'route'
                      ? '이동 동선을 맞추고 있어요'
                      : '하루방 플랜 조합'}
                </span>
                <span className="mt-0.5 block text-[10.5px] leading-relaxed text-basalt-2">
                  담아둔 장소를 날씨와 동선에 맞춰 수정 가능한 일정 초안으로 만들어요.
                </span>
              </span>
            </button>
            {compositionError && (
              <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[10px] text-rose-700">
                {compositionError}
              </p>
            )}
          </div>
        )}
      </div>

      {planItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-earth bg-[#FDF6EA]/70 px-4 py-5 text-center">
          <p className="text-[12px] font-semibold text-basalt">아직 담은 장소가 없습니다.</p>
          <p className="mt-1 text-[10.5px] text-basalt-2 leading-relaxed">
            아래 추천 후보에서 `플랜에 담기`를 누르면 이곳에 일정 후보가 쌓입니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {planItems.map((item, index) => (
            <PlanItemRow
              key={item.id}
              item={item}
              index={index}
              durationDays={durationDays}
              visitCheck={visitChecks[item.id]}
              onRemovePlanItem={onRemovePlanItem}
              onUpdatePlanSchedule={onUpdatePlanSchedule}
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
  index,
  durationDays,
  visitCheck,
  onRemovePlanItem,
  onUpdatePlanSchedule,
  onSetVisitCheck,
}: {
  item: TravelPlanItem;
  index: number;
  durationDays: number;
  visitCheck?: VisitCheck;
  onRemovePlanItem: (itemId: string) => void;
  onUpdatePlanSchedule: (
    itemId: string,
    patch: Partial<Pick<TravelPlanItem, 'day' | 'daypart' | 'startTime' | 'fixed'>>,
  ) => void;
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
    <article className="relative overflow-hidden rounded-2xl border border-[#D8C3A4] bg-[#FFFCF7] p-3 pl-4 shadow-[0_5px_18px_-14px_rgba(46,50,53,0.55)] space-y-2 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-gradient-to-b before:from-citrus before:to-[#E8B36D]" aria-label={`${index + 1}번 플랜 장소 ${item.name}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-citrus/35 bg-citrus/10 text-[10px] font-extrabold text-citrus-2" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold border ${
              item.source === 'public_data'
                ? 'bg-mint/10 text-mint border-mint/20'
                : item.source === 'web_search'
                  ? 'bg-[#E9F4EE] text-[#2D6F65] border-[#2D6F65]/20'
                : 'bg-amber-50 text-amber-700 border-amber-100'
            }`}>
              {item.source === 'public_data'
                ? '공공데이터 후보'
                : item.source === 'web_search'
                  ? '하루방 웹검색'
                  : '사용자 추가'}
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
          {item.source === 'web_search' && item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[9.5px] font-semibold text-[#A84422] underline underline-offset-2"
            >
              {item.source_title || '검색 원문 보기'}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
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

      <div className="rounded-xl border border-[#E3D7C5] bg-white/75 p-2.5" aria-label={`${item.name} 일정 시간`}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-earth bg-white px-2.5 text-[10.5px] font-bold text-basalt-2">
            <Clock3 className="h-3.5 w-3.5 text-mint" />
            <span>날짜</span>
            <select
              aria-label={`${item.name} 여행 날짜`}
              value={item.day ?? 1}
              onChange={(event) => onUpdatePlanSchedule(item.id, {day: Number(event.target.value)})}
              className="bg-transparent text-[11px] font-bold text-basalt outline-none"
            >
              {Array.from({length: Math.max(1, durationDays)}, (_, dayIndex) => (
                <option key={dayIndex + 1} value={dayIndex + 1}>Day {dayIndex + 1}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-1 gap-1" aria-label={`${item.name} 시간대`}>
            {DAYPART_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={`${item.name} ${option.label}으로 설정`}
                aria-pressed={item.daypart === option.value}
                onClick={() => onUpdatePlanSchedule(item.id, {
                  daypart: option.value,
                  startTime: option.startTime,
                })}
                className={`min-h-11 flex-1 rounded-xl border px-2 py-2 text-[10.5px] font-bold transition ${
                  item.daypart === option.value
                    ? 'border-[#2D6F65] bg-[#E6F2EE] text-[#245B52]'
                    : 'border-earth bg-white text-basalt-2 hover:border-[#8CB7AD]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={Boolean(item.fixed)}
            aria-label={`${item.name} 시간 고정`}
            onClick={() => onUpdatePlanSchedule(item.id, {fixed: !item.fixed})}
            className={`inline-flex min-h-11 items-center gap-1 rounded-xl border px-3 py-2 text-[10.5px] font-bold transition ${
              item.fixed
                ? 'border-[#B75C36] bg-[#FFF0E8] text-[#994523]'
                : 'border-earth bg-white text-basalt-2 hover:border-[#D19A78]'
            }`}
          >
            <LockKeyhole className="h-3.5 w-3.5" /> 시간 고정
          </button>
        </div>
        <p className="mt-1.5 text-[9.5px] leading-relaxed text-basalt-2/70">
          {item.fixed
            ? '예약·약속이 있는 일정으로 표시되어 날씨 추천이 이동하지 않습니다.'
            : '날씨 변경안은 미리보기 후 직접 승인할 때만 반영됩니다.'}
        </p>
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
          {item.source === 'public_data'
            ? '이 메모는 원본을 바로 수정하지 않고 공공데이터 수정요청 신호로 분리해 저장됩니다.'
            : '이 메모는 검색 당시 출처와 분리된 사용자 방문 신호로 저장됩니다.'}
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
    </article>
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

function FeedbackSummaryCard({
  planItems,
  visitChecks,
  onOpenFeedback,
}: {
  planItems: TravelPlanItem[];
  visitChecks: Record<string, VisitCheck>;
  onOpenFeedback: () => void;
}) {
  const dashboard = buildFeedbackDashboard(planItems, visitChecks);
  return (
    <div className="rounded-[20px] border border-mint/25 bg-[#F4FBF8] p-4 shadow-pyj-card">
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-mint">
        <ClipboardCheck className="h-3 w-3" /> 여행 피드백
      </span>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <strong className="font-serif-kr text-[22px] text-basalt">{dashboard.total}건</strong>
          <p className="mt-0.5 text-[10.5px] text-basalt-2">
            변경·불일치 {dashboard.changed}건 · 수정요청 {dashboard.queued}건
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenFeedback}
          className="shrink-0 rounded-full border border-mint/30 bg-white px-3 py-1.5 text-[10.5px] font-bold text-mint transition hover:bg-mint hover:text-white"
        >
          전체 보기 →
        </button>
      </div>
    </div>
  );
}

function LegacyTrustFeedbackLoopCard({
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
            <div className="flex flex-wrap justify-end gap-1.5">
              <span className="rounded-full border border-mint/20 bg-white/80 px-2 py-0.5 text-[9.5px] font-bold text-mint">
                내부 대시보드 기록
              </span>
              <button
                type="button"
                onClick={() => downloadFeedbackDashboard(dashboard, 'csv')}
                className="inline-flex items-center gap-1 rounded-full border border-mint/20 bg-white/90 px-2 py-0.5 text-[9.5px] font-bold text-mint transition hover:bg-mint/10"
              >
                <Download className="h-3 w-3" />
                CSV
              </button>
              <button
                type="button"
                onClick={() => downloadFeedbackDashboard(dashboard, 'json')}
                className="inline-flex items-center gap-1 rounded-full border border-mint/20 bg-white/90 px-2 py-0.5 text-[9.5px] font-bold text-mint transition hover:bg-mint/10"
              >
                JSON
              </button>
            </div>
          </div>
          {dashboard.entries.slice(0, 4).map((entry) => (
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
    entries,
  };
}

function downloadFeedbackDashboard(
  dashboard: FeedbackDashboardSummary,
  format: 'csv' | 'json',
) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `jeju-damda-feedback-dashboard-${stamp}.${format}`;
  const content = format === 'csv'
    ? buildFeedbackDashboardCsv(dashboard)
    : JSON.stringify({
        exported_at: new Date().toISOString(),
        summary: {
          total: dashboard.total,
          queued: dashboard.queued,
          changed: dashboard.changed,
          score_delta: dashboard.scoreDelta,
        },
        entries: dashboard.entries,
      }, null, 2);
  const mime = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';
  const blob = new Blob([format === 'csv' ? `\uFEFF${content}` : content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildFeedbackDashboardCsv(dashboard: FeedbackDashboardSummary): string {
  const header = [
    'place_name',
    'visit_status',
    'feedback_memo',
    'trust_score_change',
    'public_data_queue_status',
    'queued',
    'updated_at',
  ];
  const rows = dashboard.entries.map((entry) => [
    entry.name,
    entry.statusLabel,
    entry.memo ?? '',
    entry.scoreLabel ?? '',
    entry.queueLabel ?? '로컬 기록',
    entry.queued ? 'Y' : 'N',
    entry.updatedAt,
  ]);
  return [header, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
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
      const source = item.source === 'public_data'
        ? shareBadgeLabel(item.badge ?? 'reference')
        : item.source === 'web_search'
          ? '하루방 웹검색 출처'
          : '검증 전 메모';
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
    <div className="mb-0.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-[#2E6D61]">
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
  // VisitJeju 대표사진을 우선 사용하고, 기존 ITS 이미지 키도 호환한다.
  const media = (it.amenities ?? {}) as Record<string, unknown>;
  const thumbnail = [media.thumbnail_path, media.image_path, media.img_path]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
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
              <span className="rounded-full border border-mint/35 bg-mint/10 px-2 py-0.5 text-[11px] font-bold text-[#275E53]">
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
            <span className="ml-auto text-[11px] font-semibold text-[#2E6D61]">
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
              <FixRequestEvidence fixRequest={it.fix_request} />
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

function FixRequestEvidence({ fixRequest }: { fixRequest?: PackItemDto['fix_request'] }) {
  const requests = fixRequest?.requests?.filter(Boolean) ?? [];
  if (!fixRequest || requests.length === 0) return null;

  return (
    <details className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-950">
      <summary className="cursor-pointer font-bold text-amber-900">
        수정요청 내용 보기 · 총 {fixRequest.count}건 중 최근 {requests.length}건
      </summary>
      <div className="mt-2 space-y-2">
        {requests.map((request, idx) => (
          <div key={`${request.request_id ?? idx}`} className="rounded-lg bg-white/70 border border-amber-100 p-2">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                {request.change_type_label ?? '수정요청'}
              </span>
              {request.request_id && (
                <span className="text-[10px] text-amber-800/70">요청 #{request.request_id}</span>
              )}
            </div>
            {request.before_text && (
              <p className="leading-relaxed">
                <span className="font-bold">기존/표기 내용: </span>
                {request.before_text}
              </p>
            )}
            {request.after_text && (
              <p className="leading-relaxed">
                <span className="font-bold">요청된 수정 내용: </span>
                {request.after_text}
              </p>
            )}
            {!request.before_text && !request.after_text && request.display_text && (
              <p className="leading-relaxed">
                <span className="font-bold">요청 내용: </span>
                {request.display_text}
              </p>
            )}
            <p className="mt-1 text-[10px] leading-relaxed text-amber-800/80">
              수정요청은 확정 변경이 아니라 방문 전 확인이 필요한 공공데이터 신호입니다.
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}

function SectionCard({
  section,
  selectedPlanIds,
  onTogglePlanItem,
  pageState,
  onLoadMore,
}: {
  section: SectionDto;
  selectedPlanIds: Set<string>;
  onTogglePlanItem: (item: TravelPlanItem) => void;
  pageState?: { loading: boolean; error: string | null };
  onLoadMore: (section: SectionDto) => void;
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
        {!section.fallback && section.items.length > 0 && section.total_count !== undefined ? (
          <span
            data-testid={`candidate-progress-${section.moment}`}
            className="ml-auto text-[10.5px] font-bold text-basalt-2/60"
          >
            전체 {section.total_count.toLocaleString()}곳 중 {section.items.length.toLocaleString()}곳
          </span>
        ) : !section.fallback && section.items.length > 0 ? (
          <span className="ml-auto text-[10.5px] font-bold text-basalt-2/60 uppercase tracking-wider">
            {section.items.length}곳
          </span>
        ) : null}
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
        <>
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

          {section.total_count !== undefined && (
          <div className="border-t border-earth/70 pt-3 text-center">
            {pageState?.error && (
              <p className="mb-2 text-[11px] font-medium text-rose-700" role="alert">
                {pageState.error}
              </p>
            )}
            {section.has_more && section.next_cursor ? (
              <button
                type="button"
                onClick={() => onLoadMore(section)}
                disabled={pageState?.loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-citrus/30 bg-citrus/10 px-5 text-[12px] font-bold text-citrus-2 transition hover:border-citrus/60 hover:bg-citrus/15 disabled:cursor-wait disabled:opacity-60"
              >
                {pageState?.loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    다른 후보를 불러오는 중
                  </>
                ) : (
                  '다른 후보 5곳 보기'
                )}
              </button>
            ) : hasFinishedCandidateSection(section) ? (
              <p className="text-[11px] font-semibold text-basalt-2/70">
                전체 후보를 모두 확인했습니다.
              </p>
            ) : null}
          </div>
          )}
        </>
      )}
    </div>
  );
}

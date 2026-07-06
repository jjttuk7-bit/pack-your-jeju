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
} from 'lucide-react';
import type {
  TravelInfo,
  MomentId,
  PackResponse,
  SectionDto,
  ItineraryDayDto,
  ItineraryItemDto,
  PackItemDto,
} from '../types';
import { MOMENTS, REGIONS, COMPANIONS, PURPOSES } from '../data';
import { requestPack, downloadPackPdf } from '../api';
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
  onToggleItem: (itemId: string) => void;
  onToggleMemory: (memoryId: string) => void;
  onAddCustomBasic: (itemName: string) => void;
  onRemoveCustomBasic: (itemName: string) => void;
  onAddCustomMomentItem: (momentId: MomentId, itemName: string) => void;
  onRemoveCustomMomentItem: (momentId: MomentId, itemName: string) => void;
  onAddCustomMemory: (memoryText: string) => void;
  onRemoveCustomMemory: (memoryText: string) => void;
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

export default function PackingDashboard(props: Props) {
  const { info, selectedMomentIds, checkedItemIds, onToggleItem, onReset } = props;

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

  const handleDownloadPdf = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const { filename, blob } = await downloadPackPdf(info, selectedMomentIds);
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
  const shareText = useMemo(
    () => packResp ? buildShareText(info, selectedMomentIds, packResp) : '',
    [info, selectedMomentIds, packResp]
  );

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
    if (selectedMomentIds.length > 0) fetchPack();
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
    JSON.stringify(selectedMomentIds),
  ]);

  return (
    <div className="w-full max-w-md mx-auto space-y-5" id="packing-dashboard">
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
                onClick={handleDownloadPdf}
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
                    여행플랜 저장
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
              공공데이터 근거로 확인된 곳을 담고, 근거가 부족한 항목은 별도로 안내합니다.
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

      {packResp && !loading && !error && (
        <TripMapCard
          items={packItems}
          regions={info.regions}
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
          <SectionCard section={section} />
        </React.Fragment>
      ))}

      {/* 요일별 뷰 (검증된 items를 규칙 기반 재배치) */}
      {viewMode === 'itinerary' && packResp?.itinerary?.map((day) => (
        <ItineraryDayCard key={day.day} day={day} />
      ))}

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

function buildShareText(
  info: TravelInfo,
  selectedMomentIds: MomentId[],
  packResp: PackResponse,
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
  const itinerary = packResp.itinerary ?? [];
  const planLines = itinerary.length > 0
    ? itinerary.flatMap((day) => buildShareDayLines(day))
    : collectPackItems(packResp).slice(0, 8).map((item, idx) =>
      `${idx + 1}. ${item.name} (${shareBadgeLabel(item.badge)})`);
  const gapLines = collectUnavailableCombos(packResp).slice(0, 5);
  const url = typeof window !== 'undefined' ? window.location.href : 'https://pack-your-jeju.vercel.app/';
  return [
    'Pack Your Jeju 여행플랜',
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
    ...(planLines.length > 0 ? planLines : ['아직 공유할 후보가 없습니다.']),
    ...(gapLines.length > 0 ? ['', '데이터가 부족한 조합 메모', ...gapLines.map((x) => `- ${x}`)] : []),
    '',
    '장소별 근거와 주의 신호는 Pack Your Jeju에서 확인할 수 있어요.',
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

function buildShareDayLines(day: ItineraryDayDto): string[] {
  const regionLabel = (day.regions ?? [])
    .map((r) => REGIONS.find((x) => x.value === r)?.label ?? r)
    .join(' · ');
  const header = `Day ${day.day} (${day.date}${regionLabel ? ` · ${regionLabel}` : ''})`;
  const itemLines = (day.items ?? []).slice(0, 4).map((item, idx) => {
    const moment = MOMENTS.find((m) => m.id === item.moment)?.title ?? item.moment;
    return `- ${shareSlotLabel(item, idx)}: ${item.name} (${moment} · ${shareBadgeLabel(item.badge)})`;
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

function resolveItemCoordinate(item: PackItemDto): { lat: number; lng: number } | null {
  const raw = item as any;
  const amenities = (item.amenities ?? {}) as Record<string, unknown>;
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
}: {
  items: PackItemDto[];
  regions: TravelInfo['regions'];
}) {
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const [mapStatus, setMapStatus] = useState<'idle' | 'ready' | 'fallback'>('idle');
  const naverKey = import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined;
  const markerItems = useMemo(
    () => items
      .map((item) => ({ item, coord: resolveItemCoordinate(item) }))
      .filter((x): x is { item: PackItemDto; coord: { lat: number; lng: number } } => !!x.coord)
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
        setMapStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setMapStatus('fallback');
      });

    return () => {
      cancelled = true;
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
            선택한 제주를 한눈에 보기
          </h3>
        </div>
        <span className="rounded-full border border-earth bg-[#FDF6EA] px-2 py-1 text-[10px] font-semibold text-basalt-2">
          마커 {markerItems.length}곳
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-earth bg-[#FDF6EA]">
        <div ref={mapRef} className="h-[220px] w-full">
          {mapStatus !== 'ready' && <FallbackJejuMap regions={regions} />}
        </div>
      </div>

      <p className="text-[10.5px] text-basalt-2 leading-relaxed">
        좌표가 확인된 장소만 지도 마커로 표시합니다. 좌표가 없는 장소는 아래 장소 카드의 근거와 주소에서 확인해 주세요.
      </p>
    </div>
  );
}

function FallbackJejuMap({ regions }: { regions: TravelInfo['regions'] }) {
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
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
        <p className="font-serif-kr text-[15px] font-bold text-basalt">
          {labels.length > 0 ? labels.join(' · ') : '제주'} 중심 여행팩
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-basalt-2">
          네이버 지도 키 또는 좌표가 준비되면 이 영역에 장소 마커가 표시됩니다.
        </p>
      </div>
    </div>
  );
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

function ItineraryDayCard({ day }: { day: ItineraryDayDto }) {
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
            <ItineraryItemRow key={`${it.external_id}-${day.day}`} it={it} />
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

function ItineraryItemRow({ it }: { it: ItineraryItemDto }) {
  const moment = MOMENTS.find((m) => m.id === it.moment);
  const momentTitle = moment?.title ?? String(it.moment);
  const momentHeader = (
    <div className="flex items-center gap-1.5 text-[10px] text-orange-700/80 font-semibold uppercase tracking-wider mb-0.5">
      {moment && <MomentIcon id={moment.id as any} className="w-3.5 h-3.5" />}
      <span>{momentTitle}</span>
    </div>
  );
  return <PackItemCard it={it} header={momentHeader} />;
}

// 팩 아이템 하나 = 클릭 시 확장. 헤더(장소명·배지·요약 뱃지)만 접혀 있고, 열면 PlaceDetail 노출.
// 요일별 뷰와 순간별 뷰가 공유. 순간 라벨은 부모(요일별 뷰)에서 header prop으로 주입.
function PackItemCard({
  it,
  header,
}: {
  it: PackItemDto;
  header?: React.ReactNode;
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
            <span className="text-stone-400">· {it.freshness.info_type}</span>
          )}
          {!open && (
            <span className="ml-auto text-[10px] text-citrus-2/80 font-semibold">
              자세히 보기 →
            </span>
          )}
        </div>
      </button>

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

function SectionCard({ section }: { section: SectionDto }) {
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
        <div className="space-y-2">
          {section.items.map((it) => (
            <PackItemCard key={it.external_id} it={it} />
          ))}
        </div>
      )}
    </div>
  );
}

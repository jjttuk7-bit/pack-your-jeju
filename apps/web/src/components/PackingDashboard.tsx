import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
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
} from 'lucide-react';
import type {
  TravelInfo,
  MomentId,
  PackResponse,
  SectionDto,
} from '../types';
import { MOMENTS, REGIONS, COMPANIONS, PURPOSES } from '../data';
import { requestPack } from '../api';
import Badge from './Badge';

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

  const regionLabel = useMemo(
    () => REGIONS.find((r) => r.value === info.region)?.label ?? info.region,
    [info.region]
  );
  const companionLabel = useMemo(
    () => COMPANIONS.find((c) => c.value === info.companion)?.label ?? info.companion,
    [info.companion]
  );
  const purposeLabel = useMemo(
    () => PURPOSES.find((p) => p.value === info.purpose)?.label ?? info.purpose,
    [info.purpose]
  );

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
    info.region,
    info.startDate,
    info.durationDays,
    info.companion,
    info.purpose,
    JSON.stringify(selectedMomentIds),
  ]);

  return (
    <div className="w-full max-w-md mx-auto space-y-6" id="packing-dashboard">
      {/* 요약 카드 */}
      <div
        className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-100/50 p-5 space-y-3"
        id="trip-summary"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">이번 제주 여행</h2>
          <button
            onClick={onReset}
            className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3 h-3" /> 다시 세우기
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <SummaryLine icon={<MapPin className="w-3.5 h-3.5" />} label={regionLabel} />
          <SummaryLine
            icon={<Calendar className="w-3.5 h-3.5" />}
            label={`${info.startDate} · ${info.durationDays}일`}
          />
          <SummaryLine icon={<Users className="w-3.5 h-3.5" />} label={companionLabel} />
          <SummaryLine icon={<Compass className="w-3.5 h-3.5" />} label={purposeLabel} />
        </div>
      </div>

      {/* Intro 문구 (LLM 조립 or 템플릿 폴백) */}
      {packResp?.intro && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-orange-50/60 border border-orange-100 p-4 text-xs text-orange-950 leading-relaxed"
          id="intro-copy"
        >
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-650 mb-1.5">
            <Sparkles className="w-3 h-3" />
            {packResp.intro.llm_used ? 'AI 조립 문구' : '템플릿 문구 (LLM 미사용)'}
          </span>
          <p>{packResp.intro.text}</p>
        </motion.div>
      )}

      {/* 로딩 · 에러 */}
      {loading && (
        <div className="text-center py-10 text-slate-500 text-xs" id="pack-loading">
          <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin text-orange-500" />
          공공데이터에서 근거를 모으는 중…
        </div>
      )}
      {error && (
        <div
          className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs text-rose-800 space-y-2"
          id="pack-error"
        >
          <div className="flex items-center gap-1 font-bold">
            <ShieldAlert className="w-4 h-4" />
            서버 연결 실패
          </div>
          <div className="font-mono text-[10px] break-all">{error}</div>
          <p className="text-[10px] leading-relaxed text-rose-700">
            백엔드 URL을 확인해 주세요. Vercel 배포는 <code>VITE_API_BASE_URL</code> 환경변수로,
            로컬은 <code>uvicorn apps.api.main:app --port 8000</code> 실행 필요.
          </p>
        </div>
      )}

      {/* 순간별 섹션 (백엔드 응답) */}
      {packResp?.sections?.map((section) => (
        <React.Fragment key={section.moment}>
          <SectionCard section={section} />
        </React.Fragment>
      ))}

      {/* 기본 체크리스트 */}
      <div
        className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-100/50 p-5 space-y-3"
        id="basic-checklist"
      >
        <h2 className="text-sm font-bold text-slate-800">기본 짐 체크리스트</h2>
        <p className="text-[10px] text-slate-500">제주 여행 공통 필수 · 개인 취향으로 체크</p>
        <div className="space-y-1.5">
          {BASIC_CHECKLIST.map((item, idx) => {
            const id = `basic-${idx}`;
            const checked = checkedItemIds.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggleItem(id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition text-left"
              >
                {checked ? (
                  <CheckSquare className="w-4 h-4 text-orange-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-300" />
                )}
                <span
                  className={`text-xs ${
                    checked ? 'line-through text-slate-400' : 'text-slate-700'
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

function SummaryLine({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="font-medium truncate">{label}</span>
    </div>
  );
}

function SectionCard({ section }: { section: SectionDto }) {
  const moment = MOMENTS.find((m) => m.id === section.moment);
  const title = moment?.title ?? section.moment;
  const emoji = moment?.emoji ?? '📍';

  return (
    <div
      className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-100/50 p-5 space-y-3"
      id={`section-${section.moment}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <h3 className="font-bold text-sm text-slate-800">{title}</h3>
      </div>

      {section.fallback ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3 text-xs text-amber-900">
          <div className="font-bold mb-1">
            {section.fallback.reason === 'coverage_gap' && '데이터 커버리지 밖'}
            {section.fallback.reason === 'contradicted' && '반증 확인됨'}
            {section.fallback.reason === 'retrieval_miss' && '검색 결과 없음'}
            {section.fallback.reason === 'out_of_scope' && '범위 밖'}
          </div>
          <p className="leading-relaxed">{section.fallback.message}</p>
        </div>
      ) : section.items.length === 0 ? (
        <p className="text-xs text-slate-400">결과가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {section.items.map((it) => (
            <div
              key={it.external_id}
              className="p-3 rounded-2xl border border-slate-100 bg-slate-50/30"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-800">{it.name}</div>
                </div>
                <Badge kind={it.badge} note={it.note} />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-1">
                {it.transit.parking && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100">
                    <ParkingCircle className="w-3 h-3" /> 주차 {it.transit.parking_count}
                  </span>
                )}
                {it.transit.bus_walkable && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100">
                    <Bus className="w-3 h-3" /> 정류장 근접
                  </span>
                )}
                {it.freshness?.info_type && (
                  <span className="text-slate-400">
                    · {it.freshness.info_type}
                  </span>
                )}
              </div>

              {it.sources?.length > 0 && (
                <div className="mt-1.5">
                  {it.sources.map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-orange-700 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {s.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

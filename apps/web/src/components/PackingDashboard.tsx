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
import MomentIcon from './marks/MomentIcon';

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

      {/* 순간별 섹션 (백엔드 응답) */}
      {packResp?.sections?.map((section) => (
        <React.Fragment key={section.moment}>
          <SectionCard section={section} />
        </React.Fragment>
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
            <div
              key={it.external_id}
              className="p-3.5 rounded-2xl border border-stone-100 bg-[#FDFBF7] hover:border-orange-200 transition"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13.5px] text-stone-900 leading-snug">{it.name}</div>
                </div>
                <Badge kind={it.badge} note={it.note} />
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
              </div>

              {it.sources?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-stone-100">
                  {it.sources.map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10.5px] font-medium text-orange-700 hover:underline"
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

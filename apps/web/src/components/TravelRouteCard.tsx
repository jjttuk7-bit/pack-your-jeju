import React from 'react';
import {
  Bus,
  Car,
  Clock3,
  Footprints,
  Loader2,
  MapPin,
  Navigation,
  RotateCcw,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';

import type {
  RouteChangeProposal,
  RouteMode,
  RoutePlanResponse,
  RouteStatus,
  TravelPlanItem,
} from '../types';


interface TravelRouteCardProps {
  planItems: TravelPlanItem[];
  activeDay: number;
  mode: RouteMode;
  originLabel: string;
  destinationLabel: string;
  response: RoutePlanResponse | null;
  loading: boolean;
  error: string | null;
  canUndo: boolean;
  actionMessage: string | null;
  mapContent?: React.ReactNode;
  onActiveDayChange: (day: number) => void;
  onModeChange: (mode: RouteMode) => void;
  onRequest: () => void;
  onApply: (proposal: RouteChangeProposal) => void;
  onDismiss: (proposal: RouteChangeProposal) => void;
  onUndo: () => void;
}


const MODE_OPTIONS: Array<{
  value: RouteMode;
  label: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {value: 'driving', label: '자동차', icon: Car},
  {value: 'transit', label: '대중교통', icon: Bus},
  {value: 'walking', label: '도보', icon: Footprints},
];


export default function TravelRouteCard({
  planItems,
  activeDay,
  mode,
  originLabel,
  destinationLabel,
  response,
  loading,
  error,
  canUndo,
  actionMessage,
  mapContent,
  onActiveDayChange,
  onModeChange,
  onRequest,
  onApply,
  onDismiss,
  onUndo,
}: TravelRouteCardProps) {
  const days = Array.from(new Set(
    planItems.map((item) => item.day).filter((day): day is number => Boolean(day)),
  )).sort((a, b) => a - b);
  const activeRoute = response?.days.find((day) => day.day === activeDay) ?? null;
  const itemById = new Map(planItems.map((item) => [item.id, item]));
  const planCount = planItems.filter((item) => item.day === activeDay).length;
  const status = activeRoute?.recommended.status ?? response?.status ?? null;

  return (
    <section
      className="overflow-hidden rounded-[26px] border border-[#D8C6A8] bg-[#FFFDF8] shadow-pyj-card"
      aria-labelledby="travel-route-title"
    >
      <div className="relative overflow-hidden border-b border-[#E9DCC8] bg-[linear-gradient(125deg,#F7EBD7_0%,#FFF9EE_52%,#E6F1EA_100%)] px-5 py-5">
        <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full border-[22px] border-white/35" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#C95632]">
              <RouteIcon className="h-3.5 w-3.5" aria-hidden="true" />
              My Travel Route
            </span>
            <h3 id="travel-route-title" className="font-serif-kr text-[18px] font-bold tracking-tight text-basalt">
              내 여행 동선
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-basalt-2">
              현재 순서를 지키면서 이동 부담을 줄일 수 있는 흐름을 비교합니다.
            </p>
          </div>
          {status ? <RouteStatusBadge status={status} /> : null}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div role="tablist" aria-label="여행 날짜" className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => (
            <button
              key={day}
              type="button"
              role="tab"
              aria-selected={activeDay === day}
              onClick={() => onActiveDayChange(day)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-[12px] font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6F65] ${
                activeDay === day
                  ? 'border-[#2D6F65] bg-[#2D6F65] text-white shadow-sm'
                  : 'border-[#D8C6A8] bg-white text-basalt hover:bg-[#F7F1E6]'
              }`}
            >
              Day {day}
            </button>
          ))}
        </div>

        <fieldset>
          <legend className="mb-2 text-[11px] font-bold text-basalt">이동수단</legend>
          <div className="grid grid-cols-3 gap-2">
            {MODE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <label
                  key={option.value}
                  className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-bold transition ${
                    mode === option.value
                      ? 'border-[#D7613B] bg-[#FFF1E8] text-[#A53C1F]'
                      : 'border-[#E3DDD0] bg-white text-basalt-2 hover:bg-[#FAF7F0]'
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="route-mode"
                    value={option.value}
                    checked={mode === option.value}
                    onChange={() => onModeChange(option.value)}
                  />
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[#E3DDD0] bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[12px] font-bold text-basalt">
            <MapPin className="h-4 w-4 shrink-0 text-[#D7613B]" aria-hidden="true" />
            <span className="truncate">{originLabel} → {destinationLabel}</span>
          </div>
          <span className="shrink-0 text-[10px] font-semibold text-basalt-2">출발·도착</span>
        </div>

        {mapContent}

        {activeRoute ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <RouteSummaryBlock
              eyebrow="현재 동선"
              itemIds={activeRoute.current_item_ids}
              totalDuration={activeRoute.current.total_duration_s}
              totalDistance={activeRoute.current.total_distance_m}
              itemById={itemById}
            />
            <RouteSummaryBlock
              eyebrow="추천 동선"
              itemIds={activeRoute.recommended_item_ids}
              totalDuration={activeRoute.recommended.total_duration_s}
              totalDistance={activeRoute.recommended.total_distance_m}
              itemById={itemById}
              recommended
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D8C6A8] bg-[#FBF6EC] px-4 py-4 text-[11px] leading-relaxed text-basalt-2">
            Day {activeDay}의 장소를 연결해 이동시간과 거리를 비교해 보세요.
          </div>
        )}

        {response?.proposal ? (
          <article className="rounded-2xl border border-[#F0B59F] bg-[#FFF5EF] p-4" aria-label="추천 동선 변경안">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#D7613B]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <strong className="text-[12px] text-basalt">
                  {formatDuration(response.proposal.saved_duration_s)} 절약 · {formatDistance(response.proposal.saved_distance_m)} 단축
                </strong>
                <ul className="mt-2 space-y-1 text-[10.5px] leading-relaxed text-basalt-2">
                  {response.proposal.reasons.map((reason) => <li key={reason}>· {reason}</li>)}
                </ul>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onApply(response.proposal!)}
                className="min-h-11 rounded-xl bg-[#D7613B] px-4 text-[12px] font-bold text-white transition hover:bg-[#B94727] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8F351D]"
              >
                이 순서로 적용
              </button>
              <button
                type="button"
                onClick={() => onDismiss(response.proposal!)}
                className="min-h-11 rounded-xl border border-[#D8C6A8] bg-white px-4 text-[12px] font-bold text-basalt transition hover:bg-[#FAF7F0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6F65]"
              >
                기존 일정 유지
              </button>
            </div>
          </article>
        ) : null}

        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#FFF0EC] px-3 py-3 text-[11px] text-[#9D3B25]">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}

        {actionMessage ? <p role="status" className="text-[11px] text-[#2D6F65]">{actionMessage}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRequest}
            disabled={loading || planCount < 2}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#D7613B] bg-white px-4 text-[12px] font-bold text-[#B94727] transition hover:bg-[#FFF5EF] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8F351D]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Navigation className="h-4 w-4" aria-hidden="true" />}
            {loading ? '동선 계산 중' : '동선 추천받기'}
          </button>
          {canUndo ? (
            <button
              type="button"
              onClick={onUndo}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#2D6F65] bg-[#EEF7F3] px-4 text-[12px] font-bold text-[#215B53] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6F65]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              되돌리기
            </button>
          ) : null}
        </div>

        {planCount < 2 ? (
          <p className="text-[10.5px] text-basalt-2">같은 Day에 장소를 2곳 이상 담으면 동선을 비교할 수 있습니다.</p>
        ) : null}
      </div>
    </section>
  );
}


function RouteStatusBadge({status}: {status: RouteStatus}) {
  const content: Record<RouteStatus, {label: string; className: string; icon: React.ReactNode}> = {
    verified_route: {
      label: '실제 경로 확인',
      className: 'border-[#9BC8B7] bg-[#EDF7F2] text-[#1F6257]',
      icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />,
    },
    estimated_route: {
      label: '예상 동선',
      className: 'border-[#E4C487] bg-[#FFF7E5] text-[#8A5A13]',
      icon: <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />,
    },
    mixed_route: {
      label: '일부 예상',
      className: 'border-[#E4C487] bg-[#FFF7E5] text-[#8A5A13]',
      icon: <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />,
    },
    unavailable: {
      label: '경로 확인 불가',
      className: 'border-[#E7B3A7] bg-[#FFF0EC] text-[#9D3B25]',
      icon: <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />,
    },
  };
  const selected = content[status];
  return (
    <span className={`relative inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[10px] font-bold ${selected.className}`}>
      {selected.icon}
      {selected.label}
    </span>
  );
}


function RouteSummaryBlock({
  eyebrow,
  itemIds,
  totalDuration,
  totalDistance,
  itemById,
  recommended = false,
}: {
  eyebrow: string;
  itemIds: string[];
  totalDuration: number;
  totalDistance: number;
  itemById: Map<string, TravelPlanItem>;
  recommended?: boolean;
}) {
  const names = itemIds.map((itemId) => itemById.get(itemId)?.name ?? itemId);
  return (
    <article className={`rounded-2xl border p-4 ${recommended ? 'border-[#A9CFC1] bg-[#F0F8F4]' : 'border-[#E3DDD0] bg-white'}`}>
      <span className={`text-[10px] font-extrabold uppercase tracking-[0.12em] ${recommended ? 'text-[#2D6F65]' : 'text-basalt-2'}`}>
        {eyebrow}
      </span>
      <p className="mt-2 text-[11px] font-semibold leading-relaxed text-basalt">
        {names.join(' → ')}
      </p>
      <p className="mt-3 text-[12px] font-bold text-basalt">
        {formatDuration(totalDuration)} · {formatDistance(totalDistance)}
      </p>
    </article>
  );
}


function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${minutes}분`;
  if (remainder === 0) return `${hours}시간`;
  return `${hours}시간 ${remainder}분`;
}


function formatDistance(meters: number): string {
  if (meters < 1_000) return `${Math.max(0, Math.round(meters))}m`;
  return `${new Intl.NumberFormat('ko-KR', {maximumFractionDigits: 1}).format(meters / 1_000)}km`;
}

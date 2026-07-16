import {useMemo, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CloudRain,
  CloudSun,
  Clock3,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Umbrella,
  Wind,
} from 'lucide-react';

import {REGIONS} from '../data';
import type {
  Daypart,
  TravelPlanItem,
  WeatherChangeProposal,
  WeatherDecisionStatus,
  WeatherReportResponse,
} from '../types';


interface Props {
  report: WeatherReportResponse | null;
  planItems: TravelPlanItem[];
  loading?: boolean;
  error?: string | null;
  onApply: (proposal: WeatherChangeProposal) => void;
  onDismiss: (proposal: WeatherChangeProposal) => void;
  canUndo?: boolean;
  onUndo?: () => void;
  actionMessage?: string | null;
}


const STATUS_COPY: Record<WeatherDecisionStatus, {
  label: string;
  tone: string;
  icon: typeof CloudSun;
}> = {
  unknown: {
    label: '판단 보류',
    tone: 'border-stone-200 bg-stone-50 text-stone-700',
    icon: AlertTriangle,
  },
  suitable: {
    label: '일정 유지 가능',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: CheckCircle2,
  },
  prepare: {
    label: '준비 권장',
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: Umbrella,
  },
  adjust: {
    label: '조정 권장',
    tone: 'border-orange-200 bg-orange-50 text-orange-900',
    icon: CloudRain,
  },
  official_check: {
    label: '공식 확인 필요',
    tone: 'border-sky-200 bg-sky-50 text-sky-900',
    icon: ShieldCheck,
  },
};

const DAYPART_LABEL: Record<Daypart, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
};


function regionLabel(region: string): string {
  return REGIONS.find((item) => item.value === region)?.label ?? region;
}


function dateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}


function temperatureLabel(min?: number | null, max?: number | null): string | null {
  if (min == null && max == null) return null;
  if (min == null) return `${max}℃`;
  if (max == null || min === max) return `${min}℃`;
  return `${min}–${max}℃`;
}


export default function WeatherDecisionReport({
  report,
  planItems,
  loading = false,
  error = null,
  onApply,
  onDismiss,
  canUndo = false,
  onUndo,
  actionMessage = null,
}: Props) {
  const [openProposalId, setOpenProposalId] = useState<string | null>(null);
  const dates = useMemo(
    () => Array.from(new Set(report?.periods.map((period) => period.date) ?? [])),
    [report],
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const activeDate = selectedDate && dates.includes(selectedDate)
    ? selectedDate
    : dates[0] ?? null;
  const itemsById = useMemo(
    () => new Map(planItems.map((item) => [item.id, item])),
    [planItems],
  );

  if (loading) {
    return (
      <section className="rounded-[26px] border border-[#B8D7CF] bg-white/90 p-5 shadow-pyj-card" aria-live="polite">
        <div className="flex min-h-24 items-center gap-3 text-sm text-[#345E57]">
          <CloudSun className="h-5 w-5 animate-pulse" />
          일정과 지역별 예보를 맞춰보는 중이에요…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-[26px] border border-stone-200 bg-white/90 p-5 shadow-pyj-card" role="status">
        <p className="text-sm font-bold text-stone-800">날씨 리포트를 불러오지 못했습니다.</p>
        <p className="mt-1 text-xs leading-relaxed text-stone-600">
          현재 플랜은 그대로 유지됩니다. 잠시 뒤 다시 확인해 주세요.
        </p>
      </section>
    );
  }

  if (!report) return null;

  const statusCopy = STATUS_COPY[report.status];
  const StatusIcon = statusCopy.icon;
  const activePeriods = report.periods.filter((period) => period.date === activeDate);
  const activeImpacts = report.impacts.filter(
    (impact) => !activeDate || impact.date === activeDate,
  );
  const issuedLabels = Array.from(new Set(
    report.forecast_meta.issues
      .map((issue) => issue.source_issued_at_label)
      .filter((label): label is string => Boolean(label)),
  ));
  const preparation = Array.from(new Set(report.impacts.flatMap((impact) => {
    const values: string[] = [];
    if (impact.signals.includes('rain')) values.push('작은 우산 또는 방수 겉옷');
    if (impact.signals.includes('wind')) values.push('해안·오름용 바람막이');
    if (impact.status === 'official_check') values.push('출발 전 공식 운항·통제 공지 확인');
    return values;
  })));

  return (
    <section
      className="overflow-hidden rounded-[28px] border border-[#B8D7CF] bg-[#FFFCF6]/95 shadow-pyj-card"
      aria-labelledby="weather-decision-title"
    >
      <div className="relative border-b border-[#DCEBE6] bg-gradient-to-br from-[#EAF5F1] via-[#F7F2E6] to-[#FFF7EC] px-5 py-5">
        <div className="absolute right-5 top-4 h-16 w-16 rounded-full bg-white/45 blur-xl" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#34766B]">
              Jeju weather decision
            </p>
            <h2 id="weather-decision-title" className="mt-1 font-serif-kr text-[19px] font-bold text-[#243F3A]">
              여행 날씨 리포트
            </h2>
          </div>
          <span className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold ${statusCopy.tone}`}>
            <StatusIcon className="h-4 w-4" aria-hidden="true" />
            {statusCopy.label}
          </span>
        </div>
        <p className="relative mt-3 max-w-2xl text-[13px] font-semibold leading-relaxed text-[#304B46]">
          {report.headline}
        </p>
        <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-[#58736E]">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> 기상청 단기예보
          </span>
          {issuedLabels.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" /> {issuedLabels.join(' · ')}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {report.forecast_meta.available_regions.map(regionLabel).join(' · ') || '확인 지역 없음'}
          </span>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {report.forecast_meta.partial && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11.5px] leading-relaxed text-amber-900" role="status">
            <strong>일부 지역 예보 확인 불가</strong>
            <span className="ml-1.5">
              {report.forecast_meta.unavailable_regions.map(regionLabel).join(' · ')}은 판단에서 제외했습니다.
            </span>
          </div>
        )}

        {dates.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="날짜별 날씨">
            {dates.map((date) => (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                aria-pressed={activeDate === date}
                className={`min-h-11 shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${
                  activeDate === date
                    ? 'border-[#2D6F65] bg-[#2D6F65] text-white'
                    : 'border-[#D9E4DF] bg-white text-[#526761] hover:border-[#7EAAA0]'
                }`}
              >
                {dateLabel(date)}
              </button>
            ))}
          </div>
        )}

        {activePeriods.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {activePeriods.map((period) => {
              const temperature = temperatureLabel(period.temperature_min, period.temperature_max);
              return (
                <article key={`${period.region}-${period.date}-${period.daypart}`} className="rounded-2xl border border-[#E3DDD0] bg-white p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs text-[#2E4944]">{DAYPART_LABEL[period.daypart]} · {regionLabel(period.region)}</strong>
                    {period.available && (period.precipitation_probability_max ?? 0) >= 40
                      ? <CloudRain className="h-4 w-4 text-[#D96B37]" />
                      : <CloudSun className="h-4 w-4 text-[#559286]" />}
                  </div>
                  {period.available ? (
                    <div className="mt-2 space-y-1 text-[11px] text-stone-600">
                      <p>{period.sky ?? '하늘 상태 확인 중'} · {period.precipitation_type ?? '강수 형태 확인 중'}</p>
                      <p>
                        강수 {period.precipitation_probability_max ?? '–'}%
                        {temperature ? ` · ${temperature}` : ''}
                      </p>
                      {period.wind_speed_max != null && (
                        <p className="inline-flex items-center gap-1"><Wind className="h-3 w-3" /> 최대 {period.wind_speed_max}m/s</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-stone-500">예보 없음 · 이 시간대는 판단하지 않음</p>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {activeImpacts.length > 0 && (
          <div>
            <h3 className="text-xs font-extrabold text-[#304B46]">내 일정에 미치는 영향</h3>
            <div className="mt-2 space-y-2">
              {activeImpacts.map((impact) => {
                const item = itemsById.get(impact.item_id);
                const copy = STATUS_COPY[impact.status];
                return (
                  <article key={impact.item_id} className="rounded-2xl border border-[#E5E0D5] bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-[12.5px] text-stone-900">{item?.name ?? '일정 항목'}</strong>
                      <span className="text-[10.5px] font-bold text-stone-600">{copy.label} · 일정 영향</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-stone-600">{impact.reason}</p>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {report.proposals.length > 0 && (
          <div>
            <h3 className="text-xs font-extrabold text-[#304B46]">선택 가능한 변경안</h3>
            <p className="mt-1 text-[10.5px] leading-relaxed text-stone-500">
              추천일 뿐이며, 버튼을 눌러 승인하기 전에는 플랜이 바뀌지 않습니다.
            </p>
            <div className="mt-2 space-y-2">
              {report.proposals.map((proposal) => {
                const open = openProposalId === proposal.proposal_id;
                return (
                  <article key={proposal.proposal_id} className="overflow-hidden rounded-2xl border border-[#F0C8AF] bg-white">
                    <button
                      type="button"
                      aria-label="변경안 보기"
                      aria-expanded={open}
                      onClick={() => setOpenProposalId(open ? null : proposal.proposal_id)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span>
                        <strong className="block text-xs text-[#8B4B2D]">변경안 보기</strong>
                        <span className="mt-0.5 block text-[10.5px] text-stone-600">{proposal.reason}</span>
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-[#A7623E] transition ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="border-t border-[#F5DED0] bg-[#FFF9F4] px-4 py-4">
                        <div className="space-y-2">
                          {proposal.operations.map((operation, index) => {
                            const first = itemsById.get(operation.item_ids[0]);
                            const second = itemsById.get(operation.item_ids[1]);
                            return (
                              <div key={`${proposal.proposal_id}-${index}`} className="grid gap-2 text-[11px] sm:grid-cols-2">
                                <p className="rounded-xl bg-white px-3 py-2 text-stone-700">
                                  <strong>{first?.name ?? operation.item_ids[0]}</strong><br />
                                  {first?.daypart ? DAYPART_LABEL[first.daypart] : '시간 미정'} → {second?.daypart ? DAYPART_LABEL[second.daypart] : '시간 미정'}
                                </p>
                                <p className="rounded-xl bg-white px-3 py-2 text-stone-700">
                                  <strong>{second?.name ?? operation.item_ids[1]}</strong><br />
                                  {second?.daypart ? DAYPART_LABEL[second.daypart] : '시간 미정'} → {first?.daypart ? DAYPART_LABEL[first.daypart] : '시간 미정'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => onDismiss(proposal)}
                            className="min-h-11 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
                          >
                            기존 일정 유지
                          </button>
                          <button
                            type="button"
                            onClick={() => onApply(proposal)}
                            className="min-h-11 rounded-xl bg-[#E8753C] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#CF6130]"
                          >
                            변경안 적용
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {(preparation.length > 0 || canUndo || actionMessage) && (
          <div className="rounded-2xl border border-[#D7E8E2] bg-[#F1F8F5] p-4">
            {preparation.length > 0 && (
              <>
                <h3 className="text-xs font-extrabold text-[#315F57]">준비물·재확인</h3>
                <ul className="mt-2 space-y-1 text-[11px] text-[#4F6E68]">
                  {preparation.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </>
            )}
            {(canUndo || actionMessage) && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#D7E8E2] pt-3">
                {actionMessage && <p className="text-[11px] font-semibold text-[#315F57]" role="status">{actionMessage}</p>}
                {canUndo && onUndo && (
                  <button
                    type="button"
                    onClick={onUndo}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#78A89E] bg-white px-4 py-2 text-xs font-bold text-[#315F57]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> 되돌리기
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {report.status === 'unknown' && report.proposals.length === 0 && (
          <p className="rounded-2xl bg-stone-50 px-4 py-3 text-[11px] leading-relaxed text-stone-600">
            확인되지 않은 값을 추측해 변경안을 만들지 않았습니다. 현재 일정은 그대로 유지됩니다.
          </p>
        )}
      </div>
    </section>
  );
}

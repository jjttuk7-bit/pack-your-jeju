import React, { useMemo, useState } from 'react';
import { CalendarDays, Database, Download, ExternalLink, MapPin, MessageSquareText, Search, Sparkles } from 'lucide-react';
import type { TravelInfo, TravelPlanItem, VisitCheck, VisitCheckStatus } from '../types';
import { REGIONS } from '../data';

type SourceFilter = 'all' | TravelPlanItem['source'];
type StatusFilter = 'all' | 'positive' | 'attention' | 'unrecorded';

interface Props {
  info: TravelInfo;
  planItems: TravelPlanItem[];
  visitChecks: Record<string, VisitCheck>;
  onSetVisitCheck: (itemId: string, status: VisitCheckStatus, patch?: Partial<VisitCheck>) => void;
  onOpenPlan: () => void;
}

const STATUS_LABELS: Record<VisitCheckStatus, string> = {
  visited: '방문 완료', not_visited: '방문하지 않음', changed: '장소가 변경됨',
  info_mismatch: '정보가 달랐음', satisfied: '만족', unsatisfied: '아쉬움',
};
const SOURCE_LABELS: Record<TravelPlanItem['source'], string> = {
  public_data: '공공데이터', web_search: '하루방 웹검색', user_added: '직접 추가',
};

export default function TravelFeedback({ info, planItems, visitChecks, onSetVisitCheck, onOpenPlan }: Props) {
  const [source, setSource] = useState<SourceFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const rows = useMemo(() => planItems.filter((item) => {
    const check = visitChecks[item.id];
    const term = query.trim().toLocaleLowerCase('ko');
    if (source !== 'all' && item.source !== source) return false;
    if (term && !`${item.name} ${item.region ?? ''} ${item.address ?? ''}`.toLocaleLowerCase('ko').includes(term)) return false;
    if (status === 'unrecorded') return !check;
    if (status === 'positive') return check?.status === 'satisfied' || check?.status === 'visited';
    if (status === 'attention') return Boolean(check && ['changed', 'info_mismatch', 'unsatisfied'].includes(check.status));
    return true;
  }), [planItems, visitChecks, source, status, query]);
  const checks = Object.values(visitChecks);
  const positive = checks.filter((check) => check.status === 'satisfied' || check.status === 'visited').length;
  const attention = checks.filter((check) => ['changed', 'info_mismatch', 'unsatisfied'].includes(check.status)).length;
  const saveMemo = (item: TravelPlanItem) => {
    const previous = visitChecks[item.id];
    onSetVisitCheck(item.id, previous?.status ?? 'visited', { ...previous, memo: drafts[item.id] ?? previous?.memo ?? '' });
  };

  return (
    <section className="mx-auto w-full max-w-[1180px]" aria-labelledby="feedback-title">
      <div className="border-y border-basalt/15 py-6 sm:py-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <span className="text-[10px] font-bold tracking-[0.18em] text-citrus-2">TRAVEL FEEDBACK</span>
            <h2 id="feedback-title" className="mt-2 font-serif-kr text-[28px] font-bold leading-tight text-basalt sm:text-[34px]">다녀온 제주가 다음 여행의 근거가 됩니다.</h2>
            <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-basalt-2">검색 당시 정보와 실제 경험을 나란히 남겨보세요. 공공데이터 원본은 유지하고, 방문 기록은 별도의 신뢰 신호로 보관합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButton label="CSV" onClick={() => exportFeedback(planItems, visitChecks, 'csv')} />
            <ExportButton label="JSON" onClick={() => exportFeedback(planItems, visitChecks, 'json')} />
            <button type="button" onClick={onOpenPlan} className="rounded-md bg-citrus px-4 py-2 text-[11px] font-bold text-white hover:bg-citrus-2">내 여행팩으로</button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 border-b border-basalt/15 sm:grid-cols-4">
        <Metric label="전체 기록" value={`${checks.length}건`} icon={<MessageSquareText className="h-4 w-4" />} />
        <Metric label="만족·방문" value={`${positive}건`} icon={<Sparkles className="h-4 w-4" />} />
        <Metric label="확인 필요" value={`${attention}건`} icon={<Database className="h-4 w-4" />} />
        <Metric label="웹검색 후보" value={`${planItems.filter((item) => item.source === 'web_search').length}곳`} icon={<Search className="h-4 w-4" />} />
      </div>
      <div className="flex flex-col gap-3 border-b border-basalt/15 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {([['all', '전체 출처'], ['public_data', '공공데이터'], ['web_search', '하루방 웹검색'], ['user_added', '직접 추가']] as const).map(([value, label]) => <FilterButton key={value} active={source === value} onClick={() => setSource(value)}>{label}</FilterButton>)}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="h-9 rounded-md border border-earth bg-white px-3 text-[11px] font-semibold text-basalt focus:border-mint focus:outline-none">
            <option value="all">모든 상태</option><option value="positive">만족·방문</option><option value="attention">확인 필요</option><option value="unrecorded">기록 전</option>
          </select>
          <label className="flex h-9 min-w-[220px] items-center gap-2 rounded-md border border-earth bg-white px-3"><Search className="h-3.5 w-3.5 text-basalt-2" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="장소·지역 검색" className="min-w-0 flex-1 bg-transparent text-[11px] outline-none" /></label>
        </div>
      </div>
      <div className="py-5">
        {rows.length === 0 ? <EmptyState /> : (
          <div className="divide-y divide-basalt/12 border-y border-basalt/15 bg-white/55">
            {rows.map((item) => {
              const check = visitChecks[item.id];
              const memo = drafts[item.id] ?? check?.memo ?? '';
              return (
                <article key={item.id} className="grid gap-4 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><SourceBadge source={item.source} />{check && <span className="rounded-full bg-mint/10 px-2 py-1 text-[9.5px] font-bold text-mint">{STATUS_LABELS[check.status]}</span>}</div>
                    <h3 className="mt-2 font-serif-kr text-[18px] font-bold text-basalt">{item.name}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-basalt-2">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{regionLabel(item.region) ?? regionLabel(info.regions[0]) ?? '제주'}</span>
                      {(item.checked_at || check?.updatedAt) && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatDate(item.checked_at ?? check?.updatedAt)}</span>}
                    </div>
                    {item.address && <p className="mt-2 text-[11px] leading-relaxed text-basalt-2">{item.address}</p>}
                    {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-citrus-2 hover:underline">검색 당시 출처 <ExternalLink className="h-3 w-3" /></a>}
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-1.5">{([['visited', '방문'], ['satisfied', '만족'], ['unsatisfied', '아쉬움'], ['info_mismatch', '정보 다름']] as const).map(([value, label]) => <FilterButton key={value} active={check?.status === value} onClick={() => onSetVisitCheck(item.id, value, { ...check, memo })}>{label}</FilterButton>)}</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="text-[10px] font-semibold text-basalt-2">현장 운영 상태
                        <select value={check?.operationStatus ?? 'unknown'} onChange={(event) => onSetVisitCheck(item.id, check?.status ?? 'visited', { ...check, memo, operationStatus: event.target.value as NonNullable<VisitCheck['operationStatus']> })} className="mt-1 h-8 w-full rounded-md border border-earth bg-white px-2 text-[10px] font-normal text-basalt outline-none focus:border-mint">
                          <option value="unknown">확인하지 않음</option><option value="open">운영 중</option><option value="closed">휴무·폐업</option><option value="temporarily_closed">임시 휴무</option><option value="closure_suspected">폐업 의심</option><option value="moved_suspected">이전 의심</option>
                        </select>
                      </label>
                      <div><span className="text-[10px] font-semibold text-basalt-2">달랐던 정보</span><div className="mt-1 flex flex-wrap gap-1">{['운영시간', '주소', '메뉴·요금', '분위기'].map((tag) => { const active = check?.mismatchTypes?.includes(tag); return <button key={tag} type="button" onClick={() => { const next = active ? (check?.mismatchTypes ?? []).filter((value) => value !== tag) : [...(check?.mismatchTypes ?? []), tag]; onSetVisitCheck(item.id, check?.status ?? 'info_mismatch', { ...check, memo, mismatchTypes: next }); }} className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${active ? 'border-citrus bg-citrus/10 text-citrus-2' : 'border-earth bg-white text-basalt-2'}`}>{tag}</button>; })}</div></div>
                    </div>
                    <textarea value={memo} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="운영시간, 혼잡도, 실제 분위기처럼 다음 여행에 도움 될 경험을 남겨주세요." className="mt-2 min-h-[76px] w-full resize-y rounded-md border border-earth bg-white px-3 py-2 text-[11px] leading-relaxed outline-none focus:border-mint" />
                    <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[9.5px] text-basalt-2">{item.source === 'public_data' ? '방문 신호·수정요청 분리 저장' : '현재 기기 여행 기록에 저장'}</span><button type="button" onClick={() => saveMemo(item)} className="rounded-md border border-mint/35 bg-white px-3 py-1.5 text-[10px] font-bold text-mint hover:bg-mint hover:text-white">메모 저장</button></div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="border-r border-basalt/15 px-3 py-4 last:border-r-0 sm:px-5"><div className="flex items-center gap-1.5 text-[10px] font-bold text-basalt-2">{icon}{label}</div><div className="mt-1 font-serif-kr text-[22px] font-bold text-basalt">{value}</div></div>; }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${active ? 'border-mint bg-mint text-white' : 'border-earth bg-white text-basalt-2 hover:border-mint/50'}`}>{children}</button>; }
function ExportButton({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-md border border-earth bg-white px-3 py-2 text-[10.5px] font-bold text-basalt-2 hover:border-mint"><Download className="h-3.5 w-3.5" />{label}</button>; }
function EmptyState() { return <div className="border border-dashed border-earth bg-white/55 px-6 py-14 text-center"><p className="font-serif-kr text-[18px] font-bold text-basalt">조건에 맞는 기록이 아직 없어요.</p><p className="mt-2 text-[11px] text-basalt-2">여행팩에 장소를 담고 방문 후 경험을 기록하면 여기에 차곡차곡 모입니다.</p></div>; }
function SourceBadge({ source }: { source: TravelPlanItem['source'] }) { const tone = source === 'public_data' ? 'bg-[#E7F4EF] text-mint' : source === 'web_search' ? 'bg-[#FFF0E8] text-citrus-2' : 'bg-stone-100 text-stone-600'; return <span className={`rounded-full px-2 py-1 text-[9.5px] font-bold ${tone}`}>{SOURCE_LABELS[source]}</span>; }
function regionLabel(region?: string | null) { return REGIONS.find((candidate) => candidate.value === region)?.label ?? region ?? null; }
function formatDate(value?: string | null) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(date); }

function exportFeedback(planItems: TravelPlanItem[], visitChecks: Record<string, VisitCheck>, format: 'csv' | 'json') {
  const rows = planItems.map((item) => ({ place_name: item.name, source: SOURCE_LABELS[item.source], region: item.region ?? '', address: item.address ?? '', source_url: item.source_url ?? '', search_checked_at: item.checked_at ?? '', visit_status: visitChecks[item.id] ? STATUS_LABELS[visitChecks[item.id].status] : '기록 전', feedback_memo: visitChecks[item.id]?.memo ?? '', feedback_updated_at: visitChecks[item.id]?.updatedAt ?? '' }));
  const content = format === 'json' ? JSON.stringify({ exported_at: new Date().toISOString(), rows }, null, 2) : toCsv(rows);
  const blob = new Blob([format === 'csv' ? `\uFEFF${content}` : content], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `jeju-damda-travel-feedback-${new Date().toISOString().slice(0, 10)}.${format}`; anchor.click(); URL.revokeObjectURL(url);
}
function toCsv(rows: Record<string, string>[]) { const headers = rows.length ? Object.keys(rows[0]) : ['place_name', 'source', 'region', 'address', 'source_url', 'search_checked_at', 'visit_status', 'feedback_memo', 'feedback_updated_at']; const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`; return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n'); }

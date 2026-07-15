import React, { useMemo, useState } from 'react';

export interface ModerationCase {
  id: string;
  place_id: number;
  case_type: string;
  claim_key: string;
  status: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  priority_rank: number;
  research_status: string;
  opened_at: string;
  updated_at: string;
}

interface Props {
  cases: ModerationCase[];
  onOpen?: (item: ModerationCase) => void;
}

const priorityLabel: Record<ModerationCase['priority'], string> = { urgent: '긴급', high: '높음', normal: '보통', low: '낮음' };

export default function ModerationQueue({ cases, onOpen }: Props) {
  const [priority, setPriority] = useState<'all' | ModerationCase['priority']>('all');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => cases.filter((item) => {
    if (priority !== 'all' && item.priority !== priority) return false;
    const term = query.trim().toLocaleLowerCase('ko');
    return !term || `${item.claim_key} ${item.case_type} ${item.place_id}`.toLocaleLowerCase('ko').includes(term);
  }), [cases, priority, query]);

  return <section className="mx-auto w-full max-w-[1180px]" aria-labelledby="moderation-title">
    <div className="border-y border-basalt/15 py-6">
      <span className="text-[10px] font-bold tracking-[0.18em] text-citrus-2">OPERATOR REVIEW</span>
      <h2 id="moderation-title" className="mt-2 font-serif-kr text-[28px] font-bold text-basalt">근거를 확인할 차례예요.</h2>
      <p className="mt-2 text-[12px] text-basalt-2">사용자 신고를 사실로 확정하기 전에, 출처·최신성·충돌 여부를 검토합니다.</p>
    </div>
    <div className="flex flex-col gap-2 border-b border-basalt/15 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5">{(['all', 'urgent', 'high', 'normal', 'low'] as const).map((value) => <button key={value} type="button" onClick={() => setPriority(value)} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${priority === value ? 'border-mint bg-mint text-white' : 'border-earth bg-white text-basalt-2'}`}>{value === 'all' ? '전체' : priorityLabel[value]}</button>)}</div>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="주장·유형·장소 ID 검색" className="h-9 rounded-md border border-earth bg-white px-3 text-[11px] outline-none focus:border-mint" />
    </div>
    <div className="divide-y divide-basalt/12 border-b border-basalt/15 bg-white/60">{filtered.length === 0 ? <p className="px-5 py-12 text-center text-[12px] text-basalt-2">조건에 맞는 검토 케이스가 없습니다.</p> : filtered.map((item) => <button key={item.id} type="button" onClick={() => onOpen?.(item)} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-mint/5 sm:px-5"><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="font-serif-kr text-[16px] text-basalt">{item.claim_key}</strong><span className="rounded-full bg-citrus/10 px-2 py-1 text-[9px] font-bold text-citrus-2">{priorityLabel[item.priority]}</span></span><span className="mt-1 block text-[10px] text-basalt-2">장소 {item.place_id} · {item.case_type} · {item.research_status}</span></span><span className="shrink-0 text-[10px] font-bold text-mint">검토하기 →</span></button>)}</div>
  </section>;
}

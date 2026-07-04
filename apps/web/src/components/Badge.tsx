import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { BadgeKind } from '../types';

/**
 * 신뢰 배지 4종 (TRUST_ENGINE.md §3, DECISIONS D-07).
 * - verified 🔵: 확인됨
 * - caution ⚠️: 주의 (수정요청 이력·정보 결측 등)
 * - contradicted ×: 반증 존재 (폐업 확인)
 * - reference 🟠: 참고 (공공데이터 검증 아님)
 */
export default function Badge({
  kind,
  note,
}: {
  kind: BadgeKind;
  note?: string | null;
}) {
  const map: Record<
    BadgeKind,
    { label: string; icon: ReactNode; bg: string; text: string; border: string }
  > = {
    verified: {
      label: '확인됨',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
    },
    caution: {
      label: '주의',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
    },
    contradicted: {
      label: '폐업/변경 확인',
      icon: <XCircle className="w-3.5 h-3.5" />,
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
    },
    reference: {
      label: '참고',
      icon: <Info className="w-3.5 h-3.5" />,
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
    },
  };
  const b = map[kind];
  return (
    <div className="inline-flex flex-col gap-0.5">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${b.bg} ${b.text} ${b.border}`}
      >
        {b.icon}
        {b.label}
      </span>
      {note && (
        <span className="text-[10px] text-slate-500 leading-tight">· {note}</span>
      )}
    </div>
  );
}

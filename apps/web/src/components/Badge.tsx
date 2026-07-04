import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { BadgeKind } from '../types';

/**
 * 신뢰 배지 4종 (TRUST_ENGINE.md §3, DECISIONS D-07).
 * - verified 🔵: 확인됨
 * - caution ⚠️: 주의 (수정요청 이력·정보 결측 등) — 사유를 라벨에 통합해 노출
 * - contradicted ×: 반증 존재 (폐업 확인)
 * - reference 🟠: 참고 (공공데이터 검증 아님)
 *
 * 정직함 원칙(CLAUDE.md 절대 규칙 3): 사유가 있으면 반드시 보이게.
 * caution 배지는 note를 라벨에 압축 노출하고, note 원문은 아래 소자로 유지.
 */

// caution note 원문 → 짧은 라벨 매핑 (배지 안에 들어갈 헤드라인).
// 백엔드 trust.py:_AMENITY_KO 라벨과 정합해야 한다.
// 우선순위 순으로 위에서 아래로 첫 매칭 사용 (수정요청 이력 > amenity 결측 > 유효기간).
// 매칭 실패 시 기본 "주의"로 폴백.
const CAUTION_LABEL_MAP: Array<{ needle: string; label: string; footnote?: string }> = [
  { needle: '수정요청', label: '수정요청 이력', footnote: '1,686건 중 하나' },
  { needle: '아이 동반', label: '아이 동반 정보 미확인' },
  { needle: '접근성',   label: '접근성 정보 미확인' },
  { needle: '주차',     label: '주차 정보 미확인' },
  { needle: '유효기간', label: '정보 노후' },
  { needle: '난이도',   label: '난이도 미확인' },
];

function pickCautionLabel(note?: string | null): { label: string; footnote?: string } {
  if (!note) return { label: '주의' };
  for (const m of CAUTION_LABEL_MAP) {
    if (note.includes(m.needle)) return { label: m.label, footnote: m.footnote };
  }
  return { label: '주의' };
}

export default function Badge({
  kind,
  note,
}: {
  kind: BadgeKind;
  note?: string | null;
}) {
  const cautionResolved = kind === 'caution' ? pickCautionLabel(note) : null;

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
      label: cautionResolved?.label ?? '주의',
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
    <div className="inline-flex flex-col gap-1 items-end">
      <span
        title={note ?? undefined}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border shrink-0 ${b.bg} ${b.text} ${b.border}`}
      >
        {b.icon}
        {b.label}
      </span>
      {note && (
        <span className="text-[10px] text-stone-500 leading-snug text-right max-w-[160px]">
          {note}
          {cautionResolved?.footnote && (
            <span className="block text-[9.5px] text-amber-700/70 mt-0.5">
              · {cautionResolved.footnote}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

import type {TravelPlanItem, WeatherChangeProposal} from './types';


export interface WeatherUndoSnapshot {
  proposalId: string;
  beforeItems: TravelPlanItem[];
  appliedPlanFingerprint: string;
}

export interface ApplyProposalResult {
  ok: boolean;
  items: TravelPlanItem[];
  reason?: string;
  undo?: WeatherUndoSnapshot;
}

export type ProposalPreview = ApplyProposalResult;


function cloneItems(items: TravelPlanItem[]): TravelPlanItem[] {
  return items.map((item) => ({
    ...item,
    score_breakdown: item.score_breakdown
      ? structuredClone(item.score_breakdown)
      : item.score_breakdown,
    check_required: item.check_required ? [...item.check_required] : item.check_required,
  }));
}


export function planFingerprint(items: TravelPlanItem[]): string {
  const schedule = items.map((item) => ({
    id: item.id,
    day: item.day ?? null,
    date: item.date ?? null,
    daypart: item.daypart ?? null,
    startTime: item.startTime ?? null,
    fixed: item.fixed ?? false,
  }));
  const value = JSON.stringify(schedule);
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `plan-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}


function validationError(
  items: TravelPlanItem[],
  reason: string,
): ApplyProposalResult {
  return {ok: false, items: cloneItems(items), reason};
}


export function applyWeatherProposal(
  items: TravelPlanItem[],
  proposal: WeatherChangeProposal,
): ApplyProposalResult {
  const currentFingerprint = planFingerprint(items);
  if (
    proposal.basePlanFingerprint
    && proposal.basePlanFingerprint !== currentFingerprint
  ) {
    return validationError(
      items,
      '날씨 변경안을 만든 뒤 현재 플랜이 달라졌습니다. 새 리포트를 확인해 주세요.',
    );
  }
  if (proposal.operations.length === 0) {
    return validationError(items, '적용할 일정 변경이 없습니다.');
  }

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const touched = new Set<string>();
  for (const operation of proposal.operations) {
    if (operation.type !== 'swap_daypart') {
      return validationError(items, '지원하지 않는 일정 변경 방식입니다.');
    }
    const [firstId, secondId] = operation.item_ids;
    if (!firstId || !secondId || firstId === secondId) {
      return validationError(items, '교환할 일정 항목이 올바르지 않습니다.');
    }
    if (touched.has(firstId) || touched.has(secondId)) {
      return validationError(items, '서로 겹치는 변경이 있어 플랜을 변경하지 않았습니다.');
    }
    const first = itemsById.get(firstId);
    const second = itemsById.get(secondId);
    if (!first || !second) {
      return validationError(items, '변경 대상 일정이 현재 플랜에 없습니다.');
    }
    if (first.fixed || second.fixed) {
      return validationError(items, '시간 고정 일정은 날씨 제안으로 이동하지 않습니다.');
    }
    if (!first.daypart || !second.daypart || first.date !== second.date) {
      return validationError(items, '같은 날짜의 유효한 시간대 일정만 교환할 수 있습니다.');
    }
    touched.add(firstId);
    touched.add(secondId);
  }

  const next = cloneItems(items);
  const nextById = new Map(next.map((item) => [item.id, item]));
  for (const operation of proposal.operations) {
    const [firstId, secondId] = operation.item_ids;
    const first = nextById.get(firstId)!;
    const second = nextById.get(secondId)!;
    const firstDaypart = first.daypart;
    const firstStartTime = first.startTime;
    first.daypart = second.daypart;
    first.startTime = second.startTime;
    second.daypart = firstDaypart;
    second.startTime = firstStartTime;
  }

  return {
    ok: true,
    items: next,
    undo: {
      proposalId: proposal.proposal_id,
      beforeItems: cloneItems(items),
      appliedPlanFingerprint: planFingerprint(next),
    },
  };
}


export function previewWeatherProposal(
  items: TravelPlanItem[],
  proposal: WeatherChangeProposal,
): ProposalPreview {
  return applyWeatherProposal(items, proposal);
}


export function undoWeatherProposal(
  items: TravelPlanItem[],
  undo: WeatherUndoSnapshot,
): TravelPlanItem[] {
  if (planFingerprint(items) !== undo.appliedPlanFingerprint) {
    return cloneItems(items);
  }
  return cloneItems(undo.beforeItems);
}

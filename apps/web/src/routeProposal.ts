import type {
  RouteChangeProposal,
  RouteUndoState,
  TravelPlanItem,
} from './types';
import {planFingerprint} from './weatherProposal';


export interface RouteProposalResult {
  ok: boolean;
  items: TravelPlanItem[];
  reason?: string;
  undo?: RouteUndoState;
}

export interface RouteUndoResult {
  ok: boolean;
  items: TravelPlanItem[];
  reason?: string;
}


function cloneItems(items: TravelPlanItem[]): TravelPlanItem[] {
  return items.map((item) => ({
    ...item,
    score_breakdown: item.score_breakdown
      ? structuredClone(item.score_breakdown)
      : item.score_breakdown,
    check_required: item.check_required ? [...item.check_required] : item.check_required,
  }));
}


function rejected(items: TravelPlanItem[], reason: string): RouteProposalResult {
  return {ok: false, items: cloneItems(items), reason};
}


export function applyRouteProposal(
  items: TravelPlanItem[],
  proposal: RouteChangeProposal,
): RouteProposalResult {
  const currentFingerprint = planFingerprint(items);
  if (
    proposal.basePlanFingerprint
    && proposal.basePlanFingerprint !== currentFingerprint
  ) {
    return rejected(
      items,
      '동선 변경안을 만든 뒤 현재 플랜이 달라졌습니다. 동선을 다시 계산해 주세요.',
    );
  }
  if (proposal.operations.length === 0) {
    return rejected(items, '적용할 동선 변경이 없습니다.');
  }

  const seenDays = new Set<number>();
  const validated: Array<{
    indexes: number[];
    orderedItems: TravelPlanItem[];
  }> = [];
  for (const operation of proposal.operations) {
    if (operation.type !== 'reorder_day_items') {
      return rejected(items, '지원하지 않는 동선 변경 방식입니다.');
    }
    if (seenDays.has(operation.day)) {
      return rejected(items, '같은 날짜를 중복으로 변경할 수 없습니다.');
    }
    seenDays.add(operation.day);

    const indexes = items.flatMap((item, index) => (
      item.day === operation.day ? [index] : []
    ));
    const dayItems = indexes.map((index) => items[index]);
    const orderedIds = operation.ordered_item_ids;
    if (
      orderedIds.length !== dayItems.length
      || new Set(orderedIds).size !== orderedIds.length
    ) {
      return rejected(items, '추천 순서의 장소 수 또는 ID가 올바르지 않습니다.');
    }
    const byId = new Map(dayItems.map((item) => [item.id, item]));
    if (orderedIds.some((itemId) => !byId.has(itemId))) {
      return rejected(items, '추천 장소가 현재 날짜의 플랜과 일치하지 않습니다.');
    }
    for (const [originalIndex, item] of dayItems.entries()) {
      if (item.fixed && orderedIds[originalIndex] !== item.id) {
        return rejected(items, '시간 고정 일정은 동선 제안으로 이동하지 않습니다.');
      }
    }
    validated.push({
      indexes,
      orderedItems: orderedIds.map((itemId) => byId.get(itemId)!),
    });
  }

  const next = cloneItems(items);
  for (const operation of validated) {
    operation.indexes.forEach((globalIndex, dayIndex) => {
      next[globalIndex] = cloneItems([operation.orderedItems[dayIndex]])[0];
    });
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


export function previewRouteProposal(
  items: TravelPlanItem[],
  proposal: RouteChangeProposal,
): RouteProposalResult {
  return applyRouteProposal(items, proposal);
}


export function undoRouteProposal(
  items: TravelPlanItem[],
  undo: RouteUndoState,
): RouteUndoResult {
  if (planFingerprint(items) !== undo.appliedPlanFingerprint) {
    return {
      ok: false,
      items: cloneItems(items),
      reason: '동선 적용 후 플랜이 수정되어 안전하게 되돌릴 수 없습니다.',
    };
  }
  return {ok: true, items: cloneItems(undo.beforeItems)};
}

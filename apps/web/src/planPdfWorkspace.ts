import {
  buildInitialPlanPdfDraft,
  type PlanPdfDraft,
  type PlanPdfDraftItem,
} from './planPdf';
import type { HarubanPlanDraft, TravelPlanItem } from './types';

export interface ExcludedPlanPdfItem {
  item: PlanPdfDraftItem;
  excludedAt: string;
}

export interface PlanPdfWorkspace {
  draft: PlanPdfDraft;
  composition: HarubanPlanDraft | null;
  knownSourceItemIds: string[];
  excludedItems: ExcludedPlanPdfItem[];
  updatedAt: string;
}

interface CreatePlanPdfWorkspaceInput {
  sourceItems: TravelPlanItem[];
  durationDays: number;
  initialDraft?: PlanPdfDraft | null;
  composition?: HarubanPlanDraft | null;
  now?: string;
}

function timestamp(now?: string): string {
  return now ?? new Date().toISOString();
}

function normalizedDays(durationDays: number): number {
  if (!Number.isFinite(durationDays)) return 1;
  return Math.max(1, Math.floor(durationDays));
}

function renumberByDay(
  items: PlanPdfDraftItem[],
  durationDays?: number,
): PlanPdfDraftItem[] {
  const maximumDay = normalizedDays(
    durationDays ?? Math.max(1, ...items.map((item) => item.day)),
  );
  const result: PlanPdfDraftItem[] = [];

  for (let day = 1; day <= maximumDay; day += 1) {
    items
      .filter((item) => item.day === day)
      .sort((left, right) => left.order - right.order)
      .forEach((item, index) => {
        result.push({ ...item, order: index + 1 });
      });
  }

  return result;
}

function compositionDraft(composition: HarubanPlanDraft): PlanPdfDraft {
  return {
    title: composition.title,
    items: composition.items,
  };
}

export function createPlanPdfWorkspace({
  sourceItems,
  durationDays,
  initialDraft,
  composition = null,
  now,
}: CreatePlanPdfWorkspaceInput): PlanPdfWorkspace {
  const draft = initialDraft
    ?? (composition ? compositionDraft(composition) : null)
    ?? buildInitialPlanPdfDraft(sourceItems, durationDays);

  return {
    draft: structuredClone(draft),
    composition: composition ? structuredClone(composition) : null,
    knownSourceItemIds: [...new Set(sourceItems.map((item) => item.id))],
    excludedItems: [],
    updatedAt: timestamp(now),
  };
}

export function updatePlanPdfWorkspaceDraft(
  workspace: PlanPdfWorkspace,
  draft: PlanPdfDraft,
  now?: string,
): PlanPdfWorkspace {
  return {
    ...workspace,
    draft: structuredClone(draft),
    updatedAt: timestamp(now),
  };
}

export function excludePlanPdfWorkspaceItem(
  workspace: PlanPdfWorkspace,
  itemId: string,
  now?: string,
): PlanPdfWorkspace {
  const item = workspace.draft.items.find((candidate) => candidate.id === itemId);
  if (!item) return workspace;

  const excludedAt = timestamp(now);
  return {
    ...workspace,
    draft: {
      ...workspace.draft,
      items: renumberByDay(
        workspace.draft.items.filter((candidate) => candidate.id !== itemId),
      ),
    },
    excludedItems: [
      ...workspace.excludedItems.map((record) => structuredClone(record)),
      { item: structuredClone(item), excludedAt },
    ],
    updatedAt: excludedAt,
  };
}

export function undoExcludedPlanPdfWorkspaceItem(
  workspace: PlanPdfWorkspace,
  durationDays: number,
  now?: string,
): PlanPdfWorkspace {
  const record = workspace.excludedItems.at(-1);
  if (!record) return workspace;

  const restoredItems = workspace.draft.items
    .map((item) => structuredClone(item));
  const insertAt = restoredItems.findIndex((item) => (
    item.day > record.item.day
    || (item.day === record.item.day && item.order >= record.item.order)
  ));
  restoredItems.splice(
    insertAt < 0 ? restoredItems.length : insertAt,
    0,
    structuredClone(record.item),
  );
  const updatedAt = timestamp(now);

  return {
    ...workspace,
    draft: {
      ...workspace.draft,
      items: renumberByDay(restoredItems, durationDays),
    },
    excludedItems: workspace.excludedItems
      .slice(0, -1)
      .map((item) => structuredClone(item)),
    updatedAt,
  };
}

export function findPendingPlanPdfSourceItems(
  workspace: PlanPdfWorkspace,
  sourceItems: TravelPlanItem[],
): TravelPlanItem[] {
  const knownIds = new Set(workspace.knownSourceItemIds);
  return sourceItems
    .filter((item) => !knownIds.has(item.id))
    .map((item) => structuredClone(item));
}

export function addPendingPlanPdfItems(
  workspace: PlanPdfWorkspace,
  sourceItems: TravelPlanItem[],
  itemIds: string[],
  durationDays: number,
  now?: string,
): PlanPdfWorkspace {
  const pendingById = new Map(
    findPendingPlanPdfSourceItems(workspace, sourceItems)
      .map((item) => [item.id, item]),
  );
  const selectedIds = [...new Set(itemIds)].filter((id) => pendingById.has(id));
  if (selectedIds.length === 0) return workspace;

  const selectedItems = selectedIds.map((id) => pendingById.get(id)!);
  const lastOrderByDay = new Map<number, number>();
  workspace.draft.items.forEach((item) => {
    lastOrderByDay.set(
      item.day,
      Math.max(lastOrderByDay.get(item.day) ?? 0, item.order),
    );
  });
  const additions = buildInitialPlanPdfDraft(selectedItems, durationDays).items
    .map((item) => {
      const order = (lastOrderByDay.get(item.day) ?? 0) + 1;
      lastOrderByDay.set(item.day, order);
      return { ...item, order };
    });
  const updatedAt = timestamp(now);

  return {
    ...workspace,
    draft: {
      ...workspace.draft,
      items: renumberByDay(
        [
          ...workspace.draft.items.map((item) => structuredClone(item)),
          ...additions,
        ],
        durationDays,
      ),
    },
    knownSourceItemIds: [
      ...workspace.knownSourceItemIds,
      ...selectedIds,
    ],
    updatedAt,
  };
}

export function syncRemovedPlanPdfSourceItems(
  workspace: PlanPdfWorkspace,
  sourceItems: TravelPlanItem[],
  now?: string,
): PlanPdfWorkspace {
  const sourceIds = new Set(sourceItems.map((item) => item.id));
  const removedIds = new Set(
    workspace.knownSourceItemIds.filter((id) => !sourceIds.has(id)),
  );
  if (removedIds.size === 0) return workspace;

  const updatedAt = timestamp(now);
  return {
    ...workspace,
    draft: {
      ...workspace.draft,
      items: renumberByDay(
        workspace.draft.items.filter((item) => !removedIds.has(item.id)),
      ),
    },
    excludedItems: workspace.excludedItems
      .filter(({ item }) => !removedIds.has(item.id))
      .map((record) => structuredClone(record)),
    knownSourceItemIds: workspace.knownSourceItemIds
      .filter((id) => !removedIds.has(id)),
    updatedAt,
  };
}

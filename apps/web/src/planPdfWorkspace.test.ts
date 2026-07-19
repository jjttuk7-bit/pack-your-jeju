import { describe, expect, it } from 'vitest';
import type { PlanPdfDraft } from './planPdf';
import {
  addPendingPlanPdfItems,
  createPlanPdfWorkspace,
  excludePlanPdfWorkspaceItem,
  findPendingPlanPdfSourceItems,
  syncRemovedPlanPdfSourceItems,
  undoExcludedPlanPdfWorkspaceItem,
  updatePlanPdfWorkspaceDraft,
} from './planPdfWorkspace';
import type { TravelPlanItem } from './types';

function sourceItem(
  id: string,
  overrides: Partial<TravelPlanItem> = {},
): TravelPlanItem {
  return {
    id,
    name: `장소 ${id}`,
    moment: 'workspace-test',
    source: 'public_data',
    day: 1,
    note: `메모 ${id}`,
    ...overrides,
  };
}

describe('planPdfWorkspace', () => {
  it('원본과 분리된 PDF 작업 초안을 생성한다', () => {
    const sourceItems = [sourceItem('a'), sourceItem('b', { day: 2 })];
    const initialDraft: PlanPdfDraft = {
      title: '하루방 초안',
      items: [
        { ...sourceItems[0], day: 1, order: 1, pdfMemo: '편집 메모' },
        { ...sourceItems[1], day: 2, order: 1, pdfMemo: '둘째 날' },
      ],
    };

    const workspace = createPlanPdfWorkspace({
      sourceItems,
      durationDays: 2,
      initialDraft,
      now: '2026-07-19T00:00:00.000Z',
    });

    expect(workspace.draft).toEqual(initialDraft);
    expect(workspace.draft).not.toBe(initialDraft);
    expect(workspace.draft.items[0]).not.toBe(initialDraft.items[0]);
    expect(workspace.knownSourceItemIds).toEqual(['a', 'b']);
    expect(workspace.excludedItems).toEqual([]);
    expect(workspace.composition).toBeNull();
    expect(workspace.updatedAt).toBe('2026-07-19T00:00:00.000Z');
  });

  it('편집 초안과 갱신 시각을 불변 방식으로 교체한다', () => {
    const workspace = createPlanPdfWorkspace({
      sourceItems: [sourceItem('a')],
      durationDays: 1,
      now: '2026-07-19T00:00:00.000Z',
    });
    const draft = {
      title: '수정 제목',
      items: [{ ...workspace.draft.items[0], pdfMemo: '새 메모' }],
    };

    const updated = updatePlanPdfWorkspaceDraft(
      workspace,
      draft,
      '2026-07-19T01:00:00.000Z',
    );

    expect(updated).not.toBe(workspace);
    expect(updated.draft).toEqual(draft);
    expect(updated.draft).not.toBe(draft);
    expect(updated.updatedAt).toBe('2026-07-19T01:00:00.000Z');
    expect(workspace.draft.title).not.toBe('수정 제목');
  });

  it('구조적으로 같은 초안 갱신은 동일 작업 공간과 시각을 유지한다', () => {
    const workspace = createPlanPdfWorkspace({
      sourceItems: [sourceItem('a')],
      durationDays: 1,
      now: '2026-07-19T00:00:00.000Z',
    });

    const updated = updatePlanPdfWorkspaceDraft(
      workspace,
      structuredClone(workspace.draft),
      '2026-07-19T01:00:00.000Z',
    );

    expect(updated).toBe(workspace);
    expect(updated.updatedAt).toBe('2026-07-19T00:00:00.000Z');
  });

  it('제외 전의 오래된 편집 콜백이 제외 장소를 다시 넣지 못하게 한다', () => {
    const workspace = createPlanPdfWorkspace({
      sourceItems: [sourceItem('a'), sourceItem('b')],
      durationDays: 1,
    });
    const staleDraft = structuredClone(workspace.draft);
    const excluded = excludePlanPdfWorkspaceItem(workspace, 'a');

    const updated = updatePlanPdfWorkspaceDraft(excluded, {
      ...staleDraft,
      title: '유효한 제목 수정',
      items: staleDraft.items.map((item) => (
        item.id === 'b' ? { ...item, pdfMemo: '유효한 메모 수정' } : item
      )),
    });

    expect(updated.draft.title).toBe('유효한 제목 수정');
    expect(updated.draft.items.map((item) => item.id)).toEqual(['b']);
    expect(updated.draft.items[0].pdfMemo).toBe('유효한 메모 수정');
    expect(updated.excludedItems.map(({ item }) => item.id)).toEqual(['a']);

    const restored = undoExcludedPlanPdfWorkspaceItem(updated, 1);
    expect(restored.draft.items.filter((item) => item.id === 'a')).toHaveLength(1);
    expect(restored.excludedItems).toEqual([]);
  });

  it('원본은 유지한 채 작업 초안에서만 제외하고 Day 순서를 다시 매긴다', () => {
    const sourceItems = [
      sourceItem('a'),
      sourceItem('b'),
      sourceItem('c', { day: 2 }),
    ];
    const workspace = createPlanPdfWorkspace({
      sourceItems,
      durationDays: 2,
      now: '2026-07-19T00:00:00.000Z',
    });
    const originalSource = structuredClone(sourceItems);

    const excluded = excludePlanPdfWorkspaceItem(
      workspace,
      'a',
      '2026-07-19T01:00:00.000Z',
    );

    expect(excluded.draft.items.map(({ id, day, order }) => ({ id, day, order })))
      .toEqual([
        { id: 'b', day: 1, order: 1 },
        { id: 'c', day: 2, order: 1 },
      ]);
    expect(excluded.excludedItems).toEqual([
      {
        item: workspace.draft.items[0],
        excludedAt: '2026-07-19T01:00:00.000Z',
      },
    ]);
    expect(excluded.knownSourceItemIds).toEqual(['a', 'b', 'c']);
    expect(sourceItems).toEqual(originalSource);
    expect(workspace.draft.items).toHaveLength(3);
  });

  it('가장 최근 제외 장소를 이전 Day와 순서에 복원한다', () => {
    const workspace = createPlanPdfWorkspace({
      sourceItems: [sourceItem('a'), sourceItem('b'), sourceItem('c')],
      durationDays: 1,
      now: '2026-07-19T00:00:00.000Z',
    });
    const withoutB = excludePlanPdfWorkspaceItem(workspace, 'b');
    const withoutBC = excludePlanPdfWorkspaceItem(withoutB, 'c');

    const restored = undoExcludedPlanPdfWorkspaceItem(
      withoutBC,
      1,
      '2026-07-19T01:00:00.000Z',
    );

    expect(restored.draft.items.map(({ id, order }) => ({ id, order }))).toEqual([
      { id: 'a', order: 1 },
      { id: 'c', order: 2 },
    ]);
    expect(restored.excludedItems.map(({ item }) => item.id)).toEqual(['b']);
    expect(withoutBC.draft.items.map((item) => item.id)).toEqual(['a']);

    const restoredAgain = undoExcludedPlanPdfWorkspaceItem(restored, 1);
    expect(restoredAgain.draft.items.map(({ id, order }) => ({ id, order })))
      .toEqual([
        { id: 'a', order: 1 },
        { id: 'b', order: 2 },
        { id: 'c', order: 3 },
      ]);
  });

  it('알지 못하는 원본 장소만 추가 대기 대상으로 찾고 제외 장소는 다시 제안하지 않는다', () => {
    const sourceItems = [sourceItem('a'), sourceItem('b')];
    const workspace = excludePlanPdfWorkspaceItem(
      createPlanPdfWorkspace({ sourceItems, durationDays: 1 }),
      'b',
    );
    const nextSourceItems = [...sourceItems, sourceItem('c'), sourceItem('d')];

    expect(findPendingPlanPdfSourceItems(workspace, nextSourceItems).map((item) => item.id))
      .toEqual(['c', 'd']);
  });

  it('선택한 새 장소를 대상 Day 마지막에 한 번만 추가하고 처리된 ID를 기록한다', () => {
    const sourceItems = [sourceItem('a'), sourceItem('b', { day: 2 })];
    const workspace = createPlanPdfWorkspace({
      sourceItems,
      durationDays: 2,
      now: '2026-07-19T00:00:00.000Z',
    });
    const nextSourceItems = [
      ...sourceItems,
      sourceItem('c', { day: 1, note: '새 장소 메모' }),
      sourceItem('d', { day: 2 }),
    ];

    const added = addPendingPlanPdfItems(
      workspace,
      nextSourceItems,
      ['c', 'c', 'd'],
      2,
      '2026-07-19T01:00:00.000Z',
    );

    expect(added.draft.items.map(({ id, day, order, pdfMemo }) => ({
      id,
      day,
      order,
      pdfMemo,
    }))).toEqual([
      { id: 'a', day: 1, order: 1, pdfMemo: '메모 a' },
      { id: 'c', day: 1, order: 2, pdfMemo: '새 장소 메모' },
      { id: 'b', day: 2, order: 1, pdfMemo: '메모 b' },
      { id: 'd', day: 2, order: 2, pdfMemo: '메모 d' },
    ]);
    expect(added.knownSourceItemIds).toEqual(['a', 'b', 'c', 'd']);
    expect(workspace.knownSourceItemIds).toEqual(['a', 'b']);
  });

  it('새 장소는 같은 Day에 기존 장소가 여러 개여도 맨 뒤에 배치한다', () => {
    const sourceItems = [sourceItem('a'), sourceItem('b')];
    const workspace = createPlanPdfWorkspace({
      sourceItems,
      durationDays: 1,
    });
    const nextSourceItems = [...sourceItems, sourceItem('c')];

    const added = addPendingPlanPdfItems(
      workspace,
      nextSourceItems,
      ['c'],
      1,
    );

    expect(added.draft.items.map(({ id, order }) => ({ id, order }))).toEqual([
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
      { id: 'c', order: 3 },
    ]);
  });

  it('순서를 다시 매길 때 잘못된 Day를 여행 기간 안으로 보정한다', () => {
    const sourceItems = [sourceItem('a'), sourceItem('b'), sourceItem('c')];
    const initialDraft: PlanPdfDraft = {
      title: 'Day 경계 초안',
      items: [
        { ...sourceItems[0], day: Number.NaN, order: 1, pdfMemo: '' },
        { ...sourceItems[1], day: -3, order: 2, pdfMemo: '' },
        { ...sourceItems[2], day: 99, order: 3, pdfMemo: '' },
      ],
    };
    const workspace = createPlanPdfWorkspace({
      sourceItems,
      durationDays: 2,
      initialDraft,
    });
    const nextSourceItems = [...sourceItems, sourceItem('d', { day: 2 })];

    const updated = addPendingPlanPdfItems(
      workspace,
      nextSourceItems,
      ['d'],
      2,
    );

    expect(updated.draft.items.map(({ id, day }) => ({ id, day }))).toEqual([
      { id: 'a', day: 1 },
      { id: 'b', day: 1 },
      { id: 'c', day: 2 },
      { id: 'd', day: 2 },
    ]);
  });

  it('원본에서 사라진 장소를 초안·제외 기록·알려진 ID에서 함께 제거한다', () => {
    const sourceItems = [sourceItem('a'), sourceItem('b'), sourceItem('c')];
    const workspace = excludePlanPdfWorkspaceItem(
      createPlanPdfWorkspace({ sourceItems, durationDays: 1 }),
      'b',
    );

    const synced = syncRemovedPlanPdfSourceItems(
      workspace,
      [sourceItems[0]],
      '2026-07-19T01:00:00.000Z',
    );

    expect(synced.draft.items.map(({ id, order }) => ({ id, order }))).toEqual([
      { id: 'a', order: 1 },
    ]);
    expect(synced.excludedItems).toEqual([]);
    expect(synced.knownSourceItemIds).toEqual(['a']);
    expect(workspace.knownSourceItemIds).toEqual(['a', 'b', 'c']);
  });

  it('대상이 없거나 변경이 없으면 동일 객체와 시각을 유지한다', () => {
    const workspace = createPlanPdfWorkspace({
      sourceItems: [sourceItem('a')],
      durationDays: 1,
      now: '2026-07-19T00:00:00.000Z',
    });

    expect(excludePlanPdfWorkspaceItem(workspace, 'missing')).toBe(workspace);
    expect(undoExcludedPlanPdfWorkspaceItem(workspace, 1)).toBe(workspace);
    expect(addPendingPlanPdfItems(workspace, [sourceItem('a')], ['a'], 1))
      .toBe(workspace);
    expect(syncRemovedPlanPdfSourceItems(workspace, [sourceItem('a')]))
      .toBe(workspace);
  });
});

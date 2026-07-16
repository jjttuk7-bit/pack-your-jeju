import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildInitialPlanPdfDraft,
  changePlanPdfItemDay,
  movePlanPdfItem,
} from '../src/planPdf.ts';

function item(id, day = null) {
  return {
    id,
    name: `장소 ${id}`,
    moment: 'local_food',
    source: 'web_search',
    day,
    note: `${id} 메모`,
  };
}

test('selected places are distributed contiguously across trip days while preserving order', () => {
  const draft = buildInitialPlanPdfDraft(
    [item('a'), item('b'), item('c'), item('d'), item('e')],
    2,
  );

  assert.deepEqual(
    draft.items.map((entry) => [entry.id, entry.day, entry.order]),
    [
      ['a', 1, 1],
      ['b', 1, 2],
      ['c', 1, 3],
      ['d', 2, 1],
      ['e', 2, 2],
    ],
  );
});

test('existing valid days are preserved and invalid days are normalized', () => {
  const draft = buildInitialPlanPdfDraft(
    [item('a', 2), item('b', 0), item('c', 8)],
    3,
    '제주의 봄',
  );

  assert.equal(draft.title, '제주의 봄');
  assert.equal(draft.items.find((entry) => entry.id === 'a').day, 2);
  assert.equal(draft.items.find((entry) => entry.id === 'b').day, 2);
  assert.equal(draft.items.find((entry) => entry.id === 'c').day, 3);
  assert.equal(draft.items[0].pdfMemo, 'a 메모');
});

test('changing a day appends the place and renumbers both affected days', () => {
  const initial = buildInitialPlanPdfDraft(
    [item('a'), item('b'), item('c'), item('d')],
    2,
  );
  const changed = changePlanPdfItemDay(initial.items, 'a', 2, 2);

  assert.deepEqual(
    changed.map((entry) => [entry.id, entry.day, entry.order]),
    [
      ['b', 1, 1],
      ['c', 2, 1],
      ['d', 2, 2],
      ['a', 2, 3],
    ],
  );
});

test('moving a place changes order only within its day', () => {
  const initial = buildInitialPlanPdfDraft(
    [item('a'), item('b'), item('c'), item('d')],
    2,
  );
  const moved = movePlanPdfItem(initial.items, 'b', 'up');

  assert.deepEqual(
    moved.map((entry) => [entry.id, entry.day, entry.order]),
    [
      ['b', 1, 1],
      ['a', 1, 2],
      ['c', 2, 1],
      ['d', 2, 2],
    ],
  );
});

test('empty plans stay empty', () => {
  assert.deepEqual(buildInitialPlanPdfDraft([], 3).items, []);
});

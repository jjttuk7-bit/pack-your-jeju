import {describe, expect, it} from 'vitest';

import {
  applyRouteProposal,
  previewRouteProposal,
  undoRouteProposal,
} from './routeProposal';
import {planFingerprint} from './weatherProposal';
import type {RouteChangeProposal, TravelPlanItem} from './types';


function plan(): TravelPlanItem[] {
  return [
    {
      id: 'a',
      name: '오름',
      moment: 'oreum',
      source: 'public_data',
      day: 1,
      date: '2026-07-20',
      daypart: 'morning',
      fixed: false,
    },
    {
      id: 'b',
      name: '시장',
      moment: 'local_market',
      source: 'public_data',
      day: 1,
      date: '2026-07-20',
      daypart: 'afternoon',
      fixed: false,
    },
    {
      id: 'c',
      name: '카페',
      moment: 'quiet_cafe',
      source: 'web_search',
      day: 1,
      date: '2026-07-20',
      daypart: 'evening',
      fixed: false,
    },
  ];
}


function proposal(items = plan()): RouteChangeProposal {
  return {
    proposal_id: 'route-proposal-1',
    fingerprint: 'route-recommended',
    base_plan_fingerprint: 'server-fingerprint',
    basePlanFingerprint: planFingerprint(items),
    operations: [
      {
        type: 'reorder_day_items',
        day: 1,
        ordered_item_ids: ['b', 'a', 'c'],
      },
    ],
    saved_duration_s: 1_200,
    saved_distance_m: 12_000,
    reasons: ['이동시간을 20분 줄입니다.'],
  };
}


describe('route proposal guard', () => {
  it('does not change the source plan before approval', () => {
    const items = plan();

    const preview = previewRouteProposal(items, proposal(items));

    expect(preview.ok).toBe(true);
    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(preview.items.map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('rejects a stale proposal', () => {
    const items = plan();
    const stale = proposal(items);
    const edited = items.map((item) => item.id === 'a' ? {...item, daypart: 'evening' as const} : item);

    const result = applyRouteProposal(edited, stale);

    expect(result.ok).toBe(false);
    expect(result.items).toEqual(edited);
  });

  it('rejects moving a fixed item', () => {
    const items = plan().map((item) => item.id === 'a' ? {...item, fixed: true} : item);
    const moving = proposal(items);

    const result = applyRouteProposal(items, moving);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/고정/);
  });

  it('undoes only the exact applied plan', () => {
    const items = plan();
    const applied = applyRouteProposal(items, proposal(items));
    expect(applied.ok).toBe(true);

    const undone = undoRouteProposal(applied.items, applied.undo!);
    expect(undone.ok).toBe(true);
    expect(undone.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);

    const manuallyEdited = applied.items.map((item) => (
      item.id === 'c' ? {...item, fixed: true} : item
    ));
    const blocked = undoRouteProposal(manuallyEdited, applied.undo!);
    expect(blocked.ok).toBe(false);
    expect(blocked.items).toEqual(manuallyEdited);
  });
});

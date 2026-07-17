import {describe, expect, it} from 'vitest';

import type {TravelPlanItem, WeatherChangeProposal} from './types';
import {
  applyWeatherProposal,
  planFingerprint,
  previewWeatherProposal,
  undoWeatherProposal,
} from './weatherProposal';


function samplePlan(): TravelPlanItem[] {
  return [
    {
      id: 'outdoor',
      name: '성산 오름',
      moment: 'oreum',
      source: 'public_data',
      day: 1,
      date: '2026-07-20',
      daypart: 'morning',
      startTime: '09:00',
      region: 'seongsan',
      fixed: false,
    },
    {
      id: 'indoor',
      name: '제주 전시',
      moment: 'culture_stop',
      source: 'public_data',
      day: 1,
      date: '2026-07-20',
      daypart: 'afternoon',
      startTime: '14:00',
      region: 'seongsan',
      fixed: false,
    },
  ];
}


function sampleProposal(items = samplePlan()): WeatherChangeProposal {
  return {
    proposal_id: 'weather-1',
    fingerprint: 'forecast-proposal-1',
    basePlanFingerprint: planFingerprint(items),
    severity: 'adjust',
    reason: '오전 비 예보로 시간 교환을 권합니다.',
    signals: ['rain'],
    operations: [{type: 'swap_daypart', item_ids: ['outdoor', 'indoor']}],
    affected_item_ids: ['outdoor', 'indoor'],
    requires_recalculation: false,
  };
}


describe('weather proposal state changes', () => {
  it('does not change a plan before explicit apply', () => {
    const plan = samplePlan();
    const snapshot = structuredClone(plan);

    const preview = previewWeatherProposal(plan, sampleProposal(plan));

    expect(plan).toEqual(snapshot);
    expect(preview.ok).toBe(true);
    expect(preview.items).not.toBe(plan);
  });

  it('applies every operation atomically', () => {
    const plan = samplePlan();

    const result = applyWeatherProposal(plan, sampleProposal(plan));

    expect(result.ok).toBe(true);
    expect(result.items.find((item) => item.id === 'outdoor')?.daypart).toBe('afternoon');
    expect(result.items.find((item) => item.id === 'outdoor')?.startTime).toBe('14:00');
    expect(result.items.find((item) => item.id === 'indoor')?.daypart).toBe('morning');
    expect(plan[0].daypart).toBe('morning');
  });

  it('rejects an outdated proposal without partial changes', () => {
    const plan = samplePlan();
    const proposal = {...sampleProposal(plan), basePlanFingerprint: 'old-plan'};

    const result = applyWeatherProposal(plan, proposal);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/달라/);
    expect(result.items).toEqual(plan);
  });

  it('restores the exact previous snapshot', () => {
    const before = samplePlan();
    const applied = applyWeatherProposal(before, sampleProposal(before));

    expect(applied.ok).toBe(true);
    expect(undoWeatherProposal(applied.items, applied.undo!)).toEqual(before);
  });

  it('rejects moving a fixed item', () => {
    const plan = samplePlan();
    plan[0].fixed = true;

    const result = applyWeatherProposal(plan, sampleProposal(plan));

    expect(result.ok).toBe(false);
    expect(result.items).toEqual(plan);
  });

  it('cancels every operation when operations overlap', () => {
    const plan = samplePlan();
    plan.push({
      id: 'cafe',
      name: '조용한 카페',
      moment: 'quiet_cafe',
      source: 'public_data',
      day: 1,
      date: '2026-07-20',
      daypart: 'evening',
      region: 'seongsan',
      fixed: false,
    });
    const proposal: WeatherChangeProposal = {
      ...sampleProposal(plan),
      operations: [
        {type: 'swap_daypart', item_ids: ['outdoor', 'indoor']},
        {type: 'swap_daypart', item_ids: ['outdoor', 'cafe']},
      ],
    };

    const result = applyWeatherProposal(plan, proposal);

    expect(result.ok).toBe(false);
    expect(result.items).toEqual(plan);
  });

  it('does not undo over newer user edits', () => {
    const before = samplePlan();
    const applied = applyWeatherProposal(before, sampleProposal(before));
    const edited = applied.items.map((item) => (
      item.id === 'outdoor' ? {...item, fixed: true} : item
    ));

    expect(undoWeatherProposal(edited, applied.undo!)).toEqual(edited);
  });
});

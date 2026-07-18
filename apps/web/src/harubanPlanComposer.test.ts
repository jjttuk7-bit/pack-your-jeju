import {describe, expect, it} from 'vitest';

import {createHarubanPlanDraft} from './harubanPlanComposer';
import type {
  RoutePlanResponse,
  TravelInfo,
  TravelPlanItem,
  WeatherReportResponse,
} from './types';


const info: TravelInfo = {
  regions: ['jeju'],
  startDate: '2026-07-20',
  durationDays: 2,
  companion: 'solo',
  purpose: 'healing',
};

const items: TravelPlanItem[] = [
  {
    id: 'a',
    name: '제주 숲',
    moment: 'forest',
    source: 'public_data',
    region: 'jeju',
    day: 1,
    daypart: 'morning',
    startTime: '09:00',
    latitude: 33.4,
    longitude: 126.5,
  },
  {
    id: 'b',
    name: '제주 카페',
    moment: 'cafe',
    source: 'web_search',
    region: 'jeju',
    day: 1,
    daypart: 'afternoon',
    startTime: '14:00',
    latitude: 33.41,
    longitude: 126.51,
  },
  {
    id: 'c',
    name: '예약한 식당',
    moment: 'food',
    source: 'user_added',
    region: 'jeju',
    day: 2,
    daypart: 'evening',
    startTime: '18:00',
    fixed: true,
    reservationNote: '예약 18:00',
  },
];

function weatherReport(): WeatherReportResponse {
  return {
    status: 'adjust',
    headline: '비를 피해 시간대를 바꿔보세요.',
    periods: [],
    impacts: [
      {
        item_id: 'a',
        region: 'jeju',
        date: '2026-07-20',
        daypart: 'morning',
        status: 'adjust',
        signals: ['비'],
        reason: '오전 비 예보를 피합니다.',
        policy_version: 'test',
        source_label: '기상청',
        forecast_issued_at: '2026-07-18T00:00:00Z',
      },
    ],
    proposals: [
      {
        proposal_id: 'weather-1',
        fingerprint: 'weather-next',
        severity: 'adjust',
        reason: '오전 비를 피해 순서를 바꿉니다.',
        signals: ['비'],
        operations: [{type: 'swap_daypart', item_ids: ['a', 'b']}],
        affected_item_ids: ['a', 'b'],
        requires_recalculation: true,
      },
    ],
    forecast_meta: {
      provider: 'kma',
      requested_regions: ['jeju'],
      available_regions: ['jeju'],
      unavailable_regions: [],
      partial: false,
      issues: [],
      failures: [],
    },
  };
}

function routeReport(): RoutePlanResponse {
  return {
    status: 'verified_route',
    headline: '가까운 장소 순서로 조정합니다.',
    partial: false,
    days: [],
    proposal: {
      proposal_id: 'route-1',
      fingerprint: 'route-next',
      base_plan_fingerprint: 'route-base',
      operations: [
        {type: 'reorder_day_items', day: 1, ordered_item_ids: ['b', 'a']},
      ],
      saved_duration_s: 900,
      saved_distance_m: 3200,
      reasons: ['이동시간을 15분 줄이는 순서입니다.'],
    },
    provider_meta: {
      providers: ['test-route'],
      checked_at: '2026-07-18T01:00:00Z',
      verified_segments: 2,
      estimated_segments: 0,
      failures: [],
    },
  };
}

describe('haruban plan composer', () => {
  it('applies weather and route proposals to a separate editable draft', () => {
    const original = structuredClone(items);

    const draft = createHarubanPlanDraft({
      info,
      items,
      weatherReport: weatherReport(),
      routeReport: routeReport(),
      now: '2026-07-18T02:00:00Z',
    });

    expect(items).toEqual(original);
    expect(draft.items.map((item) => item.id)).toEqual(['b', 'a', 'c']);
    expect(draft.items.find((item) => item.id === 'a')).toMatchObject({
      daypart: 'afternoon',
      source: 'public_data',
    });
    expect(draft.items.find((item) => item.id === 'c')).toMatchObject({
      fixed: true,
      startTime: '18:00',
      reservationNote: '예약 18:00',
    });
    expect(draft.weather.status).toBe('applied');
    expect(draft.route.status).toBe('applied');
    expect(draft.reasonsByItemId.a).toContain('오전 비 예보를 피합니다.');
    expect(draft.sourcePlanFingerprint).toMatch(/^plan-/);
  });

  it('keeps a usable base draft and exposes partial-check warnings', () => {
    const draft = createHarubanPlanDraft({
      info,
      items,
      weatherError: '기상청 연결 실패',
      routeError: '동선 서비스 연결 실패',
      now: '2026-07-18T02:00:00Z',
    });

    expect(draft.items).toHaveLength(3);
    expect(draft.weather.status).toBe('unavailable');
    expect(draft.route.status).toBe('unavailable');
    expect(draft.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('기상청 연결 실패'),
      expect.stringContaining('동선 서비스 연결 실패'),
      expect.stringContaining('예약한 식당'),
    ]));
  });
});

import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import TravelRouteCard from './TravelRouteCard';
import type {
  RouteChangeProposal,
  RouteMode,
  RoutePlanResponse,
  RouteSegment,
  TravelPlanItem,
} from '../types';


const planItems: TravelPlanItem[] = [
  {
    id: 'market',
    name: '제주 시장',
    moment: 'local_market',
    source: 'public_data',
    day: 1,
    daypart: 'morning',
    fixed: false,
  },
  {
    id: 'cafe',
    name: '바다 카페',
    moment: 'quiet_cafe',
    source: 'web_search',
    day: 1,
    daypart: 'afternoon',
    fixed: false,
  },
  {
    id: 'oreum',
    name: '제주 오름',
    moment: 'oreum',
    source: 'public_data',
    day: 2,
    daypart: 'morning',
    fixed: false,
  },
];


const proposal: RouteChangeProposal = {
  proposal_id: 'route-proposal',
  fingerprint: 'route-next',
  base_plan_fingerprint: 'server-base',
  operations: [
    {type: 'reorder_day_items', day: 1, ordered_item_ids: ['cafe', 'market']},
  ],
  saved_duration_s: 2_700,
  saved_distance_m: 25_000,
  reasons: ['시장과 카페를 연속 방문하면 이동 부담이 줄어듭니다.'],
};


function response(status: 'verified_route' | 'estimated_route' = 'verified_route'): RoutePlanResponse {
  const segment: RouteSegment = {
    from_id: 'origin',
    to_id: 'market',
    distance_m: 24_000,
    duration_s: 2_400,
    status,
    provider: status === 'verified_route' ? 'naver_directions' : 'route-travel-v1',
    geometry: [
      {lat: 33.5, lng: 126.5},
      {lat: 33.45, lng: 126.6},
    ],
  };
  return {
    status,
    headline: '이동 부담을 줄일 수 있는 동선을 제안합니다.',
    partial: status !== 'verified_route',
    days: [
      {
        day: 1,
        headline: '이동 부담을 줄일 수 있는 동선을 제안합니다.',
        current_item_ids: ['market', 'cafe'],
        recommended_item_ids: ['cafe', 'market'],
        current: {
          item_ids: ['market', 'cafe'],
          segments: [segment],
          total_duration_s: 9_600,
          total_distance_m: 96_000,
          status,
        },
        recommended: {
          item_ids: ['cafe', 'market'],
          segments: [segment],
          total_duration_s: 6_900,
          total_distance_m: 71_000,
          status,
        },
      },
    ],
    proposal,
    provider_meta: {
      providers: [segment.provider],
      checked_at: '2026-07-17T00:00:00Z',
      verified_segments: status === 'verified_route' ? 1 : 0,
      estimated_segments: status === 'estimated_route' ? 1 : 0,
      failures: [],
    },
  };
}


function renderCard(options?: {
  routeResponse?: RoutePlanResponse;
  mode?: RouteMode;
  onApply?: (next: RouteChangeProposal) => void;
}) {
  const onRequest = vi.fn();
  const onApply = options?.onApply ?? vi.fn();
  render(
    <TravelRouteCard
      planItems={planItems}
      activeDay={1}
      mode={options?.mode ?? 'driving'}
      originLabel="숙소"
      destinationLabel="숙소"
      response={options?.routeResponse ?? response()}
      loading={false}
      error={null}
      canUndo={false}
      actionMessage={null}
      onActiveDayChange={vi.fn()}
      onModeChange={vi.fn()}
      onRequest={onRequest}
      onApply={onApply}
      onDismiss={vi.fn()}
      onUndo={vi.fn()}
    />,
  );
  return {onRequest, onApply};
}


describe('TravelRouteCard', () => {
  it('shows day tabs, mode controls, endpoints, and route summary', () => {
    renderCard();

    expect(screen.getByRole('tab', {name: 'Day 1'})).toBeVisible();
    expect(screen.getByRole('tab', {name: 'Day 2'})).toBeVisible();
    expect(screen.getByRole('radio', {name: '자동차'})).toBeChecked();
    expect(screen.getByText('숙소 → 숙소')).toBeVisible();
    expect(screen.getByText(/2시간 40분/)).toBeVisible();
  });

  it('shows comparison and waits for explicit approval', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const {onRequest} = renderCard({onApply});

    await user.click(screen.getByRole('button', {name: '동선 추천받기'}));
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(/45분 절약/)).toBeVisible();

    await user.click(screen.getByRole('button', {name: '이 순서로 적용'}));
    expect(onApply).toHaveBeenCalledWith(proposal);
  });

  it('labels fallback without pretending it is verified', () => {
    renderCard({routeResponse: response('estimated_route')});

    expect(screen.getByText('예상 동선')).toBeVisible();
    expect(screen.queryByText('실제 경로 확인')).not.toBeInTheDocument();
  });
});

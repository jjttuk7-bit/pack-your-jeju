import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import TravelRouteMap from './TravelRouteMap';
import type {RouteDayResult, RouteLocation, TravelPlanItem} from '../types';


const origin: RouteLocation = {label: '숙소', lat: 33.50, lng: 126.50};
const destination: RouteLocation = {label: '숙소', lat: 33.50, lng: 126.50};
const planItems: TravelPlanItem[] = [
  {
    id: 'market',
    name: '제주 시장',
    moment: 'local_market',
    source: 'public_data',
    day: 1,
    daypart: 'morning',
    latitude: 33.49,
    longitude: 126.53,
  },
  {
    id: 'cafe',
    name: '바다 카페',
    moment: 'quiet_cafe',
    source: 'web_search',
    day: 1,
    daypart: 'afternoon',
    latitude: 33.47,
    longitude: 126.58,
  },
];


const dayRoute: RouteDayResult = {
  day: 1,
  headline: '현재 동선이 적절합니다.',
  current_item_ids: ['market', 'cafe'],
  recommended_item_ids: ['cafe', 'market'],
  current: {
    item_ids: ['market', 'cafe'],
    total_duration_s: 3_600,
    total_distance_m: 24_000,
    status: 'estimated_route',
    segments: [
      {
        from_id: 'origin',
        to_id: 'market',
        distance_m: 10_000,
        duration_s: 1_500,
        status: 'estimated_route',
        provider: 'route-travel-v1',
        geometry: [origin, {lat: 33.49, lng: 126.53}],
      },
    ],
  },
  recommended: {
    item_ids: ['cafe', 'market'],
    total_duration_s: 3_000,
    total_distance_m: 20_000,
    status: 'estimated_route',
    segments: [
      {
        from_id: 'origin',
        to_id: 'cafe',
        distance_m: 9_000,
        duration_s: 1_200,
        status: 'estimated_route',
        provider: 'route-travel-v1',
        geometry: [origin, {lat: 33.47, lng: 126.58}],
      },
    ],
  },
};


describe('TravelRouteMap', () => {
  it('renders ordered marker labels and an accessible route summary', () => {
    render(
      <TravelRouteMap
        activeDay={1}
        dayRoute={dayRoute}
        planItems={planItems}
        origin={origin}
        destination={destination}
        showRecommended
      />,
    );

    expect(screen.getByLabelText('1. 숙소')).toBeVisible();
    expect(screen.getByLabelText('2. 바다 카페')).toBeVisible();
    expect(screen.getByLabelText('3. 제주 시장')).toBeVisible();
    expect(screen.getByText('Day 1 동선 1개 구간')).toBeVisible();
  });

  it('keeps an honest fallback map when the Naver SDK is unavailable', () => {
    render(
      <TravelRouteMap
        activeDay={1}
        dayRoute={dayRoute}
        planItems={planItems}
        origin={origin}
        destination={destination}
        showRecommended
      />,
    );

    expect(screen.getByText(/간이 지도/)).toBeVisible();
    expect(screen.getByText(/예상 동선/)).toBeVisible();
  });
});

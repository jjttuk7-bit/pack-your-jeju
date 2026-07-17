import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import type {TravelPlanItem, WeatherReportResponse} from '../types';
import WeatherDecisionReport from './WeatherDecisionReport';


const planItems: TravelPlanItem[] = [
  {
    id: 'outdoor',
    name: '성산 오름',
    moment: 'oreum',
    source: 'public_data',
    day: 1,
    date: '2026-07-20',
    daypart: 'morning',
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
    region: 'seongsan',
    fixed: false,
  },
];


function adjustmentReport(): WeatherReportResponse {
  return {
    status: 'adjust',
    headline: '날씨를 고려해 바꿔볼 일정을 제안합니다.',
    periods: [
      {
        region: 'seongsan',
        date: '2026-07-20',
        daypart: 'morning',
        available: true,
        sky: '흐림',
        precipitation_type: '비',
        precipitation_probability_max: 80,
        temperature_min: 23,
        temperature_max: 25,
        wind_speed_max: 6,
        source_issued_at_label: '2026년 7월 19일 05시 발표',
      },
      {
        region: 'seongsan',
        date: '2026-07-20',
        daypart: 'afternoon',
        available: true,
        sky: '맑음',
        precipitation_type: '강수 없음',
        precipitation_probability_max: 10,
        temperature_min: 27,
        temperature_max: 28,
        wind_speed_max: 2,
      },
    ],
    impacts: [
      {
        item_id: 'outdoor',
        region: 'seongsan',
        date: '2026-07-20',
        daypart: 'morning',
        status: 'adjust',
        signals: ['rain', 'wind'],
        reason: '비와 바람이 야외 일정에 영향을 줄 수 있습니다.',
        policy_version: 'weather-travel-v1',
        source_label: '기상청 예보 · 제주를 담다 여행 판단 기준',
      },
    ],
    proposals: [
      {
        proposal_id: 'weather-1',
        fingerprint: 'proposal-1',
        severity: 'adjust',
        reason: '오전 오름과 오후 전시의 시간 교환을 권합니다.',
        signals: ['rain'],
        operations: [{type: 'swap_daypart', item_ids: ['outdoor', 'indoor']}],
        affected_item_ids: ['outdoor', 'indoor'],
        requires_recalculation: false,
      },
    ],
    forecast_meta: {
      provider: 'kma_vilage_fcst',
      requested_regions: ['seongsan'],
      available_regions: ['seongsan'],
      unavailable_regions: [],
      partial: false,
      issues: [
        {
          region: 'seongsan',
          source_issued_at_label: '2026년 7월 19일 05시 발표',
        },
      ],
      failures: [],
    },
  };
}


describe('WeatherDecisionReport', () => {
  it('shows forecast source and affected itinerary', () => {
    render(
      <WeatherDecisionReport
        report={adjustmentReport()}
        planItems={planItems}
        onApply={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('조정 권장')).toBeInTheDocument();
    expect(screen.getAllByText(/기상청/).length).toBeGreaterThan(0);
    expect(screen.getByText('성산 오름')).toBeInTheDocument();
  });

  it('does not apply until the user confirms', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <WeatherDecisionReport
        report={adjustmentReport()}
        planItems={planItems}
        onApply={onApply}
        onDismiss={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', {name: '변경안 보기'}));
    expect(onApply).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', {name: '변경안 적용'}));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('lets the user keep the existing itinerary', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <WeatherDecisionReport
        report={adjustmentReport()}
        planItems={planItems}
        onApply={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    await user.click(screen.getByRole('button', {name: '변경안 보기'}));
    await user.click(screen.getByRole('button', {name: '기존 일정 유지'}));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders partial and unknown states without invented changes', () => {
    const report: WeatherReportResponse = {
      ...adjustmentReport(),
      status: 'unknown',
      headline: '확인 가능한 예보가 부족해 일정을 자동 판단하지 않습니다.',
      periods: [],
      impacts: [],
      proposals: [],
      forecast_meta: {
        ...adjustmentReport().forecast_meta,
        available_regions: [],
        unavailable_regions: ['udo'],
        partial: true,
        failures: [{region: 'udo', reason: 'timeout'}],
      },
    };

    render(
      <WeatherDecisionReport
        report={report}
        planItems={planItems}
        onApply={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('판단 보류')).toBeInTheDocument();
    expect(screen.getByText(/일부 지역 예보 확인 불가/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '변경안 적용'})).not.toBeInTheDocument();
  });
});

import {useMemo, useState} from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import WeatherDecisionReport from './components/WeatherDecisionReport';
import type {
  TravelInfo,
  TravelPlanItem,
  WeatherChangeProposal,
  WeatherReportResponse,
} from './types';
import {
  applyWeatherProposal,
  planFingerprint,
  schedulePlanItemsForWeather,
  toWeatherReportItems,
  undoWeatherProposal,
  type WeatherUndoSnapshot,
} from './weatherProposal';


const info: TravelInfo = {
  regions: ['seongsan'],
  startDate: '2026-07-20',
  durationDays: 2,
  companion: 'solo',
  purpose: 'healing',
};

const initialItems: TravelPlanItem[] = [
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


function reportFor(items: TravelPlanItem[]): WeatherReportResponse {
  return {
    status: 'adjust',
    headline: '비 예보를 고려한 일정 변경안을 확인해 주세요.',
    periods: [],
    impacts: [
      {
        item_id: 'outdoor',
        region: 'seongsan',
        date: '2026-07-20',
        daypart: 'morning',
        status: 'adjust',
        signals: ['rain'],
        reason: '오전 비 예보가 있습니다.',
        policy_version: 'weather-travel-v1',
        source_label: '기상청 예보 · 제주를 담다 여행 판단 기준',
      },
    ],
    proposals: [
      {
        proposal_id: 'weather-1',
        fingerprint: 'proposal-1',
        basePlanFingerprint: planFingerprint(items),
        severity: 'adjust',
        reason: '오전 오름과 오후 전시를 바꿔볼 수 있습니다.',
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
      issues: [],
      failures: [],
    },
  };
}


function WeatherIntegrationHarness() {
  const [items, setItems] = useState(initialItems);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [undo, setUndo] = useState<WeatherUndoSnapshot | null>(null);
  const report = useMemo(() => {
    const current = reportFor(items);
    return {
      ...current,
      proposals: current.proposals.filter(
        (proposal) => !dismissed.includes(proposal.fingerprint),
      ),
    };
  }, [items, dismissed]);
  const outdoor = items.find((item) => item.id === 'outdoor')!;

  const apply = (proposal: WeatherChangeProposal) => {
    const result = applyWeatherProposal(items, proposal);
    if (!result.ok) return;
    setItems(result.items);
    setUndo(result.undo ?? null);
  };

  return (
    <>
      <p>{outdoor.daypart === 'morning' ? '오전' : '오후'} · {outdoor.name}</p>
      <output aria-label="유지한 제안">{dismissed.join(',')}</output>
      <WeatherDecisionReport
        report={report}
        planItems={items}
        onApply={apply}
        onDismiss={(proposal) => setDismissed((current) => [...current, proposal.fingerprint])}
        canUndo={Boolean(undo)}
        onUndo={() => {
          if (!undo) return;
          setItems(undoWeatherProposal(items, undo));
          setUndo(null);
        }}
        actionMessage={undo ? '날씨 변경안을 플랜에 반영했습니다.' : null}
      />
    </>
  );
}


describe('weather report and saved plan integration', () => {
  it('applies a proposal only after approval and exposes undo', async () => {
    const user = userEvent.setup();
    render(<WeatherIntegrationHarness />);

    expect(screen.getByText('오전 · 성산 오름')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: '변경안 보기'}));
    expect(screen.getByText('오전 · 성산 오름')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: '변경안 적용'}));
    expect(screen.getByText('오후 · 성산 오름')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: '되돌리기'}));
    expect(screen.getByText('오전 · 성산 오름')).toBeInTheDocument();
  });

  it('stores an explicitly kept proposal and hides it', async () => {
    const user = userEvent.setup();
    render(<WeatherIntegrationHarness />);

    await user.click(screen.getByRole('button', {name: '변경안 보기'}));
    await user.click(screen.getByRole('button', {name: '기존 일정 유지'}));

    expect(screen.getByLabelText('유지한 제안')).toHaveTextContent('proposal-1');
    expect(screen.queryByRole('button', {name: '변경안 보기'})).not.toBeInTheDocument();
  });

  it('normalizes missing schedule fields and excludes unknown regions from weather calls', () => {
    const scheduled = schedulePlanItemsForWeather(info, [
      {
        id: 'known',
        name: '성산 카페',
        moment: 'quiet_cafe',
        source: 'public_data',
        region: 'seongsan',
      },
      {
        id: 'unknown',
        name: '지역 미확인 메모',
        moment: 'user_added',
        source: 'user_added',
      },
    ]);

    expect(scheduled[0]).toMatchObject({
      day: 1,
      date: '2026-07-20',
      daypart: 'morning',
      startTime: '09:00',
      fixed: false,
    });
    expect(toWeatherReportItems(info, scheduled).map((item) => item.id)).toEqual(['known']);
  });
});

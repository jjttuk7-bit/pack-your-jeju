import {useState} from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';

import {migrateSavedTravel} from './App';
import TravelRouteCard from './components/TravelRouteCard';
import {
  applyRouteProposal,
  undoRouteProposal,
} from './routeProposal';
import type {
  RouteChangeProposal,
  RoutePlanResponse,
  RouteUndoState,
  TravelPlanItem,
} from './types';
import {planFingerprint} from './weatherProposal';


const initialItems: TravelPlanItem[] = [
  {
    id: 'market',
    name: '제주 시장',
    moment: 'local_market',
    source: 'public_data',
    day: 1,
    daypart: 'morning',
    fixed: false,
    latitude: 33.51,
    longitude: 126.52,
  },
  {
    id: 'cafe',
    name: '바다 카페',
    moment: 'quiet_cafe',
    source: 'public_data',
    day: 1,
    daypart: 'afternoon',
    fixed: false,
    latitude: 33.48,
    longitude: 126.49,
  },
];


function responseFor(items: TravelPlanItem[]): RoutePlanResponse {
  const proposal: RouteChangeProposal = {
    proposal_id: 'route-1',
    fingerprint: 'route-fingerprint-1',
    base_plan_fingerprint: 'server-fingerprint',
    basePlanFingerprint: planFingerprint(items),
    operations: [{
      type: 'reorder_day_items',
      day: 1,
      ordered_item_ids: ['cafe', 'market'],
    }],
    saved_duration_s: 900,
    saved_distance_m: 3400,
    reasons: ['먼 장소를 먼저 방문하면 되돌아가는 이동을 줄일 수 있습니다.'],
  };
  return {
    status: 'estimated_route',
    headline: '예상 이동 기준으로 비교했습니다.',
    partial: false,
    days: [{
      day: 1,
      headline: 'Day 1 예상 동선',
      current_item_ids: ['market', 'cafe'],
      recommended_item_ids: ['cafe', 'market'],
      current: {
        item_ids: ['market', 'cafe'],
        segments: [],
        total_duration_s: 3600,
        total_distance_m: 16000,
        status: 'estimated_route',
      },
      recommended: {
        item_ids: ['cafe', 'market'],
        segments: [],
        total_duration_s: 2700,
        total_distance_m: 12600,
        status: 'estimated_route',
      },
    }],
    proposal,
    provider_meta: {
      providers: ['estimate'],
      checked_at: '2026-07-17T10:00:00+09:00',
      verified_segments: 0,
      estimated_segments: 3,
      failures: [],
    },
  };
}


function RouteIntegrationHarness() {
  const [items, setItems] = useState(initialItems);
  const [undo, setUndo] = useState<RouteUndoState | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const response = responseFor(items);

  return (
    <>
      <output aria-label="현재 장소 순서">{items.map((item) => item.name).join(' → ')}</output>
      <output aria-label="유지한 동선 제안">{dismissed.join(',')}</output>
      <TravelRouteCard
        planItems={items}
        activeDay={1}
        mode="driving"
        originLabel="제주 시장"
        destinationLabel="제주 시장"
        response={dismissed.includes(response.proposal!.fingerprint) ? {...response, proposal: null} : response}
        loading={false}
        error={null}
        canUndo={Boolean(undo)}
        actionMessage={undo ? '추천 동선을 플랜에 반영했습니다.' : null}
        onActiveDayChange={() => undefined}
        onModeChange={() => undefined}
        onRequest={() => undefined}
        onApply={(proposal) => {
          const result = applyRouteProposal(items, proposal);
          if (!result.ok) return;
          setItems(result.items);
          setUndo(result.undo ?? null);
        }}
        onDismiss={(proposal) => setDismissed((current) => [...current, proposal.fingerprint])}
        onUndo={() => {
          if (!undo) return;
          const result = undoRouteProposal(items, undo);
          if (!result.ok) return;
          setItems(result.items);
          setUndo(null);
        }}
      />
    </>
  );
}


describe('route recommendation and saved plan integration', () => {
  it('migrates legacy saved travel with safe route defaults', () => {
    const migrated = migrateSavedTravel({
      info: {
        regions: ['jeju_city'],
        startDate: '2026-07-20',
        durationDays: 2,
        companion: 'solo',
        purpose: 'healing',
      },
      selectedMomentIds: ['local_market'],
      step: 'dashboard',
    });

    expect(migrated.routeDismissedFingerprints).toEqual([]);
    expect(migrated.routeUndo).toBeNull();
    expect(migrated.routeActionMessage).toBeNull();
  });

  it('changes the plan only after approval and can undo it', async () => {
    const user = userEvent.setup();
    render(<RouteIntegrationHarness />);

    expect(screen.getByLabelText('현재 장소 순서')).toHaveTextContent('제주 시장 → 바다 카페');
    await user.click(screen.getByRole('button', {name: '이 순서로 적용'}));
    expect(screen.getByLabelText('현재 장소 순서')).toHaveTextContent('바다 카페 → 제주 시장');
    await user.click(screen.getByRole('button', {name: '되돌리기'}));
    expect(screen.getByLabelText('현재 장소 순서')).toHaveTextContent('제주 시장 → 바다 카페');
  });

  it('remembers an explicitly kept route proposal', async () => {
    const user = userEvent.setup();
    render(<RouteIntegrationHarness />);

    await user.click(screen.getByRole('button', {name: '기존 일정 유지'}));
    expect(screen.getByLabelText('유지한 동선 제안')).toHaveTextContent('route-fingerprint-1');
    expect(screen.queryByRole('button', {name: '이 순서로 적용'})).not.toBeInTheDocument();
  });
});

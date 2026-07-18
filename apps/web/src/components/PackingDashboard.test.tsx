import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PackResponse,
  RoutePlanResponse,
  TravelInfo,
  TravelPlanItem,
  WeatherReportResponse,
} from '../types';
import {
  requestCandidatePage,
  requestPack,
  requestRoutePlan,
  requestVisitSignal,
  requestWeatherReport,
} from '../api';
import PackingDashboard from './PackingDashboard';

vi.mock('../api', () => ({
  requestCandidatePage: vi.fn(),
  requestPack: vi.fn(),
  requestRoutePlan: vi.fn(),
  requestVisitSignal: vi.fn(),
  requestWeatherReport: vi.fn(),
}));

const info: TravelInfo = {
  regions: ['andeok'],
  startDate: '2026-07-18',
  durationDays: 2,
  companion: 'solo',
  purpose: 'healing',
};

const candidate = {
  name: '산방산 둘레길',
  badge: 'verified' as const,
  external_id: 'candidate-1',
  sources: [{ name: '공식', url: 'https://example.com/place' }],
  freshness: { info_type: '운영 정보', valid_until: null },
  transit: { parking: true, parking_count: 1, bus_walkable: true },
  note: '산책 후보',
  address: '제주 서귀포시 안덕면',
  region: 'andeok',
};

const packResponse: PackResponse = {
  pack_id: 'pack-1',
  intro: { text: '안덕의 산책 후보를 준비했어요.', llm_used: false },
  sections: [
    {
      moment: 'beach_walk',
      items: [candidate],
      fallback: null,
      total_count: 1,
      shown_count: 1,
      has_more: false,
      next_cursor: null,
    },
  ],
  itinerary: [
    {
      day: 1,
      date: '2026-07-18',
      items: [{ ...candidate, moment: 'beach_walk' }],
      regions: ['andeok'],
    },
  ],
  packing_additions: [],
  log_id: 'log-1',
};

const noop = vi.fn();

const scheduledPlanItem: TravelPlanItem = {
  id: 'plan-candidate-1',
  name: '산방산 둘레길',
  moment: 'beach_walk',
  source: 'web_search',
  day: 1,
  daypart: 'afternoon',
  startTime: '14:00',
  latitude: 33.24,
  longitude: 126.31,
};

const secondScheduledPlanItem: TravelPlanItem = {
  id: 'plan-candidate-2',
  name: '안덕 숲길',
  moment: 'gotjawal',
  source: 'public_data',
  region: 'andeok',
  day: 1,
  daypart: 'morning',
  startTime: '09:00',
  latitude: 33.25,
  longitude: 126.32,
};

const weatherReport: WeatherReportResponse = {
  status: 'suitable',
  headline: '선택한 일정은 현재 예보와 잘 맞아요.',
  periods: [],
  impacts: [],
  proposals: [],
  forecast_meta: {
    provider: 'kma',
    requested_regions: ['andeok'],
    available_regions: ['andeok'],
    unavailable_regions: [],
    partial: false,
    issues: [],
    failures: [],
  },
};

const routeReport: RoutePlanResponse = {
  status: 'verified_route',
  headline: '가까운 장소부터 잇는 동선으로 정리했어요.',
  partial: false,
  days: [],
  proposal: null,
  provider_meta: {
    providers: ['test-route'],
    checked_at: '2026-07-18T01:00:00Z',
    verified_segments: 1,
    estimated_segments: 0,
    failures: [],
  },
};

function dashboardElement(
  selectedPlanItems: TravelPlanItem[] = [],
  onUpdatePlanSchedule = noop,
) {
  return (
    <PackingDashboard
      info={info}
      selectedMomentIds={['beach_walk']}
      checkedItemIds={[]}
      checkedMemoryIds={[]}
      customBasicItems={[]}
      customMomentItems={{
        oreum: [],
        beach_walk: [],
        sunset: [],
        local_market: [],
        local_food: [],
        quiet_cafe: [],
        gotjawal: [],
        citrus: [],
        stay: [],
        festival_event: [],
        souvenir_shopping: [],
        culture_stop: [],
      }}
      customMemories={[]}
      selectedPlanItems={selectedPlanItems}
      visitChecks={{}}
      weatherDismissedFingerprints={[]}
      weatherUndoAvailable={false}
      weatherActionMessage={null}
      routeDismissedFingerprints={[]}
      routeUndoAvailable={false}
      routeActionMessage={null}
      onToggleItem={noop}
      onToggleMemory={noop}
      onAddCustomBasic={noop}
      onRemoveCustomBasic={noop}
      onAddCustomMomentItem={noop}
      onRemoveCustomMomentItem={noop}
      onAddCustomMemory={noop}
      onRemoveCustomMemory={noop}
      onTogglePlanItem={noop}
      onAddCustomPlanItem={noop}
      onRemovePlanItem={noop}
      onUpdatePlanSchedule={onUpdatePlanSchedule}
      onApplyWeatherProposal={noop}
      onDismissWeatherProposal={noop}
      onUndoWeatherProposal={noop}
      onApplyRouteProposal={noop}
      onDismissRouteProposal={noop}
      onUndoRouteProposal={noop}
      onSetVisitCheck={noop}
      onOpenFeedback={noop}
      onReset={noop}
    />
  );
}

function renderDashboard(
  selectedPlanItems: TravelPlanItem[] = [],
  onUpdatePlanSchedule = noop,
) {
  return render(dashboardElement(selectedPlanItems, onUpdatePlanSchedule));
}

describe('PackingDashboard pack journey guide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requestPack).mockResolvedValue(packResponse);
    vi.mocked(requestCandidatePage).mockRejectedValue(new Error('unused'));
    vi.mocked(requestRoutePlan).mockRejectedValue(new Error('unused'));
    vi.mocked(requestVisitSignal).mockRejectedValue(new Error('unused'));
    vi.mocked(requestWeatherReport).mockRejectedValue(new Error('unused'));
  });

  it('adds the guide without removing existing dashboard controls', async () => {
    renderDashboard();

    expect(await screen.findByRole('navigation', { name: '여행팩 만드는 순서' }))
      .toBeInTheDocument();
    expect(screen.getByText('이번 제주 여행')).toBeInTheDocument();
    expect(screen.getByText('후보를 고르고, 근거를 확인하고, 플랜에 담습니다.'))
      .toBeInTheDocument();
    expect(screen.getByText('내 여행플랜에 담은 것')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /여행 플랜 PDF/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /플랜 공유/ })).toBeInTheDocument();

    expect(document.getElementById('candidate-workbench-header')).toBeInTheDocument();
    expect(document.getElementById('my-plan-builder')).toBeInTheDocument();
    expect(document.getElementById('view-mode-tabs')).toBeInTheDocument();
    expect(document.getElementById('plan-export-actions')).toBeInTheDocument();
  });

  it('introduces all four actions in order without trusting preloaded day data', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    const onUpdatePlanSchedule = vi.fn();
    const { rerender } = renderDashboard([], onUpdatePlanSchedule);

    await screen.findByRole('navigation', { name: '여행팩 만드는 순서' });
    expect(
      screen.getByRole('button', { name: /후보 살펴보기 현재/ }),
    ).toHaveAttribute('aria-current', 'step');

    fireEvent.click(screen.getByRole('button', { name: '지금 후보 둘러보기' }));
    expect(
      screen.getByRole('button', { name: /플랜에 담기 현재/ }),
    ).toHaveAttribute('aria-current', 'step');

    rerender(dashboardElement([scheduledPlanItem], onUpdatePlanSchedule));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /일정 정하기 현재/ }),
      ).toHaveAttribute('aria-current', 'step');
    });

    fireEvent.click(
      screen.getByRole('button', { name: '산방산 둘레길 오전으로 설정' }),
    );
    expect(onUpdatePlanSchedule).toHaveBeenCalledWith('plan-candidate-1', {
      daypart: 'morning',
      startTime: '09:00',
    });
    expect(
      screen.getByRole('button', { name: /저장·공유하기 현재/ }),
    ).toHaveAttribute('aria-current', 'step');
  }, 15_000);

  it('advances to step 4 when the schedule day is changed via the day dropdown', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    const onUpdatePlanSchedule = vi.fn();
    const { rerender } = renderDashboard([], onUpdatePlanSchedule);

    await screen.findByRole('navigation', { name: '여행팩 만드는 순서' });
    fireEvent.click(screen.getByRole('button', { name: '지금 후보 둘러보기' }));
    rerender(dashboardElement([scheduledPlanItem], onUpdatePlanSchedule));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /일정 정하기 현재/ }),
      ).toHaveAttribute('aria-current', 'step');
    });

    fireEvent.change(
      screen.getByRole('combobox', { name: '산방산 둘레길 여행 날짜' }),
      { target: { value: '2' } },
    );
    expect(onUpdatePlanSchedule).toHaveBeenCalledWith('plan-candidate-1', { day: 2 });
    expect(
      screen.getByRole('button', { name: /저장·공유하기 현재/ }),
    ).toHaveAttribute('aria-current', 'step');
  }, 15_000);

  it('scrolls and focuses existing sections while respecting reduced motion', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    renderDashboard();
    await screen.findByRole('navigation', { name: '여행팩 만드는 순서' });

    fireEvent.click(screen.getByRole('button', { name: /일정 정하기 다음/ }));
    const scheduleTarget = document.getElementById('view-mode-tabs');
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    await waitFor(() => expect(scheduleTarget).toHaveFocus());

    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    fireEvent.click(screen.getByRole('button', { name: /저장·공유하기 다음/ }));
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'auto',
      block: 'start',
    });
    await waitFor(() => expect(document.getElementById('plan-export-actions')).toHaveFocus());
  });

  it('optionally composes saved places with fresh weather and route checks', async () => {
    vi.mocked(requestWeatherReport).mockResolvedValue(weatherReport);
    vi.mocked(requestRoutePlan).mockResolvedValue(routeReport);
    renderDashboard([scheduledPlanItem, secondScheduledPlanItem]);

    const composeButton = await screen.findByRole('button', {
      name: /하루방 플랜 조합/,
    });
    fireEvent.click(composeButton);

    await waitFor(() => {
      expect(requestRoutePlan).toHaveBeenCalled();
    });
    expect(requestWeatherReport).toHaveBeenCalled();
    expect(
      await screen.findByText('하루방이 여행 플랜 초안을 만들었어요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '초안 확인하기' })).toBeInTheDocument();
    expect(screen.getByText('원본 플랜은 그대로 유지됩니다.')).toBeInTheDocument();
  }, 30_000);
});

import { useState } from 'react';
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

const thirdScheduledPlanItem: TravelPlanItem = {
  id: 'plan-candidate-3',
  name: '안덕 카페',
  moment: 'quiet_cafe',
  source: 'user_added',
  region: 'andeok',
  day: 2,
  daypart: 'afternoon',
  startTime: '15:00',
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
  onUpdatePlanSchedule: (
    itemId: string,
    patch: Partial<Pick<TravelPlanItem, 'day' | 'daypart' | 'startTime' | 'fixed'>>,
  ) => void = noop,
  onRemovePlanItem: (itemId: string) => void = noop,
  onAddCustomPlanItem: (item: TravelPlanItem) => void = noop,
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
      onAddCustomPlanItem={onAddCustomPlanItem}
      onRemovePlanItem={onRemovePlanItem}
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
  onUpdatePlanSchedule: (
    itemId: string,
    patch: Partial<Pick<TravelPlanItem, 'day' | 'daypart' | 'startTime' | 'fixed'>>,
  ) => void = noop,
  onRemovePlanItem: (itemId: string) => void = noop,
  onAddCustomPlanItem: (item: TravelPlanItem) => void = noop,
) {
  return render(dashboardElement(
    selectedPlanItems,
    onUpdatePlanSchedule,
    onRemovePlanItem,
    onAddCustomPlanItem,
  ));
}

function CustomScheduleDashboard({
  onAddCustomPlanItem,
  onRemovePlanItem,
}: {
  onAddCustomPlanItem: (item: TravelPlanItem) => void;
  onRemovePlanItem: (itemId: string) => void;
}) {
  const [items, setItems] = useState<TravelPlanItem[]>([
    scheduledPlanItem,
    secondScheduledPlanItem,
  ]);

  return dashboardElement(
    items,
    noop,
    (itemId) => {
      onRemovePlanItem(itemId);
      setItems((current) => current.filter((item) => item.id !== itemId));
    },
    (item) => {
      onAddCustomPlanItem(item);
      setItems((current) => [...current, item]);
    },
  );
}

async function addDayTwoCustomSchedule() {
  fireEvent.click(await screen.findByRole('button', {
    name: 'Day 2 일정 직접 추가',
  }));
  fireEvent.change(screen.getByLabelText('일정명'), {
    target: {value: '렌터카 반납'},
  });
  fireEvent.change(screen.getByLabelText('시간'), {
    target: {value: '18:30'},
  });
  fireEvent.change(screen.getByLabelText('장소 또는 주소'), {
    target: {value: '제주공항 렌터카하우스'},
  });
  fireEvent.change(screen.getByLabelText('일정 메모'), {
    target: {value: '출발 2시간 전 도착'},
  });
  fireEvent.click(screen.getByRole('button', {name: '일정 추가'}));
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
  }, 30_000);

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
  }, 30_000);

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

  it('shares the active Haruban order and returns to the original plan on discard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    vi.mocked(requestWeatherReport).mockResolvedValue(weatherReport);
    vi.mocked(requestRoutePlan).mockResolvedValue({
      ...routeReport,
      proposal: {
        proposal_id: 'route-reorder',
        fingerprint: 'route-reorder-fingerprint',
        base_plan_fingerprint: 'route-base',
        operations: [{
          type: 'reorder_day_items',
          day: 1,
          ordered_item_ids: ['plan-candidate-2', 'plan-candidate-1'],
        }],
        saved_duration_s: 600,
        saved_distance_m: 1200,
        reasons: ['가까운 장소부터 이동합니다.'],
      },
    });
    renderDashboard([scheduledPlanItem, secondScheduledPlanItem]);

    fireEvent.click(await screen.findByRole('button', { name: /하루방 플랜 조합/ }));
    await screen.findByText('하루방이 여행 플랜 초안을 만들었어요.');
    fireEvent.click(screen.getByRole('button', { name: /플랜 공유/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const composedText = writeText.mock.calls[0][0] as string;
    expect(composedText.indexOf('- 안덕 숲길')).toBeLessThan(
      composedText.indexOf('- 산방산 둘레길'),
    );

    fireEvent.click(screen.getByRole('button', { name: '내 플랜으로 돌아가기' }));
    fireEvent.click(screen.getByRole('button', { name: /복사 완료|플랜 공유/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    const originalText = writeText.mock.calls[1][0] as string;
    expect(originalText.indexOf('- 산방산 둘레길')).toBeLessThan(
      originalText.indexOf('- 안덕 숲길'),
    );
  }, 30_000);

  it('keeps ordinary PDF edits when the editor closes and opens again', async () => {
    renderDashboard([scheduledPlanItem, secondScheduledPlanItem]);

    fireEvent.click(await screen.findByRole('button', {name: /여행 플랜 PDF/}));
    fireEvent.change(await screen.findByLabelText(
      '산방산 둘레길 여행 메모',
      {},
      {timeout: 10_000},
    ), {
      target: {value: '노을 전에 도착'},
    });
    fireEvent.click(screen.getByRole('button', {name: '나가서 장소 더 보기'}));
    fireEvent.click(screen.getByRole('button', {name: /여행 플랜 PDF/}));

    expect(await screen.findByDisplayValue('노을 전에 도착')).toBeInTheDocument();
  }, 30_000);

  it('adds a fixed custom schedule to both plans and undoes it with the same id', async () => {
    const onAddCustomPlanItem = vi.fn();
    const onRemovePlanItem = vi.fn();
    render(
      <CustomScheduleDashboard
        onAddCustomPlanItem={onAddCustomPlanItem}
        onRemovePlanItem={onRemovePlanItem}
      />,
    );

    fireEvent.click(await screen.findByRole('button', {name: /여행 플랜 PDF/}));
    await addDayTwoCustomSchedule();

    await waitFor(() => expect(onAddCustomPlanItem).toHaveBeenCalledOnce());
    const createdItem = onAddCustomPlanItem.mock.calls[0][0] as TravelPlanItem;
    expect(createdItem).toMatchObject({
      id: expect.stringMatching(/^pdf-user-/),
      name: '렌터카 반납',
      day: 2,
      startTime: '18:30',
      fixed: true,
      source: 'user_added',
      address: '제주공항 렌터카하우스',
      note: '출발 2시간 전 도착',
    });
    expect(await screen.findByRole('heading', {name: '렌터카 반납'}))
      .toBeInTheDocument();
    expect(screen.getByText('18:30 · 고정 일정')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: '추가한 일정 되돌리기'}));

    expect(onRemovePlanItem).toHaveBeenCalledOnce();
    expect(onRemovePlanItem).toHaveBeenCalledWith(createdItem.id);
    await waitFor(() => {
      expect(screen.queryByRole('heading', {name: '렌터카 반납'}))
        .not.toBeInTheDocument();
    });
  }, 30_000);

  it('keeps a custom schedule after closing and reopening the PDF editor', async () => {
    const onAddCustomPlanItem = vi.fn();
    render(
      <CustomScheduleDashboard
        onAddCustomPlanItem={onAddCustomPlanItem}
        onRemovePlanItem={noop}
      />,
    );

    fireEvent.click(await screen.findByRole('button', {name: /여행 플랜 PDF/}));
    await addDayTwoCustomSchedule();
    expect(await screen.findByRole('heading', {name: '렌터카 반납'}))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: '나가서 장소 더 보기'}));
    fireEvent.click(screen.getByRole('button', {name: /여행 플랜 PDF/}));

    expect(await screen.findByRole('heading', {name: '렌터카 반납'}))
      .toBeInTheDocument();
    expect(onAddCustomPlanItem).toHaveBeenCalledOnce();
  }, 30_000);

  it('excludes a custom schedule only from the PDF workspace', async () => {
    const onAddCustomPlanItem = vi.fn();
    const onRemovePlanItem = vi.fn();
    render(
      <CustomScheduleDashboard
        onAddCustomPlanItem={onAddCustomPlanItem}
        onRemovePlanItem={onRemovePlanItem}
      />,
    );

    fireEvent.click(await screen.findByRole('button', {name: /여행 플랜 PDF/}));
    await addDayTwoCustomSchedule();
    expect(await screen.findByRole('heading', {name: '렌터카 반납'}))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {
      name: '렌터카 반납 초안에서 제외',
    }));

    expect(onRemovePlanItem).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('heading', {name: '렌터카 반납'}))
        .not.toBeInTheDocument();
    });
  }, 30_000);

  it('excludes only from the PDF workspace and shares the remaining items', async () => {
    const onRemovePlanItem = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {writeText},
    });
    renderDashboard(
      [scheduledPlanItem, secondScheduledPlanItem],
      noop,
      onRemovePlanItem,
    );

    fireEvent.click(await screen.findByRole('button', {name: /여행 플랜 PDF/}));
    fireEvent.click(await screen.findByRole('button', {
      name: '안덕 숲길 초안에서 제외',
    }));
    fireEvent.click(screen.getByRole('button', {name: '나가서 장소 더 보기'}));

    expect(onRemovePlanItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: /플랜 공유/}));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).not.toContain('- 안덕 숲길');
  }, 30_000);

  it('keeps the draft, offers new source places, and removes deleted source places', async () => {
    const {rerender} = renderDashboard([
      scheduledPlanItem,
      secondScheduledPlanItem,
    ]);

    fireEvent.click(await screen.findByRole('button', {name: /여행 플랜 PDF/}));
    fireEvent.change(await screen.findByLabelText(
      '산방산 둘레길 여행 메모',
      {},
      {timeout: 10_000},
    ), {
      target: {value: '기존 메모 유지'},
    });
    fireEvent.click(screen.getByRole('button', {name: '나가서 장소 더 보기'}));

    rerender(dashboardElement([
      scheduledPlanItem,
      secondScheduledPlanItem,
      thirdScheduledPlanItem,
    ]));
    fireEvent.click(screen.getByRole('button', {name: /여행 플랜 PDF/}));
    expect(await screen.findByDisplayValue('기존 메모 유지')).toBeInTheDocument();
    expect(screen.getByText('새로 담은 장소 1곳이 있어요')).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: '안덕 카페'})).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {
      name: '선택한 장소 초안에 추가',
    }));
    expect(await screen.findByRole('heading', {name: '안덕 카페'}))
      .toBeInTheDocument();

    rerender(dashboardElement([
      scheduledPlanItem,
      thirdScheduledPlanItem,
    ]));
    await waitFor(() => {
      expect(screen.queryByRole('heading', {name: '안덕 숲길'}))
        .not.toBeInTheDocument();
    });
  }, 30_000);

  it('keeps Haruban evidence and edits after closing and reopening the workspace', async () => {
    vi.mocked(requestWeatherReport).mockResolvedValue(weatherReport);
    vi.mocked(requestRoutePlan).mockResolvedValue(routeReport);
    renderDashboard([scheduledPlanItem, secondScheduledPlanItem]);

    fireEvent.click(await screen.findByRole('button', { name: /하루방 플랜 조합/ }));
    await screen.findByText('하루방이 여행 플랜 초안을 만들었어요.');
    fireEvent.click(screen.getByRole('button', {name: '초안 확인하기'}));
    fireEvent.change(await screen.findByLabelText(
      '산방산 둘레길 여행 메모',
      {},
      {timeout: 10_000},
    ), {
      target: {value: '하루방 초안 메모'},
    });
    fireEvent.click(screen.getByRole('button', {name: '나가서 장소 더 보기'}));
    fireEvent.click(screen.getByRole('button', {name: '초안 확인하기'}));

    expect(await screen.findByText('하루방 추천 초안')).toBeInTheDocument();
    expect(screen.getAllByText('선택한 일정은 현재 예보와 잘 맞아요.').length)
      .toBeGreaterThan(0);
    expect(screen.getByDisplayValue('하루방 초안 메모')).toBeInTheDocument();
  }, 30_000);

  it('asks before replacing an edited PDF workspace with a Haruban draft', async () => {
    vi.mocked(requestWeatherReport).mockResolvedValue(weatherReport);
    vi.mocked(requestRoutePlan).mockResolvedValue(routeReport);
    renderDashboard([scheduledPlanItem, secondScheduledPlanItem]);

    fireEvent.click(await screen.findByRole('button', {name: /여행 플랜 PDF/}));
    fireEvent.change(await screen.findByLabelText(
      '산방산 둘레길 여행 메모',
      {},
      {timeout: 10_000},
    ), {
      target: {value: '기존 메모'},
    });
    fireEvent.click(screen.getByRole('button', {name: '나가서 장소 더 보기'}));

    const weatherCallsBeforeCompose = vi.mocked(requestWeatherReport).mock.calls.length;
    fireEvent.click(screen.getByRole('button', {name: /하루방 플랜 조합/}));
    expect(screen.getByRole('dialog', {name: 'PDF 초안 다시 조합'}))
      .toBeInTheDocument();
    expect(requestWeatherReport).toHaveBeenCalledTimes(weatherCallsBeforeCompose);

    fireEvent.click(screen.getByRole('button', {name: '기존 초안 유지'}));
    expect(screen.queryByRole('dialog', {name: 'PDF 초안 다시 조합'}))
      .not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /여행 플랜 PDF/}));
    expect(await screen.findByDisplayValue('기존 메모')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '나가서 장소 더 보기'}));

    fireEvent.click(screen.getByRole('button', {name: /하루방 플랜 조합/}));
    fireEvent.keyDown(window, {key: 'Escape'});
    expect(screen.queryByRole('dialog', {name: 'PDF 초안 다시 조합'}))
      .not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: /하루방 플랜 조합/}));
    fireEvent.click(screen.getByRole('button', {name: '새 초안으로 교체'}));
    expect(
      await screen.findByText('하루방이 여행 플랜 초안을 만들었어요.'),
    ).toBeInTheDocument();
    expect(requestWeatherReport)
      .toHaveBeenCalledTimes(weatherCallsBeforeCompose + 1);
  }, 30_000);
});

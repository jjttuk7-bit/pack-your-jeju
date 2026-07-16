import {afterEach, describe, expect, it, vi} from 'vitest';

import {requestWeatherReport} from './api';


describe('requestWeatherReport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps the scheduled plan to the backend weather-report contract', async () => {
    const responsePayload = {
      status: 'suitable',
      headline: '현재 예보에서는 일정 변경 신호가 없습니다.',
      periods: [],
      impacts: [],
      proposals: [],
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
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responsePayload,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestWeatherReport({
      startDate: '2026-07-20',
      days: 1,
      regions: ['seongsan'],
      dismissedProposalFingerprints: ['dismissed-one'],
      items: [
        {
          id: 'place-1',
          name: '성산 오름',
          day: 1,
          date: '2026-07-20',
          daypart: 'morning',
          startTime: '09:00',
          durationMinutes: 120,
          region: 'seongsan',
          moment: 'oreum',
          fixed: true,
          reservationNote: '오전 예약',
        },
      ],
    });

    expect(result).toEqual(responsePayload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/weather\/report$/);
    expect(JSON.parse(init.body)).toEqual({
      start_date: '2026-07-20',
      days: 1,
      regions: ['seongsan'],
      items: [
        {
          id: 'place-1',
          name: '성산 오름',
          day: 1,
          date: '2026-07-20',
          daypart: 'morning',
          start_time: '09:00',
          duration_minutes: 120,
          region: 'seongsan',
          moment: 'oreum',
          fixed: true,
          reservation_note: '오전 예약',
        },
      ],
      dismissed_proposal_fingerprints: ['dismissed-one'],
    });
  });
});

import {afterEach, describe, expect, it, vi} from 'vitest';

import {requestRoutePlan} from './api';


describe('requestRoutePlan', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps route preferences and scheduled items to the backend contract', async () => {
    const responsePayload = {
      status: 'verified_route',
      headline: '현재 동선이 적절합니다.',
      partial: false,
      days: [],
      proposal: null,
      provider_meta: {
        providers: ['naver_directions'],
        checked_at: '2026-07-17T00:00:00Z',
        verified_segments: 4,
        estimated_segments: 0,
        failures: [],
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responsePayload,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestRoutePlan({
      mode: 'driving',
      origin: {label: '숙소', lat: 33.5, lng: 126.5},
      destination: {label: '숙소', lat: 33.5, lng: 126.5},
      items: [
        {
          id: 'place-1',
          label: '성산 오름',
          lat: 33.45,
          lng: 126.9,
          day: 1,
          daypart: 'morning',
          fixed: true,
          weatherStatus: 'suitable',
          operatingCheckRequired: false,
        },
      ],
      dismissedProposalFingerprints: ['dismissed-one'],
    });

    expect(result).toEqual(responsePayload);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/route\/plan$/);
    expect(JSON.parse(init.body)).toEqual({
      mode: 'driving',
      origin: {label: '숙소', lat: 33.5, lng: 126.5},
      destination: {label: '숙소', lat: 33.5, lng: 126.5},
      items: [
        {
          id: 'place-1',
          label: '성산 오름',
          lat: 33.45,
          lng: 126.9,
          day: 1,
          daypart: 'morning',
          fixed: true,
          weather_status: 'suitable',
          operating_check_required: false,
        },
      ],
      dismissed_proposal_fingerprints: ['dismissed-one'],
    });
  });
});

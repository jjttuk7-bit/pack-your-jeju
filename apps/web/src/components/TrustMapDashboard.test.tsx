import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {requestRegionCoveragePreview} from '../api';
import type {RegionCoveragePreview} from '../types';
import TrustMapDashboard from './TrustMapDashboard';


vi.mock('../api', () => ({
  requestRegionCoveragePreview: vi.fn(),
}));

const mockedPreview = vi.mocked(requestRegionCoveragePreview);

function previewFor(region: string): RegionCoveragePreview {
  return {
    region,
    region_label: region === 'jeju_city' ? '제주시' : region,
    total_places: region === 'jeju_city' ? 128 : 24,
    moments: [
      {
        moment: 'oreum',
        moment_label: '오름',
        category: 'nature',
        verified: 8,
        caution: 1,
        coverage_gap: false,
      },
      {
        moment: 'beach_walk',
        moment_label: '바다 산책',
        category: 'nature',
        verified: 7,
        caution: 1,
        coverage_gap: false,
      },
      {
        moment: 'local_food',
        moment_label: '현지 음식',
        category: 'food',
        verified: 9,
        caution: 2,
        coverage_gap: false,
      },
    ],
    recommended_moments: ['oreum', 'beach_walk', 'local_food'],
    weak_moments: [],
    briefing: '확인 가능한 공공데이터 후보가 있습니다.',
  };
}

describe('TrustMapDashboard terrain map', () => {
  beforeEach(() => {
    mockedPreview.mockImplementation(async (region) => previewFor(region));
  });

  it('renders sea depth, coastline, and Hallasan terrain behind the region controls', async () => {
    render(<TrustMapDashboard onSubmit={vi.fn()} />);

    expect(await screen.findByTestId('jeju-sea-layer')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('jeju-coast-layer')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('hallasan-terrain-layer')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getAllByRole('button', {name: /근거 보기/})).toHaveLength(12);
  });
});

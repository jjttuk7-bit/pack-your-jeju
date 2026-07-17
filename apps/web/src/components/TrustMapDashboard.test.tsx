import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {requestRegionCoveragePreview} from '../api';
import type {MomentId, RegionCoveragePreview, TravelInfo} from '../types';
import TrustMapDashboard from './TrustMapDashboard';


vi.mock('../api', () => ({
  requestRegionCoveragePreview: vi.fn(),
}));

const mockedPreview = vi.mocked(requestRegionCoveragePreview);

const twoRegionTravelInfo: TravelInfo = {
  regions: ['hallim', 'gujwa'],
  startDate: '2026-07-20',
  durationDays: 3,
  companion: 'solo',
  purpose: 'healing',
  specialNotes: '동서쪽의 순간을 차분히 비교하고 싶어요.',
};

const fiveSelectedMoments: MomentId[] = [
  'oreum',
  'beach_walk',
  'sunset',
  'local_food',
  'quiet_cafe',
];

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

  it('shows compact evidence status and a selected visual state without changing the button contract', async () => {
    const user = userEvent.setup();
    render(<TrustMapDashboard onSubmit={vi.fn()} />);

    const jeju = await screen.findByRole('button', {name: '제주시 근거 보기'});
    expect(jeju).toHaveAttribute('data-selected', 'false');
    expect(screen.getByLabelText('제주시 지도 상태')).toHaveTextContent('후보 128');

    await user.dblClick(jeju);

    expect(jeju).toHaveAttribute('aria-pressed', 'true');
    expect(jeju).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('jeju_city-selection-glow')).toBeInTheDocument();
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('opens the region evidence panel with %s', async (_label, key) => {
    const user = userEvent.setup();
    render(<TrustMapDashboard onSubmit={vi.fn()} />);

    const jeju = await screen.findByRole('button', {name: '제주시 근거 보기'});
    jeju.focus();
    await user.keyboard(key);

    expect(jeju).toHaveAttribute('data-active', 'true');
  });

  it('separates terrain shading from public-data status in the legend', async () => {
    render(<TrustMapDashboard onSubmit={vi.fn()} />);

    await screen.findByRole('button', {name: '제주시 근거 보기'});
    expect(screen.getByText('중앙 음영은 지형 표현')).toBeVisible();
  });

  it('keeps the surrounding islands decorative and out of the region button count', async () => {
    render(<TrustMapDashboard onSubmit={vi.fn()} />);

    expect(await screen.findByTestId('jeju-offshore-islands')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getAllByRole('button', {name: /근거 보기/})).toHaveLength(12);
  });

  it('summarizes every selected region and moment combination and switches regions', async () => {
    const user = userEvent.setup();
    render(
      <TrustMapDashboard
        onSubmit={vi.fn()}
        initialInfo={twoRegionTravelInfo}
        initialMoments={fiveSelectedMoments}
      />,
    );

    const inspector = await screen.findByTestId('region-moment-inspector');
    expect(inspector).toHaveTextContent('2개 지역 · 5개 순간 · 총 10개 조합');
    expect(within(inspector).getAllByRole('button', {name: /조합 확인/})).toHaveLength(5);

    await user.click(within(inspector).getByRole('button', {name: '구좌 지역 조합 보기'}));

    expect(within(inspector).getByText('구좌에서 오름에 올라 바람 맞기')).toBeVisible();
  });

  it('advances the confirmation count across selected region and moment combinations', async () => {
    const user = userEvent.setup();
    render(
      <TrustMapDashboard
        onSubmit={vi.fn()}
        initialInfo={twoRegionTravelInfo}
        initialMoments={fiveSelectedMoments.slice(0, 2)}
      />,
    );

    const inspector = await screen.findByTestId('region-moment-inspector');
    expect(within(inspector).getByText('확인 1 / 4')).toBeVisible();

    await user.click(within(inspector).getByRole('button', {name: '다음 조합'}));

    expect(within(inspector).getByText('확인 2 / 4')).toBeVisible();
    expect(within(inspector).getByText('한림에서 바다 산책하기')).toBeVisible();
  });

  it('shows only unreviewed moment controls while preserving the active detail', async () => {
    const user = userEvent.setup();
    render(
      <TrustMapDashboard
        onSubmit={vi.fn()}
        initialInfo={{...twoRegionTravelInfo, regions: ['hallim']}}
        initialMoments={['oreum', 'beach_walk', 'quiet_cafe']}
      />,
    );

    const inspector = await screen.findByTestId('region-moment-inspector');
    await user.click(
      within(inspector).getByRole('button', {name: '미확인만 보기'}),
    );

    expect(
      within(inspector).queryByRole('button', {
        name: /한림에서 오름에 올라 바람 맞기 조합 확인/,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(inspector).getByRole('button', {
        name: /한림에서 바다 산책하기 조합 확인/,
      }),
    ).toBeVisible();
    expect(
      within(inspector).getByText('한림에서 오름에 올라 바람 맞기'),
    ).toBeVisible();
  });
});

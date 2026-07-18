import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import type {PlanPdfDraft} from '../planPdf';
import type {HarubanPlanDraft, TravelInfo, TravelPlanItem} from '../types';
import PlanPdfEditor from './PlanPdfEditor';


vi.mock('../api', () => ({
  downloadTravelPlanPdf: vi.fn(),
}));

const info: TravelInfo = {
  regions: ['jeju'],
  startDate: '2026-07-20',
  durationDays: 2,
  companion: 'solo',
  purpose: 'healing',
};

const selectedPlanItems: TravelPlanItem[] = [{
  id: 'forest',
  name: '제주 숲',
  moment: 'forest',
  source: 'public_data',
  day: 1,
}];

const initialDraft: PlanPdfDraft = {
  title: '하루방이 조합한 제주 여행',
  items: [{
    ...selectedPlanItems[0],
    day: 2,
    order: 1,
    pdfMemo: '초기 메모',
  }],
};

const composition: HarubanPlanDraft = {
  ...initialDraft,
  sourcePlanFingerprint: 'plan-test',
  createdAt: '2026-07-18T02:00:00Z',
  weather: {
    status: 'applied',
    headline: '비를 피해 오후로 조정했어요.',
  },
  route: {
    status: 'partial',
    headline: '일부 장소의 위치를 확인하지 못했어요.',
  },
  reasonsByItemId: {
    forest: ['비 예보를 피해 Day 2로 이동'],
  },
  warnings: ['사용자 추가 장소는 위치 확인이 필요해요.'],
};

describe('PlanPdfEditor Haruban draft', () => {
  it('opens with the composed draft and explains weather, route, and warnings', () => {
    render(
      <PlanPdfEditor
        open
        info={info}
        selectedMomentIds={[]}
        selectedPlanItems={selectedPlanItems}
        packingItems={[]}
        initialDraft={initialDraft}
        composition={composition}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('하루방 추천 초안')).toBeInTheDocument();
    expect(screen.getByDisplayValue('하루방이 조합한 제주 여행')).toBeInTheDocument();
    expect(screen.getByText('비를 피해 오후로 조정했어요.')).toBeInTheDocument();
    expect(screen.getByText('일부 장소의 위치를 확인하지 못했어요.')).toBeInTheDocument();
    expect(screen.getByText('사용자 추가 장소는 위치 확인이 필요해요.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: '제주 숲 Day 선택'})).toHaveValue('2');
  });

  it('reports memo edits to the active composed draft', async () => {
    const onDraftChange = vi.fn();
    render(
      <PlanPdfEditor
        open
        info={info}
        selectedMomentIds={[]}
        selectedPlanItems={selectedPlanItems}
        packingItems={[]}
        initialDraft={initialDraft}
        composition={composition}
        onDraftChange={onDraftChange}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('초기 메모'), {
      target: {value: '우산을 챙겨 출발'},
    });

    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
        items: [expect.objectContaining({
          id: 'forest',
          pdfMemo: '우산을 챙겨 출발',
        })],
      }));
    });
  });
});

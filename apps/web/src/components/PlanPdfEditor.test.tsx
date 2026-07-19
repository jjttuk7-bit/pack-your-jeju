import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import type {PlanPdfDraft} from '../planPdf';
import type {HarubanPlanDraft, TravelInfo, TravelPlanItem} from '../types';
import PlanPdfEditor from './PlanPdfEditor';


vi.mock('../api', () => ({
  downloadTravelPlanPdf: vi.fn(),
}));

const info: TravelInfo = {
  regions: ['jeju_city'],
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

function renderEditor(
  overrides: Partial<React.ComponentProps<typeof PlanPdfEditor>> = {},
) {
  const props: React.ComponentProps<typeof PlanPdfEditor> = {
    open: true,
    info,
    selectedMomentIds: [],
    selectedPlanItems,
    packingItems: [],
    initialDraft,
    composition,
    onClose: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<PlanPdfEditor {...props} />),
    props,
  };
}

describe('PlanPdfEditor Haruban draft', () => {
  it('adds a custom schedule from the selected Day form and resets it', () => {
    const onAddCustomSchedule = vi.fn();
    renderEditor({onAddCustomSchedule});

    expect(screen.getByRole('button', {name: 'Day 1 일정 직접 추가'}))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Day 2 일정 직접 추가'}));

    const nameInput = screen.getByLabelText('일정명');
    expect(nameInput).toBeRequired();
    expect(nameInput).toHaveAttribute('maxlength', '80');
    expect(screen.getByLabelText('Day')).toHaveValue('2');
    expect(screen.getByLabelText('시간')).toHaveAttribute('type', 'time');
    expect(screen.getByLabelText('장소 또는 주소')).toHaveAttribute('maxlength', '200');
    expect(screen.getByLabelText('일정 메모')).toHaveAttribute('maxlength', '800');

    fireEvent.change(nameInput, {target: {value: '렌터카 반납'}});
    fireEvent.change(screen.getByLabelText('시간'), {target: {value: '18:30'}});
    fireEvent.change(screen.getByLabelText('장소 또는 주소'), {
      target: {value: '제주공항'},
    });
    fireEvent.change(screen.getByLabelText('일정 메모'), {
      target: {value: '주유 후 반납'},
    });
    fireEvent.click(screen.getByRole('button', {name: '일정 추가'}));

    expect(onAddCustomSchedule).toHaveBeenCalledWith({
      name: '렌터카 반납',
      day: 2,
      startTime: '18:30',
      address: '제주공항',
      note: '주유 후 반납',
    });
    expect(screen.queryByLabelText('일정명')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Day 2 일정 직접 추가'}));
    expect(screen.getByLabelText('일정명')).toHaveValue('');
    expect(screen.getByLabelText('Day')).toHaveValue('2');
  });

  it('explains why a blank title cannot be submitted', () => {
    renderEditor({onAddCustomSchedule: vi.fn()});

    fireEvent.click(screen.getByRole('button', {name: 'Day 1 일정 직접 추가'}));
    fireEvent.change(screen.getByLabelText('일정명'), {target: {value: '   '}});

    expect(screen.getByText('일정명을 입력해 주세요.')).toBeVisible();
    expect(screen.getByRole('button', {name: '일정 추가'})).toBeDisabled();
  });

  it('rejects an invalid nonblank time with a linked error', () => {
    const onAddCustomSchedule = vi.fn();
    renderEditor({onAddCustomSchedule});

    fireEvent.click(screen.getByRole('button', {name: 'Day 1 일정 직접 추가'}));
    fireEvent.change(screen.getByLabelText('일정명'), {
      target: {value: '숙소 체크인'},
    });
    const timeInput = screen.getByLabelText('시간');
    timeInput.setAttribute('type', 'text');
    fireEvent.change(timeInput, {target: {value: '25:00'}});
    fireEvent.click(screen.getByRole('button', {name: '일정 추가'}));

    const timeError = screen.getByText('시간은 00:00부터 23:59 사이로 입력해 주세요.');
    expect(timeError).toBeVisible();
    expect(timeInput).toHaveAttribute('aria-describedby', timeError.id);
    expect(timeInput).toHaveAttribute('aria-invalid', 'true');
    expect(onAddCustomSchedule).not.toHaveBeenCalled();
  });

  it('closes only the open custom schedule form with Escape or cancel', () => {
    const onClose = vi.fn();
    renderEditor({onClose, onAddCustomSchedule: vi.fn()});

    fireEvent.click(screen.getByRole('button', {name: 'Day 2 일정 직접 추가'}));
    fireEvent.keyDown(window, {key: 'Escape'});
    expect(screen.queryByLabelText('일정명')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {name: 'Day 1 일정 직접 추가'}));
    fireEvent.click(screen.getByRole('button', {name: '취소'}));
    expect(screen.queryByLabelText('일정명')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('offers a separate undo for the recently added custom schedule', () => {
    const onUndoCustomSchedule = vi.fn();
    renderEditor({
      canUndoCustomSchedule: true,
      onUndoCustomSchedule,
    });

    expect(screen.getByText('일정을 내 여행플랜에도 추가했어요')).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: '추가한 일정 되돌리기'}));
    expect(onUndoCustomSchedule).toHaveBeenCalledOnce();
  });

  it('labels timed and addressless user-added schedule cards', () => {
    renderEditor({
      initialDraft: {
        ...initialDraft,
        items: [
          {
            ...initialDraft.items[0],
            id: 'fixed',
            name: '렌터카 반납',
            source: 'user_added',
            moment: 'user_added',
            startTime: '18:30',
            fixed: true,
            address: null,
          },
          {
            ...initialDraft.items[0],
            id: 'timed',
            name: '기념품 사기',
            source: 'user_added',
            moment: 'user_added',
            startTime: '16:00',
            fixed: false,
          },
        ],
      },
    });

    expect(screen.getByText('18:30 · 고정 일정')).toBeVisible();
    expect(screen.getByText('16:00 · 시간 지정')).toBeVisible();
    expect(screen.getAllByText('사용자가 직접 입력한 일정입니다.')).toHaveLength(2);
  });

  it('opens with the composed draft and explains weather, route, and warnings', () => {
    renderEditor();

    expect(screen.getByText('하루방 추천 초안')).toBeInTheDocument();
    expect(screen.getByDisplayValue('하루방이 조합한 제주 여행')).toBeInTheDocument();
    expect(screen.getByText('비를 피해 오후로 조정했어요.')).toBeInTheDocument();
    expect(screen.getByText('일부 장소의 위치를 확인하지 못했어요.')).toBeInTheDocument();
    expect(screen.getByText('사용자 추가 장소는 위치 확인이 필요해요.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: '제주 숲 Day 선택'})).toHaveValue('2');
  });

  it('reports memo edits to the active composed draft', async () => {
    const onDraftChange = vi.fn();
    renderEditor({onDraftChange});

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

  it('excludes a place only from the PDF draft and can undo it', () => {
    const onExcludeItem = vi.fn();
    const onUndoExclude = vi.fn();
    renderEditor({
      onExcludeItem,
      onUndoExclude,
      canUndoExclude: true,
    });

    fireEvent.click(screen.getByRole('button', {
      name: '제주 숲 초안에서 제외',
    }));
    expect(onExcludeItem).toHaveBeenCalledWith('forest');

    fireEvent.click(screen.getByRole('button', {name: '제외 되돌리기'}));
    expect(onUndoExclude).toHaveBeenCalledOnce();
  });

  it('shows newly saved places and adds only the selected IDs', () => {
    const onAddPendingItems = vi.fn();
    const pendingSourceItems = [
      {
        ...selectedPlanItems[0],
        id: 'cafe',
        name: '제주 카페',
      },
      {
        ...selectedPlanItems[0],
        id: 'oreum',
        name: '제주 오름',
      },
    ];
    renderEditor({pendingSourceItems, onAddPendingItems});

    expect(screen.getByText('새로 담은 장소 2곳이 있어요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', {name: '제주 오름 초안에 추가'}));
    fireEvent.click(screen.getByRole('button', {name: '선택한 장소 초안에 추가'}));

    expect(onAddPendingItems).toHaveBeenCalledWith(['cafe']);
  });

  it('announces temporary saving and uses the leave-to-browse label', () => {
    renderEditor({savedAt: '2026-07-19T01:00:00.000Z'});

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('변경사항 임시저장됨');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status.parentElement).not.toHaveClass('hidden');
    expect(screen.getByRole('button', {name: '나가서 장소 더 보기'}))
      .toBeInTheDocument();
  });

  it('disables PDF generation when the workspace draft has no places', () => {
    renderEditor({
      initialDraft: {
        title: '빈 초안',
        items: [],
      },
      composition: null,
    });

    expect(screen.getByText('PDF 초안에 담긴 장소가 없습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'PDF 만들기'})).toBeDisabled();
  });

  it('keeps the close button and Escape close contracts', () => {
    const onClose = vi.fn();
    renderEditor({onClose});

    fireEvent.keyDown(window, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', {name: 'PDF 편집창 닫기'}));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('resyncs local edits only when the workspace revision changes', () => {
    const {rerender, props} = renderEditor({workspaceRevision: '0'});
    fireEvent.change(screen.getByDisplayValue('초기 메모'), {
      target: {value: '입력 중인 메모'},
    });

    const restoredDraft = {
      ...initialDraft,
      items: [{...initialDraft.items[0], pdfMemo: '부모가 복원한 메모'}],
    };
    rerender(
      <PlanPdfEditor
        {...props}
        initialDraft={restoredDraft}
        workspaceRevision="0"
      />,
    );
    expect(screen.getByDisplayValue('입력 중인 메모')).toBeInTheDocument();

    rerender(
      <PlanPdfEditor
        {...props}
        initialDraft={restoredDraft}
        workspaceRevision="1"
      />,
    );
    expect(screen.getByDisplayValue('부모가 복원한 메모')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { derivePackJourneyState } from '../packJourneyGuide';
import PackJourneyGuide from './PackJourneyGuide';

describe('PackJourneyGuide', () => {
  it('shows four accessible steps and the current progress', () => {
    const state = derivePackJourneyState(4, []);

    render(<PackJourneyGuide state={state} onNavigate={vi.fn()} />);

    const navigation = screen.getByRole('navigation', { name: '여행팩 만드는 순서' });
    expect(within(navigation).getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /플랜에 담기 현재/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByRole('button', { name: /후보 살펴보기 완료/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /일정 정하기 다음/ })).toBeInTheDocument();
    expect(screen.getByText('여행팩 완성도 1/4')).toBeInTheDocument();
  });

  it('navigates both steps and the current action to their target sections', () => {
    const state = derivePackJourneyState(4, []);
    const onNavigate = vi.fn();

    render(<PackJourneyGuide state={state} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: /일정 정하기 다음/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('view-mode-tabs');

    fireEvent.click(screen.getByRole('button', { name: '지금 플랜에 담기' }));
    expect(onNavigate).toHaveBeenLastCalledWith('my-plan-builder');
  });
});

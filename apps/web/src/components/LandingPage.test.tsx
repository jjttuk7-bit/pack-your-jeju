import {render, screen} from '@testing-library/react';
import {beforeAll, describe, expect, it, vi} from 'vitest';

import LandingPage from './LandingPage';

beforeAll(() => {
  class IntersectionObserverStub implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds = [0];

    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  }

  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
});

describe('LandingPage visual hierarchy', () => {
  it('reserves the primary filled treatment for the hero and final conversion actions', () => {
    render(<LandingPage onEnter={vi.fn()} />);

    const repeatedActions = screen.getAllByRole('button', {name: '내 제주 여행 만들기'});
    expect(repeatedActions).toHaveLength(3);
    expect(repeatedActions.filter((action) => action.dataset.visualRole === 'primary')).toHaveLength(2);
    expect(repeatedActions.filter((action) => action.dataset.visualRole === 'secondary')).toHaveLength(1);

    expect(screen.getByRole('button', {name: '여행 시작하기'})).toHaveAttribute(
      'data-visual-role',
      'secondary',
    );
    expect(screen.getByRole('button', {name: '나만의 제주를 담아보기'})).toHaveAttribute(
      'data-visual-role',
      'secondary',
    );
    expect(screen.getByRole('button', {name: '나만의 제주 시작하기'})).toHaveAttribute(
      'data-visual-role',
      'text',
    );
    expect(screen.getByRole('button', {name: '하루방과 여행 시작하기'})).toHaveAttribute(
      'data-visual-role',
      'text',
    );
  });

  it('protects the final headline word and applies the readable supporting-text role', () => {
    render(<LandingPage onEnter={vi.fn()} />);

    expect(screen.getByText('기억하세요.')).toHaveClass('whitespace-nowrap');
    expect(screen.getByText('나만의 제주 여행 플래너')).toHaveClass(
      'pyj-supporting-text-on-dark',
    );
    expect(screen.getByText('최신 정보와 출처까지 함께 확인해요')).toHaveClass(
      'pyj-supporting-text-on-dark',
    );
  });
});

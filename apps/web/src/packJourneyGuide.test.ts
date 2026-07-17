import { describe, expect, it } from 'vitest';
import {
  advancePackJourneyStep,
  derivePackJourneyState,
} from './packJourneyGuide';

describe('derivePackJourneyState', () => {
  it('starts with candidate discovery regardless of loaded pack data', () => {
    const state = derivePackJourneyState('candidates');

    expect(state.currentStep.id).toBe('candidates');
    expect(state.completedCount).toBe(0);
    expect(state.guidance).toBe('마음에 드는 후보를 골라보세요.');
    expect(state.actionLabel).toBe('후보 둘러보기');
    expect(state.steps.map((step) => step.status)).toEqual([
      'current',
      'next',
      'next',
      'next',
    ]);
  });

  it('derives plan guidance from the explicitly introduced step', () => {
    const state = derivePackJourneyState('plan');

    expect(state.currentStep.id).toBe('plan');
    expect(state.completedCount).toBe(1);
    expect(state.guidance).toBe('고른 후보를 여행 플랜에 담아보세요.');
    expect(state.actionLabel).toBe('플랜에 담기');
    expect(state.steps.map((step) => step.status)).toEqual([
      'complete',
      'current',
      'next',
      'next',
    ]);
  });

  it('keeps scheduling as an explicit step even when plan data already has a day', () => {
    const state = derivePackJourneyState('schedule');

    expect(state.currentStep.id).toBe('schedule');
    expect(state.completedCount).toBe(2);
    expect(state.guidance).toBe('담은 장소로 여행 일정을 만들어보세요.');
    expect(state.actionLabel).toBe('일정 정하기');
    expect(state.steps.map((step) => step.status)).toEqual([
      'complete',
      'complete',
      'current',
      'next',
    ]);
  });

  it('shows saving and sharing only after the schedule step is completed', () => {
    const state = derivePackJourneyState('export');

    expect(state.currentStep.id).toBe('export');
    expect(state.completedCount).toBe(3);
    expect(state.guidance).toBe(
      '완성한 일정을 저장하거나 함께 갈 사람에게 공유해보세요.',
    );
    expect(state.actionLabel).toBe('저장·공유하기');
    expect(state.steps.map((step) => step.status)).toEqual([
      'complete',
      'complete',
      'complete',
      'current',
    ]);
  });

  it('exposes concise guidance on every step card', () => {
    const state = derivePackJourneyState('candidates');

    expect(state.steps.map((step) => step.guidance)).toEqual([
      '마음에 드는 후보를 골라보세요.',
      '고른 후보를 여행 플랜에 담아보세요.',
      '담은 장소로 여행 일정을 만들어보세요.',
      '완성한 일정을 저장하거나 함께 갈 사람에게 공유해보세요.',
    ]);
  });
});

describe('advancePackJourneyStep', () => {
  it('advances only through the expected user action for each step', () => {
    expect(advancePackJourneyStep('candidates', 'candidates_viewed')).toBe('plan');
    expect(advancePackJourneyStep('plan', 'plan_item_added')).toBe('schedule');
    expect(advancePackJourneyStep('schedule', 'schedule_updated')).toBe('export');
  });

  it('never skips a step for an out-of-order action', () => {
    expect(advancePackJourneyStep('candidates', 'plan_item_added')).toBe('candidates');
    expect(advancePackJourneyStep('plan', 'schedule_updated')).toBe('plan');
    expect(advancePackJourneyStep('export', 'candidates_viewed')).toBe('export');
  });
});

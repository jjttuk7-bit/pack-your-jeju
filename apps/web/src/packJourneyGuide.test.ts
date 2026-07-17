import { describe, expect, it } from 'vitest';
import type { TravelPlanItem } from './types';
import { derivePackJourneyState } from './packJourneyGuide';

const makePlanItem = (day: number | null): TravelPlanItem => ({
  id: `plan-${day ?? 'unscheduled'}`,
  name: '테스트 장소',
  moment: 'walk',
  source: 'user_added',
  day,
});

describe('derivePackJourneyState', () => {
  it('starts with candidate discovery when there are no candidates', () => {
    const state = derivePackJourneyState(0, []);

    expect(state.currentStep.id).toBe('candidates');
    expect(state.completedCount).toBe(0);
    expect(state.guidance).toBe('먼저 여행 후보를 살펴보고 마음에 드는 장소를 찾아보세요.');
    expect(state.actionLabel).toBe('후보 둘러보기');
    expect(state.steps.map((step) => step.status)).toEqual([
      'current',
      'next',
      'next',
      'next',
    ]);
  });

  it('moves to plan building when candidates are ready', () => {
    const state = derivePackJourneyState(3, []);

    expect(state.currentStep.id).toBe('plan');
    expect(state.completedCount).toBe(1);
    expect(state.guidance).toBe('마음에 드는 후보를 하나 이상 여행 플랜에 담아보세요.');
    expect(state.actionLabel).toBe('플랜에 담기');
    expect(state.steps.map((step) => step.status)).toEqual([
      'complete',
      'current',
      'next',
      'next',
    ]);
  });

  it('moves to scheduling while any plan item has no day', () => {
    const state = derivePackJourneyState(3, [
      makePlanItem(1),
      makePlanItem(null),
    ]);

    expect(state.currentStep.id).toBe('schedule');
    expect(state.completedCount).toBe(2);
    expect(state.guidance).toBe('플랜의 장소마다 여행 날짜를 정해 동선을 준비하세요.');
    expect(state.actionLabel).toBe('일정 정하기');
    expect(state.steps.map((step) => step.status)).toEqual([
      'complete',
      'complete',
      'current',
      'next',
    ]);
  });

  it('moves to export when every plan item has a day', () => {
    const state = derivePackJourneyState(3, [
      makePlanItem(1),
      makePlanItem(2),
    ]);

    expect(state.currentStep.id).toBe('export');
    expect(state.completedCount).toBe(3);
    expect(state.guidance).toBe('여행 플랜이 준비됐어요. PDF로 저장하거나 함께 갈 사람에게 공유하세요.');
    expect(state.actionLabel).toBe('저장·공유하기');
    expect(state.steps.map((step) => step.status)).toEqual([
      'complete',
      'complete',
      'complete',
      'current',
    ]);
  });
});

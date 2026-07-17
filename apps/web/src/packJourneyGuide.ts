import type { TravelPlanItem } from './types';

export type PackJourneyStepId = 'candidates' | 'plan' | 'schedule' | 'export';

export interface PackJourneyStep {
  id: PackJourneyStepId;
  label: string;
  targetId: string;
  status: 'complete' | 'current' | 'next';
}

export interface PackJourneyState {
  steps: PackJourneyStep[];
  currentStep: PackJourneyStep;
  completedCount: number;
  guidance: string;
  actionLabel: string;
}

const STEP_DEFINITIONS: ReadonlyArray<
  Omit<PackJourneyStep, 'status'> & {
    guidance: string;
    actionLabel: string;
  }
> = [
  {
    id: 'candidates',
    label: '후보 살펴보기',
    targetId: 'candidate-workbench-header',
    guidance: '먼저 여행 후보를 살펴보고 마음에 드는 장소를 찾아보세요.',
    actionLabel: '후보 둘러보기',
  },
  {
    id: 'plan',
    label: '플랜에 담기',
    targetId: 'my-plan-builder',
    guidance: '마음에 드는 후보를 하나 이상 여행 플랜에 담아보세요.',
    actionLabel: '플랜에 담기',
  },
  {
    id: 'schedule',
    label: '일정 정하기',
    targetId: 'view-mode-tabs',
    guidance: '플랜의 장소마다 여행 날짜를 정해 동선을 준비하세요.',
    actionLabel: '일정 정하기',
  },
  {
    id: 'export',
    label: '저장·공유하기',
    targetId: 'plan-export-actions',
    guidance: '여행 플랜이 준비됐어요. PDF로 저장하거나 함께 갈 사람에게 공유하세요.',
    actionLabel: '저장·공유하기',
  },
];

export function derivePackJourneyState(
  candidateCount: number,
  planItems: TravelPlanItem[],
): PackJourneyState {
  const hasCandidates = candidateCount > 0;
  const hasPlanItems = planItems.length > 0;
  const hasScheduledPlan = hasPlanItems && planItems.every((item) => item.day != null);

  const currentIndex = !hasCandidates
    ? 0
    : !hasPlanItems
      ? 1
      : !hasScheduledPlan
        ? 2
        : 3;

  const steps = STEP_DEFINITIONS.map<PackJourneyStep>((step, index) => ({
    id: step.id,
    label: step.label,
    targetId: step.targetId,
    status: index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'next',
  }));
  const currentStep = steps[currentIndex];
  const currentDefinition = STEP_DEFINITIONS[currentIndex];

  return {
    steps,
    currentStep,
    completedCount: currentIndex,
    guidance: currentDefinition.guidance,
    actionLabel: currentDefinition.actionLabel,
  };
}

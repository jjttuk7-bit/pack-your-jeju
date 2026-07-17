export type PackJourneyStepId = 'candidates' | 'plan' | 'schedule' | 'export';

export type PackJourneyEvent =
  | 'candidates_viewed'
  | 'plan_item_added'
  | 'schedule_updated';

export interface PackJourneyStep {
  id: PackJourneyStepId;
  label: string;
  guidance: string;
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
    actionLabel: string;
  }
> = [
  {
    id: 'candidates',
    label: '후보 살펴보기',
    targetId: 'candidate-workbench-header',
    guidance: '마음에 드는 후보를 골라보세요.',
    actionLabel: '후보 둘러보기',
  },
  {
    id: 'plan',
    label: '플랜에 담기',
    targetId: 'my-plan-builder',
    guidance: '고른 후보를 여행 플랜에 담아보세요.',
    actionLabel: '플랜에 담기',
  },
  {
    id: 'schedule',
    label: '일정 정하기',
    targetId: 'view-mode-tabs',
    guidance: '담은 장소로 여행 일정을 만들어보세요.',
    actionLabel: '일정 정하기',
  },
  {
    id: 'export',
    label: '저장·공유하기',
    targetId: 'plan-export-actions',
    guidance: '완성한 일정을 저장하거나 함께 갈 사람에게 공유해보세요.',
    actionLabel: '저장·공유하기',
  },
];

const NEXT_STEP_BY_EVENT: Readonly<
  Partial<Record<PackJourneyStepId, Partial<Record<PackJourneyEvent, PackJourneyStepId>>>>
> = {
  candidates: { candidates_viewed: 'plan' },
  plan: { plan_item_added: 'schedule' },
  schedule: { schedule_updated: 'export' },
};

export function advancePackJourneyStep(
  currentStepId: PackJourneyStepId,
  event: PackJourneyEvent,
): PackJourneyStepId {
  return NEXT_STEP_BY_EVENT[currentStepId]?.[event] ?? currentStepId;
}

export function derivePackJourneyState(
  currentStepId: PackJourneyStepId,
): PackJourneyState {
  const currentIndex = STEP_DEFINITIONS.findIndex((step) => step.id === currentStepId);

  const steps = STEP_DEFINITIONS.map<PackJourneyStep>((step, index) => ({
    id: step.id,
    label: step.label,
    guidance: step.guidance,
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

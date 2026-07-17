import {
  ArrowRight,
  CalendarDays,
  Check,
  ListPlus,
  MapPinned,
  Share2,
} from 'lucide-react';
import type {
  PackJourneyState,
  PackJourneyStep,
  PackJourneyStepId,
} from '../packJourneyGuide';

interface Props {
  state: PackJourneyState;
  onNavigate: (targetId: string) => void;
}

const STEP_ICONS: Record<
  PackJourneyStepId,
  typeof MapPinned
> = {
  candidates: MapPinned,
  plan: ListPlus,
  schedule: CalendarDays,
  export: Share2,
};

const STATUS_LABELS: Record<PackJourneyStep['status'], string> = {
  complete: '완료',
  current: '현재',
  next: '다음',
};

export default function PackJourneyGuide({ state, onNavigate }: Props) {
  return (
    <section
      className="card-jeju overflow-hidden"
      aria-labelledby="pack-journey-guide-title"
    >
      <div className="border-b border-sand/80 bg-cream/55 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] text-mint-dark uppercase">
              Pack Journey
            </p>
            <h2
              id="pack-journey-guide-title"
              className="mt-1 font-serif-kr text-lg font-bold text-basalt"
            >
              이 순서대로 여행팩을 완성해요
            </h2>
          </div>
          <p className="rounded-full bg-white px-3 py-1 text-xs font-bold text-basalt/70 shadow-sm">
            여행팩 완성도 {state.completedCount}/4
          </p>
        </div>
      </div>

      <nav
        className="grid grid-cols-2 gap-2 p-3 sm:p-4"
        aria-label="여행팩 만드는 순서"
      >
        {state.steps.map((step, index) => {
          const Icon = STEP_ICONS[step.id];
          const statusLabel = STATUS_LABELS[step.status];
          const isCurrent = step.status === 'current';
          const isComplete = step.status === 'complete';

          return (
            <button
              key={step.id}
              type="button"
              className={[
                'group min-w-0 rounded-2xl border px-3 py-3 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-citrus focus-visible:ring-offset-2',
                isCurrent
                  ? 'border-citrus bg-citrus/8 shadow-[0_6px_18px_rgba(239,102,55,0.10)]'
                  : isComplete
                    ? 'border-mint/45 bg-mint/8 hover:border-mint-dark/45'
                    : 'border-sand bg-white hover:border-basalt/25',
              ].join(' ')}
              aria-label={`${step.label} ${statusLabel}`}
              aria-current={isCurrent ? 'step' : undefined}
              onClick={() => onNavigate(step.targetId)}
            >
              <span className="flex items-center justify-between gap-2">
                <span
                  className={[
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold',
                    isCurrent
                      ? 'bg-citrus text-white'
                      : isComplete
                        ? 'bg-mint-dark text-white'
                        : 'bg-sand/70 text-basalt/65',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {isComplete ? <Check className="size-4" strokeWidth={2.8} /> : index + 1}
                </span>
                <Icon
                  className={[
                    'size-4 shrink-0',
                    isCurrent ? 'text-citrus' : isComplete ? 'text-mint-dark' : 'text-basalt/40',
                  ].join(' ')}
                  aria-hidden="true"
                />
              </span>
              <span className="mt-3 block text-sm font-bold leading-snug text-basalt">
                {step.label}
              </span>
              <span className="mt-1.5 block text-[11px] leading-[1.45] text-basalt/65">
                {step.guidance}
              </span>
              <span
                className={[
                  'mt-2 block text-[11px] font-bold',
                  isCurrent
                    ? 'text-citrus'
                    : isComplete
                      ? 'text-mint-dark'
                      : 'text-basalt/45',
                ].join(' ')}
              >
                {statusLabel}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 border-t border-sand/80 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm leading-6 text-basalt/75">{state.guidance}</p>
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-citrus px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-citrus-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-citrus focus-visible:ring-offset-2"
          onClick={() => onNavigate(state.currentStep.targetId)}
          aria-label={`지금 ${state.actionLabel}`}
        >
          지금 {state.actionLabel}
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

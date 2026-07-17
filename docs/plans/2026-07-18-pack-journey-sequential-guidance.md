# Pack Journey Sequential Guidance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Pack Journey introduce all four actions in order, based on user actions rather than preloaded candidate and schedule data.

**Architecture:** Replace data-derived progress with a small pure event-driven state transition helper. Keep the current step in `PackingDashboard`, advance it only on the expected user action, and continue rendering `PackJourneyGuide` as a presentational component with concise guidance on every card.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, Testing Library

---

### Task 1: Define sequential journey transitions

**Files:**
- Modify: `apps/web/src/packJourneyGuide.ts`
- Test: `apps/web/src/packJourneyGuide.test.ts`

**Step 1: Write failing transition tests**

Add tests that express the required contract:

```ts
expect(derivePackJourneyState('candidates').currentStep.id).toBe('candidates');
expect(advancePackJourneyStep('candidates', 'candidates_viewed')).toBe('plan');
expect(advancePackJourneyStep('plan', 'plan_item_added')).toBe('schedule');
expect(advancePackJourneyStep('schedule', 'schedule_updated')).toBe('export');
expect(advancePackJourneyStep('candidates', 'plan_item_added')).toBe('candidates');
```

Also assert that every step exposes its concise guidance text.

**Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/web
npm test -- --run src/packJourneyGuide.test.ts
```

Expected: FAIL because the event transition API and sequential state contract do not exist.

**Step 3: Implement the minimal pure state machine**

Define:

```ts
export type PackJourneyEvent =
  | 'candidates_viewed'
  | 'plan_item_added'
  | 'schedule_updated';

export function advancePackJourneyStep(
  currentStepId: PackJourneyStepId,
  event: PackJourneyEvent,
): PackJourneyStepId;

export function derivePackJourneyState(
  currentStepId: PackJourneyStepId,
): PackJourneyState;
```

Only the expected event for the current step may advance it. Add a `guidance` field to each rendered step definition.

**Step 4: Run the focused test and verify GREEN**

Run:

```bash
cd apps/web
npm test -- --run src/packJourneyGuide.test.ts
```

Expected: PASS.

### Task 2: Show the action guidance on every step card

**Files:**
- Modify: `apps/web/src/components/PackJourneyGuide.tsx`
- Test: `apps/web/src/components/PackJourneyGuide.test.tsx`

**Step 1: Write a failing component test**

Render the first-step state and assert all four phrases are visible:

```ts
expect(screen.getByText('마음에 드는 후보를 골라보세요.')).toBeInTheDocument();
expect(screen.getByText('고른 후보를 여행 플랜에 담아보세요.')).toBeInTheDocument();
expect(screen.getByText('담은 장소로 여행 일정을 만들어보세요.')).toBeInTheDocument();
expect(
  screen.getByText('완성한 일정을 저장하거나 함께 갈 사람에게 공유해보세요.'),
).toBeInTheDocument();
```

Keep assertions for four accessible buttons, `aria-current="step"`, and the visible status labels.

**Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/web
npm test -- --run src/components/PackJourneyGuide.test.tsx
```

Expected: FAIL because cards do not render their action guidance.

**Step 3: Render the guidance without changing navigation**

Add a compact guidance line under each step label. Retain number/check treatment, current/complete/next text, accessible button names, focus styling, and the existing 2×2 responsive grid.

**Step 4: Run the focused test and verify GREEN**

Run:

```bash
cd apps/web
npm test -- --run src/components/PackJourneyGuide.test.tsx
```

Expected: PASS.

### Task 3: Connect real user actions to sequential progress

**Files:**
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Test: `apps/web/src/components/PackingDashboard.test.tsx`

**Step 1: Write failing integration tests**

Extend the dashboard test harness so it can rerender with different `selectedPlanItems`. Verify:

1. a loaded pack with candidates still starts at `후보 살펴보기 현재`;
2. clicking `지금 후보 둘러보기` changes the current step to `플랜에 담기`;
3. increasing the plan item count changes the current step to `일정 정하기`, even when the new item already has `day`;
4. clicking an existing schedule control changes the current step to `저장·공유하기`.

**Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/web
npm test -- --run src/components/PackingDashboard.test.tsx
```

Expected: FAIL because progress is still inferred directly from candidate and plan data.

**Step 3: Implement local sequential progress**

In `PackingDashboard`:

- initialize `packJourneyStepId` to `candidates`;
- derive the presentational state from that ID;
- advance `candidates → plan` when the current candidate navigation action runs;
- compare the previous and current plan item counts and advance `plan → schedule` only when the count increases;
- wrap `onUpdatePlanSchedule` and advance `schedule → export` after forwarding the real update;
- use the pure transition helper so out-of-order events do nothing.

Do not change pack APIs, selected plan data, route/weather proposal behavior, PDF, share, scrolling, or focus transfer.

**Step 4: Run focused tests and verify GREEN**

Run:

```bash
cd apps/web
npm test -- --run src/components/PackingDashboard.test.tsx src/components/PackJourneyGuide.test.tsx src/packJourneyGuide.test.ts
```

Expected: PASS.

### Task 4: Verify the complete frontend

**Files:**
- Modify only the files above if verification exposes a regression.

**Step 1: Run the full frontend test suite**

Run:

```bash
cd apps/web
npm test
```

Expected: all tests pass.

**Step 2: Run TypeScript verification**

Run:

```bash
cd apps/web
npm run lint
```

Expected: `tsc --noEmit` exits 0.

**Step 3: Run production build**

Run:

```bash
cd apps/web
npm run build
```

Expected: Vite build exits 0.

**Step 4: Check the patch**

Run:

```bash
git diff --check
git diff -- apps/web/src/packJourneyGuide.ts apps/web/src/packJourneyGuide.test.ts apps/web/src/components/PackJourneyGuide.tsx apps/web/src/components/PackJourneyGuide.test.tsx apps/web/src/components/PackingDashboard.tsx apps/web/src/components/PackingDashboard.test.tsx
```

Expected: no whitespace errors and only the intended journey guidance changes.

# Pack Guidance Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a non-blocking four-step guide to the existing pack dashboard so users always know how to move from candidates to a saved or shared travel plan.

**Architecture:** Derive progress entirely from existing candidate and `TravelPlanItem` data in a pure helper. Render a presentational guide above the existing pack content and navigate to existing section anchors without changing their order, APIs, or behavior. Keep PDF and share actions unchanged and expose their existing area as the final navigation target.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library

---

### Task 1: Derive pack journey state

**Files:**
- Create: `apps/web/src/packJourneyGuide.ts`
- Create: `apps/web/src/packJourneyGuide.test.ts`

**Step 1: Write failing state tests**

Define tests for:

- no candidates: current step is `candidates`;
- candidates exist but no plan items: current step is `plan`;
- plan items exist with any `day == null`: current step is `schedule`;
- all plan items have a day: current step is `export`;
- completed steps and guidance copy match each state.

**Step 2: Run the test and verify RED**

```bash
npm test -- --run src/packJourneyGuide.test.ts
```

Expected: FAIL because `derivePackJourneyState` does not exist.

**Step 3: Implement the pure helper**

Export these stable types:

```ts
export type PackJourneyStepId = 'candidates' | 'plan' | 'schedule' | 'export';

export interface PackJourneyStep {
  id: PackJourneyStepId;
  label: string;
  targetId: string;
  status: 'complete' | 'current' | 'next';
}
```

Implement:

```ts
derivePackJourneyState(candidateCount: number, planItems: TravelPlanItem[])
```

Use existing data only:

- `candidateCount > 0`
- `planItems.length > 0`
- `planItems.every(item => item.day != null)`

Return the four steps, current step, completed count, guidance text, and action label.

**Step 4: Run the focused test and verify GREEN**

```bash
npm test -- --run src/packJourneyGuide.test.ts
```

Expected: PASS.

### Task 2: Render an accessible guide

**Files:**
- Create: `apps/web/src/components/PackJourneyGuide.tsx`
- Create: `apps/web/src/components/PackJourneyGuide.test.tsx`

**Step 1: Write failing component tests**

Render the guide for the `plan` state and verify:

- all four step buttons are present;
- the current button has `aria-current="step"`;
- complete/current/next states have text labels independent of color;
- the current-action button calls `onNavigate` with the correct target ID;
- the progress label reads `여행팩 완성도 1/4`.

**Step 2: Run the focused test and verify RED**

```bash
npm test -- --run src/components/PackJourneyGuide.test.tsx
```

Expected: FAIL because the component does not exist.

**Step 3: Implement the component**

Create a compact `card-jeju` guide:

- current plan sidebar: a readable 2×2 grid at both desktop and mobile widths;
- reserve a four-column row for a future full-width placement;
- current step: citrus border and `aria-current`;
- complete step: mint check icon;
- next step: neutral number;
- guidance row with one action button.

The component must not own progress state or mutate plan data.

**Step 4: Run the focused test and verify GREEN**

```bash
npm test -- --run src/components/PackJourneyGuide.test.tsx
```

Expected: PASS.

### Task 3: Connect the guide to the existing dashboard

**Files:**
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Modify: `apps/web/src/components/PackingDashboard.test.tsx`

**Step 1: Write failing integration tests**

Render `PackingDashboard` with existing fixtures and verify:

- the guide appears without removing existing summary, candidate, plan, PDF, or share controls;
- candidate, plan, schedule, and export step buttons point to the existing section anchors;
- clicking a step calls `scrollIntoView`;
- the destination heading receives focus;
- `prefers-reduced-motion: reduce` uses immediate scrolling.

If `PackingDashboard.test.tsx` does not exist, create it with the smallest API fixtures required to render the shell.

**Step 2: Run the focused test and verify RED**

```bash
npm test -- --run src/components/PackingDashboard.test.tsx
```

Expected: FAIL because the guide and export anchor are not integrated.

**Step 3: Integrate without restructuring**

- Compute candidate count from the already rendered pack response.
- Derive guide state from `selectedPlanItems`.
- Insert `PackJourneyGuide` after the existing trip summary.
- Reuse these targets:
  - `candidate-workbench-header`
  - `my-plan-builder`
  - `view-mode-tabs`
- Add `plan-export-actions` only to the existing PDF/share wrapper.
- Implement a small navigation callback that scrolls and focuses the target.
- Add `tabIndex={-1}` to focusable destination wrappers where needed.

Do not reorder sections, alter view-mode behavior, or change PDF/share callbacks.

**Step 4: Run focused tests and verify GREEN**

```bash
npm test -- --run src/components/PackingDashboard.test.tsx src/components/PackJourneyGuide.test.tsx src/packJourneyGuide.test.ts
```

Expected: PASS.

### Task 4: Full verification and responsive QA

**Files:**
- Modify only files already listed if verification finds a regression.

**Step 1: Run all frontend tests**

```bash
npm test
```

Expected: all tests pass.

**Step 2: Run TypeScript verification**

```bash
npm run lint
```

Expected: `tsc --noEmit` exits 0.

**Step 3: Run whitespace verification**

```bash
git diff --check
```

Expected: no output.

**Step 4: Inspect desktop and mobile**

At 1440×1000 and 390×844 verify:

- the existing page order is unchanged;
- the guide does not overlap Harubang;
- no horizontal overflow appears;
- all four stages remain readable;
- only the current action is citrus;
- clicking each stage reaches the correct existing section;
- PDF and share still work from their original controls.

**Step 5: Commit**

Stage only the implementation and tests, then commit:

```text
[프론트엔드] 여행팩 진행 안내 추가
```

# Visual Hierarchy Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve the current Jeju editorial aesthetic while clarifying landing-page CTA hierarchy, preventing awkward headline breaks, and giving dashboard text and statuses consistent readable visual roles.

**Architecture:** Extend the existing CSS token layer with semantic action, verified, caution, and muted roles. Apply those roles through the existing React components without changing component state, data flow, navigation, or API contracts. Use component tests for stable semantic/class contracts and Playwright screenshots for responsive visual verification.

**Tech Stack:** React, TypeScript, Tailwind CSS v4 utilities, Vitest, Testing Library, Playwright

---

### Task 1: Landing CTA and headline contracts

**Files:**
- Create: `apps/web/src/components/LandingPage.test.tsx`
- Modify: `apps/web/src/components/LandingPage.tsx`

**Step 1: Write the failing tests**

Add tests that render `LandingPage` and verify:

- only the hero and final CTA use the primary filled visual role;
- intermediate CTAs use secondary or text visual roles;
- the phrase `기억하세요.` is contained in an element with a no-word-break class;
- small supporting copy uses the readable supporting-text class.

**Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- --run apps/web/src/components/LandingPage.test.tsx
```

Expected: FAIL because the semantic visual roles and protected headline span do not exist yet.

**Step 3: Implement the minimal landing changes**

- Give `PrimaryButton` an explicit `primary | secondary | inverse` visual variant.
- Keep the hero and final CTA filled.
- Render middle-of-page actions as outline or underline actions.
- Wrap `기억하세요.` in a `whitespace-nowrap` span and use responsive `clamp`-style sizing where necessary.
- Raise supporting copy that is currently below 12px to the shared readable supporting-text style.

**Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- --run apps/web/src/components/LandingPage.test.tsx
```

Expected: PASS.

### Task 2: Shared semantic visual tokens

**Files:**
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/components/LandingPage.test.tsx`

**Step 1: Add a failing token contract test**

Read the rendered landing elements and verify that primary, secondary, and supporting text use named semantic utility classes instead of duplicated arbitrary colors.

**Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- --run apps/web/src/components/LandingPage.test.tsx
```

Expected: FAIL because the semantic classes are not defined or applied.

**Step 3: Add minimal semantic styles**

Add existing-palette utilities for:

- primary action: citrus fill with accessible foreground;
- secondary action: deep green border/text;
- verified state: mint;
- caution state: amber;
- muted/supporting text: darker basalt gray with a 12–13px minimum.

Do not add a new palette or change background art.

**Step 4: Run the focused test and verify GREEN**

Run:

```bash
npm test -- --run apps/web/src/components/LandingPage.test.tsx
```

Expected: PASS.

### Task 3: Dashboard status and supporting-text hierarchy

**Files:**
- Modify: `apps/web/src/components/TrustMapDashboard.test.tsx`
- Modify: `apps/web/src/components/TrustMapDashboard.tsx`
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Modify: `apps/web/src/components/HarubanChat.tsx`

**Step 1: Write failing dashboard assertions**

Extend the existing dashboard tests to verify that:

- verified evidence uses the verified visual role;
- confirmation-needed evidence uses the caution visual role;
- missing data remains neutral rather than citrus;
- dashboard supporting text uses the readable muted role;
- action buttons retain the primary citrus role.

**Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- --run apps/web/src/components/TrustMapDashboard.test.tsx
```

Expected: FAIL because status colors currently share arbitrary orange/gray classes.

**Step 3: Apply the semantic roles**

Replace only the repeated small-text and status color classes visible in the main map, result dashboard, and Harubang panel. Preserve markup order, callbacks, labels, and responsive layout.

**Step 4: Run focused tests and verify GREEN**

Run:

```bash
npm test -- --run apps/web/src/components/TrustMapDashboard.test.tsx
```

Expected: PASS.

### Task 4: Full verification and responsive visual QA

**Files:**
- Modify only files already listed if QA exposes a regression.

**Step 1: Run the complete web test suite**

```bash
npm test --workspace apps/web
```

Expected: all tests pass.

**Step 2: Run TypeScript verification**

```bash
npm run lint --workspace apps/web
```

Expected: exit code 0.

**Step 3: Run whitespace verification**

```bash
git diff --check
```

Expected: no output and exit code 0.

**Step 4: Inspect at desktop and mobile widths**

Use Playwright at 1440×1000 and 390×844. Verify:

- no horizontal overflow;
- `기억하세요.` does not break inside the word;
- only the intended landing CTAs are filled;
- supporting text is legible;
- verified, caution, and action colors are visually distinct;
- no interaction or layout change occurred.

**Step 5: Commit**

Stage only the implementation and test files, then commit with:

```text
[프론트엔드] 시각 위계와 CTA 색상 정리
```

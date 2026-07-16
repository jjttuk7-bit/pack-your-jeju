# Haruban Research Loading Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Haruban's one-line spinner with a compact research bubble that expands after 8 seconds into an animated Jeju research card with elapsed time, research guidance, and rotating travel tips.

**Architecture:** Keep the network request and chat state in `HarubanChat`, adding only a request start timestamp. Render a dedicated `HarubanResearchLoading` component while the request is active; the component derives elapsed seconds and display content locally, so closing and reopening the panel does not interrupt the request or reset the perceived elapsed time. All progress language is advisory rather than a claim about real server completion.

**Tech Stack:** React 19, TypeScript, Motion for React, Tailwind CSS, Node.js source-contract tests, Vite

---

### Task 1: Lock the loading experience contract with a failing test

**Files:**
- Create: `apps/web/tests/haruban-research-loading.test.mjs`
- Test: `apps/web/tests/haruban-research-loading.test.mjs`

**Step 1: Write the failing source-contract test**

Create the test with these assertions:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const loadingSource = readFileSync(
  new URL('../src/components/HarubanResearchLoading.tsx', import.meta.url),
  'utf8',
);
const chatSource = readFileSync(
  new URL('../src/components/HarubanChat.tsx', import.meta.url),
  'utf8',
);

test('Haruban loading expands after eight seconds and shows honest elapsed time', () => {
  assert.match(loadingSource, /EXPAND_AFTER_SECONDS\s*=\s*8/);
  assert.match(loadingSource, /elapsedSeconds/);
  assert.match(loadingSource, /초째 제주 곳곳의 근거를 살펴보고 있어요/);
  assert.doesNotMatch(loadingSource, /남은 시간|진행률|% 완료/);
});

test('Haruban loading alternates research guidance and Jeju tips', () => {
  assert.match(loadingSource, /공식·플랫폼·경험 출처를 폭넓게 살펴보고 있어요/);
  assert.match(loadingSource, /서로 다른 정보를 나란히 비교하고 있어요/);
  assert.match(loadingSource, /기다리는 동안 제주 한 조각/);
  assert.match(loadingSource, /해안과 중산간의 날씨가 다를 수 있어요/);
});

test('Haruban loading is accessible and does not offer a premature cancel action', () => {
  assert.match(loadingSource, /role="status"/);
  assert.match(loadingSource, /aria-live="polite"/);
  assert.match(loadingSource, /useReducedMotion/);
  assert.doesNotMatch(loadingSource, /조사 그만하기/);
});

test('Haruban chat preserves a request start timestamp and renders the research card', () => {
  assert.match(chatSource, /const \[loadingStartedAt, setLoadingStartedAt\]/);
  assert.match(chatSource, /setLoadingStartedAt\(Date\.now\(\)\)/);
  assert.match(chatSource, /<HarubanResearchLoading startedAt=\{loadingStartedAt\}/);
});
```

**Step 2: Run the test to verify it fails**

Run:

```powershell
node --test apps/web/tests/haruban-research-loading.test.mjs
```

Expected: FAIL because `HarubanResearchLoading.tsx` does not exist.

**Step 3: Commit the failing test**

```powershell
git add apps/web/tests/haruban-research-loading.test.mjs
git commit -m "[테스트] 하루방 리서치 로딩 계약 추가"
```

### Task 2: Build the compact and expanded research loading component

**Files:**
- Create: `apps/web/src/components/HarubanResearchLoading.tsx`
- Test: `apps/web/tests/haruban-research-loading.test.mjs`

**Step 1: Add constants and elapsed-time state**

Start the component with stable content and one timer:

```tsx
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Compass, Search, Sparkles } from 'lucide-react';
import HarubangMark from './marks/HarubangMark';

const EXPAND_AFTER_SECONDS = 8;
const GUIDE_INTERVAL_SECONDS = 4;
const TIP_INTERVAL_SECONDS = 5;

const RESEARCH_GUIDES = [
  '질문에 담긴 지역과 여행 취향을 읽고 있어요',
  '공식·플랫폼·경험 출처를 폭넓게 살펴보고 있어요',
  '서로 다른 정보를 나란히 비교하고 있어요',
  '확인한 근거를 여행자가 읽기 쉽게 정리하고 있어요',
] as const;

const JEJU_TIPS = [
  '제주에서는 같은 지역도 해안과 중산간의 날씨가 다를 수 있어요.',
  '바람이 강한 날에는 우산보다 가벼운 우비가 편할 때가 많아요.',
  '인기 장소는 운영시간뿐 아니라 마지막 입장 시간도 함께 확인해 보세요.',
  '이동 시간을 잡을 때는 지도 거리보다 제주 도로의 실제 흐름을 여유 있게 보세요.',
  '여행 중 발견한 변경 정보는 다음 여행자의 더 나은 근거가 될 수 있어요.',
] as const;

function secondsSince(startedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}
```

Implement the component state:

```tsx
export default function HarubanResearchLoading({ startedAt }: { startedAt: number }) {
  const shouldReduceMotion = useReducedMotion();
  const [elapsedSeconds, setElapsedSeconds] = useState(() => secondsSince(startedAt));

  useEffect(() => {
    setElapsedSeconds(secondsSince(startedAt));
    const timer = window.setInterval(
      () => setElapsedSeconds(secondsSince(startedAt)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const expanded = elapsedSeconds >= EXPAND_AFTER_SECONDS;
  const guideIndex = Math.floor(elapsedSeconds / GUIDE_INTERVAL_SECONDS) % RESEARCH_GUIDES.length;
  const tipIndex = Math.floor(elapsedSeconds / TIP_INTERVAL_SECONDS) % JEJU_TIPS.length;
```

**Step 2: Render the compact state**

Use a `motion.div` with `layout`, a cream background, the existing `HarubangMark`, and a three-dot searching indicator. The compact copy must be:

```tsx
<p className="font-bold text-basalt">
  질문에 담긴 여행 조건을 살펴보고 있어요
</p>
```

The outer element must include:

```tsx
role="status"
aria-live="polite"
aria-label={
  expanded
    ? '하루방 에이전트가 웹 출처를 조사하고 답변을 정리하고 있습니다.'
    : '하루방 에이전트가 질문을 살펴보고 있습니다.'
}
```

Place rapidly changing visible content inside an `aria-hidden="true"` wrapper so screen readers do not announce every second.

**Step 3: Render the expanded state**

Inside `AnimatePresence`, show the following only when `expanded` is true:

```tsx
<motion.div
  key="research-details"
  initial={shouldReduceMotion ? false : { opacity: 0, height: 0, y: -6 }}
  animate={{ opacity: 1, height: 'auto', y: 0 }}
  exit={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
>
  <p>{elapsedSeconds}초째 제주 곳곳의 근거를 살펴보고 있어요</p>
  <span>조사 중 안내</span>
  <p>{RESEARCH_GUIDES[guideIndex]}</p>
  <span>기다리는 동안 제주 한 조각</span>
  <p>{JEJU_TIPS[tipIndex]}</p>
</motion.div>
```

Add a decorative curved route made from an inline SVG path and a small compass/search marker. Mark the SVG `aria-hidden="true"`. If `shouldReduceMotion` is true, keep the marker stationary and disable repeating character motion.

**Step 4: Run the source-contract test**

Run:

```powershell
node --test apps/web/tests/haruban-research-loading.test.mjs
```

Expected: the component-specific tests PASS; the chat integration test still FAILS.

**Step 5: Run TypeScript validation**

Run:

```powershell
npm run lint
```

Working directory: `apps/web`

Expected: PASS with no TypeScript errors.

**Step 6: Commit the component**

```powershell
git add apps/web/src/components/HarubanResearchLoading.tsx
git commit -m "[웹] 하루방 리서치 로딩 카드 추가"
```

### Task 3: Integrate the research card into Haruban chat

**Files:**
- Modify: `apps/web/src/components/HarubanChat.tsx:1-20`
- Modify: `apps/web/src/components/HarubanChat.tsx:165-180`
- Modify: `apps/web/src/components/HarubanChat.tsx:370-418`
- Modify: `apps/web/src/components/HarubanChat.tsx:580-590`
- Test: `apps/web/tests/haruban-research-loading.test.mjs`

**Step 1: Import the component and add request timing state**

Add:

```tsx
import HarubanResearchLoading from './HarubanResearchLoading';
```

Next to the existing `loading` state add:

```tsx
const [loadingStartedAt, setLoadingStartedAt] = useState<number | null>(null);
```

**Step 2: Start and clear the timestamp with the request**

Immediately before or with `setLoading(true)`:

```tsx
setLoadingStartedAt(Date.now());
setLoading(true);
```

In the request `finally` block:

```tsx
setLoading(false);
setLoadingStartedAt(null);
```

Do not attach request lifetime to `open`. The existing component remains mounted when the panel closes, so the fetch and timestamp continue.

**Step 3: Replace the one-line spinner**

Replace:

```tsx
{loading && (
  <div className="flex items-center gap-1.5 text-[11px] text-basalt-2/60 px-1">
    <Loader2 className="w-3 h-3 animate-spin" /> 하루방 에이전트가 질문을 해석하고 정보를 확인 중이에요...
  </div>
)}
```

with:

```tsx
{loading && loadingStartedAt !== null && (
  <HarubanResearchLoading startedAt={loadingStartedAt} />
)}
```

Keep `Loader2` if it is still used by `introLoading`; otherwise remove only unused imports.

**Step 4: Run the focused contract tests**

Run:

```powershell
node --test apps/web/tests/haruban-research-loading.test.mjs
node --test apps/web/tests/haruban-plan-selection.test.mjs
```

Expected: PASS.

**Step 5: Run all web source-contract tests**

Run:

```powershell
node --test apps/web/tests/*.test.mjs
```

Expected: all tests PASS.

**Step 6: Commit the chat integration**

```powershell
git add apps/web/src/components/HarubanChat.tsx apps/web/tests/haruban-research-loading.test.mjs
git commit -m "[웹] 하루방 조사 대기 경험 연결"
```

### Task 4: Verify production behavior and visual quality

**Files:**
- Modify if required by QA: `apps/web/src/components/HarubanResearchLoading.tsx`
- Modify if required by QA: `apps/web/src/components/HarubanChat.tsx`

**Step 1: Run TypeScript validation**

Run:

```powershell
npm run lint
```

Working directory: `apps/web`

Expected: PASS.

**Step 2: Build the production bundle**

Run:

```powershell
npm run build
```

Working directory: `apps/web`

Expected: PASS and `dist/` generated.

**Step 3: Start the local web app**

Run:

```powershell
npm run dev -- --host 127.0.0.1
```

Working directory: `apps/web`

Expected: Vite serves the app on the configured local port.

**Step 4: Verify with a deliberately slow request**

Use browser network throttling or temporarily delay the frontend response only in local development. Confirm:

- 0–7 seconds: compact card only
- 8 seconds: card expands without a layout jump
- elapsed seconds continue accurately
- guide text and tips rotate
- no percentage, remaining time, or cancel button appears
- closing and reopening the chat shows the correct elapsed time
- response arrival replaces the loading card with the answer and place picker
- mobile layout does not cover the input
- reduced-motion mode removes repeating movement

Do not commit a temporary delay.

**Step 5: Run the full web verification again**

Run:

```powershell
node --test apps/web/tests/*.test.mjs
npm run lint
npm run build
```

Expected: all commands PASS.

**Step 6: Commit any QA refinements**

```powershell
git add apps/web/src/components/HarubanResearchLoading.tsx apps/web/src/components/HarubanChat.tsx
git commit -m "[개선] 하루방 로딩 카드 반응형 마감"
```

Skip this commit if no QA changes were needed.


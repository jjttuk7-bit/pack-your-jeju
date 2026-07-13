# Mobile Map Instruction Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 스마트폰에서 지도 안내문이 제주 지도 터치 영역을 가리지 않도록 반응형 배치를 수정한다.

**Architecture:** `JejuSilhouetteMap`의 지도 캔버스와 안내문을 하나의 반응형 래퍼 안에서 분리한다. 모바일 안내문은 일반 흐름으로 렌더링하고, `sm` 이상에서는 별도의 안내문을 기존 우측 하단 오버레이로 표시해 현재 데스크톱 구성을 보존한다.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Node.js built-in test runner, Vite

---

### Task 1: 모바일 안내문 배치 회귀 테스트

**Files:**
- Create: `apps/web/tests/mobile-map-instruction-layout.test.mjs`
- Test: `apps/web/tests/mobile-map-instruction-layout.test.mjs`

**Step 1: Write the failing test**

소스 파일을 읽고 다음 계약을 검증한다.

```js
assert.match(source, /data-testid="mobile-map-instruction"/);
assert.match(source, /data-testid="desktop-map-instruction"/);
assert.match(source, /data-testid="mobile-map-instruction"[\s\S]*?sm:hidden/);
assert.match(source, /data-testid="desktop-map-instruction"[\s\S]*?hidden[\s\S]*?sm:block/);
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/mobile-map-instruction-layout.test.mjs`

Expected: FAIL because the responsive instruction elements do not exist.

### Task 2: 반응형 안내문 구현

**Files:**
- Modify: `apps/web/src/components/TrustMapDashboard.tsx:485-615`
- Test: `apps/web/tests/mobile-map-instruction-layout.test.mjs`

**Step 1: Write minimal implementation**

- 기존 지도 카드의 `aspect-ratio`를 내부 캔버스 요소로 이동한다.
- 모바일 안내문을 캔버스 아래 일반 흐름에 추가하고 `sm:hidden`으로 제한한다.
- 기존 오버레이는 `hidden sm:block`으로 데스크톱에서만 표시한다.

**Step 2: Run test to verify it passes**

Run: `node --test tests/mobile-map-instruction-layout.test.mjs`

Expected: PASS.

### Task 3: 정적·브라우저 검증

**Files:**
- Verify: `apps/web/src/components/TrustMapDashboard.tsx`

**Step 1: Run TypeScript validation**

Run: `npm run lint`

Expected: Exit code 0.

**Step 2: Run production build**

Run: `npm run build`

Expected: Exit code 0.

**Step 3: Verify at mobile viewport**

스마트폰 너비에서 앱을 열고 안내문이 지도 아래에 있으며 지도 행정구역 클릭이 동작하는지 확인한다. 데스크톱 너비에서는 안내문이 기존 위치에 있는지 확인한다.

**Step 4: Commit**

```bash
git add apps/web/src/components/TrustMapDashboard.tsx apps/web/tests/mobile-map-instruction-layout.test.mjs docs/plans/2026-07-13-mobile-map-instruction-layout-design.md docs/plans/2026-07-13-mobile-map-instruction-layout.md
git commit -m "[web] 모바일 지도 안내문 터치 영역 수정"
```

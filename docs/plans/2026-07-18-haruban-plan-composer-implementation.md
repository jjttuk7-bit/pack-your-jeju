# Haruban Plan Composer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 사용자가 담은 장소를 변경하지 않고 날씨·동선 결과를 반영한 편집 가능한 하루방 PDF 초안을 생성한다.

**Architecture:** 순수 함수 모듈이 원본 플랜 복사본에 날씨·동선 제안을 적용하고 `HarubanPlanDraft`를 만든다. `PackingDashboard`가 기존 API 호출을 순서대로 오케스트레이션하고, `PlanPdfEditor`는 일반 초안 또는 하루방 초안을 초기값으로 받아 편집·다운로드한다.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, 기존 `/weather/report`·`/route/plan` API

---

### Task 1: 하루방 초안 순수 모델

**Files:**
- Create: `apps/web/src/harubanPlanComposer.ts`
- Create: `apps/web/src/harubanPlanComposer.test.ts`
- Modify: `apps/web/src/types.ts`

**Step 1: Write the failing test**

- 원본 배열을 변경하지 않고 기본 PDF 초안을 만드는지 검사한다.
- 날씨 제안과 동선 제안이 복사본에만 적용되는지 검사한다.
- 고정 일정과 출처 정보가 유지되는지 검사한다.
- 부분 실패 경고와 장소별 이유가 생성되는지 검사한다.

**Step 2: Run test to verify it fails**

Run: `npm test -- harubanPlanComposer.test.ts`

Expected: 조합 모듈과 타입이 없어 FAIL.

**Step 3: Write minimal implementation**

- `HarubanPlanDraft`, `HarubanPlanCheckState` 타입을 추가한다.
- `createHarubanPlanDraft`에서 기본 일정, 날씨 결과, 동선 결과, 경고를 하나의 PDF 초안으로 조립한다.
- `planFingerprint`로 원본 기준을 저장한다.

**Step 4: Run test to verify it passes**

Run: `npm test -- harubanPlanComposer.test.ts`

Expected: PASS.

### Task 2: PDF 편집기 하루방 초안 연결

**Files:**
- Modify: `apps/web/src/components/PlanPdfEditor.tsx`
- Create: `apps/web/src/components/PlanPdfEditor.test.tsx`

**Step 1: Write the failing test**

- `initialDraft`가 있으면 기본 초안 대신 사용한다.
- 하루방 초안 배지, 날씨·동선 상태, 경고를 표시한다.
- Day·순서·메모 편집 시 `onDraftChange`를 호출한다.

**Step 2: Run test to verify it fails**

Run: `npm test -- components/PlanPdfEditor.test.tsx`

Expected: 새 props와 상태 UI가 없어 FAIL.

**Step 3: Write minimal implementation**

- 선택적 `initialDraft`, `composition`, `onDraftChange` props를 추가한다.
- 기존 편집·PDF 다운로드 기능은 유지한다.
- 편집될 때 현재 draft를 부모에 전달한다.

**Step 4: Run test to verify it passes**

Run: `npm test -- components/PlanPdfEditor.test.tsx`

Expected: PASS.

### Task 3: 대시보드 조합 오케스트레이션

**Files:**
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Modify: `apps/web/src/components/PackingDashboard.test.tsx`

**Step 1: Write the failing test**

- 장소가 있을 때 `하루방 플랜 조합` 버튼을 표시한다.
- 클릭 시 진행 상태를 표시하고 날씨·동선 요청을 수행한다.
- 원본 `selectedPlanItems` 변경 콜백을 호출하지 않는다.
- 완료 후 `초안 확인하기`로 PDF 편집기를 연다.
- 원본 fingerprint가 바뀌면 초안을 폐기한다.

**Step 2: Run test to verify it fails**

Run: `npm test -- --testTimeout=30000 components/PackingDashboard.test.tsx`

Expected: 조합 버튼과 완료 상태가 없어 FAIL.

**Step 3: Write minimal implementation**

- `compositionState`, `harubanDraft`, 단계 메시지를 상태로 관리한다.
- 기존 `requestWeatherReport`와 `requestRoutePlan`을 순차 호출한다.
- 날씨·동선 실패는 경고로 바꾸고 기본 초안 생성을 계속한다.
- `PlanPdfEditor`에 하루방 초안을 전달한다.

**Step 4: Run test to verify it passes**

Run: `npm test -- --testTimeout=30000 components/PackingDashboard.test.tsx`

Expected: PASS.

### Task 4: 공유 텍스트와 활성 초안

**Files:**
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Modify: `apps/web/src/components/PackingDashboard.test.tsx`

**Step 1: Write the failing test**

- 하루방 초안 활성 시 공유 텍스트가 초안 Day·순서를 사용한다.
- `내 플랜으로 돌아가기` 후 원본 플랜을 사용한다.

**Step 2: Run test to verify it fails**

Run: `npm test -- --testTimeout=30000 components/PackingDashboard.test.tsx`

Expected: 공유가 항상 원본을 사용해 FAIL.

**Step 3: Write minimal implementation**

- `activeExportItems`를 원본 또는 하루방 초안에서 계산한다.
- PDF·공유가 같은 활성 초안을 참조하게 한다.

**Step 4: Run test to verify it passes**

Run: `npm test -- --testTimeout=30000 components/PackingDashboard.test.tsx`

Expected: PASS.

### Task 5: 회귀·접근성·프로덕션 검증

**Files:**
- Verify: `apps/web/src/harubanPlanComposer.ts`
- Verify: `apps/web/src/components/PackingDashboard.tsx`
- Verify: `apps/web/src/components/PlanPdfEditor.tsx`

**Step 1:** `npm test -- --testTimeout=30000 --maxWorkers=1` 실행.

**Step 2:** `npm run lint` 실행.

**Step 3:** `npm run build` 실행.

**Step 4:** 모바일·데스크톱에서 버튼, 진행 상태, 완료 카드, PDF 편집기 확인.

**Step 5:** 관련 파일만 커밋하고 사용자 변경을 보존한다.

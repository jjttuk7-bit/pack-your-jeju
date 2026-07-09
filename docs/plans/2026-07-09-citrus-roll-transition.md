# Citrus Roll Transition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 랜딩페이지에서 대시보드로 진입한 직후, 상단 감귤이 한라산 방향으로 한 번 굴러가는 감성 전환 모션을 추가한다.

**Architecture:** `App.tsx`의 랜딩 진입 핸들러에서 세션 플래그를 설정하고, 앱 헤더에서 해당 플래그를 읽어 1회성 `motion` 레이어를 렌더링한다. 실제 로고는 원래 위치에 유지하고, 모션용 감귤 복제본만 라인 위를 지나가게 한다.

**Tech Stack:** React, Motion React, sessionStorage, 기존 `CitrusMark` SVG 컴포넌트.

---

### Task 1: Trigger State

**Files:**
- Modify: `apps/web/src/App.tsx`

**Steps:**
1. `handleEnter`에서 `sessionStorage`에 대시보드 전환 모션 요청 플래그를 저장한다.
2. 앱 렌더 후 헤더에서 해당 플래그를 읽어 `playCitrusRoll` 상태를 켠다.
3. 플래그는 즉시 제거해 같은 세션에서 반복되지 않게 한다.

### Task 2: Motion Layer

**Files:**
- Modify: `apps/web/src/App.tsx`

**Steps:**
1. 헤더의 실제 로고는 그대로 둔다.
2. `CitrusRollTransition` 컴포넌트를 추가해 모션용 감귤 복제본을 절대 위치로 렌더링한다.
3. 감귤은 왼쪽 브랜드 영역에서 오른쪽 한라산 방향으로 이동하며 회전한다.
4. `pointer-events-none`, `aria-hidden`을 적용한다.
5. `prefers-reduced-motion` 사용자는 모션을 보지 않도록 한다.

### Task 3: Verification

**Files:**
- Test: `apps/web`

**Steps:**
1. `npm run lint`로 타입 검사를 통과한다.
2. `npm run build`로 프로덕션 빌드를 통과한다.
3. `git diff`로 변경 범위를 확인한다.


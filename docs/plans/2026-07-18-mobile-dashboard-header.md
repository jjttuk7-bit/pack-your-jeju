# Mobile Dashboard Header Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모바일 대시보드 헤더를 2단 앱 헤더로 재구성해 브랜드명이 한 글자씩 줄바꿈되는 문제를 없앤다.

**Architecture:** `App.tsx`의 기존 헤더와 데스크톱 표현은 유지하고 Tailwind 반응형 클래스만 조정한다. 모바일에서는 감귤·브랜드·아이콘 버튼을 첫 행에 배치하고 짧은 안내를 두 번째 행에 노출한다.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Motion, Vitest

---

### Task 1: 모바일 헤더 계약 고정

**Files:**
- Create: `apps/web/src/appHeaderLayout.test.ts`
- Modify: `apps/web/src/App.tsx`

**Step 1: Write the failing test**

모바일 제목의 한 줄 유지, 44px 조작 영역, 모바일 전용 안내 문구와 데스크톱 텍스트 레이블의 반응형 전환을 검증한다.

**Step 2: Run test to verify it fails**

Run: `npm test -- appHeaderLayout.test.ts`

Expected: 현재 헤더에 모바일 반응형 계약이 없어 FAIL.

**Step 3: Write minimal implementation**

`App.tsx` 헤더에 `whitespace-nowrap`, 모바일 44px 버튼, `sm:hidden`/`hidden sm:inline` 레이블, 모바일 전용 두 번째 안내 행을 적용한다.

**Step 4: Run test to verify it passes**

Run: `npm test -- appHeaderLayout.test.ts`

Expected: PASS.

### Task 2: 회귀 및 프로덕션 검증

**Files:**
- Verify: `apps/web/src/App.tsx`
- Verify: `apps/web/src/appHeaderLayout.test.ts`

**Step 1:** Run the focused and frontend test suite.

**Step 2:** Run `npm run lint`.

**Step 3:** Run `npm run build`.

**Step 4:** Review the final diff and preserve unrelated user files.

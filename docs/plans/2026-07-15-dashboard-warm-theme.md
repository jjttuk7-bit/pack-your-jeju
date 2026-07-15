# 대시보드 웜 테마 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 랜딩 히어로의 크림빛 하늘·오름 녹색·현무암색을 대시보드 전체에 확장하고 산세리프 타이포그래피로 전환한다.

**Architecture:** 기존 Tailwind 토큰과 전역 CSS를 유지하면서 폰트 변수와 배경 장식 클래스를 추가한다. App의 공통 셸에 테마 클래스를 적용하고, 기존 컴포넌트의 세리프 제목 사용을 산세리프 계층으로 교체한다.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, 기존 CSS 변수.

---

### Task 1: 전역 폰트·색상 토큰

**Files:** `apps/web/src/index.css`

1. 기존 폰트 선언과 색상 변수를 확인한다.
2. 산세리프 본문/제목 폰트 변수를 추가한다.
3. 크림·오름·현무암 기반 대시보드 배경 토큰과 능선 그라디언트를 추가한다.

### Task 2: 대시보드 셸 배경

**Files:** `apps/web/src/App.tsx`

1. 대시보드 이후 화면에 웜 테마 클래스를 적용한다.
2. 상단 능선 그라디언트와 종이 질감 오버레이를 추가한다.
3. 랜딩 화면의 기존 장식을 변경하지 않는다.

### Task 3: 컴포넌트 타이포그래피

**Files:** `apps/web/src/components/PackingDashboard.tsx`, `TravelFeedback.tsx`, `ModerationQueue.tsx`

1. 주요 제목의 serif 클래스를 산세리프 계층으로 교체한다.
2. 작은 라벨·본문 대비를 유지한다.
3. 모바일 줄바꿈과 접근성 포커스 스타일을 보존한다.

### Task 4: 검증

1. `npm run lint`
2. `npm run build`
3. `git diff --check`


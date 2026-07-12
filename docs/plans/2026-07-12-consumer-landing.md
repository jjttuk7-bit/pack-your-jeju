# Consumer Landing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 제주 여행 욕구를 만들고 사용자를 대시보드로 전환하는 소비자용 랜딩 페이지를 구축한다.

**Architecture:** 기존 `LandingPage`의 `onEnter` 계약은 유지하면서 내부 마크업을 전면 교체한다. 프로젝트 전용 실사 이미지 자산을 생성해 로컬 정적 파일로 제공하고, 전용 CSS 클래스는 기존 디자인 토큰과 함께 사용한다.

**Tech Stack:** React 19, TypeScript, Motion, Tailwind CSS, generated WebP/PNG assets, Vite

---

### Task 1: 마케팅 이미지 자산

**Files:**
- Create: `apps/web/public/images/landing-jeju-hero.jpg`
- Create: `apps/web/public/images/landing-jeju-forest.jpg`
- Create: `apps/web/public/images/landing-jeju-market.jpg`

1. 제주 히어로, 해안 산책, 골목·음식 이미지를 생성한다.
2. 결과를 프로젝트 정적 자산 경로로 복사한다.
3. 각 이미지의 구도와 모바일 크롭 적합성을 확인한다.

### Task 2: 소비자 랜딩 컴포넌트

**Files:**
- Modify: `apps/web/src/components/LandingPage.tsx`

1. 심사·경진대회·데이터 구조 섹션을 제거한다.
2. 풀블리드 히어로와 단일 CTA를 구현한다.
3. 제주 발견 갤러리와 3단계 플래닝 흐름을 구현한다.
4. 신뢰 가치와 최종 CTA를 구현한다.
5. 기존 `onEnter` 전환 애니메이션을 유지한다.

### Task 3: 반응형 스타일

**Files:**
- Modify: `apps/web/src/index.css`

1. 히어로 이미지 오버레이, 스크롤 유도, 갤러리 크롭을 구현한다.
2. 모바일·태블릿·데스크톱 레이아웃을 조정한다.
3. 모션 감소 설정과 포커스 상태를 보존한다.

### Task 4: 검증과 배포

1. `npm run lint`와 `npm run build`를 실행한다.
2. 데스크톱과 모바일 뷰포트에서 Playwright 스크린샷을 확인한다.
3. CTA가 대시보드로 이동하는지 검증한다.
4. 변경 파일만 커밋하고 `main`에 푸시한다.
5. Railway 배포 성공 후 운영 랜딩을 확인한다.

# PWA Brand Icon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PWA 설치 이름을 `제주를 담다`로 통일하고 기존 `P` 아이콘을 크림 배경의 감귤 브랜드 마크로 교체한다.

**Architecture:** 헤더의 `CitrusMark` 도형을 독립 SVG 자산으로 옮겨 PWA용 PNG 네 크기로 렌더링한다. 새 파일명을 manifest와 HTML에 연결해 기존 아이콘 URL 캐시를 피하고, 앱 `id`는 유지한다.

**Tech Stack:** Vite, vite-plugin-pwa, TypeScript, Vitest, SVG, PNG

---

### Task 1: PWA 브랜드 계약 테스트

**Files:**
- Create: `apps/web/src/pwaBrand.test.ts`
- Test: `apps/web/vite.config.ts`
- Test: `apps/web/index.html`

**Step 1: Write the failing test**

- HTML 제목과 iOS 설치 이름이 `제주를 담다`인지 검사한다.
- manifest가 새 `jeju-damda-icon-*` 파일과 정확한 `purpose`를 참조하는지 검사한다.
- 기존 `Pack Your Jeju`와 `icons/icon-` 참조가 PWA 메타데이터에서 사라졌는지 검사한다.

**Step 2: Run test to verify it fails**

Run: `npm test -- pwaBrand.test.ts`

Expected: 영문 HTML·iOS 이름과 기존 아이콘 파일명 때문에 FAIL.

### Task 2: 감귤 아이콘 자산 생성

**Files:**
- Create: `apps/web/public/icons/jeju-damda-icon.svg`
- Create: `apps/web/public/icons/jeju-damda-icon-180.png`
- Create: `apps/web/public/icons/jeju-damda-icon-192.png`
- Create: `apps/web/public/icons/jeju-damda-icon-512.png`
- Create: `apps/web/public/icons/jeju-damda-icon-maskable-512.png`

**Step 1:** `CitrusMark.tsx`의 감귤 path, gradient, highlight, texture를 SVG에 동일하게 구성한다.

**Step 2:** 일반 아이콘은 크림 배경 위에 큰 감귤을 배치한다.

**Step 3:** 마스커블 아이콘은 같은 도형을 안전 영역 안으로 축소한다.

**Step 4:** PNG 헤더를 읽어 각각 180×180, 192×192, 512×512인지 검증한다.

### Task 3: 앱 이름과 아이콘 연결

**Files:**
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/index.html`

**Step 1:** HTML `<title>`과 `apple-mobile-web-app-title`을 `제주를 담다`로 바꾼다.

**Step 2:** `includeAssets`, manifest `icons`, Apple touch icon, favicon을 새 파일명으로 바꾼다.

**Step 3:** `name`, `short_name`, `id`, `start_url`을 유지한다.

**Step 4:** `npm test -- pwaBrand.test.ts`를 실행해 GREEN을 확인한다.

### Task 4: 프로덕션 PWA 검증

**Files:**
- Verify: `apps/web/dist/manifest.webmanifest`

**Step 1:** `npm run lint`를 실행한다.

**Step 2:** `npm run build`를 실행한다.

**Step 3:** 빌드 manifest의 이름, 아이콘 경로, 크기, purpose를 검사한다.

**Step 4:** 일반·마스커블 PNG를 시각 검토한다.

**Step 5:** 관련 파일만 커밋하고 사용자 변경은 보존한다.

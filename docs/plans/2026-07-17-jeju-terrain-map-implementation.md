# 제주 입체 지형 지도 시각 고도화 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 기존 제주 지역 선택과 공공데이터 상태 계약을 유지하면서 바다 수심, 해안광, 한라산 등고선, 선택 지역 입체감을 가진 SVG 지도로 고도화한다.

**Architecture:** `TrustMapDashboard.tsx`의 상태·API·제출 로직은 그대로 두고 `JejuSilhouetteMap` 내부를 defs, 바다, 지형, 지역 상태 레이어로 분리한다. 모든 장식은 SVG/CSS로 구현하고 지역 경로만 이벤트를 받으며, 데이터 상태와 선택 여부는 명시적인 `data-*` 속성과 접근성 텍스트로 노출한다.

**Tech Stack:** React 19, TypeScript, SVG, Tailwind CSS, Vitest, Testing Library, Node test, Vite PWA

---

### Task 1: 지도 지형 레이어의 테스트 계약

**Files:**
- Create: `apps/web/src/components/TrustMapDashboard.test.tsx`
- Modify: `apps/web/src/components/TrustMapDashboard.tsx:484-614`

**Skills:** `@test-driven-development`, `@frontend-design`, `@web-design-guidelines`

**Step 1: Write the failing terrain-layer test**

`requestRegionCoveragePreview`를 mock하고 현재 컴포넌트를 렌더한다.

```tsx
import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import TrustMapDashboard from './TrustMapDashboard';
import {requestRegionCoveragePreview} from '../api';

vi.mock('../api', () => ({
  requestRegionCoveragePreview: vi.fn(),
}));

const mockedPreview = vi.mocked(requestRegionCoveragePreview);

beforeEach(() => {
  mockedPreview.mockImplementation(async (region) => ({
    region,
    total_candidates: region === 'jeju_city' ? 128 : 24,
    strong_moments: [],
    caution_moments: [],
    unavailable_moments: [],
  }));
});

it('renders sea depth, coastline, and Hallasan terrain behind the region controls', async () => {
  render(<TrustMapDashboard onSubmit={vi.fn()} />);

  expect(await screen.findByTestId('jeju-sea-layer')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByTestId('jeju-coast-layer')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByTestId('hallasan-terrain-layer')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getAllByRole('button', {name: /근거 보기/})).toHaveLength(12);
});
```

응답 타입의 실제 필드명이 다르면 `RegionCoveragePreview` 정의에 맞춰 fixture를 완성하되, 테스트 목적은 장식 레이어와 12개 지역 버튼의 공존으로 유지한다.

**Step 2: Run the test and verify it fails**

Run:

```powershell
cd apps/web
npm test -- src/components/TrustMapDashboard.test.tsx
```

Expected: FAIL because the three `data-testid` terrain layers do not exist.

**Step 3: Add reusable SVG definitions**

`JejuSilhouetteMap`의 `<defs>`를 `JejuMapDefs`로 추출하고 다음 ID를 제공한다.

```tsx
function JejuMapDefs() {
  return (
    <defs>
      <linearGradient id="jejuSeaDepth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F9FCFB" />
        <stop offset="0.55" stopColor="#E5F2EF" />
        <stop offset="1" stopColor="#CFE5E1" />
      </linearGradient>
      <radialGradient id="hallasanRelief" cx="50%" cy="48%" r="48%">
        <stop offset="0" stopColor="#477D70" stopOpacity="0.34" />
        <stop offset="0.42" stopColor="#74A496" stopOpacity="0.18" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      <filter id="jejuIslandDepth" x="-15%" y="-20%" width="130%" height="150%">
        <feDropShadow dx="0" dy="13" stdDeviation="10" floodColor="#44665F" floodOpacity="0.24" />
      </filter>
      <filter id="jejuSelectedGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#E66A38" floodOpacity="0.55" />
      </filter>
      <clipPath id="jejuIslandClip">
        <path d={JEJU_ISLAND_PATH} />
      </clipPath>
    </defs>
  );
}
```

`JEJU_ISLAND_PATH`는 현재 12개 지역의 외곽을 따르는 단일 실루엣 경로 상수로 추가한다. 행정구역 경로 자체는 수정하지 않는다.

**Step 4: Add sea and terrain layers before the interactive region group**

```tsx
function JejuSeaLayer() {
  return (
    <g data-testid="jeju-sea-layer" aria-hidden="true" pointerEvents="none">
      <rect width="567" height="312" fill="url(#jejuSeaDepth)" />
      <path className="fill-none stroke-white/70" d="..." />
      <path className="fill-none stroke-[#A8D0C8]/45" d="..." />
    </g>
  );
}

function JejuTerrainLayer() {
  return (
    <>
      <g data-testid="jeju-coast-layer" aria-hidden="true" pointerEvents="none">
        <path d={JEJU_ISLAND_PATH} className="fill-white/45" filter="url(#jejuIslandDepth)" />
        <path d={JEJU_ISLAND_PATH} className="fill-none stroke-white/90 stroke-[5]" />
      </g>
      <g
        data-testid="hallasan-terrain-layer"
        aria-hidden="true"
        pointerEvents="none"
        clipPath="url(#jejuIslandClip)"
      >
        <ellipse cx="292" cy="163" rx="142" ry="92" fill="url(#hallasanRelief)" />
        <ellipse cx="292" cy="163" rx="112" ry="69" className="fill-none stroke-white/32" />
        <ellipse cx="292" cy="163" rx="75" ry="45" className="fill-none stroke-[#3D7468]/16" />
      </g>
    </>
  );
}
```

레이어 순서는 `sea → coast shadow → region fills → Hallasan overlay → road/boundaries → labels`로 맞춘다. 한라산 레이어가 지역 색을 가리면 opacity를 낮추고 region fill 바로 뒤로 옮긴다.

**Step 5: Run the focused test**

Run: `npm test -- src/components/TrustMapDashboard.test.tsx`

Expected: PASS.

**Step 6: Commit**

```powershell
git add apps/web/src/components/TrustMapDashboard.tsx apps/web/src/components/TrustMapDashboard.test.tsx
git commit -m "[지도] 제주 바다와 지형 레이어 추가"
```

---

### Task 2: 지역별 데이터 상태와 입체 선택 피드백

**Files:**
- Modify: `apps/web/src/components/TrustMapDashboard.tsx:500-610`
- Modify: `apps/web/src/components/TrustMapDashboard.test.tsx`

**Skills:** `@test-driven-development`, `@frontend-design`

**Step 1: Write failing interaction tests**

```tsx
it('shows compact evidence status and a selected visual state without changing the button contract', async () => {
  const user = userEvent.setup();
  render(<TrustMapDashboard onSubmit={vi.fn()} />);

  const jeju = await screen.findByRole('button', {name: '제주시 근거 보기'});
  expect(jeju).toHaveAttribute('data-selected', 'false');
  expect(screen.getByLabelText('제주시 지도 상태')).toHaveTextContent('후보 128');

  await user.dblClick(jeju);
  expect(jeju).toHaveAttribute('aria-pressed', 'true');
  expect(jeju).toHaveAttribute('data-selected', 'true');
  expect(screen.getByTestId('jeju_city-selection-glow')).toBeInTheDocument();
});
```

실제 fixture에서 후보 수 필드가 `total` 등 다른 이름이면 프로덕션 타입에 맞춰 조정한다.

**Step 2: Run and verify RED**

Run: `npm test -- src/components/TrustMapDashboard.test.tsx`

Expected: FAIL because status labels, `data-selected`, and selection glow are missing.

**Step 3: Add explicit region state attributes and selected glow**

각 지역 `<path>`에 다음 속성을 추가한다.

```tsx
data-region-id={shape.id}
data-tone={tone}
data-active={String(active)}
data-selected={String(selected)}
filter={selected ? 'url(#jejuSelectedGlow)' : undefined}
className={`... motion-reduce:transition-none ${regionFillClass(...)}`}
```

선택광은 지역 경로를 이동시키지 않는다. 동일 경로를 장식용으로 한 번 더 그리거나 filter만 사용한다.

```tsx
{selected && (
  <path
    data-testid={`${shape.id}-selection-glow`}
    aria-hidden="true"
    pointerEvents="none"
    d={shape.path}
    className="fill-none stroke-citrus stroke-[5] opacity-80"
    filter="url(#jejuSelectedGlow)"
  />
)}
```

**Step 4: Add compact status labels**

`RegionStatusLabel`은 지도 안에 보여줄 문자열을 결정한다.

```tsx
function regionMapStatus(
  preview: RegionCoveragePreview | undefined,
  tone: RegionTone,
  loading: boolean,
): string {
  if (loading) return '조회 중';
  if (tone === 'insufficient') return '데이터 부족';
  if (tone === 'caution') return '확인 필요';
  const total = preview?.total_candidates ?? 0;
  return total > 0 ? `후보 ${total}` : '근거 보기';
}
```

실제 타입 필드 이름을 사용한다. 라벨은 `foreignObject` 대신 SVG `<text>` 두 줄로 구현해 브라우저 호환성을 유지한다.

```tsx
<g aria-label={`${regionLabel} 지도 상태`} role="status" className="pointer-events-none">
  <text ...>{regionLabel}</text>
  {(active || selected) && <text ...>{status}</text>}
</g>
```

작은 지역인 우도는 상태 보조 문구를 숨기고 지역명만 유지한다.

**Step 5: Run focused and existing map layout tests**

```powershell
npm test -- src/components/TrustMapDashboard.test.tsx
node --test tests/mobile-map-instruction-layout.test.mjs
```

Expected: all PASS.

**Step 6: Commit**

```powershell
git add apps/web/src/components/TrustMapDashboard.tsx apps/web/src/components/TrustMapDashboard.test.tsx
git commit -m "[지도] 지역 상태와 선택 입체감 강화"
```

---

### Task 3: 호버·포커스·감소된 모션과 범례 정리

**Files:**
- Modify: `apps/web/src/components/TrustMapDashboard.tsx:470-640`
- Modify: `apps/web/src/components/TrustMapDashboard.test.tsx`
- Modify: `apps/web/tests/mobile-map-instruction-layout.test.mjs`

**Skills:** `@web-design-guidelines`, `@test-driven-development`

**Step 1: Write failing keyboard and source-contract tests**

```tsx
it.each([
  ['Enter', 'jeju_city'],
  [' ', 'jeju_city'],
])('opens the region evidence panel with %s', async (key, regionId) => {
  const user = userEvent.setup();
  render(<TrustMapDashboard onSubmit={vi.fn()} />);
  const region = await screen.findByRole('button', {name: '제주시 근거 보기'});
  region.focus();
  await user.keyboard(key === ' ' ? ' ' : '{Enter}');
  expect(region).toHaveAttribute('data-active', 'true');
});
```

Node source test에는 다음 계약을 추가한다.

```js
assert.match(source, /motion-reduce:transition-none/);
assert.match(source, /data-testid="jeju-sea-layer"/);
assert.match(source, /pointerEvents="none"/);
```

**Step 2: Run tests and verify RED where applicable**

Run:

```powershell
npm test -- src/components/TrustMapDashboard.test.tsx
node --test tests/mobile-map-instruction-layout.test.mjs
```

**Step 3: Refine focus and motion behavior**

- 지역 path에 `focus-visible`에서 4px citrus 외곽선을 유지한다.
- 기본 transition은 `duration-200 ease-out`만 사용한다.
- 광택이나 맥동 효과가 있으면 `motion-reduce:animate-none`을 추가한다.
- 지역 label에는 `paint-order: stroke`와 낮은 대비 배경선을 사용해 지형 위에서도 읽히게 한다.
- 장식 레이어는 모두 `pointerEvents="none"`으로 고정한다.

**Step 4: Upgrade the legend without changing meanings**

범례의 기존 세 상태를 유지하고 작은 지형 키를 추가한다.

```tsx
<span className="..." aria-hidden="true">
  <span className="h-2 w-5 rounded-full bg-gradient-to-r from-[#D9EDE8] to-[#79A99C]" />
</span>
<span>중앙 음영은 지형 표현</span>
```

데이터 상태 색과 지형 음영이 서로 다른 의미임을 짧게 설명한다.

**Step 5: Run tests**

Run:

```powershell
npm test -- src/components/TrustMapDashboard.test.tsx
node --test tests/mobile-map-instruction-layout.test.mjs
npm run lint
```

Expected: all PASS.

**Step 6: Commit**

```powershell
git add apps/web/src/components/TrustMapDashboard.tsx apps/web/src/components/TrustMapDashboard.test.tsx apps/web/tests/mobile-map-instruction-layout.test.mjs
git commit -m "[지도] 포커스와 모션 접근성 마감"
```

---

### Task 4: 반응형 시각 균형과 주변 섬 마감

**Files:**
- Modify: `apps/web/src/components/TrustMapDashboard.tsx:484-630`
- Modify: `apps/web/src/components/TrustMapDashboard.test.tsx`

**Skills:** `@frontend-design`, `@web-design-guidelines`

**Step 1: Add failing tests for decorative islands and labels**

```tsx
it('keeps the surrounding islands decorative and out of the region button count', async () => {
  render(<TrustMapDashboard onSubmit={vi.fn()} />);
  expect(await screen.findByTestId('jeju-offshore-islands')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getAllByRole('button', {name: /근거 보기/})).toHaveLength(12);
});
```

**Step 2: Run and verify RED**

Run: `npm test -- src/components/TrustMapDashboard.test.tsx`

**Step 3: Extract `OffshoreIslands`**

추자도·가파도·마라도는 데이터 선택 대상이 아니므로 장식 그룹으로 유지한다. 우도는 12개 지역 중 하나이므로 interactive path를 유지한다.

```tsx
function OffshoreIslands() {
  return (
    <g data-testid="jeju-offshore-islands" aria-hidden="true" pointerEvents="none">
      {/* existing paths and labels, with small depth shadows */}
    </g>
  );
}
```

- 주변 섬 그림자는 본섬보다 약하게 한다.
- 모바일에서 작은 글자가 겹치면 추자도만 남기고 가파도·마라도 라벨은 숨기되 섬 형상은 유지한다.
- 지도 카드의 aspect ratio와 기존 모바일 안내문 위치는 바꾸지 않는다.

**Step 4: Verify responsive source contracts**

Run:

```powershell
npm test -- src/components/TrustMapDashboard.test.tsx
node --test tests/mobile-map-instruction-layout.test.mjs
npm run lint
```

Expected: all PASS.

**Step 5: Commit**

```powershell
git add apps/web/src/components/TrustMapDashboard.tsx apps/web/src/components/TrustMapDashboard.test.tsx
git commit -m "[지도] 주변 섬과 반응형 지형 표현 마감"
```

---

### Task 5: 전체 회귀, 번들 확인, 배포 준비

**Files:**
- Modify: `DEPLOYMENT_STATUS.md`
- Verify: `apps/web/src/components/TrustMapDashboard.tsx`
- Verify: `apps/web/src/components/TrustMapDashboard.test.tsx`

**Skills:** `@verification-before-completion`, `@requesting-code-review`

**Step 1: Run the focused visual tests**

```powershell
cd apps/web
npm test -- src/components/TrustMapDashboard.test.tsx
node --test tests/mobile-map-instruction-layout.test.mjs tests/lazy-loading.test.mjs
```

Expected: all PASS.

**Step 2: Run the full frontend suite**

```powershell
npm test
node --test tests/*.test.mjs
npm run lint
npm run build
```

Expected:

- no test failures
- TypeScript success
- PWA build success
- initial entry chunk remains below 500KB
- `TrustMapDashboard` stays a separate lazy chunk

**Step 3: Inspect source and generated bundle**

```powershell
git diff --check
git status --short
git diff --stat
```

Confirm:

- no generated `dist` files are tracked
- no external image or map SDK dependency was added
- decorative layers do not have click handlers
- 12 region controls still exist

**Step 4: Record measured results**

`DEPLOYMENT_STATUS.md`에 다음만 기록한다.

- 입체 지형형 SVG 지도 적용
- 외부 이미지·SDK 추가 없음
- 지역 선택·공공데이터 API 계약 유지
- 전체 테스트 결과
- production entry와 `TrustMapDashboard` chunk 크기
- 프로덕션 배포 전에는 배포 완료라고 쓰지 않음

**Step 5: Commit**

```powershell
git add DEPLOYMENT_STATUS.md
git commit -m "[문서] 입체 지형 지도 검증 결과 기록"
```

## 배포 후 스모크 체크리스트

코드 리뷰와 배포 승인을 받은 뒤 수행한다.

1. Vercel 첫 화면에서 지도 카드가 200으로 로드되는지 확인한다.
2. `TrustMapDashboard` lazy chunk가 200인지 확인한다.
3. 12개 지역 중 제주시·성산·우도를 클릭해 우측 근거 패널이 바뀌는지 확인한다.
4. 우측 버튼으로 지역을 선택했을 때 체크·주황 선택광이 표시되는지 확인한다.
5. 키보드 Tab, Enter, Space로 동일한 근거 패널 전환이 가능한지 확인한다.
6. 모바일 너비에서 안내문이 지도 터치 영역 아래에 있는지 확인한다.
7. PWA manifest와 service worker가 200인지 확인한다.

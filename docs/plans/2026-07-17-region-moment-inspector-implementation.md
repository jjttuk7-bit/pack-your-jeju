# Region Moment Inspector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 선택한 지역과 순간이 많아도 모든 조합을 지역별로 탐색하고 확인 진행률과 한 조합의 상세 근거를 명확히 볼 수 있는 오른쪽 패널을 만든다.

**Architecture:** `TrustMapDashboard`가 선택 지역·순간과 활성 조합·세션 확인 상태를 소유하고, 새 `RegionMomentInspector`가 지역 탭, 순간 칩, 진행률, 이전·다음과 상세 카드 하나를 렌더링한다. 기존 지역 근거 API와 제주팩 생성 계약은 유지하며, 조합 순서와 확인 상태 계산은 순수 함수로 분리해 단위 테스트한다.

**Tech Stack:** React 19, TypeScript 5.8, Vite, Tailwind CSS 4, Vitest, Testing Library

---

### Task 1: 조합 탐색 결정과 순수 상태 모델 기록

**Files:**
- Modify: `DECISIONS.md`
- Create: `apps/web/src/regionMomentInspector.ts`
- Create: `apps/web/src/regionMomentInspector.test.ts`

**Step 1: Write the failing test**

`apps/web/src/regionMomentInspector.test.ts`에 조합 순서와 진행률 테스트를 작성한다.

```ts
import {describe, expect, it} from 'vitest';
import {
  buildRegionMomentCombinations,
  countReviewedCombinations,
  combinationKey,
} from './regionMomentInspector';

describe('region moment inspector model', () => {
  it('orders every selected moment inside each selected region', () => {
    expect(
      buildRegionMomentCombinations(
        ['hallim', 'gujwa'],
        ['oreum', 'beach_walk', 'quiet_cafe'],
      ),
    ).toEqual([
      {region: 'hallim', moment: 'oreum'},
      {region: 'hallim', moment: 'beach_walk'},
      {region: 'hallim', moment: 'quiet_cafe'},
      {region: 'gujwa', moment: 'oreum'},
      {region: 'gujwa', moment: 'beach_walk'},
      {region: 'gujwa', moment: 'quiet_cafe'},
    ]);
  });

  it('counts only reviewed combinations that are still selected', () => {
    const combinations = buildRegionMomentCombinations(
      ['hallim'],
      ['oreum', 'beach_walk'],
    );
    const reviewed = new Set([
      combinationKey('hallim', 'oreum'),
      combinationKey('gujwa', 'oreum'),
    ]);

    expect(countReviewedCombinations(combinations, reviewed)).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web
npm test -- --run src/regionMomentInspector.test.ts
```

Expected: FAIL because `regionMomentInspector.ts` does not exist.

**Step 3: Write minimal implementation**

`apps/web/src/regionMomentInspector.ts`에 순수 모델을 구현한다.

```ts
import type {MomentId, RegionId} from './types';

export interface RegionMomentCombination {
  region: RegionId;
  moment: MomentId;
}

export function combinationKey(region: RegionId, moment: MomentId) {
  return `${region}:${moment}`;
}

export function buildRegionMomentCombinations(
  regions: RegionId[],
  moments: MomentId[],
): RegionMomentCombination[] {
  return regions.flatMap((region) =>
    moments.map((moment) => ({region, moment})),
  );
}

export function countReviewedCombinations(
  combinations: RegionMomentCombination[],
  reviewed: ReadonlySet<string>,
) {
  return combinations.filter(({region, moment}) =>
    reviewed.has(combinationKey(region, moment)),
  ).length;
}
```

`DECISIONS.md`에 다음 결정을 추가한다.

```md
**D-33. `active` 여러 지역·순간 조합은 지역별 마스터-디테일로 탐색한다.**

- 선택한 순간은 개수와 무관하게 모두 접근할 수 있어야 하며 네 개로 자르지 않는다.
- 선택 지역별 순간 상태와 전체 조합 진행률을 보여주고 상세 근거는 한 조합씩 연다.
- 플랜 후보 선택과 현재 확인 중인 지역을 분리하며, 확인 상태는 화면 세션의 UI 상태로만 유지한다.
- 상세 설계: `docs/plans/2026-07-17-region-moment-inspector-design.md`
```

**Step 4: Run test to verify it passes**

Run:

```bash
cd apps/web
npm test -- --run src/regionMomentInspector.test.ts
```

Expected: 2 tests PASS.

**Step 5: Commit**

```bash
git add DECISIONS.md apps/web/src/regionMomentInspector.ts apps/web/src/regionMomentInspector.test.ts docs/plans/2026-07-17-region-moment-inspector-design.md docs/plans/2026-07-17-region-moment-inspector-implementation.md
git commit -m "[프론트] 지역별 순간 조합 탐색 모델 기록"
```

### Task 2: 다섯 개 이상 순간과 여러 지역의 실패 테스트 추가

**Files:**
- Modify: `apps/web/src/components/TrustMapDashboard.test.tsx`

**Step 1: Write the failing test**

기존 테스트 파일에 다음 시나리오를 추가한다.

```tsx
import {within} from '@testing-library/react';

const initialInfo = {
  regions: ['hallim', 'gujwa'] as const,
  startDate: '2026-07-17',
  durationDays: 2,
  companion: 'solo' as const,
  purpose: 'healing' as const,
};

const fiveMoments = [
  'oreum',
  'beach_walk',
  'sunset',
  'local_food',
  'quiet_cafe',
] as const;

it('exposes every selected moment and every selected region without truncation', async () => {
  const user = userEvent.setup();
  render(
    <TrustMapDashboard
      onSubmit={vi.fn()}
      initialInfo={{...initialInfo, regions: [...initialInfo.regions]}}
      initialMoments={[...fiveMoments]}
    />,
  );

  const inspector = await screen.findByTestId('region-moment-inspector');
  expect(within(inspector).getByText('2개 지역 · 5개 순간 · 총 10개 조합')).toBeVisible();

  const momentButtons = within(inspector).getAllByRole('button', {
    name: /조합 확인/,
  });
  expect(momentButtons).toHaveLength(5);

  await user.click(
    within(inspector).getByRole('button', {name: '구좌 지역 조합 보기'}),
  );
  expect(within(inspector).getByText('구좌에서 오름에 올라 바람 맞기')).toBeVisible();
});
```

확인 진행률 테스트도 추가한다.

```tsx
it('marks opened combinations as reviewed and moves through combinations', async () => {
  const user = userEvent.setup();
  render(
    <TrustMapDashboard
      onSubmit={vi.fn()}
      initialInfo={{...initialInfo, regions: [...initialInfo.regions]}}
      initialMoments={['oreum', 'beach_walk']}
    />,
  );

  const inspector = await screen.findByTestId('region-moment-inspector');
  expect(within(inspector).getByText('확인 1 / 4')).toBeVisible();

  await user.click(within(inspector).getByRole('button', {name: '다음 조합'}));
  expect(within(inspector).getByText('확인 2 / 4')).toBeVisible();
  expect(within(inspector).getByText('한림에서 바다 산책하기')).toBeVisible();
});
```

**Step 2: Run tests to verify they fail**

Run:

```bash
cd apps/web
npm test -- --run src/components/TrustMapDashboard.test.tsx
```

Expected: FAIL because the inspector test ID, summary, region tabs and navigation do not exist.

**Step 3: Keep production code unchanged**

이 작업에서는 실패 계약만 추가한다. 테스트 이름과 접근 가능한 이름이 설계 문서의 문구와 일치하는지 확인한다.

**Step 4: Run the existing unrelated tests**

Run:

```bash
cd apps/web
npm test -- --run src/components/WeatherDecisionReport.test.tsx src/components/TravelRouteCard.test.tsx
```

Expected: existing unrelated tests PASS.

**Step 5: Commit**

```bash
git add apps/web/src/components/TrustMapDashboard.test.tsx
git commit -m "[테스트] 다중 지역 순간 탐색 계약 추가"
```

### Task 3: 활성 조합과 확인 진행 상태 구현

**Files:**
- Modify: `apps/web/src/components/TrustMapDashboard.tsx:250-345`
- Modify: `apps/web/src/components/TrustMapDashboard.tsx:1021-1190`

**Step 1: Add dashboard state**

`TrustMapDashboard`에 활성 순간과 확인한 조합 상태를 추가한다.

```tsx
const [activeMoment, setActiveMoment] = useState<MomentId | null>(
  initialMoments?.[0] ?? null,
);
const [reviewedCombinations, setReviewedCombinations] = useState<Set<string>>(
  () => new Set(),
);
const [showUnreviewedOnly, setShowUnreviewedOnly] = useState(false);
```

선택 지역과 순간에서 전체 조합을 계산한다.

```tsx
const combinations = useMemo(
  () => buildRegionMomentCombinations(selectedRegions, selectedMoments),
  [selectedRegions, selectedMoments],
);
const reviewedCount = countReviewedCombinations(
  combinations,
  reviewedCombinations,
);
```

**Step 2: Implement active combination transitions**

활성 조합을 열 때 확인 상태를 복사해 갱신한다.

```tsx
const inspectCombination = (region: RegionId, moment: MomentId) => {
  setActiveRegion(region);
  setActiveMoment(moment);
  setReviewedCombinations((current) => {
    const next = new Set(current);
    next.add(combinationKey(region, moment));
    return next;
  });
};
```

초기 선택과 선택 변화 뒤에도 유효한 활성 조합을 유지하는 `useEffect`를 추가한다.

```tsx
useEffect(() => {
  const region = selectedRegions.includes(activeRegion as RegionId)
    ? activeRegion
    : selectedRegions[0] ?? activeRegion;
  const moment = activeMoment && selectedMoments.includes(activeMoment)
    ? activeMoment
    : selectedMoments[0] ?? null;

  if (region && moment) inspectCombination(region, moment);
}, [selectedRegions, selectedMoments, activeRegion, activeMoment]);
```

무한 effect 갱신을 피하도록 `inspectCombination`은 `useCallback`으로 고정하고, 이미 확인된 키에서는 같은 `Set`을 반환한다.

**Step 3: Replace the four-card list**

`RegionPanel`의 다음 코드를 삭제한다.

```tsx
.slice(0, 4)
```

여러 상세 카드를 렌더링하던 `momentStories.map` 대신 활성 순간 하나의 `activeStory`만 만든다.

```tsx
const activeStory = activeMoment
  ? buildMomentStory(region, preview, activeMoment)
  : null;
```

지역 탭과 모든 선택 순간 칩을 렌더링한다.

```tsx
<section data-testid="region-moment-inspector" aria-label="지역별 순간 조합 확인">
  <p>
    {selectedRegions.length}개 지역 · {selectedMoments.length}개 순간 ·
    총 {combinations.length}개 조합
  </p>
  <p>확인 {reviewedCount} / {combinations.length}</p>

  <nav aria-label="선택 지역 조합">
    {selectedRegions.map((regionId) => (
      <button
        key={regionId}
        type="button"
        aria-current={regionId === region.value ? 'page' : undefined}
        aria-label={`${regionLabel(regionId)} 지역 조합 보기`}
        onClick={() => onInspectCombination(regionId, activeMoment ?? selectedMoments[0])}
      >
        {regionLabel(regionId)} {selectedMoments.length}
      </button>
    ))}
  </nav>

  <div aria-label={`${region.label} 선택 순간`}>
    {visibleMoments.map((momentId) => (
      <button
        key={momentId}
        type="button"
        aria-pressed={momentId === activeMoment}
        aria-label={`${region.label}에서 ${momentTitle(momentId)} 조합 확인`}
        onClick={() => onInspectCombination(region.value, momentId)}
      >
        {momentTitle(momentId)}
        {combinationStatus(region.value, momentId)}
      </button>
    ))}
  </div>
</section>
```

**Step 4: Run focused tests**

Run:

```bash
cd apps/web
npm test -- --run src/regionMomentInspector.test.ts src/components/TrustMapDashboard.test.tsx
```

Expected: all model tests and dashboard tests PASS.

**Step 5: Commit**

```bash
git add apps/web/src/components/TrustMapDashboard.tsx apps/web/src/regionMomentInspector.ts apps/web/src/regionMomentInspector.test.ts apps/web/src/components/TrustMapDashboard.test.tsx
git commit -m "[프론트] 지역별 순간 마스터 디테일 구현"
```

### Task 4: 이전·다음과 미확인 필터 완성

**Files:**
- Modify: `apps/web/src/components/TrustMapDashboard.tsx`
- Modify: `apps/web/src/components/TrustMapDashboard.test.tsx`

**Step 1: Write failing filter test**

```tsx
it('can show only unreviewed moments for the active region', async () => {
  const user = userEvent.setup();
  render(
    <TrustMapDashboard
      onSubmit={vi.fn()}
      initialInfo={{...initialInfo, regions: ['hallim']}}
      initialMoments={['oreum', 'beach_walk', 'quiet_cafe']}
    />,
  );

  const inspector = await screen.findByTestId('region-moment-inspector');
  await user.click(within(inspector).getByRole('button', {name: '미확인만 보기'}));

  expect(
    within(inspector).queryByRole('button', {
      name: /한림에서 오름에 올라 바람 맞기 조합 확인/,
    }),
  ).not.toBeInTheDocument();
  expect(
    within(inspector).getByRole('button', {
      name: /한림에서 바다 산책하기 조합 확인/,
    }),
  ).toBeVisible();
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web
npm test -- --run src/components/TrustMapDashboard.test.tsx
```

Expected: FAIL because the unreviewed filter button does not exist.

**Step 3: Implement navigation and filter**

현재 조합 인덱스를 계산하고 이전·다음 버튼을 연결한다.

```tsx
const activeIndex = combinations.findIndex(
  ({region, moment}) => region === activeRegion && moment === activeMoment,
);

const inspectAt = (index: number) => {
  const combination = combinations[index];
  if (combination) {
    inspectCombination(combination.region, combination.moment);
  }
};
```

`showUnreviewedOnly`일 때 활성 지역의 확인한 순간을 칩 목록에서 제외하되, 현재 활성 순간은 상세 문맥 유지를 위해 남긴다.

```tsx
const visibleMoments = selectedMoments.filter((moment) =>
  !showUnreviewedOnly ||
  moment === activeMoment ||
  !reviewedCombinations.has(combinationKey(region.value, moment)),
);
```

**Step 4: Run focused tests and typecheck**

Run:

```bash
cd apps/web
npm test -- --run src/regionMomentInspector.test.ts src/components/TrustMapDashboard.test.tsx
npm run lint
```

Expected: all tests PASS and TypeScript exits 0.

**Step 5: Commit**

```bash
git add apps/web/src/components/TrustMapDashboard.tsx apps/web/src/components/TrustMapDashboard.test.tsx
git commit -m "[프론트] 순간 조합 진행 탐색 추가"
```

### Task 5: 고정 패널 레이아웃과 반응형 접근성 검증

**Files:**
- Modify: `apps/web/src/components/TrustMapDashboard.tsx`
- Modify: `apps/web/src/components/TrustMapDashboard.test.tsx`

**Step 1: Write failing accessibility test**

```tsx
it('keeps summary, scrollable inspector, and primary actions accessible', async () => {
  render(
    <TrustMapDashboard
      onSubmit={vi.fn()}
      initialInfo={{...initialInfo, regions: ['hallim']}}
      initialMoments={[...fiveMoments]}
    />,
  );

  const inspector = await screen.findByTestId('region-moment-inspector');
  expect(within(inspector).getByRole('progressbar')).toHaveAttribute('max', '5');
  expect(screen.getByRole('button', {name: /제주팩 받기/})).toBeEnabled();
  expect(screen.getByTestId('region-panel-scroll-area')).toHaveClass('overflow-y-auto');
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd apps/web
npm test -- --run src/components/TrustMapDashboard.test.tsx
```

Expected: FAIL because the progress element and scroll-area test ID do not exist.

**Step 3: Implement desktop and mobile layout**

- `aside` 안에 `lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]` 래퍼를 둔다.
- 요약은 상단에 유지한다.
- 탐색과 상세 영역에 `data-testid="region-panel-scroll-area"`와 `min-h-0 overflow-y-auto`를 적용한다.
- 하단 행동 버튼은 스크롤 영역 밖에 둔다.
- 진행률을 다음과 같이 추가한다.

```tsx
<progress
  aria-label="조합 확인 진행률"
  value={reviewedCount}
  max={combinations.length || 1}
  className="h-1.5 w-full"
/>
```

- 12개 순간 칩은 `flex-wrap` 또는 반응형 2열 그리드로 모두 표시한다.
- 44px에 가까운 누름 영역과 가시적인 `focus-visible` 스타일을 유지한다.

**Step 4: Run complete web verification**

Run:

```bash
cd apps/web
npm test
npm run lint
npm run build
```

Expected: all Vitest files PASS, TypeScript exits 0, Vite production build completes.

**Step 5: Manual verification**

Run:

```bash
cd apps/web
npm run dev -- --host 127.0.0.1
```

Verify at desktop and mobile widths:

- 1 region × 10 moments exposes all 10 moment chips.
- 3 regions × 10 moments reports 30 combinations.
- Region tabs change only the active inspection region.
- Previous/next updates detail and reviewed progress.
- `미확인만 보기` retains access to every unreviewed combination.
- The primary action remains reachable without losing the active detail.

**Step 6: Commit**

```bash
git add apps/web/src/components/TrustMapDashboard.tsx apps/web/src/components/TrustMapDashboard.test.tsx
git commit -m "[프론트] 다중 조합 패널 반응형 마감"
```

### Task 6: 최종 회귀 검사와 통합 준비

**Files:**
- Verify: `apps/web/src/components/TrustMapDashboard.tsx`
- Verify: `apps/web/src/components/TrustMapDashboard.test.tsx`
- Verify: `DECISIONS.md`
- Verify: `docs/plans/2026-07-17-region-moment-inspector-design.md`

**Step 1: Review the diff**

Run:

```bash
git diff main...HEAD --check
git diff main...HEAD --stat
```

Expected: no whitespace errors; changes are limited to the inspector, tests, decisions and design documents.

**Step 2: Run complete verification again**

Run:

```bash
cd apps/web
npm test
npm run lint
npm run build
```

Expected: all commands exit 0.

**Step 3: Check repository status**

Run:

```bash
git status --short
```

Expected: no uncommitted product changes. Generated build output remains ignored.

**Step 4: Prepare integration**

Use `superpowers:finishing-a-development-branch` to present merge, review, or cleanup options. Do not deploy until the user explicitly asks to push or deploy this feature.

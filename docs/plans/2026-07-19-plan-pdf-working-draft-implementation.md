# 여행 플랜 PDF 작업 초안 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PDF 편집기의 장소 제외·되돌리기·화면 내 임시저장·새 장소 선택 추가를 원본 여행플랜과 분리해 제공한다.

**Architecture:** `planPdfWorkspace.ts`의 순수 함수가 PDF 작업 초안, 이미 확인한 원본 ID, 제외 기록을 관리한다. `PackingDashboard`가 현재 여행팩 화면의 작업 초안을 메모리로 소유하고 원본 플랜과 동기화하며, `PlanPdfEditor`는 편집 UI와 사용자 명령을 부모 작업 초안에 즉시 전달한다.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, 기존 `planPdf.ts` PDF 생성 흐름

---

### Task 1: PDF 작업 초안 순수 모델

**Files:**
- Create: `apps/web/src/planPdfWorkspace.ts`
- Create: `apps/web/src/planPdfWorkspace.test.ts`
- Reuse: `apps/web/src/planPdf.ts`
- Reuse: `apps/web/src/types.ts`

**Step 1: Write the failing model tests**

다음 계약을 검사한다.

```ts
const workspace = createPlanPdfWorkspace({
  sourceItems,
  durationDays: 2,
  initialDraft,
  composition,
  now: '2026-07-19T00:00:00Z',
});

const excluded = excludePlanPdfWorkspaceItem(
  workspace,
  'place-a',
  '2026-07-19T00:01:00Z',
);

expect(excluded.draft.items.map((item) => item.id)).not.toContain('place-a');
expect(excluded.excludedItems.at(-1)?.item.id).toBe('place-a');
expect(sourceItems.map((item) => item.id)).toContain('place-a');

const restored = undoExcludedPlanPdfWorkspaceItem(
  excluded,
  2,
  '2026-07-19T00:02:00Z',
);
expect(restored.draft.items.map((item) => item.id)).toContain('place-a');
expect(restored.excludedItems).toHaveLength(0);
```

추가로 다음을 검사한다.

- `findPendingPlanPdfSourceItems`는 새 원본 장소만 반환한다.
- PDF에서 제외한 장소는 새 장소로 다시 반환하지 않는다.
- `addPendingPlanPdfItems`는 대상 Day의 마지막 순서에 중복 없이 추가한다.
- `syncRemovedPlanPdfSourceItems`는 원본에서 삭제된 장소를 초안과 제외 기록에서 제거한다.
- 모든 함수는 입력 객체와 원본 장소 배열을 변경하지 않는다.

**Step 2: Run tests to verify RED**

Run:

```bash
cd apps/web
npm test -- planPdfWorkspace.test.ts
```

Expected: `planPdfWorkspace` 모듈이 없어 FAIL.

**Step 3: Implement the workspace type and pure functions**

`apps/web/src/planPdfWorkspace.ts`에 다음 형태를 구현한다.

```ts
import {
  buildInitialPlanPdfDraft,
  type PlanPdfDraft,
  type PlanPdfDraftItem,
} from './planPdf';
import type {HarubanPlanDraft, TravelPlanItem} from './types';

export interface ExcludedPlanPdfItem {
  item: PlanPdfDraftItem;
  excludedAt: string;
}

export interface PlanPdfWorkspace {
  draft: PlanPdfDraft;
  composition: HarubanPlanDraft | null;
  knownSourceItemIds: string[];
  excludedItems: ExcludedPlanPdfItem[];
  updatedAt: string;
}

export function createPlanPdfWorkspace(input: {
  sourceItems: TravelPlanItem[];
  durationDays: number;
  initialDraft?: PlanPdfDraft | null;
  composition?: HarubanPlanDraft | null;
  now?: string;
}): PlanPdfWorkspace;

export function updatePlanPdfWorkspaceDraft(
  workspace: PlanPdfWorkspace,
  draft: PlanPdfDraft,
  now?: string,
): PlanPdfWorkspace;

export function excludePlanPdfWorkspaceItem(
  workspace: PlanPdfWorkspace,
  itemId: string,
  now?: string,
): PlanPdfWorkspace;

export function undoExcludedPlanPdfWorkspaceItem(
  workspace: PlanPdfWorkspace,
  durationDays: number,
  now?: string,
): PlanPdfWorkspace;

export function findPendingPlanPdfSourceItems(
  workspace: PlanPdfWorkspace,
  sourceItems: TravelPlanItem[],
): TravelPlanItem[];

export function addPendingPlanPdfItems(
  workspace: PlanPdfWorkspace,
  sourceItems: TravelPlanItem[],
  itemIds: string[],
  durationDays: number,
  now?: string,
): PlanPdfWorkspace;

export function syncRemovedPlanPdfSourceItems(
  workspace: PlanPdfWorkspace,
  sourceItems: TravelPlanItem[],
  now?: string,
): PlanPdfWorkspace;
```

구현 규칙:

- 작업 초안은 항상 `structuredClone` 또는 새 배열·객체로 반환한다.
- 제외 시 Day별 `order`를 다시 1부터 매긴다.
- 복원 시 기록된 `day`와 `order` 위치로 삽입한 뒤 다시 번호를 매긴다.
- 새 장소 변환은 `buildInitialPlanPdfDraft`의 필드 규칙을 재사용한다.
- `knownSourceItemIds`는 제외로 제거하지 않는다.
- 원본에서 사라진 ID는 `knownSourceItemIds`와 `excludedItems`에서도 제거한다.

**Step 4: Run tests to verify GREEN**

Run:

```bash
npm test -- planPdfWorkspace.test.ts
```

Expected: all workspace tests PASS.

**Step 5: Commit**

```bash
git add apps/web/src/planPdfWorkspace.ts apps/web/src/planPdfWorkspace.test.ts
git commit -m "[기능] PDF 작업 초안 상태 모델"
```

### Task 2: PDF 편집기 장소 제외와 임시저장 UI

**Files:**
- Modify: `apps/web/src/components/PlanPdfEditor.tsx`
- Modify: `apps/web/src/components/PlanPdfEditor.test.tsx`

**Step 1: Write the failing editor tests**

`PlanPdfEditor` 테스트에 다음 시나리오를 추가한다.

```tsx
it('excludes a place only from the PDF draft and can undo it', async () => {
  const onExcludeItem = vi.fn();
  const onUndoExclude = vi.fn();
  renderEditor({
    onExcludeItem,
    onUndoExclude,
    canUndoExclude: true,
  });

  fireEvent.click(screen.getByRole('button', {
    name: '제주 숲 초안에서 제외',
  }));
  expect(onExcludeItem).toHaveBeenCalledWith('forest');
  expect(selectedPlanItems).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', {name: '제외 되돌리기'}));
  expect(onUndoExclude).toHaveBeenCalled();
});
```

다음도 검사한다.

- 하단 버튼 문구가 `나가서 장소 더 보기`다.
- `변경사항 임시저장됨` 상태가 `aria-live="polite"`에 표시된다.
- `pendingSourceItems`가 있으면 `새로 담은 장소 N곳이 있어요`를 표시한다.
- `초안에 추가`가 선택된 ID를 `onAddPendingItems`에 전달한다.
- 장소가 0곳이면 빈 초안 안내가 보이고 `PDF 만들기`가 비활성화된다.
- 닫기 버튼과 Escape는 기존 `onClose` 계약을 유지한다.

**Step 2: Run tests to verify RED**

Run:

```bash
npm test -- components/PlanPdfEditor.test.tsx
```

Expected: 새 props, 제외 버튼, 임시저장 문구가 없어 FAIL.

**Step 3: Add explicit workspace command props**

`PlanPdfEditor` props를 확장한다.

```ts
interface Props {
  // existing props
  pendingSourceItems?: TravelPlanItem[];
  canUndoExclude?: boolean;
  savedAt?: string | null;
  onExcludeItem?: (itemId: string) => void;
  onUndoExclude?: () => void;
  onAddPendingItems?: (itemIds: string[]) => void;
}
```

각 `PlanItemEditor`에 다음 버튼을 추가한다.

```tsx
<button
  type="button"
  aria-label={`${item.name} 초안에서 제외`}
  onClick={() => onExcludeItem?.(item.id)}
>
  <Trash2 aria-hidden="true" />
  초안에서 제외
</button>
```

하단 상태와 버튼을 변경한다.

```tsx
<p role="status" aria-live="polite">
  변경사항 임시저장됨
</p>
<button type="button" onClick={closeEditor}>
  나가서 장소 더 보기
</button>
```

최근 제외 기록이 있으면 `제외 되돌리기`를 표시한다. `pendingSourceItems`는 체크 가능한 목록으로 보여주고 선택 항목만 `onAddPendingItems`에 전달한다.

**Step 4: Keep local editor state in sync after parent commands**

부모에서 제외·복원·새 장소 추가 후 `initialDraft`가 명시적으로 바뀔 때만 로컬 편집 상태를 다시 맞추도록 `workspaceRevision` prop을 추가한다.

```ts
workspaceRevision?: string;
```

편집기 초기화 effect는 `workspaceRevision`을 의존성에 포함하되, 일반 `onDraftChange`로 생긴 부모 렌더에는 revision을 바꾸지 않아 입력 중 커서와 메모가 초기화되지 않게 한다.

**Step 5: Run tests to verify GREEN**

Run:

```bash
npm test -- components/PlanPdfEditor.test.tsx
```

Expected: all editor tests PASS.

**Step 6: Commit**

```bash
git add apps/web/src/components/PlanPdfEditor.tsx apps/web/src/components/PlanPdfEditor.test.tsx
git commit -m "[기능] PDF 초안 장소 제외와 복원"
```

### Task 3: 대시보드 메모리 임시저장과 원본 동기화

**Files:**
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Modify: `apps/web/src/components/PackingDashboard.test.tsx`
- Reuse: `apps/web/src/planPdfWorkspace.ts`

**Step 1: Replace the obsolete invalidation test with failing persistence tests**

현재 테스트:

```ts
it('discards a composed draft when the saved source plan changes', ...)
```

를 새 계약으로 교체한다.

```ts
it('keeps PDF edits when the editor closes and opens again', async () => {
  renderDashboard([scheduledPlanItem, secondScheduledPlanItem]);
  fireEvent.click(await screen.findByRole('button', {name: /여행 플랜 PDF/}));
  fireEvent.change(screen.getByLabelText('산방산 둘레길 여행 메모'), {
    target: {value: '노을 전에 도착'},
  });
  fireEvent.click(screen.getByRole('button', {name: '나가서 장소 더 보기'}));
  fireEvent.click(screen.getByRole('button', {name: /여행 플랜 PDF/}));
  expect(screen.getByDisplayValue('노을 전에 도착')).toBeInTheDocument();
});
```

추가 테스트:

- 편집기 제외 후 원본 `selectedPlanItems`와 제거 콜백은 변경되지 않는다.
- 원본에 새 장소를 추가한 rerender 후 기존 초안이 유지되고 새 장소 안내가 나타난다.
- `초안에 추가` 승인 후에만 새 장소가 PDF 항목에 들어간다.
- 원본에서 장소를 삭제한 rerender 후 해당 장소는 작업 초안에서도 제거된다.
- 하루방 조합 초안의 날씨·동선 근거와 편집 내용이 닫았다 열어도 유지된다.
- 공유 텍스트는 현재 PDF 작업 초안 항목을 사용한다.

**Step 2: Run dashboard tests to verify RED**

Run:

```bash
npm test -- components/PackingDashboard.test.tsx --testTimeout=30000 --maxWorkers=1
```

Expected: 일반 PDF 편집은 닫을 때 사라지고, 원본 추가 시 하루방 초안이 폐기되어 FAIL.

**Step 3: Replace `harubanDraft` ownership with `pdfWorkspace`**

상태를 다음처럼 변경한다.

```ts
const [pdfWorkspace, setPdfWorkspace] = useState<PlanPdfWorkspace | null>(null);
const [workspaceRevision, setWorkspaceRevision] = useState(0);
```

PDF를 열 때 작업 초안이 없으면 생성한다.

```ts
const openPlanPdfEditor = () => {
  setPdfWorkspace((current) => current ?? createPlanPdfWorkspace({
    sourceItems: selectedPlanItems,
    durationDays: info.durationDays,
  }));
  setPlanPdfEditorOpen(true);
};
```

하루방 조합 완료 시:

```ts
setPdfWorkspace(createPlanPdfWorkspace({
  sourceItems,
  durationDays: info.durationDays,
  initialDraft: nextDraft,
  composition: nextDraft,
}));
```

`PlanPdfEditor` 명령을 순수 함수에 연결한다.

```tsx
<PlanPdfEditor
  initialDraft={pdfWorkspace?.draft}
  composition={pdfWorkspace?.composition}
  pendingSourceItems={pendingSourceItems}
  canUndoExclude={Boolean(pdfWorkspace?.excludedItems.length)}
  savedAt={pdfWorkspace?.updatedAt ?? null}
  workspaceRevision={String(workspaceRevision)}
  onDraftChange={(draft) => {
    setPdfWorkspace((current) => (
      current ? updatePlanPdfWorkspaceDraft(current, draft) : current
    ));
  }}
  onExcludeItem={(itemId) => {
    setPdfWorkspace((current) => (
      current ? excludePlanPdfWorkspaceItem(current, itemId) : current
    ));
    setWorkspaceRevision((value) => value + 1);
  }}
  onUndoExclude={() => {
    setPdfWorkspace((current) => (
      current ? undoExcludedPlanPdfWorkspaceItem(
        current,
        info.durationDays,
      ) : current
    ));
    setWorkspaceRevision((value) => value + 1);
  }}
  onAddPendingItems={(ids) => {
    setPdfWorkspace((current) => (
      current ? addPendingPlanPdfItems(
        current,
        selectedPlanItems,
        ids,
        info.durationDays,
      ) : current
    ));
    setWorkspaceRevision((value) => value + 1);
  }}
/>
```

**Step 4: Synchronize only source removals automatically**

`selectedPlanItems`가 바뀌면:

```ts
useEffect(() => {
  setPdfWorkspace((current) => (
    current
      ? syncRemovedPlanPdfSourceItems(current, selectedPlanItems)
      : current
  ));
}, [selectedPlanItems]);
```

새 ID는 `findPendingPlanPdfSourceItems`로 계산하고 자동 추가하지 않는다. 기존의 `sourcePlanFingerprint` 불일치 시 하루방 초안을 즉시 폐기하는 effect는 제거한다.

**Step 5: Use the workspace consistently for export**

```ts
const activeExportItems = pdfWorkspace?.draft.items ?? selectedPlanItems;
```

- 공유 문구는 `activeExportItems`를 사용한다.
- PDF 편집기는 `pdfWorkspace.draft`를 사용한다.
- `내 플랜으로 돌아가기`는 PDF 작업 초안을 폐기하고 원본 플랜으로 돌아가는 명시적 동작으로 유지한다.

**Step 6: Run dashboard tests to verify GREEN**

Run:

```bash
npm test -- components/PackingDashboard.test.tsx --testTimeout=30000 --maxWorkers=1
```

Expected: all dashboard tests PASS.

**Step 7: Commit**

```bash
git add apps/web/src/components/PackingDashboard.tsx apps/web/src/components/PackingDashboard.test.tsx
git commit -m "[기능] PDF 작업 초안 화면 내 임시저장"
```

### Task 4: 하루방 재조합의 초안 교체 확인

**Files:**
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Modify: `apps/web/src/components/PackingDashboard.test.tsx`

**Step 1: Write the failing confirmation test**

다음을 검사한다.

```ts
it('asks before replacing an edited PDF workspace with a new Haruban draft', async () => {
  // 일반 PDF 초안 메모를 수정한다.
  // 하루방 다시 조합을 누른다.
  expect(screen.getByRole('dialog', {name: 'PDF 초안 다시 조합'}))
    .toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: '기존 초안 유지'}));
  expect(screen.getByDisplayValue('기존 메모')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: '새 초안으로 교체'}));
  expect(await screen.findByText('하루방이 여행 플랜 초안을 만들었어요.'))
    .toBeInTheDocument();
});
```

**Step 2: Run test to verify RED**

Run:

```bash
npm test -- components/PackingDashboard.test.tsx -t "asks before replacing" --testTimeout=30000
```

Expected: 확인 대화상자가 없어 FAIL.

**Step 3: Implement a small accessible confirmation dialog**

대시보드에 `pendingRecompose` 상태를 두고, 편집된 작업 초안이 있으면 즉시 조합하지 않고 확인창을 연다.

대화상자 계약:

- `role="dialog"`
- 제목 `PDF 초안 다시 조합`
- 본문 `현재 편집 내용과 제외한 장소가 새 초안으로 교체됩니다.`
- 버튼 `기존 초안 유지`, `새 초안으로 교체`
- Escape는 기존 초안을 유지하며 닫는다.

초안이 없으면 확인 없이 기존 조합 흐름을 실행한다.

**Step 4: Run tests to verify GREEN**

Run:

```bash
npm test -- components/PackingDashboard.test.tsx --testTimeout=30000 --maxWorkers=1
```

Expected: all dashboard tests PASS.

**Step 5: Commit**

```bash
git add apps/web/src/components/PackingDashboard.tsx apps/web/src/components/PackingDashboard.test.tsx
git commit -m "[기능] 하루방 재조합 초안 교체 확인"
```

### Task 5: 회귀·접근성·프로덕션 검증

**Files:**
- Verify: `apps/web/src/planPdfWorkspace.ts`
- Verify: `apps/web/src/components/PlanPdfEditor.tsx`
- Verify: `apps/web/src/components/PackingDashboard.tsx`

**Step 1: Run focused tests**

```bash
cd apps/web
npm test -- planPdfWorkspace.test.ts components/PlanPdfEditor.test.tsx components/PackingDashboard.test.tsx --testTimeout=30000 --maxWorkers=1
```

Expected: all focused tests PASS.

**Step 2: Run TypeScript validation**

```bash
npm run lint
```

Expected: `tsc --noEmit` exits 0.

**Step 3: Run the full web test suite**

```bash
npm test -- --testTimeout=30000 --maxWorkers=1
```

Expected: all test files and tests PASS.

**Step 4: Run the production build**

```bash
npm run build
```

Expected: Vite and PWA build exit 0.

**Step 5: Verify the real browser flow**

Use @webapp-testing and verify:

1. 여행팩에서 일반 PDF 편집기를 연다.
2. 장소 하나를 제외하고 되돌린다.
3. 메모를 편집하고 `나가서 장소 더 보기`로 닫는다.
4. 후보를 하나 더 담는다.
5. PDF 편집기를 다시 열어 기존 메모와 새 장소 안내를 확인한다.
6. 새 장소를 승인해 초안에 추가한다.
7. PDF 생성 버튼이 활성화되고 원본 여행플랜 항목 수는 변하지 않았는지 확인한다.

Expected: page errors 0, all assertions PASS, desktop and mobile viewport에서 주요 버튼이 보이고 키보드로 접근 가능.

**Step 6: Final diff check and commit if verification fixes were needed**

```bash
git diff --check
git status --short
```

검증 수정이 있었다면:

```bash
git add apps/web/src
git commit -m "[테스트] PDF 작업 초안 회귀 검증"
```

# PDF 플랜 사용자 일정 추가 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PDF 플랜의 각 Day에서 사용자가 개인 일정을 직접 추가하고, 같은 일정을 내 여행플랜에 즉시 반영하며, 선택한 시간을 고정 일정으로 PDF에도 표시한다.

**Architecture:** `PlanPdfEditor`는 Day별 인라인 입력과 검증을 담당하고 `PackingDashboard`가 동일 ID의 `TravelPlanItem`과 `PlanPdfDraftItem`을 함께 생성·되돌린다. 순수 생성 함수와 `PlanPdfWorkspace` 상태 전이 함수로 중복·오래된 콜백을 차단하고, PDF 요청 계약에 시간과 고정 여부를 추가해 FastAPI와 ReportLab 렌더러까지 전달한다.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, FastAPI, Pydantic, ReportLab, pytest

---

## 구현 원칙

- 구현 전 `@test-driven-development`를 적용해 각 행동의 실패 테스트를 먼저 작성한다.
- 폼과 모바일 상호작용에는 `@frontend-design`과 `@web-design-guidelines`를 적용한다.
- 브라우저 흐름 검증에는 `@webapp-testing`을 사용한다.
- 완료 선언 전 `@verification-before-completion`을 적용한다.
- 기존 PDF 작업 초안의 원본 분리 규칙을 유지한다. 새 일정의 초기 입력만 내 여행플랜에 반영하고, 이후 PDF Day·순서·메모 수정은 PDF 초안에만 적용한다.
- 사용자 소유의 메인 작업공간 변경과 미추적 문서는 수정하거나 스테이징하지 않는다.

### Task 1: 사용자 일정 입력을 도메인 객체로 정규화

**Files:**
- Create: `apps/web/src/planPdf.test.ts`
- Modify: `apps/web/src/planPdf.ts`

**Step 1: 시간 유무와 입력 정규화 실패 테스트 작성**

`apps/web/src/planPdf.test.ts`에 다음 행동을 고정한다.

```ts
import {describe, expect, it} from 'vitest';
import {buildPlanPdfCustomScheduleItem} from './planPdf';

describe('buildPlanPdfCustomScheduleItem', () => {
  it('trims a timed custom schedule and fixes it to the selected day', () => {
    expect(buildPlanPdfCustomScheduleItem({
      name: '  렌터카 반납  ',
      day: 2,
      startTime: '18:30',
      address: '  제주공항  ',
      note: '  주유 후 반납  ',
    }, 'pdf-user-1', 3)).toMatchObject({
      id: 'pdf-user-1',
      name: '렌터카 반납',
      moment: 'user_added',
      source: 'user_added',
      day: 2,
      startTime: '18:30',
      fixed: true,
      address: '제주공항',
      note: '주유 후 반납',
    });
  });

  it('keeps an untimed schedule movable and clamps its day', () => {
    expect(buildPlanPdfCustomScheduleItem({
      name: '기념품 사기',
      day: 9,
      startTime: '',
      address: '',
      note: '',
    }, 'pdf-user-2', 2)).toMatchObject({
      day: 2,
      startTime: null,
      fixed: false,
      address: null,
      note: null,
    });
  });

  it.each([
    {name: '   ', startTime: ''},
    {name: '숙소 체크인', startTime: '25:00'},
  ])('rejects invalid custom schedule input %#', (input) => {
    expect(buildPlanPdfCustomScheduleItem({
      day: 1,
      address: '',
      note: '',
      ...input,
    }, 'pdf-user-invalid', 2)).toBeNull();
  });
});
```

**Step 2: 실패 확인**

Run:

```powershell
cd apps/web
npm test -- --run src/planPdf.test.ts
```

Expected: `buildPlanPdfCustomScheduleItem` export가 없어 FAIL.

**Step 3: 최소 타입과 생성 함수 구현**

`apps/web/src/planPdf.ts`에 입력 계약과 순수 생성 함수를 추가한다.

```ts
export interface PlanPdfCustomScheduleInput {
  name: string;
  day: number;
  startTime: string;
  address: string;
  note: string;
}

const PLAN_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function buildPlanPdfCustomScheduleItem(
  input: PlanPdfCustomScheduleInput,
  id: string,
  durationDays: number,
): TravelPlanItem | null {
  const name = input.name.trim();
  const startTime = input.startTime.trim();
  if (!name || (startTime && !PLAN_TIME_PATTERN.test(startTime))) return null;

  return {
    id,
    name,
    moment: 'user_added',
    source: 'user_added',
    day: Math.min(normalizedDays(durationDays), Math.max(1, Math.floor(input.day))),
    startTime: startTime || null,
    fixed: Boolean(startTime),
    address: input.address.trim() || null,
    note: input.note.trim() || null,
  };
}
```

`TravelPlanItem` 타입 import를 값 생성에 사용할 수 있도록 기존 type import에 포함한다.

**Step 4: 단위 테스트 통과 확인**

Run:

```powershell
cd apps/web
npm test -- --run src/planPdf.test.ts
```

Expected: 3개 테스트 PASS.

**Step 5: 커밋**

```powershell
git add apps/web/src/planPdf.ts apps/web/src/planPdf.test.ts
git commit -m "[기능] PDF 사용자 일정 입력 정규화"
```

### Task 2: PDF 작업 초안에 사용자 일정 추가·되돌리기

**Files:**
- Modify: `apps/web/src/planPdfWorkspace.ts`
- Modify: `apps/web/src/planPdfWorkspace.test.ts`

**Step 1: 동일 ID 추가와 되돌리기 실패 테스트 작성**

기존 작업공간 생성 테스트에 `recentlyAddedItemId: null`을 추가하고 다음 테스트를 작성한다.

```ts
it('사용자 일정을 같은 ID로 대상 Day 마지막에 한 번만 추가한다', () => {
  const workspace = createPlanPdfWorkspace({sourceItems, durationDays: 2});
  const custom = {
    ...sourceItem('pdf-user-1'),
    name: '렌터카 반납',
    source: 'user_added' as const,
    moment: 'user_added',
    day: 2,
    startTime: '18:30',
    fixed: true,
    note: '주유 후 반납',
  };

  const added = addCustomPlanPdfWorkspaceItem(
    workspace, custom, 2, '2026-07-19T03:00:00.000Z',
  );
  const duplicate = addCustomPlanPdfWorkspaceItem(added, custom, 2);

  expect(added.draft.items.at(-1)).toMatchObject({
    id: 'pdf-user-1',
    day: 2,
    pdfMemo: '주유 후 반납',
  });
  expect(added.knownSourceItemIds).toContain('pdf-user-1');
  expect(added.recentlyAddedItemId).toBe('pdf-user-1');
  expect(duplicate).toBe(added);
});

it('최근 사용자 일정을 PDF 초안에서 되돌리고 순서를 다시 매긴다', () => {
  const added = addCustomPlanPdfWorkspaceItem(
    createPlanPdfWorkspace({sourceItems, durationDays: 2}),
    customSourceItem,
    2,
  );
  const undone = undoRecentlyAddedPlanPdfWorkspaceItem(added, 2);

  expect(undone.draft.items.some((item) => item.id === customSourceItem.id)).toBe(false);
  expect(undone.knownSourceItemIds).not.toContain(customSourceItem.id);
  expect(undone.recentlyAddedItemId).toBeNull();
});
```

원본에서 먼저 삭제된 ID를 되돌릴 때 같은 상태를 그대로 반환하거나 남은 참조만 정리하는 테스트도 추가한다.

**Step 2: 실패 확인**

Run:

```powershell
cd apps/web
npm test -- --run src/planPdfWorkspace.test.ts
```

Expected: 새 필드와 두 상태 전이 함수가 없어 FAIL.

**Step 3: 작업공간 상태와 순수 전이 함수 구현**

`PlanPdfWorkspace`에 최근 추가 ID를 기록한다.

```ts
export interface PlanPdfWorkspace {
  draft: PlanPdfDraft;
  composition: HarubanPlanDraft | null;
  knownSourceItemIds: string[];
  excludedItems: ExcludedPlanPdfItem[];
  recentlyAddedItemId: string | null;
  updatedAt: string;
}
```

다음 함수를 추가한다.

```ts
export function addCustomPlanPdfWorkspaceItem(
  workspace: PlanPdfWorkspace,
  item: TravelPlanItem,
  durationDays: number,
  now?: string,
): PlanPdfWorkspace

export function undoRecentlyAddedPlanPdfWorkspaceItem(
  workspace: PlanPdfWorkspace,
  durationDays: number,
  now?: string,
): PlanPdfWorkspace
```

추가 함수는 다음 규칙을 지킨다.

- 초안 또는 `knownSourceItemIds`에 같은 ID가 있으면 원본 객체를 반환한다.
- `buildInitialPlanPdfDraft([item], durationDays)`로 `pdfMemo` 초기값을 만든다.
- 대상 Day의 기존 항목 뒤에 붙인 후 `renumberByDay`로 순서를 다시 매긴다.
- `knownSourceItemIds`와 `recentlyAddedItemId`를 함께 갱신한다.

되돌리기 함수는 최근 ID를 초안·제외 기록·알려진 ID에서 제거하고 `recentlyAddedItemId`를 비운다.

`syncRemovedPlanPdfSourceItems`가 최근 추가 ID를 제거할 때도 `recentlyAddedItemId`를 비우도록 보완한다.

**Step 4: 작업공간 테스트 통과 확인**

Run:

```powershell
cd apps/web
npm test -- --run src/planPdfWorkspace.test.ts
```

Expected: 기존 12개와 새 테스트 모두 PASS.

**Step 5: 커밋**

```powershell
git add apps/web/src/planPdfWorkspace.ts apps/web/src/planPdfWorkspace.test.ts
git commit -m "[기능] PDF 작업 초안 사용자 일정 상태"
```

### Task 3: Day별 인라인 일정 입력 UI

**Files:**
- Modify: `apps/web/src/components/PlanPdfEditor.tsx`
- Modify: `apps/web/src/components/PlanPdfEditor.test.tsx`

**Step 1: 사용자 입력·검증·Escape 실패 테스트 작성**

`renderEditor` 기본 props에 spy를 추가하고 다음 흐름을 테스트한다.

```ts
it('adds a custom schedule from the selected Day form', async () => {
  const onAddCustomSchedule = vi.fn();
  renderEditor({onAddCustomSchedule});

  fireEvent.click(screen.getByRole('button', {name: 'Day 2 일정 직접 추가'}));
  fireEvent.change(screen.getByLabelText('일정명'), {target: {value: '렌터카 반납'}});
  fireEvent.change(screen.getByLabelText('시간'), {target: {value: '18:30'}});
  fireEvent.change(screen.getByLabelText('장소 또는 주소'), {target: {value: '제주공항'}});
  fireEvent.change(screen.getByLabelText('일정 메모'), {target: {value: '주유 후 반납'}});
  fireEvent.click(screen.getByRole('button', {name: '일정 추가'}));

  expect(onAddCustomSchedule).toHaveBeenCalledWith({
    name: '렌터카 반납',
    day: 2,
    startTime: '18:30',
    address: '제주공항',
    note: '주유 후 반납',
  });
});
```

추가 테스트:

- 공백 일정명에서는 `일정 추가` 비활성화
- 열린 폼에서 Escape를 누르면 폼만 닫고 `onClose`는 호출하지 않음
- 폼이 없을 때 Escape는 기존대로 PDF 편집기를 닫음
- `canUndoCustomSchedule`이면 `추가한 일정 되돌리기`가 보이고 콜백 호출
- `startTime`과 `fixed`가 있는 카드에 `18:30 · 고정 일정` 표시

**Step 2: 실패 확인**

Run:

```powershell
cd apps/web
npm test -- --run src/components/PlanPdfEditor.test.tsx
```

Expected: 새 props와 인라인 폼이 없어 FAIL.

**Step 3: 편집기 props와 폼 상태 구현**

다음 props를 추가한다.

```ts
onAddCustomSchedule?: (input: PlanPdfCustomScheduleInput) => void;
canUndoCustomSchedule?: boolean;
onUndoCustomSchedule?: () => void;
```

편집기 로컬 상태는 한 번에 하나의 Day 폼만 열도록 유지한다.

```ts
const [customScheduleDay, setCustomScheduleDay] = useState<number | null>(null);
const [customScheduleInput, setCustomScheduleInput] = useState(emptyCustomScheduleInput(1));
```

각 Day 카드의 장소 목록 아래에 다음 구조를 배치한다.

```tsx
<button
  type="button"
  aria-label={`Day ${day} 일정 직접 추가`}
  onClick={() => openCustomScheduleForm(day)}
>
  일정 직접 추가
</button>
```

폼은 제목, Day, `type="time"`, 주소, 메모와 `취소`·`일정 추가` 버튼을 제공한다. 일정명 최대 80자, 주소 최대 200자, 메모 최대 800자를 적용한다. 제출 후 콜백을 호출하고 폼을 닫는다.

전역 Escape 처리에서 `customScheduleDay !== null`이면 먼저 폼만 닫고 반환한다. 접근성 오류 문구는 입력 ID와 `aria-describedby`로 연결한다.

**Step 4: 추가 카드 표시 보완**

`PlanItemEditor`의 제목 아래에 시간이 있으면 다음 상태를 표시한다.

```tsx
{item.startTime ? (
  <p className="text-[9.5px] font-bold text-mint">
    {item.startTime} · {item.fixed ? '고정 일정' : '시간 지정'}
  </p>
) : null}
```

`user_added` 카드의 주소가 없을 때는 일반 장소 확인 문구 대신 `사용자가 직접 입력한 일정입니다.`를 표시한다.

하단 상태 영역에서 `canUndoCustomSchedule`이면 `일정을 내 여행플랜에도 추가했어요`와 `추가한 일정 되돌리기`를 표시한다. 기존 `제외 되돌리기`와 접근 가능한 이름이 겹치지 않게 한다.

**Step 5: 편집기 테스트 통과 확인**

Run:

```powershell
cd apps/web
npm test -- --run src/components/PlanPdfEditor.test.tsx
```

Expected: 기존 8개와 새 입력 UI 테스트 모두 PASS.

**Step 6: 커밋**

```powershell
git add apps/web/src/components/PlanPdfEditor.tsx apps/web/src/components/PlanPdfEditor.test.tsx
git commit -m "[기능] PDF Day별 사용자 일정 입력"
```

### Task 4: 내 여행플랜과 PDF 초안의 즉시 반영·되돌리기 연결

**Files:**
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Modify: `apps/web/src/components/PackingDashboard.test.tsx`

**Step 1: 통합 실패 테스트 작성**

기존 PDF 작업 초안 테스트 패턴을 따라 다음 사용 흐름을 추가한다.

```ts
it('adds a PDF custom schedule to the saved plan and can undo both copies', async () => {
  const onAddCustomPlanItem = vi.fn();
  const onRemovePlanItem = vi.fn();
  renderDashboard([scheduledPlanItem], {onAddCustomPlanItem, onRemovePlanItem});

  fireEvent.click(screen.getByRole('button', {name: 'PDF 편집'}));
  fireEvent.click(await screen.findByRole('button', {name: 'Day 2 일정 직접 추가'}));
  fireEvent.change(screen.getByLabelText('일정명'), {target: {value: '렌터카 반납'}});
  fireEvent.change(screen.getByLabelText('시간'), {target: {value: '18:30'}});
  fireEvent.click(screen.getByRole('button', {name: '일정 추가'}));

  expect(onAddCustomPlanItem).toHaveBeenCalledWith(expect.objectContaining({
    id: expect.stringMatching(/^pdf-user-/),
    name: '렌터카 반납',
    day: 2,
    startTime: '18:30',
    fixed: true,
    source: 'user_added',
  }));
  expect(screen.getByText('렌터카 반납')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: '추가한 일정 되돌리기'}));
  expect(onRemovePlanItem).toHaveBeenCalledWith(
    onAddCustomPlanItem.mock.calls[0][0].id,
  );
  expect(screen.queryByText('렌터카 반납')).not.toBeInTheDocument();
});
```

별도 테스트에서 추가 후 `초안에서 제외`를 눌러도 `onRemovePlanItem`이 호출되지 않는지 확인한다. 편집기를 닫고 다시 열었을 때 일정이 남는 테스트도 추가한다.

**Step 2: 실패 확인**

Run:

```powershell
cd apps/web
npm test -- --run src/components/PackingDashboard.test.tsx
```

Expected: PDF 편집기 콜백 연결이 없어 FAIL.

**Step 3: 추가 핸들러 구현**

`PackingDashboard`에 다음 흐름을 구현한다.

```ts
const addPlanPdfCustomSchedule = (input: PlanPdfCustomScheduleInput) => {
  const id = `pdf-user-${globalThis.crypto.randomUUID()}`;
  const item = buildPlanPdfCustomScheduleItem(input, id, info.durationDays);
  if (!item) return;

  onAddCustomPlanItem(item);
  setPdfWorkspace((current) => current
    ? addCustomPlanPdfWorkspaceItem(current, item, info.durationDays)
    : current);
  setWorkspaceRevision((current) => current + 1);
};
```

`globalThis.crypto.randomUUID`가 없는 테스트·구형 브라우저를 위해 기존 프로젝트 ID 생성 관례를 먼저 확인하고, 필요하면 `Date.now()`와 난수 조합의 작은 `createClientId` 헬퍼를 사용한다. ID는 한 번만 생성하고 양쪽 상태에 재사용한다.

**Step 4: 양쪽 되돌리기 구현**

```ts
const undoPlanPdfCustomSchedule = () => {
  const itemId = pdfWorkspace?.recentlyAddedItemId;
  if (!itemId) return;
  onRemovePlanItem(itemId);
  setPdfWorkspace((current) => current
    ? undoRecentlyAddedPlanPdfWorkspaceItem(current, info.durationDays)
    : current);
  setWorkspaceRevision((current) => current + 1);
};
```

`PlanPdfEditor`에 추가·되돌리기 props를 전달한다. 원본 플랜에서 먼저 삭제된 경우 기존 `syncRemovedPlanPdfSourceItems`가 최근 ID를 지우므로 되돌리기 버튼도 사라져야 한다.

**Step 5: 통합 테스트 통과 확인**

Run:

```powershell
cd apps/web
npm test -- --run src/components/PackingDashboard.test.tsx src/components/PlanPdfEditor.test.tsx src/planPdfWorkspace.test.ts src/planPdf.test.ts --testTimeout=30000 --maxWorkers=1
```

Expected: PDF 사용자 일정 관련 테스트와 기존 작업 초안 테스트 모두 PASS.

**Step 6: 커밋**

```powershell
git add apps/web/src/components/PackingDashboard.tsx apps/web/src/components/PackingDashboard.test.tsx
git commit -m "[기능] PDF 일정과 내 여행플랜 동시 반영"
```

### Task 5: 시간과 고정 상태를 실제 PDF에 표시

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/planPdf.ts`
- Modify: `apps/web/src/planPdf.test.ts`
- Modify: `apps/api/routes/plan_pdf.py`
- Modify: `apps/api/engine/travelplanpdf.py`
- Modify: `apps/api/tests/test_plan_pdf_api.py`

**Step 1: 프런트 PDF 요청 실패 테스트 작성**

`apps/web/src/planPdf.test.ts`에 시간과 고정 상태가 전송되는지 추가한다.

```ts
it('includes schedule time and fixed state in the PDF request', () => {
  const request = buildTravelPlanPdfRequest(info, moments, {
    title: '나의 제주 여행',
    items: [{
      ...customItem,
      day: 1,
      order: 1,
      pdfMemo: '주유 후 반납',
      startTime: '18:30',
      fixed: true,
    }],
  }, []);

  expect(request.items[0]).toMatchObject({
    start_time: '18:30',
    fixed: true,
  });
});
```

**Step 2: 서버 PDF 시간 표시 실패 테스트 작성**

`_valid_request`의 사용자 일정에 다음 값을 추가한다.

```py
"start_time": "18:30",
"fixed": True,
```

PDF 텍스트 assertion을 추가한다.

```py
assert "18:30" in text
assert "고정 일정" in text
```

`start_time: "25:00"` 요청이 422를 반환하는 테스트도 추가한다.

**Step 3: 실패 확인**

Run:

```powershell
cd apps/web
npm test -- --run src/planPdf.test.ts
cd ../..
python -m pytest apps/api/tests/test_plan_pdf_api.py -q
```

Expected: 프런트 요청에 필드가 없고 서버 모델이 시간을 보존하지 않아 FAIL.

**Step 4: 프런트 요청 계약 확장**

`TravelPlanPdfRequestItem`에 다음 필드를 추가한다.

```ts
start_time: string | null;
fixed: boolean;
```

`buildTravelPlanPdfRequest` 매핑에 다음을 추가한다.

```ts
start_time: item.startTime ?? null,
fixed: item.fixed ?? false,
```

**Step 5: FastAPI 입력 계약 확장**

`PlanPdfItemInput`에 다음 필드를 추가한다.

```py
start_time: str | None = Field(
    default=None,
    pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$",
)
fixed: bool = False
```

**Step 6: ReportLab 일정 카드에 시간 표시**

`_ticket`의 장소·주소 메타 앞에 시간이 있으면 다음 문구를 추가한다.

```py
if item.start_time:
    fixed_label = " · 고정 일정" if item.fixed else ""
    detail_parts.append(
        Paragraph(
            _paragraph_text(f"{item.start_time}{fixed_label}"),
            styles["ticket_meta"],
        )
    )
```

사용자 직접 입력 일정에 주소가 없으면 `주소는 여행 전 확인해 주세요.` 대신 `사용자가 직접 입력한 일정입니다.`를 표시한다. 공식 출처·확인 시점을 만들어내지 않고 기존 `직접 추가·미검증` 상태는 유지한다.

**Step 7: 프런트와 서버 테스트 통과 확인**

Run:

```powershell
cd apps/web
npm test -- --run src/planPdf.test.ts
cd ../..
python -m pytest apps/api/tests/test_plan_pdf_api.py -q
```

Expected: 두 테스트 명령 모두 PASS.

**Step 8: 커밋**

```powershell
git add apps/web/src/api.ts apps/web/src/planPdf.ts apps/web/src/planPdf.test.ts apps/api/routes/plan_pdf.py apps/api/engine/travelplanpdf.py apps/api/tests/test_plan_pdf_api.py
git commit -m "[기능] PDF 사용자 일정 시간 표시"
```

### Task 6: 전체 회귀·브라우저·출력 검증

**Files:**
- Modify only if verification reveals a scoped defect.

**Step 1: 전체 웹 테스트 실행**

Run:

```powershell
cd apps/web
npm test -- --run --testTimeout=30000 --maxWorkers=1
```

Expected: 기존 98개와 새 테스트 모두 PASS.

**Step 2: 웹 빌드와 타입 검사 실행**

Run:

```powershell
cd apps/web
npm run build
npm run lint
```

Expected: Vite/PWA build와 `tsc --noEmit` 모두 exit code 0.

**Step 3: 관련 API 테스트 실행**

Run:

```powershell
python -m pytest apps/api/tests/test_plan_pdf_api.py -q
```

Expected: 모든 PDF API 테스트 PASS.

**Step 4: 데스크톱 브라우저 흐름 검증**

`@webapp-testing` 절차로 로컬 앱을 열고 다음을 확인한다.

1. 내 여행플랜에 장소를 하나 이상 담는다.
2. PDF 편집기를 연다.
3. Day 2에서 `일정 직접 추가`를 연다.
4. `렌터카 반납`, `18:30`, `제주공항`, `주유 후 반납`을 입력한다.
5. 추가 직후 PDF 카드와 내 여행플랜에 동일 일정이 표시되는지 확인한다.
6. 카드에 `18:30 · 고정 일정`이 보이는지 확인한다.
7. PDF 편집기를 닫았다 다시 열어 일정이 유지되는지 확인한다.
8. `추가한 일정 되돌리기`로 양쪽 일정이 사라지는지 확인한다.
9. 다시 추가하고 `초안에서 제외`했을 때 내 여행플랜에는 남는지 확인한다.
10. 브라우저 콘솔 오류와 페이지 오류가 없는지 확인한다.

**Step 5: 모바일 브라우저 흐름 검증**

375px 너비에서 다음을 확인한다.

- Day 폼이 한 열로 읽히고 고정 하단 버튼에 가리지 않는다.
- 키보드 탭 순서가 일정명 → Day → 시간 → 주소 → 메모 → 취소 → 일정 추가 순서다.
- 입력 폼에서 Escape가 폼만 닫는다.
- 긴 일정명과 메모가 카드 경계를 넘지 않는다.

**Step 6: 생성 PDF 확인**

시간이 있는 직접 추가 일정을 포함해 PDF를 생성하고 다음을 확인한다.

- 올바른 Day와 순서
- `18:30 · 고정 일정`
- 사용자 메모
- `사용자 직접 입력` 또는 `직접 추가·미검증` 표기
- 존재하지 않는 공식 출처나 확인 시점이 표시되지 않음

**Step 7: 최종 상태와 커밋 확인**

Run:

```powershell
git status --short
git log --oneline --decorate -6
```

Expected: 계획된 파일 외 변경 없음. 검증 중 수정이 생겼다면 관련 실패 테스트와 함께 별도 커밋:

```powershell
git add <scoped-files>
git commit -m "[수정] PDF 사용자 일정 회귀 보완"
```

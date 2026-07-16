# Jeju Travel Passport PDF Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current text-only plan download with an editable, user-selected-place-centered 제주 여행 패스포트 PDF.

**Architecture:** Add a pure frontend scheduling module and a `PlanPdfEditor` modal that submits only the user's selected plan items to a new public `POST /plan/pdf` endpoint. Render the PDF deterministically in a dedicated ReportLab module, reusing the existing Korean font and Jeju palette infrastructure while keeping the existing public-data `/pack/pdf` endpoint unchanged.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, FastAPI, Pydantic 2, ReportLab, ReportLab QR widgets, pytest, Node test runner, Poppler visual rendering

---

### Task 1: Define and test automatic Day scheduling

**Files:**
- Create: `apps/web/src/planPdf.ts`
- Create: `apps/web/tests/plan-pdf-scheduling.test.mjs`

**Step 1: Write the failing scheduling tests**

Test these behaviors:

```javascript
test('selected places are distributed contiguously across trip days while preserving order', () => {
  const draft = buildInitialPlanPdfDraft(items, 2);
  assert.deepEqual(
    draft.items.map((item) => [item.id, item.day, item.order]),
    [
      ['a', 1, 1],
      ['b', 1, 2],
      ['c', 1, 3],
      ['d', 2, 1],
      ['e', 2, 2],
    ],
  );
});
```

Also assert:

- an existing valid `item.day` is preserved;
- invalid days are normalized into `1..durationDays`;
- `movePlanPdfItem` changes order only inside the selected Day;
- `changePlanPdfItemDay` appends the item to the destination Day and renumbers both Days;
- empty plans return an empty item list.

**Step 2: Run the test and confirm RED**

```powershell
Set-Location apps\web
node --test tests/plan-pdf-scheduling.test.mjs
```

Expected: FAIL because `src/planPdf.ts` does not exist.

**Step 3: Implement the pure scheduling module**

Define:

```typescript
export interface PlanPdfDraftItem extends TravelPlanItem {
  day: number;
  order: number;
  pdfMemo: string;
}

export interface PlanPdfDraft {
  title: string;
  items: PlanPdfDraftItem[];
}

export function buildInitialPlanPdfDraft(
  items: TravelPlanItem[],
  durationDays: number,
  title?: string,
): PlanPdfDraft

export function changePlanPdfItemDay(...)
export function movePlanPdfItem(...)
```

Use contiguous balanced distribution for items without an existing Day:

```typescript
day = Math.min(days, Math.floor(index * days / itemCount) + 1);
```

Always renumber `order` from 1 inside each Day.

**Step 4: Run the focused test and confirm GREEN**

```powershell
node --test tests/plan-pdf-scheduling.test.mjs
```

Expected: all scheduling tests PASS.

**Step 5: Commit**

```powershell
git add apps/web/src/planPdf.ts apps/web/tests/plan-pdf-scheduling.test.mjs
git commit -m "[기능] 여행 플랜 PDF 일정 편집 모델 추가"
```

### Task 2: Define the personal-plan PDF API contract

**Files:**
- Create: `apps/api/routes/plan_pdf.py`
- Modify: `apps/api/main.py:32-62`
- Create: `apps/api/tests/test_plan_pdf_api.py`

**Step 1: Write failing API validation tests**

Create `TestClient(app)` tests for:

- `POST /plan/pdf` rejects an empty item list with 422;
- title length is limited;
- Day must be inside `1..travel.days`;
- item source accepts only `public_data`, `web_search`, `user_added`;
- a valid request returns `application/pdf`;
- filename includes the start date.

Use a minimal valid request with one web-search place and no database dependency.

**Step 2: Run and confirm RED**

```powershell
python -m pytest apps\api\tests\test_plan_pdf_api.py -q
```

Expected: FAIL/404 because `/plan/pdf` does not exist.

**Step 3: Add Pydantic models**

In `apps/api/routes/plan_pdf.py`, define:

```python
class PlanPdfTravelInput(BaseModel):
    regions: list[str] = Field(default_factory=list, max_length=20)
    start_date: date
    days: int = Field(ge=1, le=14)
    companion: str = Field(min_length=1, max_length=80)
    purpose: str = Field(min_length=1, max_length=80)
    moments: list[str] = Field(default_factory=list, max_length=20)

class PlanPdfItemInput(BaseModel):
    id: str = Field(min_length=1, max_length=220)
    name: str = Field(min_length=1, max_length=200)
    day: int = Field(ge=1, le=14)
    order: int = Field(ge=1, le=100)
    source: Literal["public_data", "web_search", "user_added"]
    address: str | None = Field(default=None, max_length=500)
    memo: str | None = Field(default=None, max_length=500)
    badge: str | None = Field(default=None, max_length=40)
    source_title: str | None = Field(default=None, max_length=300)
    source_url: str | None = Field(default=None, max_length=2000)
    checked_at: datetime | None = None
    check_required: list[str] = Field(default_factory=list, max_length=20)

class PlanPdfBody(BaseModel):
    title: str = Field(default="나의 제주 여행", min_length=1, max_length=80)
    travel: PlanPdfTravelInput
    items: list[PlanPdfItemInput] = Field(min_length=1, max_length=100)
    packing_items: list[str] = Field(default_factory=list, max_length=30)
```

Add a model validator ensuring every item Day is no greater than `travel.days`. Normalize display ordering inside the rendering layer rather than mutating the request.

**Step 4: Add the route shell**

Create:

```python
router = APIRouter(tags=["plan-pdf"])

@router.post("/plan/pdf")
def download_plan_pdf(body: PlanPdfBody) -> Response:
    pdf_bytes = travelplanpdf.build_travel_plan_pdf(body.model_dump(mode="json"))
    ...
```

Include the router in `apps/api/main.py`.

**Step 5: Run the API tests**

At this point validation tests should pass; the valid-render test may still fail until Task 3.

**Step 6: Commit**

Commit the route and contract together with the initial API tests after the endpoint shell is connected to the renderer in Task 3.

### Task 3: Build the deterministic 여행 패스포트 renderer

**Files:**
- Create: `apps/api/engine/travelplanpdf.py`
- Modify: `apps/api/routes/plan_pdf.py`
- Modify: `apps/api/tests/test_plan_pdf_api.py`
- Modify: `pyproject.toml`

**Step 1: Add a failing renderer content test**

Add `pypdf>=5.0` to `[project.optional-dependencies].dev`.

The test must:

- call `build_travel_plan_pdf()` with public-data, web-search and user-added items;
- assert bytes start with `%PDF`;
- read the PDF with `pypdf.PdfReader`;
- assert extracted text contains:
  - custom trip title;
  - each place name;
  - `Day 1`, `Day 2`;
  - `근거 확인`;
  - source labels;
  - packing checklist item.

Run the test and confirm RED because the renderer is absent.

**Step 2: Reuse the existing PDF foundation**

Import the existing module rather than copying font search code:

```python
from apps.api.engine import packpdf as pdf_theme
```

Call `pdf_theme._ensure_fonts()` and read the resolved:

- `pdf_theme.FONT_REGULAR`
- `pdf_theme.FONT_BOLD`
- Jeju palette constants

Do not alter `/pack/pdf` behavior.

**Step 3: Implement the cover**

Use a dedicated cover PageTemplate with:

- deep Jeju sea background;
- vector oreum silhouette;
- citrus passport stamp;
- trip title;
- dates, regions and companion;
- phrase `근거를 확인하고, 나만의 제주를 출발합니다.`

Use only ReportLab canvas primitives. Do not download external images.

**Step 4: Implement the overview page**

Show:

- dates and trip length;
- selected regions and moments;
- total place count;
- count by `public_data`, `web_search`, `user_added`;
- Day summary chips;
- departure recheck notice.

**Step 5: Implement Day itinerary ticket cards**

Sort by `(day, order, input index)`.

Each card includes:

- Day/order passport number;
- place name;
- address;
- user PDF memo or original note;
- source/status label;
- translated `check_required` list;
- three blank handwritten memo lines;
- clickable map search URL;
- QR code generated with `reportlab.graphics.barcode.qr.QrCodeWidget`.

QR target:

```python
https://www.google.com/maps/search/?api=1&query=<urlencoded place name + address>
```

If QR construction fails, keep the address and clickable map text and continue generating the PDF.

**Step 6: Implement packing and evidence pages**

Packing page:

- request `packing_items`;
- default departure checks for operation, reservation, weather and movement;
- checkbox-style vector marks.

Evidence page:

- place, source class, source title, checked date;
- clickable source URL;
- recheck requirement;
- direct-user items explicitly marked `직접 추가·미검증`.

Escape all user/source text before placing it in ReportLab `Paragraph` XML.

**Step 7: Run renderer and API tests**

```powershell
python -m pytest apps\api\tests\test_plan_pdf_api.py -q
```

Expected: all tests PASS.

**Step 8: Commit**

```powershell
git add pyproject.toml apps/api/engine/travelplanpdf.py apps/api/routes/plan_pdf.py apps/api/main.py apps/api/tests/test_plan_pdf_api.py
git commit -m "[기능] 제주 여행 패스포트 PDF API 추가"
```

### Task 4: Add the frontend PDF request

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/planPdf.ts`
- Create: `apps/web/tests/plan-pdf-contract.test.mjs`

**Step 1: Write a failing source-contract test**

Assert:

- `downloadTravelPlanPdf` posts to `/plan/pdf`;
- request body contains `title`, `travel`, `items`, `packing_items`;
- item mapping contains `day`, `order`, `memo`, `source_url`, `checked_at`, `check_required`;
- fallback filename ends with `.pdf`, not `.txt`.

Run and confirm RED.

**Step 2: Implement request types and mapper**

Add:

```typescript
export interface TravelPlanPdfRequest { ... }

export async function downloadTravelPlanPdf(
  request: TravelPlanPdfRequest,
): Promise<{ filename: string; blob: Blob }>
```

Keep the browser-download DOM action outside `api.ts`.

Add a pure `buildTravelPlanPdfRequest(...)` mapper in `planPdf.ts`.

**Step 3: Run contract and scheduling tests**

```powershell
node --test tests/plan-pdf-*.test.mjs
```

Expected: PASS.

**Step 4: Commit**

```powershell
git add apps/web/src/api.ts apps/web/src/planPdf.ts apps/web/tests/plan-pdf-contract.test.mjs
git commit -m "[기능] 여행 플랜 PDF 다운로드 계약 연결"
```

### Task 5: Build the pre-download PlanPdfEditor

**Files:**
- Create: `apps/web/src/components/PlanPdfEditor.tsx`
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Create: `apps/web/tests/plan-pdf-editor.test.mjs`

**Step 1: Write the failing UI contract test**

Assert the source contains:

- dialog semantics (`role="dialog"`, `aria-modal="true"`);
- title input;
- Day select for each item;
- `위로`, `아래로` actions;
- PDF memo input;
- `PDF 만들기`;
- empty-plan guard;
- `downloadTravelPlanPdf`.

Also assert `PackingDashboard` no longer creates `text/plain` or a `.txt` filename.

Run and confirm RED.

**Step 2: Implement the modal**

Use the current Jeju dashboard style:

- ivory background;
- basalt header;
- citrus primary action;
- mint status chips;
- small passport stamp decoration using CSS, not bitmap images.

Desktop:

- centered max-width dialog;
- Day columns or grouped sections.

Mobile:

- full-height bottom-sheet-like dialog;
- sticky header and sticky PDF action footer;
- large touch targets.

On open, initialize from `buildInitialPlanPdfDraft`. On close, discard temporary edits.

**Step 3: Implement accessible editing**

- Day select changes Day using the pure helper;
- up/down buttons reorder within a Day;
- textarea edits `pdfMemo`;
- focus the title input on open;
- Escape closes only when not generating;
- body scroll is locked while open.

**Step 4: Connect the dashboard**

Replace the current text download behavior:

- button label: `여행 플랜 PDF`;
- disabled when `selectedPlanItems.length === 0`;
- helper text explains that Day and order can be edited before download;
- pass `info`, moments, selected items and `planPackingItems.map(x => x.item)`;
- generate a Blob URL and download the returned PDF filename;
- keep `플랜 공유` text-copy behavior unchanged.

**Step 5: Run frontend tests and type check**

```powershell
Set-Location apps\web
node --test tests/*.test.mjs
npm run lint
```

Expected: all PASS.

**Step 6: Commit**

```powershell
git add apps/web/src/components/PlanPdfEditor.tsx apps/web/src/components/PackingDashboard.tsx apps/web/tests/plan-pdf-editor.test.mjs
git commit -m "[기능] 여행 패스포트 PDF 편집 화면 추가"
```

### Task 6: Render and visually verify the final PDF

**Files:**
- Create temporarily: `C:\tmp\sample_travel_plan_request.json`
- Output temporarily: `C:\tmp\jeju-travel-passport-sample.pdf`
- Output temporarily: `C:\tmp\jeju-travel-passport-pages\*.png`

**Step 1: Generate a representative sample**

Include:

- two Days;
- one public-data place;
- two Haruban web recommendations;
- one user-added place;
- long Korean addresses and notes;
- six packing items;
- at least one item with a long source URL.

Generate the PDF by calling the renderer directly or using `TestClient`.

**Step 2: Inspect the PDF structurally**

Use `pypdf` to confirm page count and extract all expected text.

**Step 3: Render every page**

Use Poppler:

```powershell
pdftoppm -png -r 150 C:\tmp\jeju-travel-passport-sample.pdf C:\tmp\jeju-travel-passport-pages\page
```

Inspect every page image with the image viewer.

Check:

- no clipped Korean;
- no text overlap;
- ticket cards do not split incorrectly;
- QR codes remain inside cards;
- evidence URLs wrap safely;
- cover and body have consistent visual hierarchy;
- no accidental blank page.

**Step 4: Iterate until visually clean**

Any layout issue requires:

- renderer adjustment;
- regeneration;
- complete re-render;
- reinspection of all pages.

**Step 5: Run full verification**

```powershell
python -m pytest apps\api\tests\test_plan_pdf_api.py apps\api\tests\test_haruban_agent.py apps\api\tests\test_llm.py -q
Set-Location apps\web
node --test tests/*.test.mjs
npm run lint
npm run build
```

Expected: all commands exit 0.

### Task 7: Browser interaction verification and deployment

**Step 1: Run local browser automation**

Use the webapp-testing server helper and headless Chrome.

Verify:

1. a plan with at least three items shows `여행 플랜 PDF`;
2. the editor opens;
3. title changes;
4. an item moves from Day 1 to Day 2;
5. order changes;
6. a PDF memo is entered;
7. the `/plan/pdf` request contains the edited values;
8. download is a non-empty `application/pdf` Blob.

**Step 2: Inspect final diff**

```powershell
git diff --check
git status --short
git log --oneline --decorate -8
```

**Step 3: Push to remote main after user-approved integration**

```powershell
git push origin HEAD:main
```

**Step 4: Verify production**

- check Railway `/health`;
- call production `/plan/pdf` with a representative request;
- confirm HTTP 200, `application/pdf`, non-zero bytes and correct filename;
- verify Vercel bundle contains `여행 플랜 PDF`;
- manually download once from the production UI.

**Step 5: Clean temporary artifacts**

Remove only the explicitly created files under `C:\tmp`.

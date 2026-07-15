# Public Data Lifecycle Business Plan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a readable 10-page DOCX and PDF business plan that presents Pack Your Jeju as a public-data lifecycle model, clearly separates the current solo-founder MVP from future expansion, and preserves the contest submission structure.

**Architecture:** Reuse the existing `docx`-based final business-plan generator as a formatting reference, but create a new generator and new output filenames so the previous submission remains untouched. The document will use three visual flows—public-data lifecycle, three plan inputs, and trusted feedback validation—and a separate validator will enforce page count, required narrative, prohibited overclaims, link presence, and file integrity.

**Tech Stack:** Node.js, `docx`, Python 3.11, `pypdf`, LibreOffice headless conversion, PyMuPDF rendering, XML/DOCX validation tools.

---

### Task 1: Capture the revised document contract in a failing validator

**Files:**
- Create: `scripts/validate_jeju_lifecycle_business_plan.py`
- Read: `docs/plans/2026-07-15-public-data-lifecycle-business-plan-design.md`
- Read: `docs/plans/2026-07-14-plan-feedback-trust-loop-design.md`

**Step 1: Write the failing validator**

Create a validator that expects:

```python
DOCX = Path("docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.docx")
PDF = Path("docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf")
REQUIRED = [
    "공공데이터 라이프사이클",
    "공공데이터 후보",
    "하루방 웹검색",
    "사용자 직접입력",
    "실제 여행",
    "근거 원장",
    "운영자 검토",
    "버전형 보정",
    "현재 MVP",
    "고도화 계획",
    "개인 1인 창업자",
    "https://pack-your-jeju.vercel.app",
]
FORBIDDEN = ["팀원", "자동으로 공공데이터를 수정", "기관 협력 확정", "매출 확정"]
```

The validator must assert both files exist, the PDF has exactly 10 pages, all required phrases are present, forbidden overclaims are absent, and the service URL exists as a PDF URI annotation.

**Step 2: Run the validator to verify it fails**

Run: `python scripts/validate_jeju_lifecycle_business_plan.py`

Expected: FAIL because the new DOCX and PDF do not exist.

**Step 3: Commit the contract**

```bash
git add scripts/validate_jeju_lifecycle_business_plan.py
git commit -m "[검증] 라이프사이클 사업계획서 계약 추가"
```

### Task 2: Build the revised 10-page DOCX generator

**Files:**
- Create: `scripts/generate_jeju_lifecycle_business_plan.js`
- Reference: `scripts/generate_jeju_competition_final_business_plan.js`
- Create: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.docx`

**Step 1: Define the visual system**

Use A4 portrait, 10 fixed sections, Korean sans-serif body typography, basalt title color, tangerine accent, pale mint for `현재 MVP`, and pale blue-gray for `고도화 계획`. Define reusable helpers for title bars, status chips, key-message boxes, metric cards, flow steps, and full-width tables with exact DXA widths.

**Step 2: Write the 10-page content structure**

Generate one page per approved section:

1. Item definition and lifecycle-first value proposition.
2. The public-data problem and why a lifecycle is needed.
3. Full cycle: original public data → three planning routes → actual trip → feedback → validation → correction/new evidence → next plan.
4. Three plan routes and a unified provenance snapshot.
5. Public datasets, normalization, change detection, and current development snapshot.
6. Trusted feedback design: facts vs experience, optional evidence, independent reports, web revalidation, moderation, versioned correction.
7. Current MVP scope, verified capabilities, limitations, and technical differentiation.
8. Four-stage roadmap and operational/privacy risks.
9. B2C usage → B2B trust reports → B2G data-quality collaboration business model.
10. Solo-founder execution strategy, measurable outcomes, expected public value, and closing statement.

**Step 3: Make present/future status explicit**

Every unimplemented item must use `고도화 계획`, `검증 가설`, or `기관 협력 제안` wording. Avoid team references. Describe the creator as `개인 1인 창업자` and explain that partnerships are acquired by stage rather than currently secured.

**Step 4: Generate the DOCX**

Run: `node scripts/generate_jeju_lifecycle_business_plan.js`

Expected: the new DOCX is created without overwriting the prior `04_제주를담다_최종_사업계획서.docx`.

**Step 5: Validate DOCX structure**

Run the bundled DOCX validation helper from the workspace dependency runtime. If unavailable, unzip-test the DOCX and confirm `[Content_Types].xml`, `word/document.xml`, relationships, headers, footers, and media files are readable.

Expected: valid DOCX package with no XML parse failures.

**Step 6: Commit the generator and DOCX**

```bash
git add scripts/generate_jeju_lifecycle_business_plan.js \
  docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.docx
git commit -m "[문서] 공공데이터 라이프사이클 사업계획서 생성"
```

### Task 3: Convert to PDF and tune the layout to exactly 10 pages

**Files:**
- Create: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf`
- Modify: `scripts/generate_jeju_lifecycle_business_plan.js`

**Step 1: Convert DOCX to PDF**

Use the bundled LibreOffice wrapper if available; otherwise use the installed headless LibreOffice executable.

Expected: PDF conversion exits 0.

**Step 2: Check page count**

Run:

```python
from pypdf import PdfReader
assert len(PdfReader("docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf").pages) == 10
```

Expected: exactly 10 pages.

**Step 3: Render all pages for visual inspection**

Render at 150–180 DPI into a temporary review directory and create a contact sheet. Inspect pages 1, 3, 4, 6, 7, and 10 individually for text clipping, table overflow, broken Korean fonts, low contrast, and orphaned headings.

**Step 4: Tune layout**

Change only spacing, column widths, font sizes, and concise wording needed to keep each section on its intended page. Regenerate DOCX and PDF after every adjustment.

**Step 5: Commit the final PDF and layout updates**

```bash
git add scripts/generate_jeju_lifecycle_business_plan.js \
  docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.docx \
  docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf
git commit -m "[문서] 라이프사이클 사업계획서 PDF 완성"
```

### Task 4: Verify narrative, facts, and visual integrity

**Files:**
- Modify: `scripts/validate_jeju_lifecycle_business_plan.py`
- Test: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.docx`
- Test: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf`

**Step 1: Run the artifact validator**

Run: `python scripts/validate_jeju_lifecycle_business_plan.py`

Expected: PASS with `pages=10`, all required phrases, no forbidden overclaims, and at least one service URL annotation.

**Step 2: Compare claims with implementation**

Check each `현재 MVP` statement against the deployed service, existing API routes, tests, `DECISIONS.md`, and the feedback trust-loop design. Move any unverified capability to `고도화 계획`.

**Step 3: Run repository checks**

Run:

```bash
python -m pytest -q
git diff --check
```

Expected: existing test baseline remains 229 passed and 15 skipped, and no whitespace errors.

**Step 4: Final reader checklist**

Verify a context-free reader can answer:

- What is the business: travel planner or public-data lifecycle model?
- What are the three planning inputs?
- How does a trip become trusted feedback?
- Why does feedback not directly overwrite public data?
- What exists in the MVP today?
- What is planned for later?
- How can a solo founder execute this in stages?

Expected: every answer is discoverable in the first reading without relying on this conversation.

**Step 5: Commit validator updates if changed**

```bash
git add scripts/validate_jeju_lifecycle_business_plan.py
git commit -m "[검증] 사업계획서 내용과 레이아웃 확인"
```

### Task 5: Deliver only the approved artifacts to the project folder

**Files:**
- Copy to project folder: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.docx`
- Copy to project folder: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf`

**Step 1: Copy only the final DOCX and PDF**

Do not overwrite the previous final business plan. Do not copy temporary rendered pages or review assets.

**Step 2: Compare hashes**

Compute SHA-256 for worktree and delivered copies.

Expected: hashes match exactly for both files.

**Step 3: Re-run validation on delivered files**

Expected: 10 pages, required narrative present, forbidden overclaims absent, and both files open successfully.

**Step 4: Report clickable artifact links**

Provide absolute local links to the DOCX and PDF and summarize the lifecycle-first restructuring, MVP/future split, and solo-founder framing.

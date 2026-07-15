# Online Submission Lifecycle Revision Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create separate 3-page DOCX and PDF online-submission copy documents aligned with the new public-data lifecycle business plan, while preserving the previous 05 files.

**Architecture:** Reuse the existing `docx` generator's layout helpers and three-page structure, but write a new generator and new output filenames. Add a small artifact validator that checks page count, lifecycle narrative, current-MVP/future separation, solo-founder wording, service hyperlink, and the new 04 attachment filenames.

**Tech Stack:** Node.js, `docx`, Python 3.11, `pypdf`, Microsoft Word COM PDF conversion, PyMuPDF review rendering.

---

### Task 1: Add a failing online-submission artifact contract

**Files:**
- Create: `scripts/validate_jeju_online_submission_lifecycle.py`

**Step 1: Write the validator**

Expect these outputs:

```python
DOCX = Path("docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_라이프사이클_개정본.docx")
PDF = Path("docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_라이프사이클_개정본.pdf")
```

Require exactly three PDF pages and the phrases `공공데이터 라이프사이클`, `공공데이터 후보`, `하루방 웹검색`, `사용자 직접입력`, `실제 여행`, `운영자 검토`, `버전형 보정`, `현재 MVP`, `고도화 계획`, `개인 1인 창업자`, and the service URL. Reject `팀원`, `팀 역량`, the old final-business-plan attachment filename, and claims that public data is automatically modified.

**Step 2: Run the validator and confirm failure**

Run: `python scripts/validate_jeju_online_submission_lifecycle.py`

Expected: FAIL because the revised artifacts do not exist.

**Step 3: Commit**

```bash
git add scripts/validate_jeju_online_submission_lifecycle.py
git commit -m "[검증] 온라인 접수 라이프사이클 문안 계약 추가"
```

### Task 2: Generate the revised 3-page DOCX

**Files:**
- Create: `scripts/generate_jeju_online_submission_lifecycle.js`
- Reference: `scripts/generate_jeju_online_submission_entry.js`
- Create: `docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_라이프사이클_개정본.docx`

**Step 1: Reuse the established layout**

Keep A4 portrait, three pages, basalt/teal/tangerine colors, a copy-ready shaded area, page numbers, and a clickable service URL. Do not modify the old generator or old 05 files.

**Step 2: Replace the title and copy-ready content**

Use the approved title:

> 여행으로 검증하고 다시 강화하는 제주 공공데이터, ‘제주를 담다’

Write the eight approved sections in the main copy area. Keep content concise enough for direct portal pasting and explicitly label current MVP versus future enhancement.

**Step 3: Update image and attachment instructions**

Use the new representative-image phrase and new 04 lifecycle DOCX/PDF names. Replace team checks with solo-applicant checks.

**Step 4: Generate and validate DOCX structure**

Run:

```bash
node --check scripts/generate_jeju_online_submission_lifecycle.js
node scripts/generate_jeju_online_submission_lifecycle.js
```

Unzip-test the DOCX and parse its XML.

Expected: the new DOCX opens as a valid package and the old 05 DOCX remains unchanged.

**Step 5: Commit**

```bash
git add scripts/generate_jeju_online_submission_lifecycle.js \
  docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_라이프사이클_개정본.docx
git commit -m "[문서] 온라인 접수 라이프사이클 개정본 생성"
```

### Task 3: Convert and visually verify the PDF

**Files:**
- Create: `docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_라이프사이클_개정본.pdf`
- Modify if needed: `scripts/generate_jeju_online_submission_lifecycle.js`

**Step 1: Convert with installed Microsoft Word**

Use Word COM `ExportAsFixedFormat` with a hidden application and alerts disabled.

Expected: PDF conversion exits successfully.

**Step 2: Assert three pages**

Run the validator and require `pages=3`.

**Step 3: Render and inspect all pages**

Render all pages at 150–180 DPI. Check copy markers, headings, hyperlink, attachment filenames, line breaks, table overflow, and footer placement.

**Step 4: Commit**

```bash
git add scripts/generate_jeju_online_submission_lifecycle.js \
  docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_라이프사이클_개정본.docx \
  docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_라이프사이클_개정본.pdf
git commit -m "[문서] 온라인 접수 라이프사이클 PDF 완성"
```

### Task 4: Final verification and folder delivery

**Files:**
- Test: `docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_라이프사이클_개정본.docx`
- Test: `docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_라이프사이클_개정본.pdf`

**Step 1: Run fresh artifact and repository checks**

```bash
python scripts/validate_jeju_online_submission_lifecycle.py
python -m pytest -q
git diff --check
```

Expected: artifact validation passes, repository baseline remains 229 passed and 15 skipped, and there are no whitespace errors.

**Step 2: Reader checklist**

Verify the copy alone answers: what the public-data lifecycle is, what the three plan routes are, how feedback becomes trusted data, what exists now, what is future work, and what the solo founder will do.

**Step 3: Copy only the final DOCX and PDF to the project folder**

Do not copy review images or temporary files. Compare SHA-256 hashes between worktree and project-folder copies.

**Step 4: Re-run validation against delivered files**

Expected: three pages, required phrases present, prohibited claims absent, correct lifecycle 04 attachment names, and a working service URL annotation.

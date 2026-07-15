# Business Plan Red-Mark Removal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 사업계획서에서 사용자가 빨간색으로 표시한 안내성·평가성 문구 6곳만 삭제한 최신 DOCX와 PDF를 생성한다.

**Architecture:** 기존 `docx` 생성기와 10페이지 문서 구조를 유지한다. 검증기에 삭제 문구를 금지 항목으로 추가해 기존 문서의 실패를 확인하고, 생성기 문자열만 최소 수정한 뒤 Word PDF 변환과 전체 페이지 시각 검사를 수행한다.

**Tech Stack:** Node.js, `docx`, Python 3.11, `pypdf`, PyMuPDF, Microsoft Word COM

---

### Task 1: 삭제 문구 계약 검사 추가

**Files:**
- Modify: `scripts/validate_jeju_lifecycle_business_plan.py`

**Step 1: Add forbidden phrases**

```python
FORBIDDEN.extend([
    "주최 측 공식 목차 대응",
    "기술 중심 전면 개정본",
    "제품·서비스 개발 부문",
    "(우수성)",
    "(활용 적정성)",
    "(차별성)",
    "(사업성)",
    "(사업화 계획 우수성)",
])
```

**Step 2: Run validation and verify it fails**

```powershell
$env:PYTHONPATH='C:\tmp\jeju-pdf-review'; python scripts/validate_jeju_lifecycle_business_plan.py
```

Expected: 기존 DOCX/PDF에서 금지 문구가 발견되어 FAIL.

**Step 3: Commit**

```powershell
git add scripts/validate_jeju_lifecycle_business_plan.py
git commit -m "[검증] 사업계획서 표시 문구 삭제 계약 추가"
```

### Task 2: 생성기에서 표시 문구 삭제

**Files:**
- Modify: `scripts/generate_jeju_lifecycle_business_plan.js`

**Step 1: Remove the cover subtitle**

표지 `title()` 호출에서 부제 문구를 제거하고 빈 문단이 생기지 않도록 제목 함수 또는 호출을 최소 조정한다.

**Step 2: Remove evaluation labels from five headings**

```text
1-1. 개발 서비스의 기능 및 특징
1-2. 공공데이터의 활용 적정성
1-3. 기존 서비스와의 차별성 및 독창성
2-1. 개발 제품 및 서비스를 활용한 창업 계획
2-2. 개발 제품 및 서비스의 사업화 계획
```

**Step 3: Generate DOCX**

```powershell
node scripts/generate_jeju_lifecycle_business_plan.js
```

Expected: 최신 사업계획서 DOCX 생성.

### Task 3: PDF 변환과 자동 검증

**Files:**
- Update: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.docx`
- Update: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf`

**Step 1: Export PDF with Word COM**

Word `ExportAsFixedFormat(..., 17)`으로 DOCX를 PDF로 변환한다.

**Step 2: Run validation**

```powershell
$env:PYTHONPATH='C:\tmp\jeju-pdf-review'; python scripts/validate_jeju_lifecycle_business_plan.py
```

Expected: 10 pages, required missing 0, forbidden found 0, URI link 1.

**Step 3: Commit**

```powershell
git add scripts/generate_jeju_lifecycle_business_plan.js scripts/validate_jeju_lifecycle_business_plan.py docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.docx docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf
git commit -m "[문서] 사업계획서 표시 문구 삭제"
```

### Task 4: 최종 파일 교체와 시각 검증

**Files:**
- Update: `C:\Users\USER\Desktop\제주를담다 공모전 자료\04_제주를담다_공공데이터_라이프사이클_사업계획서.docx`
- Update: `C:\Users\USER\Desktop\제주를담다 공모전 자료\04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf`

**Step 1: Render all pages**

PyMuPDF로 PDF 10페이지를 PNG로 렌더링한다.

**Step 2: Inspect all pages**

표지 여백, 다섯 제목의 줄바꿈, 표 잘림, 문단 겹침, 페이지 수를 확인한다.

**Step 3: Copy verified files**

검증된 DOCX와 PDF만 데스크톱 공모전 자료 폴더에 덮어쓴다.

**Step 4: Verify hashes and worktree**

프로젝트 산출물과 데스크톱 산출물의 SHA-256이 일치하고 Git 작업 폴더가 깨끗한지 확인한다.

# Business Plan First Page Copy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 사업계획서 첫 페이지의 핵심 강조 문장을 승인된 제주 여행 기반 표현으로 교체한다.

**Architecture:** 기존 docx-js 생성기를 단일 소스로 유지하고 문구 한 곳만 변경한다. 생성된 DOCX를 Microsoft Word로 PDF 변환한 뒤 텍스트·페이지 수·첫 페이지 렌더링을 검증한다.

**Tech Stack:** JavaScript, docx-js, Microsoft Word COM, Python pypdf/PyMuPDF

---

### Task 1: 첫 페이지 문구 계약 변경

**Files:**
- Modify: `scripts/generate_jeju_lifecycle_business_plan.js:281`

**Step 1:** 기존 문구가 생성기에 존재하는지 `rg`로 확인한다.

**Step 2:** 승인된 문구로 정확히 교체한다.

**Step 3:** `node --check scripts/generate_jeju_lifecycle_business_plan.js`를 실행한다.

### Task 2: 문서 재생성과 검증

**Files:**
- Modify: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.docx`
- Modify: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf`

**Step 1:** 생성기를 실행해 DOCX를 재생성한다.

**Step 2:** Word COM으로 PDF를 재생성한다.

**Step 3:** PDF가 10페이지이고 새 문구를 포함하며 기존 문구를 포함하지 않는지 검사한다.

**Step 4:** 첫 페이지를 이미지로 렌더링해 강조 문장의 줄바꿈·잘림·겹침을 확인한다.

### Task 3: 최종 폴더 전달

**Files:**
- Copy: 최종 DOCX와 PDF를 `C:/Users/USER/Desktop/제주를담다 공모전 자료/`

**Step 1:** 바탕화면 공모전 자료 폴더에 두 파일을 덮어쓴다.

**Step 2:** 원본과 전달본의 SHA-256 해시가 일치하는지 확인한다.

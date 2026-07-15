# 경진대회 온라인 접수 입력문안 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 온라인 접수 화면의 제목·주요내용·대표이미지·첨부파일 안내를 한 번에 제공하는 DOCX를 생성한다.

**Architecture:** 기존 최종 사업계획서와 생성기의 검증된 메시지를 재사용하되, 웹 에디터 복사에 적합한 짧은 문단과 번호 목록으로 재구성한다. 별도 Node.js 생성기를 두고 DOCX 생성 후 Word PDF 렌더링과 텍스트 검증을 수행한다.

**Tech Stack:** Node.js, `docx`, Microsoft Word PDF export, Python `pypdf`

---

### Task 1: 입력문안 확정

**Files:**
- Reference: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_최종_사업계획서.docx`
- Create: `scripts/generate_jeju_online_submission_entry.js`

1. 제목 입력값을 확정한다.
2. 주요내용을 8개 짧은 섹션으로 작성한다.
3. 대표이미지와 첨부파일 안내를 추가한다.

### Task 2: DOCX 생성

**Files:**
- Create: `docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_입력문안.docx`

1. 명시적 A4 크기와 여백을 설정한다.
2. 복사 영역과 안내 영역을 시각적으로 구분한다.
3. 번호 목록은 DOCX numbering을 사용한다.
4. Node 생성기를 실행한다.

### Task 3: 렌더링·내용 검증

**Files:**
- Create: `docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_입력문안.pdf`

1. DOCX ZIP과 XML을 파싱한다.
2. Word에서 PDF로 변환한다.
3. 3쪽 이내인지 확인한다.
4. 제목, 아이템명, 서비스 URL, 주요 섹션, 대표이미지 규격, 첨부파일 안내를 PDF 텍스트에서 확인한다.
5. 페이지 이미지를 검토해 잘림 여부를 확인한다.


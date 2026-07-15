# 제주 공공데이터·AI 창업경진대회 사업계획서 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 최신 Pack Your Jeju 구현과 활성 제품 결정을 반영한 제출용 사업계획서 DOCX를 A4 10쪽 이내로 생성한다.

**Architecture:** 기존 `docx` 기반 생성 스크립트를 단일 출처로 유지하고, 공통 신청서의 아이템 표기와 사업계획서 10개 페이지를 함께 최신화한다. 생성 후 DOCX 구조 검증, PDF 변환, 페이지 이미지 검토로 내용과 레이아웃을 확인한다.

**Tech Stack:** Node.js, `docx`, LibreOffice headless, PDF 렌더링 도구

---

### Task 1: 제출 문구와 최신 사실 확정

**Files:**
- Modify: `scripts/generate_jeju_contest_documents.js`
- Reference: `DECISIONS.md`
- Reference: `TRUST_ENGINE.md`
- Reference: `apps/api/main.py`
- Reference: `apps/api/routes/`

1. 아이템명과 20자 소개를 확정한다.
2. API와 테스트를 기준으로 현재 구현 기능을 목록화한다.
3. 활성 결정 D-17~D-29를 사업계획 메시지로 변환한다.
4. 미구현 항목을 로드맵으로 분리한다.

### Task 2: 사업계획서 생성기 개정

**Files:**
- Modify: `scripts/generate_jeju_contest_documents.js`

1. 표지와 공통 신청서의 아이템 표기를 통일한다.
2. 서식 6의 1-1, 1-2, 1-3, 2-1, 2-2 구조가 드러나도록 10개 페이지를 재작성한다.
3. 표 너비, 셀 여백, 명시적 A4 크기와 페이지 나눔을 유지한다.
4. 사실·목표·추론의 표현을 구분한다.

### Task 3: DOCX 생성과 구조 검증

**Files:**
- Create: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_최종_사업계획서.docx`

1. Node 생성 스크립트를 실행한다.
2. DOCX 패키지와 XML 구조를 검증한다.
3. 문서 텍스트를 추출해 필수 항목과 금지 표현을 점검한다.

### Task 4: PDF 렌더링과 육안 검토

**Files:**
- Create: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_최종_사업계획서.pdf`
- Create: `tmp_competition_plan_review/`

1. DOCX를 PDF로 변환한다.
2. 페이지 수가 10쪽 이하인지 확인한다.
3. 페이지별 이미지를 만들고 표 잘림, 빈 페이지, 제목 고립을 확인한다.
4. 문제가 있으면 생성기를 조정하고 다시 검증한다.

### Task 5: 제출 안내 갱신

**Files:**
- Modify: `docs/competition/2026-jeju-public-data-ai/README.md`

1. 최종 DOCX 파일을 제출 패키지 목록에 추가한다.
2. 대표자·팀 정보 입력이 남아 있음을 명시한다.
3. 최종 검증 결과와 기준일을 기록한다.


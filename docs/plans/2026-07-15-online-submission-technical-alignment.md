# Online Submission Technical Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 최신 기술 중심 사업계획서와 일치하는 온라인 접수 제목·주요내용 입력문안 DOCX와 PDF를 정확히 3페이지로 생성한다.

**Architecture:** 기존 `docx` 기반 생성기와 PDF 검증기를 유지하고, 필수 기술·개인 창업자 역량·최신 첨부파일명을 계약 검사로 먼저 고정한다. 생성기의 본문을 심사 균형형 구조로 개편한 뒤 Word로 PDF를 내보내고, 텍스트·링크·페이지 수·시각 품질을 단계별로 검증한다.

**Tech Stack:** Node.js, `docx`, Python 3.11, `pypdf`, PyMuPDF, Microsoft Word COM

---

### Task 1: 최신 입력문안 계약 검사 추가

**Files:**
- Modify: `scripts/validate_jeju_online_submission_lifecycle.py`

**Step 1: Write the failing test**

검증기의 필수 문구 목록에 다음 계약을 추가한다.

```python
REQUIRED_PHRASES = [
    "Python 기반 공공데이터 ETL",
    "PostgreSQL",
    "pg_trgm",
    "LLM Function Calling",
    "RAG",
    "Trust Engine",
    "중복 제출 방지",
    "React/Vite PWA",
    "FastAPI",
    "SQLAlchemy",
    "Vercel",
    "Railway",
    "AI 엔지니어링 정규 교육과정을 모두 이수",
    "공식 수료 절차",
    "60개 이상의 웹 서비스·프로토타입 저장소",
    "04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf",
]

FORBIDDEN_PHRASES = [
    "대표자",
    "팀 역량",
    "자동 수정",
    "04_제주를담다_최종_사업계획서.pdf",
]
```

기존 페이지 수 3, 서비스 URL, DOCX 하이퍼링크 검사도 유지한다.

**Step 2: Run test to verify it fails**

Run:

```powershell
$env:PYTHONPATH='C:\tmp\jeju-pdf-review'; python scripts/validate_jeju_online_submission_lifecycle.py
```

Expected: 기존 문서에 새 필수 기술 문구가 없어 FAIL.

**Step 3: Commit**

```powershell
git add scripts/validate_jeju_online_submission_lifecycle.py
git commit -m "[검증] 온라인 입력문안 기술 정합성 계약 추가"
```

### Task 2: 생성기 본문을 기술 중심 심사 균형형으로 개편

**Files:**
- Modify: `scripts/generate_jeju_online_submission_lifecycle.js`

**Step 1: Preserve the approved title**

```javascript
const titleValue = '여행으로 검증하고 다시 강화하는 제주 공공데이터, ‘제주를 담다’';
```

**Step 2: Rewrite page 1**

`제품·서비스 정의`, `핵심 기술·기능`, `공공데이터 활용` 순으로 구성한다. 기술 스택을 나열하는 데서 끝내지 않고 ETL→검색·공간 연결→하루방 조사→신뢰 점수→근거 원장의 데이터 흐름을 설명한다.

**Step 3: Rewrite page 2**

세 가지 플랜 생성 경로, 실제 여행 피드백 검토, 현재 MVP 검증, 개인 창업자 역량, 단계적 확장, B2C→B2B→B2G를 배치한다. `대표자`는 모두 `개인 창업자`, `신청자`, `개발자`로 교체한다.

**Step 4: Update page 3 guidance**

대표이미지 문구와 첨부파일 안내를 최신 기술 중심 사업계획서에 맞춘다. 서비스 URL은 `ExternalHyperlink`로 유지한다.

**Step 5: Generate DOCX**

Run:

```powershell
node scripts/generate_jeju_online_submission_lifecycle.js
```

Expected: 프로젝트 문서 폴더에 DOCX 생성.

**Step 6: Commit**

```powershell
git add scripts/generate_jeju_online_submission_lifecycle.js docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_라이프사이클_개정본.docx
git commit -m "[문서] 온라인 입력문안 기술 중심 개정"
```

### Task 3: PDF 생성과 자동 검증

**Files:**
- Create: `docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_라이프사이클_개정본.pdf`

**Step 1: Export DOCX to PDF**

Microsoft Word COM의 `ExportAsFixedFormat(..., 17)`을 사용한다.

**Step 2: Run contract validation**

Run:

```powershell
$env:PYTHONPATH='C:\tmp\jeju-pdf-review'; python scripts/validate_jeju_online_submission_lifecycle.py
```

Expected:

```text
pages: 3
required_missing: 0
forbidden_found: 0
uri_links: 1
PASS
```

**Step 3: Copy final deliverables**

생성된 DOCX와 PDF를 다음 이름으로 복사한다.

```text
C:\Users\USER\Desktop\제주를담다 공모전 자료\05_온라인접수_제목_주요내용_입력문안_최신본.docx
C:\Users\USER\Desktop\제주를담다 공모전 자료\05_온라인접수_제목_주요내용_입력문안_최신본.pdf
```

### Task 4: 시각·독자 검증

**Files:**
- Review: final PDF, all 3 pages

**Step 1: Render pages**

PyMuPDF로 PDF 3페이지를 PNG로 렌더링한다.

**Step 2: Inspect visual quality**

각 페이지에서 한글 깨짐, 표 잘림, 문단 겹침, 비정상 여백, 지나친 밀도, 제목 계층을 확인한다. 문제가 있으면 생성기의 간격·글자 크기·문단 길이를 조정하고 Task 2~3을 반복한다.

**Step 3: Run reader questions**

문서만 읽고 다음 질문에 답할 수 있는지 확인한다.

1. 이 서비스가 무엇인가?
2. 실제로 구현된 핵심 기술은 무엇인가?
3. 어떤 공공데이터를 어떻게 연결했는가?
4. 세 가지 플랜 경로는 무엇인가?
5. 여행 피드백이 어떻게 신뢰 데이터가 되는가?
6. 현재 MVP와 향후 기능의 경계는 무엇인가?
7. 신청자가 혼자 구현할 실행 역량이 있는가?
8. 사업화 경로는 무엇인가?

**Step 4: Final verification**

Run:

```powershell
git status --short
```

Expected: 의도한 생성기·검증기·계획·산출물 외의 변경 없음.

**Step 5: Commit generated PDF if tracked**

```powershell
git add docs/competition/2026-jeju-public-data-ai/05_온라인접수_제목_주요내용_라이프사이클_개정본.pdf
git commit -m "[문서] 온라인 입력문안 PDF 최신화"
```

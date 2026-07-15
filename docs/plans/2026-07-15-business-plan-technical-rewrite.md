# Business Plan Technical Rewrite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 주최 측 공식 목차에 맞춰 실제 핵심 기술·기능·서비스·특징이 도입부에서 명확히 드러나는 10페이지 사업계획서 DOCX·PDF를 완성한다.

**Architecture:** 기존 docx-js 생성기를 단일 문서 소스로 유지하되 10페이지 콘텐츠를 공식 평가 순서로 전면 재배치한다. 검증기는 실제 기술명, 개인 창업자 역량, 현재 MVP/고도화 경계, 금지 표현과 10페이지 계약을 검사하고, Word COM 변환 후 전 페이지 시각 점검을 수행한다.

**Tech Stack:** JavaScript, docx-js, Python, pypdf, PyMuPDF, Microsoft Word COM

---

### Task 1: 전면 개정 문서 계약을 실패 상태로 고정

**Files:**
- Modify: `scripts/validate_jeju_lifecycle_business_plan.py`

**Step 1: 새 필수 문구를 추가한다**

- 공식 목차: `1-1. 개발 서비스의 기능 및 특징`, `1-2. 공공데이터의 활용 적정성`, `1-3. 기존 서비스와의 차별성 및 독창성`, `2-1. 개발 제품 및 서비스를 활용한 창업 계획`, `2-2. 개발 제품 및 서비스의 사업화 계획`
- 실제 기술: `Python 기반 공공데이터 ETL`, `PostgreSQL`, `pg_trgm`, `LLM Function Calling`, `RAG`, `Trust Engine`, `idempotency key`, `React PWA`, `FastAPI`, `SQLAlchemy`, `Vercel`, `Railway`
- 역량: `AI 엔지니어링 정규 교육과정을 모두 이수`, `공식 수료 절차`, `60개 이상의 웹 서비스·프로토타입 저장소`

**Step 2: 금지 문구를 추가한다**

- `대표자`
- `DB에 있는 장소와 출처만 사용`
- `gpt-5-mini 하나를 자유 생성기가 아니라`
- 현재 MVP와 고도화 계획을 혼동하는 확정 과장 표현

**Step 3: 검증기를 실행해 실패를 확인한다**

Run: `python scripts/validate_jeju_lifecycle_business_plan.py`

Expected: 새 필수 문구 누락으로 FAIL.

**Step 4: 검증기 계약을 커밋한다**

```bash
git add scripts/validate_jeju_lifecycle_business_plan.py
git commit -m "[검증] 사업계획서 기술 중심 개정 계약 추가"
```

### Task 2: 1-1 기술·기능·서비스 도입부 재작성

**Files:**
- Modify: `scripts/generate_jeju_lifecycle_business_plan.js`

**Step 1: 1페이지 요약을 기술 중심으로 교체한다**

- 제품·서비스 정의
- 실제 기술 스택 한 줄
- 현재 MVP와 고도화 계획 구분

**Step 2: 2페이지에 전체 기술 아키텍처를 배치한다**

Flow: `React PWA → FastAPI API → 데이터·검색·하루방·Trust Engine → PostgreSQL 근거 원장 → Vercel/Railway`.

**Step 3: 3페이지에 데이터·검색 핵심 기술을 작성한다**

- Python ETL·정규화·체크섬 변경 감지
- PostgreSQL Full Text Search·GIN·pg_trgm
- 좌표 거리 기반 주차장·정류장 결합
- 기상청 예보 위험 신호 정규화
- pgvector는 고도화 기반으로만 표시

**Step 4: 4페이지에 AI·신뢰·원장 기술과 기능 흐름을 작성한다**

- LLM Function Calling·RAG 하루방
- 출처 역할·재시도·연구 상태
- 규칙 기반 Trust Engine과 주장 검증
- PlanItem/Evidence/VisitFeedback/ModerationCase/PublicDataCorrection
- idempotency key와 비파괴 버전 보정

**Step 5: 생성기 문법을 검사한다**

Run: `node --check scripts/generate_jeju_lifecycle_business_plan.js`

Expected: exit 0.

### Task 3: 1-2 공공데이터 활용과 1-3 차별성 재작성

**Files:**
- Modify: `scripts/generate_jeju_lifecycle_business_plan.js`

**Step 1: 5페이지 데이터 활용표를 작성한다**

각 데이터에 출처·원본 내용·획득·정제·기능·지속 활용을 표시한다.

**Step 2: 6페이지 라이프사이클을 작성한다**

`수집 → 정규화 → 검색·플랜 → 실제 여행 → 피드백 → 재검증·판정 → 버전 보정·신규 근거 → 다음 활용`.

**Step 3: 7페이지 차별성 비교표를 작성한다**

지도·여행 플랫폼, 일반 여행 AI, 공공데이터 포털, 후기·SNS, 단순 신고 시스템과 비교한다.

### Task 4: 2-1 개인 창업자 역량과 2-2 사업화 재작성

**Files:**
- Modify: `scripts/generate_jeju_lifecycle_business_plan.js`

**Step 1: 8페이지 개인 창업자 역량을 작성한다**

- AI 엔지니어링 정규 교육과정 이수 완료, 공식 수료 절차 전
- Python 데이터 처리·ML·LLM·RAG
- 60개 이상 웹 서비스·프로토타입 저장소
- 제품 기획부터 배포까지 반복 경험
- 제주를 담다 MVP 직접 설계·구현
- 직접 수행과 외부 협력 영역 구분

**Step 2: 9페이지 사업화·시장 진입을 작성한다**

- B2C→B2B→B2G 가치·수익 가설
- 조건형 콘텐츠→PWA→공유→피드백→로컬 파일럿→기관 PoC
- 행동 기반 검증 지표

**Step 3: 10페이지 실행 로드맵·위험·성과지표를 작성한다**

- MVP, 운영 기반, 신뢰 원장, 검증 순환, 기관 환류
- 개인정보·허위제보·1인 운영·외부 API 위험 대응
- 활용·현장·신뢰·환류·사업 지표

### Task 5: DOCX 생성과 자동 검증

**Files:**
- Modify: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.docx`

**Step 1: DOCX를 생성한다**

Run: `node scripts/generate_jeju_lifecycle_business_plan.js`

Expected: DOCX path 출력.

**Step 2: DOCX 패키지와 문구를 검사한다**

Run: `python scripts/validate_jeju_lifecycle_business_plan.py`

Expected: PDF가 이전 상태라면 새 계약 기준 FAIL 가능. DOCX 필수 문구는 모두 포함.

### Task 6: PDF 변환·시각 QA·독자 점검

**Files:**
- Modify: `docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf`

**Step 1: Word COM으로 PDF를 변환한다**

Expected: 10페이지 PDF.

**Step 2: 자동 검증기를 실행한다**

Run: `python scripts/validate_jeju_lifecycle_business_plan.py`

Expected: `pages=10`, 필수 문구 모두 포함, 금지 문구 0, URI link 1 이상.

**Step 3: PDF 10페이지를 전부 PNG로 렌더링한다**

PyMuPDF 1.5~1.7배율을 사용한다.

**Step 4: 전 페이지 시각 검사를 수행한다**

- 잘림·겹침·깨진 표·고아 제목 없음
- 한 페이지의 과도한 텍스트 밀도 없음
- 기술명과 쉬운 설명의 계층이 명확함
- 현재 MVP·고도화 라벨이 혼동되지 않음

**Step 5: 심사위원 독자 질문 체크리스트를 검증한다**

- 무엇을 개발했는가?
- 어떤 실제 기술로 작동하는가?
- 공공데이터는 어떻게 획득·가공·지속 활용하는가?
- 기존 서비스와 무엇이 다른가?
- 개인 창업자가 왜 실행할 수 있는가?
- 사업화와 고도화는 어떤 순서인가?

### Task 7: 최종 폴더 전달과 회귀 검증

**Files:**
- Copy: 최종 DOCX·PDF to `C:/Users/USER/Desktop/제주를담다 공모전 자료/`

**Step 1: 문서·생성기·검증기를 커밋한다**

```bash
git add scripts/generate_jeju_lifecycle_business_plan.js scripts/validate_jeju_lifecycle_business_plan.py docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.docx docs/competition/2026-jeju-public-data-ai/04_제주를담다_공공데이터_라이프사이클_사업계획서.pdf
git commit -m "[문서] 사업계획서 기술 중심 전면 개정"
```

**Step 2: 전체 백엔드 테스트를 실행한다**

Run: `python -m pytest -q`

Expected: 기존 통과 수 유지, 실패 0.

**Step 3: 바탕화면 폴더에 DOCX·PDF를 복사한다**

기존 파일명은 유지한다.

**Step 4: 원본과 전달본 SHA-256을 비교한다**

Expected: DOCX·PDF 모두 `HASH_MATCH=True`.

**Step 5: 전달본 PDF를 다시 열어 페이지 수와 필수 문구를 검증한다**

Expected: 10페이지, 새 기술 중심 문구 포함, 금지 문구 없음.

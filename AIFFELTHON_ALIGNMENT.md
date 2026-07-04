# AIFFELTHON_ALIGNMENT.md — 아이펠톤 심사 관점 정렬 문서

> 목적: 아이펠톤 5가지 관심축(제주 문화 · 신뢰도 · RAG · 방향성 · 킥 요소)에 대해 현재 프로젝트가 어디까지 와 있고, **1등을 위해 무엇을 더 해야 하는가**를 심사 시점에서 되짚는다.
> 이 문서는 실행 문서가 아니라 판단·정렬 문서다. 실행 세부는 `DEPLOYMENT_STATUS.md`, `PLAN_4DAYS.md`, `DEMO_PRESENTATION.md`에 있다.
> 스냅샷: 2026-07-05

---

## 0. 아이펠톤 주제와 우리 정의 (한 줄 대조)

| 아이펠톤이 요구하는 것 | 우리 프로젝트가 답하는 방식 |
|---|---|
| 제주 문화 | 제주 8종 "순간 카드" (오름/해변/노을/시장/식당/카페/곶자왈/감귤) — 지역 12값 · 동행자 5값 · 목적 5값과 조합 |
| 신뢰도 기반 | Trust Engine — fallback 4분기 + 배지 4종 + valid_until NOT NULL 스키마 강제 |
| RAG 기술 활용 | 두 층 RAG: (1) `/pack` 구조화 검색+LLM 조립 / (2) `/verify` 정통 RAG (LLM 분해 → retrieval → LLM 판정) |
| 검증 설계 | 골든셋 15문항 게이트 (`eval.py` exit(1)) + `/admin/metrics` 라이브 대시보드 |
| 로그 표시 | `query_log` 테이블 → 배지 분포·fallback 사유·p50/p95 지연을 `/admin/metrics`로 실시간 노출 |

핵심: **"제주 로컬 문화를 지어내지 않는 서비스"**. 카테고리 이탈(챗봇 아님), 흉내 불가(기존 실사용 앱의 진화), 엔지니어링 깊이(4분기·게이트) — 이 세 겹이 우리 방어선.

---

## 1. 지금 방향이 맞는가 — 자체 검증

### 1.1 강점 (심사에서 우리가 이길 지점)

- **인식론 규칙의 코드화**: "coverage_gap일 때 절대 '없다' 단언 금지 / contradicted만 적극 진술" 규칙이 문서로만 있지 않고 `trust.py`의 배지 판정과 `assemble.py`의 문구 템플릿에 실제로 박혀 있음. 이건 20팀 중 흉내 어려운 지점.
- **스키마가 원칙을 강제**: `place.valid_until NOT NULL` — 유효기간 없는 데이터는 DB에 들어가지도 못함. "말이 아니라 스키마로 증명."
- **정직한 실패를 데모에 편입**: G05(감귤×7월 = 시즌 아님), G11(우도×카페 = coverage_gap), G14(폐업 리뷰 = contradicted) — 실패 케이스가 버그가 아니라 킥이 되는 구조.
- **기존 실사용 앱의 진화**: 4일 만에 만든 게 아니라 4일 만에 신뢰 엔진을 이식한 것. 첫 화면부터 완성도가 다르게 보인다.
- **query_log가 라이브 대시보드로 곧장 연결**: 발표하는 동안 심사위원이 QR로 들어와서 만든 요청이 그대로 `/admin/metrics`에 집계 — 킥4의 실체.

### 1.2 방향 리스크 (심사에서 우리가 질 수 있는 지점)

| 리스크 | 심사위원 질문 예상 | 현 상태 | 대응 |
|---|---|---|---|
| **"이게 정말 RAG인가?"** | `/pack`은 SQL WHERE로만 필터함. `place.embedding vector(1536)` 컬럼은 있지만 실제 검색에 안 씀. | 구현: `search.py` 벡터 유사도 미사용 | (a) 프론트/설명에서 **`/verify`를 정통 RAG로 명확히 배치**. (b) `/pack`은 "구조화 필터 + LLM 조립"이라고 정직하게 명명 — RAG의 R은 있지만 벡터가 아님을 오히려 설계 판단으로 설명 |
| **"카카오/네이버 없이 어떻게 실용?"** | 대중 리뷰가 없으면 정보량이 얕지 않냐 | D-08 결정: 공공데이터만 | "리뷰는 검증 대상이지 근거가 아닙니다. `/verify`에 카카오 리뷰 붙여넣기 데모로 답합니다." |
| **"커버리지가 좁다"** | 4,422건이면 실제 여행 커버 가능? | place 4,422건, transit_point 0건, hygiene 0건 | coverage_gap 로그 → 데이터 보강 우선순위. "시스템이 스스로 부족한 곳을 압니다"로 반전 |
| **"챗봇이 대세 아닌가?"** | 다른 20팀은 챗봇일 것 | 우리는 폼 기반 | "챗봇은 '뭔가를 지어내는' 압박이 있습니다. 폼은 검색 필터를 이미 제공하므로 LLM이 사실 생성 권한을 안 가져도 됩니다." |

### 1.3 결론

방향은 맞다. 다만 **"RAG인가"의 반론**에 대비해 발표에서 `/verify` 파이프라인을 정통 RAG로 명확히 부각해야 한다 (§3 킥1 참조). `/pack`은 "구조화 검색 + LLM 조립"으로 정직하게 명명하는 것이 오히려 승부수가 된다.

---

## 2. 지금까지 완료된 작업 (2026-07-04~05 세션)

### 2.1 인프라·배포 (프로덕션 완료)
- Railway `skillful-alignment / production` 프로젝트에 pack-your-jeju API + Postgres 배포
- API 도메인: `https://pack-your-jeju-production.up.railway.app`
- `/health`·`/pack`·`/admin/metrics` 프로덕션 검증 완료 (응답 `verified` 배지 정상)
- Startup lifespan에서 `packages/schema/init.sql` idempotent 자동 부트스트랩 (신규 Railway 프로젝트도 스키마 수동 적재 불필요)
- `DATABASE_URL` psycopg3 dialect 자동 정규화 (Railway가 주는 `postgresql://`을 `postgresql+psycopg://`로)

### 2.2 데이터 (부분 완료)
- ✅ 비짓제주 5,756건 raw → 4,422건 place (`ingest_visitjeju --fetch-all` + `process`)
- ❌ `transit_point` 0건 (주차장 / 정류장 CSV 미적재)
- ❌ 위생등급 CSV 미적재 (`local_food` 배지 세분화 안 됨)
- ❌ 수정요청 CSV 미적재 (`has_fix_request` 플래그 미갱신 → G09 시나리오 대비 안 됨)

### 2.3 Trust Engine (코드 완료, 프로덕션 검증 부분 완료)
- ✅ `filters.py` — 폼 → 검색 필터 (LLM 없음)
- ✅ `search.py` — strict / relaxed 2단 검색, 지역 확대 완화 재시도
- ✅ `trust.py` — fallback 4분기 + 배지 4종 판정
- ✅ `assemble.py` — 템플릿 폴백 + LLM 옵션 (OPENAI_API_KEY 없어도 동작)
- ✅ `verify.py` — 킥1 파이프라인 코드 존재
- ⚠️ `/verify` 프로덕션 스모크 미실시 — 킥1 시연 전 반드시 필요

### 2.4 관측 (완료)
- ✅ `query_log` 적재 (배지 분포 · fallback 사유 · 지연)
- ✅ `/admin/metrics` (p50=12ms 확인)

---

## 3. 킥 요소 4종 상태 점검 (DEMO_PRESENTATION §2 대조)

| 킥 | 정체 | 현 상태 | 남은 작업 |
|---|---|---|---|
| **킥1 — AI가 AI를 팩트체크** | `/verify` (LLM claim 분해 → retrieval → LLM 판정) | ✅ **프로덕션 3-verdict 재현 완료** (contradicted/verified/coverage_gap). 데모 대본 확정: `data/verify_kick1_g14.json` | — |
| **킥2 — 자가파괴** | 드롭됨 (D-15) | — | Q&A용 eval 실패 로그 캡처만 준비 |
| **킥3 — 1,686건의 증거** | 수정요청 CSV 분석 → 오프닝 슬라이드 숫자 | ✅ **CSV 적재됨: 1,686행 → 556 place에 `has_fix_request=true` 매칭**. ⚠️ 유형 분포(폐업/이전/변경)는 미분석 | 유형별 카운트 뽑고 오프닝 슬라이드 1장. **핵심 숫자 두 개는 확정**: 1,686 (제기 건수) · 556 (실제 매칭) |
| **킥4 — QR + 라이브 대시보드** | Vercel 프론트 QR → 발표 중 심사위원 요청이 `/admin/metrics`에 실시간 반영 | ✅ **완결**: `pack-your-jeju.vercel.app` Online, QR `docs/qr.png` 생성, 5종 배지 실 데이터 회전 중 (p50=13ms) | 슬라이드 삽입 · 발표장 Wi-Fi 사전 스캔 테스트 |

**결론**: 킥1·킥4 완결. 킥3은 오프닝 숫자 확정, 유형 분포 시각화만 마무리 남음. 발표 준비의 핵심 조각은 모두 실 데이터로 살아있는 상태.

---

## 4. 가장 중요한 4축 자기평가

### 4.1 데이터 준비
- ✅ 주력 소스(비짓제주) 5,756건 → 4,422 place
- ✅ 스키마 강제(`valid_until NOT NULL`, `region_normalized` 12값 매핑, `info_type` 3종)
- ✅ **수정요청 CSV 적재 완료: 1,686행 → 556 place에 `has_fix_request=true`**
- ✅ G14 데모 시드: `애월오누이 제주` `tombstoned=true` (골든셋 사전 정의 시나리오와 일치)
- ⚠️ **보조 소스 2종 미적재**: transit_point(주차장·정류장), hygiene(위생등급)
- **평가**: 80% 완성. 킥3 오프닝 숫자·G09(수정요청 caution)·G14(폐업 contradicted) 모두 활성. 남은 것은 교통 배지(🚗🚌)와 위생등급 세분화.

### 4.2 RAG 설계
- ✅ `/pack` 구조화 검색 + LLM 문구 조립 (assemble.py의 intro)
- ✅ `/verify` 정통 RAG (LLM 분해 → retrieval → LLM 판정)
- ⚠️ 임베딩 벡터 검색(`place.embedding`)은 컬럼만 존재, **실 검색에 미사용** — 이 상태 유지가 낫다 (구조화 필터가 이미 정답을 좁힘) 하지만 발표에서 **의도적 판단**임을 설명해야 함
- **평가**: 설계는 완결. 명명(`/pack`은 검색+조립, `/verify`는 정통 RAG) 정직하게 발표해야 강점.

### 4.3 검증 설계 (게이트)
- ✅ 골든셋 12문항 (문서에서 언급된 `FILL_ME`는 실제 파일엔 없음 — 처음부터 정성 기준 방식으로 확정 상태였음)
- ✅ `packages/eval/run.py` 러너 완성 + 지표 3종 임계 + `exit(1)` 로직
- ✅ **최근 실행 결과: 12/12 통과, 3지표 모두 1.00** — 게이트 GREEN
- ✅ 리포트 파일 저장 (`data/eval-reports/eval-*.md`) — 발표 캡처 소스
- ✅ 코드 변경 시 재실행 정착: `/verify` 판정 순서 개선 후에도 GREEN 유지
- **평가**: 100% 완성. "미달 시 배포 차단" 서사를 실행 가능한 상태로 보유.

### 4.4 로그 기록·표시
- ✅ `query_log` 자동 적재 (`badge_counts`, `fallback_reasons`, `latency_ms`)
- ✅ `/admin/metrics` 프로덕션 정상 (window_hours 파라미터로 최근 N시간 집계)
- ✅ p50/p95 지연·배지 분포·fallback 사유 3종 지표 모두 제공
- ⚠️ 프론트 시각화 없음 — 대시보드 화면이 있으면 클로징 인상 강화. 현재는 JSON만.
- **평가**: 80% 완성. JSON 응답을 발표용 뷰(간단한 표라도)로 렌더링하면 킥4 임팩트 배가.

---

## 5. 1등을 위한 우선순위 로드맵

### P0 — 발표 실패 방지 (완료 ✅ 2026-07-05)
- [x] **`/verify` 프로덕션 스모크** — 3-verdict 재현 완료 (contradicted/verified/coverage_gap). 대본 `data/verify_kick1_g14.json` 확정.
- [x] **수정요청 CSV 적재** — 1,686행 → 556 place. 오프닝 숫자 확보.
- [x] **골든셋 상태 파악** — `FILL_ME`는 실제로 없음. 정성 기준 방식으로 이미 완성 상태.
- [x] **eval 러너 실행 + 리포트 캡처** — 12/12 GREEN, 3지표 1.00, `data/eval-reports/eval-*.md` 저장.
- [x] **G14 tombstone 시드** — `애월오누이 제주` `tombstoned=true` (킥1 하이라이트 재현).

### P1 — 시연 품질
- [x] **Vercel 프론트 배포** — `pack-your-jeju.vercel.app` Online, pack 응답 실 렌더링 확인.
- [x] **CORS 정합성** — `.vercel.app` regex가 이미 커버 → 별도 갱신 불필요.
- [x] **킥4 QR 생성** — `docs/qr.png` (370×370).
- [ ] **transit_point CSV 적재** (주차장 · 정류장) — 응답에 🚗🚌 배지 실제로 뜨게.
- [ ] **Railway Auto Deploy 정상화** — 현재 "GitHub Repo not found" 상태. Source Disconnect/Reconnect 또는 Eject. `git push`만으로 배포 반영이 목표.

### P2 — 완성도 향상
- [ ] **위생등급 CSV 적재** — `local_food` 배지 세분화
- [ ] **`OPENAI_API_KEY` Railway 세팅** — `intro.llm_used: true`. 감성 문구 활성화.
- [ ] **킥3 유형별 카운트** — 수정요청 CSV의 폐업/이전/변경 유형 분포. 오프닝 슬라이드 세부 숫자.
- [ ] **`/admin/metrics` 프론트 뷰** — JSON을 간단한 표로 렌더. 클로징 인상 배가.

### P3 — Q&A 방어 및 발표 준비
- [ ] **"이게 RAG인가" 답변 완성** — `/verify` 파이프라인 다이어그램 1장. "벡터 없이도 RAG는 성립한다" 논리.
- [ ] **전 구간 스크린 녹화** — 발표장 네트워크 불안 대비 (킥1 · `/pack` · `/admin/metrics`)
- [ ] **eval 실패 로그 스크린샷** — 킥2 대체용 (Q&A에서 요구 시)

---

## 6. 심사 항목별 자기 점검표 (리허설 필수)

- [ ] 문제 정의가 실증 데이터(수정요청 N,NNN건)로 시작되는가 → **킥3 슬라이드 완성 여부**
- [ ] 데모에서 성공 장면 + **정직한 실패 장면**(G05/G11)이 둘 다 나오는가
- [ ] 기술 깊이(4분기·게이트)가 말이 아니라 화면/로그로 증명되는가 → **eval 결과 캡처 + `/admin/metrics` 라이브**
- [ ] "RAG인가?"에 답할 문장이 30초 안에 나오는가 → `/verify` 파이프라인 그림 준비
- [ ] "이미 존재하는 앱의 진화"라는 서사가 오프닝과 클로징에 모두 걸리는가
- [ ] 확장 로드맵(지역 팩 아키텍처 · 다국어 · 플랜 검증)이 마지막 슬라이드에 명확한가

---

## 7. 1등을 위한 3가지 판단

### (1) 발표 서사를 "카테고리 이탈"로 잡는다
챗봇을 만든 팀들과 같은 리그에서 싸우면 진다. 우리는 "여행 준비 프로덕트에 신뢰 엔진을 심었다" — 다른 리그다. 오프닝 30초 안에 이 포지셔닝을 박아야 한다.

### (2) 정직한 실패 장면을 반드시 라이브로 보여준다
G05(감귤×7월)와 G11(우도×카페)는 버그가 아니라 킥이다. 여기서 심사위원이 "오, 이거 다르네"라고 느끼면 그 뒤 모든 설명이 편해진다. 반대로 이 두 장면을 스킵하면 "그냥 잘 검색되는 앱"이 된다.

### (3) `/verify`를 정통 RAG로 못 박는다
아이펠톤 심사 관점에서 RAG 요건 대응이 애매하면 감점 크다. 킥1의 30초를 아껴서 "이게 RAG입니다: LLM이 문장을 분해 → 우리 DB에서 근거를 찾음 → LLM이 다시 판정. 사실 생성은 없습니다"를 명확히 진술한다.

---

## 8. 참조 문서 위치

- 프로젝트 헌법 · 절대 규칙: `CLAUDE.md`
- 제품 요구사항: `PRD.md`
- 신뢰 엔진 스펙 (권위): `TRUST_ENGINE.md`
- 순간 카드 8종 스펙: `MOMENT_CARDS.md`
- 데이터 소스·수집·스키마: `DATA_PIPELINE.md`
- 골든셋 게이트 스펙: `EVAL_GOLDENSET.md`
- 4일 실행 체크리스트: `PLAN_4DAYS.md`
- 확정 의사결정 로그: `DECISIONS.md`
- 발표·데모·우승 전략: `DEMO_PRESENTATION.md`
- 배포 상태 스냅샷: `DEPLOYMENT_STATUS.md`
- Railway/Vercel 배포 가이드: `docs/deploy.md`

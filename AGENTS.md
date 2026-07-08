# AGENTS.md — Pack Your Jeju 작업 헌법

이 문서는 Codex가 이 저장소에서 작업할 때 항상 따라야 하는 규칙이다.

## 프로젝트 정체성

- **Pack Your Jeju**: 제주 특화 여행 준비 서비스. 사용자가 (지역·기간·동행자·목적·순간카드)를 선택하면, 공공데이터 근거로 검증된 장소·음식·교통 정보를 "팩"으로 조립해 반환한다.
- 핵심 철학: **근거 없이 답하지 않는다.** 억지로 채우는 것보다 정직한 "확인 불가"가 낫다.
- 이 프로젝트는 4일짜리 해커톤 출품작이다. **완성도 > 기능 수.** 스코프를 늘리는 제안은 하지 말 것.

## 절대 규칙 (위반 금지)

1. **환각 금지 설계**: LLM이 장소명·주소·운영시간 등 사실 정보를 생성하게 하는 코드를 절대 작성하지 않는다. 사실 정보는 반드시 DB(place/food/transit)에서 조회한 값만 사용하고, LLM은 조회된 근거의 요약·조립·판정에만 쓴다.
2. **fallback 4분기 준수**: 결과가 없을 때 뭉뚱그린 "정보 없음"을 반환하지 않는다. 반드시 `fallback_reason ∈ {out_of_scope, coverage_gap, retrieval_miss, contradicted}` 중 하나로 분류한다. (상세: TRUST_ENGINE.md)
3. **"없다" 단언 금지**: coverage_gap일 때 응답 문구는 항상 "저희가 참조하는 공공데이터 기준으로 확인되지 않습니다" 형태. "그런 곳은 없습니다"라고 쓰지 않는다. contradicted(반증 존재)일 때만 "폐업/변경이 확인됩니다"라고 적극 진술한다.
4. **원본 앱 보호**: Pack Your Moment 원본 코드/DB를 수정하지 않는다. 이 저장소는 독립 에디션이다.
5. **모델 고정**: LLM은 `gpt-5.3-mini` 하나만 사용. Gateway 추상화·모델 스왑 코드를 만들지 않는다. GPT-5 계열은 `max_completion_tokens` 파라미터를 사용한다.
6. **LLM 없이도 동작**: `OPENAI_API_KEY` 미설정 시 조립 문구는 템플릿 폴백으로, 검증 판정은 규칙 기반으로 동작해야 한다 (데모 안전판).

## 스코프 가드 (4일 프로젝트라 하지 않는 것)

- ❌ Blue/Green 실물 인프라, Prefect, Langfuse, canary — 대신 골든셋 러너 스크립트(`eval.py`) 하나로 게이트 개념만 유지
- ❌ 실시간 교통/경로 추천 — 교통은 접근성 검증(주차장·정류장 존재 확인)만
- ❌ Google Maps 연동 — 제주 지역 선택 UI로 대체됨 (스트레치로도 우선순위 최하)
- ❌ 멀티턴 대화, Self-Query LLM 추출 — 폼 입력이 이미 구조화 필터를 제공
- ❌ 카카오/네이버 리뷰를 추천 근거로 사용 — 검증 데모의 **입력값**으로만 허용

## 저장소 구조 (MAP)

```
pack-your-jeju/
├── AGENTS.md, DECISIONS.md, ...        # 이 문서 스위트
├── apps/
│   ├── api/                            # FastAPI
│   │   ├── main.py                     # /pack, /verify, /health, /admin/metrics
│   │   ├── engine/
│   │   │   ├── filters.py              # 폼 입력 → 검색 필터 변환
│   │   │   ├── search.py               # place_search / food_search / transit_check
│   │   │   ├── trust.py                # fallback 4분기 판정, 배지 산출
│   │   │   ├── assemble.py             # pack_result 조립 (+ LLM 문구 생성, 폴백 템플릿)
│   │   │   └── verify.py               # /verify: claim 분해 → 검증 (킥1 데모)
│   │   └── logging.py                  # query_log (fallback_reason 포함)
│   ├── pipelines/
│   │   ├── ingest_visitjeju.py         # API 수집 (probe → 증분)
│   │   ├── ingest_file.py              # 위생등급/주차장/정류장/수정요청 CSV 적재
│   │   └── process.py                  # 정규화, info_type, valid_until
│   └── web/                            # Next.js — 기존 Pack Your Moment UI 제주판
├── packages/
│   ├── schema/init.sql                 # 권위 DDL
│   └── eval/
│       ├── golden_set.jsonl            # 15문항
│       └── run.py                      # 게이트: 미달 시 exit(1)
└── docker-compose.yml                  # postgres + pgvector
```

## 코딩 컨벤션

- Python 3.11+, FastAPI, SQLAlchemy(Core 수준이면 충분), pgvector.
- 프론트는 기존 Pack Your Moment 스택을 따른다 (React/Next.js). 기존 컴포넌트 재사용 우선, 신규 생성 최소.
- 함수는 작게, 파일당 한 책임. 주석은 "왜"만 적는다.
- 환경변수: `.env` (`OPENAI_API_KEY`, `VISITJEJU_API_KEY`, `DATABASE_URL`).
- 에러는 삼키지 않는다. 특히 수집 파이프라인은 실패 시 직전 스냅샷을 유지하고 abort.

## 작업 흐름 규칙

- 새 결정이 필요하면 먼저 `DECISIONS.md`를 확인하고, 기존 결정과 충돌하면 코드가 아니라 사람에게 물어본다.
- 기능 구현 전 해당 스펙 문서(TRUST_ENGINE.md / MOMENT_CARDS.md / DATA_PIPELINE.md)를 읽는다.
- Day 종료 기준(PLAN_4DAYS.md)을 넘기는 야심찬 리팩토링을 제안하지 않는다.
- 커밋 메시지: `[역할] 요약` (예: `[trust] fallback 4분기 판정 구현`).

## 데모 안전판 체크리스트 (모든 기능 공통)

- [ ] API 키가 없어도 서버가 뜨고 데모 시나리오가 동작하는가
- [ ] 외부 API 실패 시 캐시/시드 데이터로 폴백하는가
- [ ] 응답에 배지·fallback_reason이 항상 포함되는가

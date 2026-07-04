# TRUST_ENGINE.md — 신뢰 엔진 스펙

> 이 문서가 `apps/api/engine/` 전체의 권위 스펙이다.
> 핵심: LLM은 사실을 만들지 않는다. DB가 사실을 대고, LLM은 조립과 판정만 한다.

## 1. 파이프라인 개요

```
/pack 요청
  → filters.py   : 폼 입력 → 검색 필터 (LLM 불필요 — 폼이 이미 구조화됨)
  → search.py    : moment별 병렬 검색 (place_search / food_search / transit_check)
  → trust.py     : 항목별 배지 판정 + 섹션별 fallback 4분기
  → assemble.py  : pack_result 조립 (+선택적 LLM 문구, 실패 시 템플릿)
  → logging.py   : query_log 적재
```

## 2. fallback 4분기 (판정 순서 중요)

| reason | 정의 | 판정 신호 | 사용자 문구 |
|---|---|---|---|
| `out_of_scope` | 제주/여행 범위 밖 | region이 선택 UI 밖 값 (사실상 발생 불가하나 /verify에서 발생 가능) | "제주 여행 정보 범위 밖입니다" |
| `contradicted` | **반증 존재** | tombstone=true 또는 수정요청에 폐업/이전 명시 | "폐업/변경이 **확인됩니다**" (유일하게 단언 허용) |
| `retrieval_miss` | DB에 있는데 못 찾음 | 후보 0건 아님 + 저점수 → **완화 검색 1회 재시도 후에도** 실패 | (사용자 노출 전 재시도로 해소 시도) |
| `coverage_gap` | 데이터에 없음 | 재시도 후에도 후보 없음 + 해당 지역·카테고리 커버리지 통계 확인 | "저희가 참조하는 공공데이터 기준으로 확인되지 않습니다" |

**인식론 규칙**: `coverage_gap`은 절대 "없다"고 단언하지 않는다 (우리 DB ≠ 세계 전체). `contradicted`만 적극 진술.

### 판정 의사코드 (trust.py)

```python
def judge_section(moment: str, filters: Filters, candidates: list[Item]) -> Section:
    # 0. 반증 우선: tombstone/폐업 플래그가 걸린 앵커가 질의에 직접 매칭되면
    if anchor := find_contradicted_anchor(moment, filters):
        return Section(items=[], fallback=Fallback("contradicted", anchor.evidence))

    # 1. 후보 있음 → 항목별 배지
    if candidates:
        return Section(items=[badge_item(c, filters) for c in candidates], fallback=None)

    # 2. 후보 없음 → 완화 재시도 1회 (지역 확대: 읍면동 → 시 단위)
    relaxed = search_relaxed(moment, filters)
    if relaxed:
        return Section(items=[badge_item(c, filters, note="인근 지역 결과") for c in relaxed])

    # 3. 그래도 없음 → coverage_gap (커버리지 통계를 로그에 첨부)
    stats = coverage_stats(filters.region, moment)   # 해당 지역·카테고리 건수
    return Section(items=[], fallback=Fallback("coverage_gap", stats=stats))
```

## 3. 배지 판정 (항목 단위)

| badge | 조건 |
|---|---|
| `verified` 🔵 | place 존재 + `valid_until > 여행일` + tombstone=false + 수정요청 플래그 없음 |
| `caution` ⚠️ | 존재하지만 (수정요청 이력 있음) or (요청 속성 결측 — 예: 아이 동반인데 키즈 정보 없음) or (valid_until 임박) |
| `contradicted` × | tombstone=true 또는 폐업/이전 반증 |
| `reference` 🟠 | 공공데이터 검증이 아닌 참고 정보 (스트레치: 대중 평점). **verified와 시각적으로 명확히 분리** |

```python
def badge_item(c: Item, f: Filters) -> BadgedItem:
    if c.tombstoned:                       return with_badge(c, "contradicted")
    if c.valid_until <= f.trip_end:        return with_badge(c, "caution", "정보 유효기간 경과/임박")
    if c.has_fix_request:                  return with_badge(c, "caution", "이용자 정보 수정요청 이력")
    if missing_required_amenity(c, f):     return with_badge(c, "caution", f"{f.companion} 관련 정보 미확인")
    return with_badge(c, "verified")
```

## 4. Freshness 규칙 (info_type)

| info_type | 대상 | valid_until 규칙 |
|---|---|---|
| `static` | 주소, 시설, 상시 관광지 | 수집일 + 90d |
| `seasonal` | 해수욕장 개장, 감귤 체험, 축제 | 시즌 종료일 (못 채우면 **place에 넣지 않음**) |
| `periodic` | 오일장 | 주기 규칙(예: 2·7일) 별도 컬럼 — 여행 날짜와 대조해 개장일 계산 |

## 5. LLM 사용 범위 (gpt-5.3-mini)

| 용도 | 입력 | 출력 | 폴백 |
|---|---|---|---|
| 팩 소개 문구 | 검증된 항목들 + 순간·동행자 | 2~3문장 감성 문구 (**새 사실 추가 금지** 프롬프트 명시) | 템플릿 문구 |
| /verify claim 분해 | 리뷰 원문 | `{claims:[{text}]}` JSON | 문장 분리 규칙(마침표) |
| /verify 판정 보조 | claim + 검색 근거 | supported/unsupported/contradicted | 키워드 매칭 규칙 |

프롬프트 공통 규칙: "제공된 데이터에 없는 장소명·수치·시간을 만들지 마라. JSON 외 출력 금지."
GPT-5 계열 파라미터: `max_completion_tokens` 사용.

## 6. /verify (킥1 데모)

```
입력 리뷰 텍스트
  → claim 분해 (LLM, 폴백: 문장 분리)
  → claim별: 장소명 추출 → place fuzzy 매칭
      매칭 성공 + 일치       → verified
      매칭 성공 + 정보 상충   → outdated/contradicted (수정요청·tombstone·valid_until 근거)
      매칭 실패             → coverage_gap ("공공데이터에서 확인되지 않음")
  → 문장별 판정 + 출처 반환
```

## 7. query_log 스키마 (logging.py)

```sql
CREATE TABLE query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,              -- pack | verify
  request JSONB NOT NULL,
  badge_counts JSONB,                  -- {"verified":3,"caution":1,...}
  fallback_reasons TEXT[],             -- 섹션별 사유
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

`/admin/metrics`는 이 테이블 집계만으로 구현 (킥4 데모 소스).

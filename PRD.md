# PRD — Pack Your Jeju

## 1. 한 줄 정의

여행자가 (제주 지역 · 기간 · 동행자 · 목적 · 순간 카드)를 선택하면, **공공데이터로 검증된** 장소·음식·교통 정보와 그에 맞는 짐 체크리스트를 하나의 "팩"으로 조립해 주는 서비스.

## 2. 문제와 해결

- 문제: 여행 정보의 상당수는 유통기한이 지났다(폐업 맛집, 끝난 축제). 공식 포털 비짓제주에조차 이용자 정보 수정요청이 1,686건 쌓여 있다. 일반 LLM은 이를 그럴듯하게 지어낸다.
- 해결: 근거 있는 것만 보여주고, 없으면 정직하게 "확인 불가"라고 말하는 여행 준비 도구. **못 채우는 항목이 나오는 것이 버그가 아니라 정직함의 증거.**

## 3. 사용자 플로우 (기존 3화면 유지)

### 화면 ① 여행 계획하기 (기존 폼, 제주판 수정)
| 필드 | 변경 | 신뢰 엔진 매핑 |
|---|---|---|
| 여행지 | 텍스트 검색 → **제주 지역 선택 UI** (제주시/서귀포/애월/한림/성산/조천/구좌/안덕/대정/표선/남원/우도) | `region_normalized` 1:1 |
| 출발일/기간 | 유지 | `valid_until` 감쇠 기준 시점 |
| 동행자 (혼자/연인/친구/가족/아이/부모님) | 유지 | `companion` → amenities 필터 (키즈·접근성 등) |
| 목적 (힐링/관광/식도락/액티비티/호캉스) | 유지 | `purpose` → category 라우팅 |
| 해외여행 토글 | **데모 빌드에서 숨김** (삭제 아님) | — |

### 화면 ② 순간 고르기 (제주 전용 카드로 전면 교체)
- 카드 목록·데이터 매핑은 **MOMENT_CARDS.md**가 권위 문서.
- 카드 선택(다중) = 검증 대상 질의. "준비과정 비밀가방 받기" 버튼 → `/pack` 호출.

### 화면 ③ 대시보드 (기존 레이아웃 + 배지)
- 순간별 섹션에 **검증된 장소 카드**: 장소명 + 배지 + 출처 링크 + 교통 배지(🚗/🚌).
- MOMENT SECRET TIP 자리: 근거 있는 팁만 노출, 없으면 fallback 문구.
- 짐 체크리스트: 기본 리스트 유지 + **근거 기반 제주 특화 항목** 추가 (예: "선택하신 오름 코스는 비포장 구간 확인 → 운동화 필수 🔵").

## 4. API 계약

### POST `/pack`
```jsonc
// 요청
{
  "region": "aewol",              // 지역 선택 UI 값
  "start_date": "2026-07-03",
  "days": 3,
  "companion": "family",          // solo|couple|friend|family|kids|parents
  "purpose": "healing",           // healing|sightseeing|food|activity|hocance
  "moments": ["oreum", "local_market", "sunset"]   // MOMENT_CARDS.md의 card_id
}
```
```jsonc
// 응답
{
  "pack_id": "...",
  "sections": [
    {
      "moment": "oreum",
      "items": [
        {
          "name": "새별오름",
          "badge": "verified",              // verified|coverage_gap|contradicted|reference
          "sources": [{"name":"비짓제주","url":"..."}],
          "freshness": {"info_type":"static","valid_until":"..."},
          "transit": {"parking": true, "parking_count": 2, "bus_walkable": false}
        }
      ],
      "fallback": null                       // 또는 {reason, message}
    },
    {
      "moment": "quiet_cafe",
      "items": [],
      "fallback": {
        "reason": "coverage_gap",
        "message": "저희가 참조하는 공공데이터 기준으로 이 지역에서 확인된 곳이 없습니다."
      }
    }
  ],
  "packing_additions": [
    {"item":"운동화","reason":"오름 비포장 구간 확인","badge":"verified","source":"..."}
  ],
  "log_id": "..."
}
```

### POST `/verify` (킥1 데모용)
- 입력: `{ "text": "카카오/블로그 리뷰 원문" }`
- 처리: claim 분해(LLM) → claim별 place/food 검색 → 판정.
- 출력: 문장별 `{text, verdict: verified|outdated|coverage_gap|contradicted, sources[]}`.

### GET `/admin/metrics` (킥4 데모용)
- 최근 요청 수, 배지 분포, fallback_reason 분포, p95 지연. 단일 쿼리 수준으로 최소 구현.

## 5. 비기능 요구

- `/pack` p95 < 4초 (LLM 문구 생성 포함). LLM 타임아웃 시 템플릿 문구 폴백.
- API 키 없이 데모 시나리오 완주 가능 (시드 데이터 + 규칙 기반 판정).
- 모든 응답에 log_id → query_log 적재 (fallback_reason 포함).

## 6. 하지 않는 것 (스코프 밖)

경로 추천, 실시간 혼잡도, 예약/결제, 다국어 UI(발표 언급만 — 비짓제주 en/cn/jp locale로 확장 가능), Google Maps, 멀티턴 챗.

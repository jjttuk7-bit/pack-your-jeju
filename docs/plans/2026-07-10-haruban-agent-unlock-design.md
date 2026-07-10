# Haruban Agent Unlock Design

## Goal

프리아이펠톤 발표 이후 하루방 에이전트를 데모 보조 챗봇에서 대화형 여행 조율 에이전트로 확장한다. 사용자는 폼을 직접 다루지 않아도 하루방에게 팩 생성, 리뷰 검증, 지역 비교, 폼 보강 제안을 물을 수 있어야 한다.

## Non-Negotiables

- 장소명, 주소, 운영시간, 후보 수, 날씨 신호 같은 사실 정보는 DB/API 도구 결과만 사용한다.
- gpt-5-mini는 사용자 의도 해석, 도구 선택, 근거 요약, 답변 문장 조립에만 사용한다.
- `fallback_reason` 4분기와 coverage_gap 문구 원칙을 유지한다.
- `OPENAI_API_KEY`가 없어도 서버와 기본 답변 폴백은 동작해야 한다.

## Recommended Approach

기존 API 기능을 하루방 도구로 연결한다. 새 검색 체계나 자유 여행 지식 베이스를 만들지 않고, 이미 검증된 `/pack`, `/verify`, `/agent/augment`, 날씨, 커버리지, 장소 상세 흐름을 대화 중 실행 가능한 도구로 묶는다.

이 방식은 사용자가 체감하는 능력은 크게 늘리면서도, 프로젝트의 핵심인 "근거 없이 답하지 않는다" 원칙을 유지한다.

## Tool Expansion

### `build_pack`

현재 폼 상태 또는 대화에서 추론한 조건으로 여행팩을 조립한다. 내부적으로 `filters.build_filters`, `trust.judge_section`, `assemble.compose_intro`, `assemble.dispatch_itinerary`, `weather.smoke_kma_nowcast`를 재사용한다.

응답에는 섹션별 대표 후보, fallback, 날씨 요약, 일정 요약만 담는다. 전체 `/pack` 응답을 그대로 대화에 노출하지 않는다.

### `verify_review`

사용자가 붙여넣은 리뷰, 블로그 문장, 외부 주장 텍스트를 `verify.verify_text`로 검증한다. 결과는 문장별 `verified`, `contradicted`, `coverage_gap`, `outdated` 톤으로 설명한다.

### `preview_region_coverage`

지역 하나 또는 여러 개에 대해 어떤 순간 카드가 강하고 어떤 조합이 비어 있는지 설명한다. 기존 `region_coverage.build_region_preview`와 검색 카운트만 사용한다.

### `suggest_form_augment`

현재 폼 상태를 바탕으로 더 좋은 지역, 순간, 조건 보강안을 제안한다. 기존 `augment.build_augment` 결과를 대화형 문장으로 정리하고, 실제 폼 변경은 사용자 승인 후 프론트가 처리한다.

## Existing Tools To Keep

- `search_places`: 구체적인 후보 목록, 한 곳 추천, 후보 수 질문
- `get_place_detail`: 특정 장소 상세, 수정요청, 주차장/정류소 확인
- `weather_signal`: 여행 기간 날씨 신호
- `suggest_form_update`: 명시적 폼 변경 제안

## Routing Rules

- "팩 만들어줘", "이 조건으로 일정 짜줘"는 `build_pack`으로 보낸다.
- "이 리뷰 맞아?", "블로그에서 봤는데 사실이야?"는 `verify_review`로 보낸다.
- "성산이 좋아 구좌가 좋아?", "지역 추천해줘"는 `preview_region_coverage`와 필요 시 `search_places`를 함께 사용한다.
- "폼을 어떻게 바꾸면 좋아?", "더 좋은 조합 있어?"는 `suggest_form_augment`로 보낸다.
- 특정 장소명과 "자세히", "수정요청", "주차", "정류소"가 함께 있으면 `get_place_detail`을 우선한다.
- 일반 여행 조언은 장소 사실을 만들지 않고 계획 방법과 선택 기준만 답한다.

## Fallback Behavior

LLM이 없거나 도구 호출에 실패해도 마지막 도구 결과를 읽어 템플릿 답변을 만든다.

- `build_pack`: 확인된 후보 수, fallback 조합, 날씨 신호를 짧게 요약한다.
- `verify_review`: 문장별 판정과 "저희 공공데이터 기준" 한계를 밝힌다.
- `preview_region_coverage`: 지역별 강한 순간과 부족한 순간을 나열한다.
- `suggest_form_augment`: 제안 필드와 이유를 짧게 말한다.

## Testing

`apps/api/tests/test_haruban_agent.py`에 도구 스키마, 라우팅 추론, 템플릿 폴백 테스트를 추가한다. 위험이 큰 구현은 기존 `/pack`, `/verify`, LLM 유틸 테스트도 함께 돌린다.

## Success Criteria

- "이 조건으로 팩 만들어줘"에 하루방이 팩 요약을 답한다.
- "이 리뷰 맞아?"에 문장별 검증 결과를 답한다.
- "성산이 좋아 구좌가 좋아?"에 커버리지와 후보 근거로 비교한다.
- "폼을 어떻게 바꾸면 좋아?"에 증강 제안을 답한다.
- API 키가 없어도 하루방 답변 폴백이 사용자에게 읽히는 문장으로 나온다.

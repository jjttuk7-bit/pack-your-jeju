# Jeju Genie Pattern Applied To Haruban

## Goal

제주 지니의 장점인 넓은 질문 라우팅, 출처 중심 답변, 실시간/정적 데이터 분리를 하루방 에이전트에 맞게 흡수한다.

## Applied Patterns

1. **Answer contract**
   - 하루방 응답마다 `answer_type`, `source_type`, `confidence`, `requires_tool`, `limitations`를 붙인다.
   - 프론트는 이 계약으로 "공공데이터 기준", "웹 출처 기준", "기상청 예보 기준", "일반 제주 안내"를 구분해 보여준다.

2. **Router-first behavior**
   - 일반 제주 안내는 템플릿 또는 LLM 일반 상담 경로로 처리한다.
   - 장소 추천은 `search_places`, 장소 상세는 `get_place_detail`, 날씨는 `weather_signal`, 최신 정보는 `web_search_jeju`, 리뷰 검증은 `verify_review`로 보낸다.

3. **No hallucination boundary**
   - 제주 지니의 "도구 실패 시 일반 지식으로 답변 유지"는 우리 서비스에서는 제한적으로만 적용한다.
   - 장소명, 운영시간, 요금, 주소, 폐업 여부는 도구 결과 없이는 말하지 않는다.
   - 일반 동선 조언과 서비스 사용법만 도구 없이 답할 수 있다.

## UI Impact

하루방 말풍선 아래에 작은 근거 칩을 표시한다. 사용자는 답변이 어떤 근거 레벨인지 바로 볼 수 있다.

## Future Work

- `answer_contract.sources`를 추가해 출처 링크 칩까지 직접 노출한다.
- Golden set에 일반 질문, 최신 질문, 장소 추천, 날씨, 검증, 도메인 가드 케이스를 추가한다.
- 제주와 무관한 질문을 부드럽게 제주 맥락으로 돌리는 도메인 가드를 별도 구현한다.

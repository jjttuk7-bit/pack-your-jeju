# VisitJeju Expanded Moments Design

## Goal

제주를 담다의 순간 카드를 기존 8종에서 12종으로 확장해, 사용자가 비짓제주에 이미 수집된 숙박·축제·특산물/쇼핑·문화 항목도 폼에서 직접 선택할 수 있게 한다.

## Decision

A안으로 진행한다. 기존 “여행 순간” UI와 `/pack` 구조는 유지하고, 새 카드 4종만 추가한다.

- `stay` -> `accommodation`: 숙소까지 같이 보기
- `festival_event` -> `festival`: 축제·행사 맞춰가기
- `souvenir_shopping` -> `shopping`: 특산물·기념품 쇼핑
- `culture_stop` -> `culture`: 전시·문화 공간 들르기

## Rationale

백엔드 `SEARCHABLE_CATEGORIES`와 비짓제주 정제 파이프라인은 이미 `accommodation`, `festival`, `shopping`, `culture`를 보존한다. 현재 제한은 `MOMENT_TO_CATEGORY`, 프론트 `MomentId`, `MOMENTS`, 라벨/아이콘 매핑이 8종에 닫혀 있는 데서 생긴다. 새 카드를 추가하면 사용자의 선택 편의는 넓히면서, 기존 신뢰 엔진과 fallback 규칙은 그대로 유지할 수 있다.

## Scope

포함:

- 백엔드 순간 카드 매핑 확장
- 하루방/조립/지역 커버리지/PDF 라벨 확장
- 프론트 타입, 카드 데이터, 순간 아이콘 확장
- 기존 테스트에 12종 카드 무결성 및 새 카드 필터 검증 추가

제외:

- 새로운 외부 데이터 소스 추가
- 실시간 숙박 예약/가격/잔여 객실
- 특산물 구매 링크/결제
- 축제 실시간 운영 여부 단정

## Trust Rules

새 카드도 기존 원칙을 따른다. 장소명·주소·운영시간·행사 일정은 DB 또는 웹검색 도구 sources 밖에서 생성하지 않는다. `/pack` 결과가 없으면 기존 fallback 4분기와 “저희가 참조하는 공공데이터 기준” 표현을 유지한다. 숙박 가격, 예약 가능 여부, 축제 당일 변경 여부처럼 실시간성이 강한 정보는 확인 불가 또는 웹 출처 기준으로만 안내한다.

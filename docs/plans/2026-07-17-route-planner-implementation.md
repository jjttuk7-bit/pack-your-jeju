# User-Approved Route Planner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 선택한 제주 여행 장소를 날짜별 실제 이동 경로로 연결하고, 시간 고정 일정과 사용자 선택을 보존한 동선 변경안을 미리보기·승인·되돌리기로 제공한다.

**Architecture:** FastAPI의 `Route Planner`가 날짜별 일정과 고정점을 검증하고 실제 경로 공급자 또는 좌표 기반 대체 계산으로 현재·추천 동선을 비교한다. React는 경로 출처와 절감 효과를 표시하고, 날씨 변경안과 동일한 fingerprint·스냅샷 패턴으로 사용자가 승인한 재정렬만 원자적으로 적용한다.

**Tech Stack:** Python 3.11, FastAPI, Pydantic 2, httpx, pytest, React 19, TypeScript, Vitest, Testing Library, Naver Maps JavaScript SDK, Vite PWA

---

## 구현 원칙

- `AGENTS.md`, `DECISIONS.md`, `TRUST_ENGINE.md`의 사용자 승인·출처·실패 공개 원칙을 유지한다.
- 동선 추천은 Day나 시간대를 자동 변경하지 않고 같은 Day 안의 방문 순서만 제안한다.
- 자동차는 실제 도로 경로를 우선하며, 대중교통·도보 또는 공급자 장애는 `estimated_route`로 명시한다.
- 실제 경로 공급자 값과 `route-travel-v1` 서비스 정책 점수를 분리한다.
- 각 행동 변경은 실패 테스트부터 작성하고 작은 커밋으로 끝낸다.

### Task 1: 경로 도메인 타입과 좌표 기반 대체 계산

**Files:**
- Create: `apps/api/engine/route_planner.py`
- Test: `apps/api/tests/test_route_planner.py`

**Step 1: Write the failing tests**

다음 계약을 먼저 고정한다.

```python
from apps.api.engine.route_planner import (
    estimated_segment,
    haversine_meters,
    route_plan_fingerprint,
)


def test_haversine_is_symmetric_and_zero_for_same_point():
    a = {"lat": 33.4996, "lng": 126.5312}
    b = {"lat": 33.4507, "lng": 126.5707}
    assert haversine_meters(a, a) == 0
    assert haversine_meters(a, b) == haversine_meters(b, a)


def test_estimated_segment_is_explicitly_estimated():
    segment = estimated_segment(
        {"lat": 33.4996, "lng": 126.5312},
        {"lat": 33.4507, "lng": 126.5707},
        mode="driving",
    )
    assert segment["status"] == "estimated_route"
    assert segment["provider"] == "route-travel-v1"
    assert segment["distance_m"] > 0
    assert segment["duration_s"] > 0


def test_route_fingerprint_changes_when_order_or_mode_changes():
    items = [{"id": "a", "day": 1}, {"id": "b", "day": 1}]
    original = route_plan_fingerprint(items, mode="driving")
    assert original != route_plan_fingerprint(list(reversed(items)), mode="driving")
    assert original != route_plan_fingerprint(items, mode="walking")
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest apps/api/tests/test_route_planner.py -q`

Expected: FAIL with `ModuleNotFoundError: apps.api.engine.route_planner`.

**Step 3: Implement the minimal domain helpers**

`route_planner.py`에 다음 타입과 함수를 추가한다.

```python
RouteMode = Literal["driving", "transit", "walking"]
RouteStatus = Literal[
    "verified_route", "estimated_route", "mixed_route", "unavailable"
]

POLICY_VERSION = "route-travel-v1"
MODE_SPEED_KMH = {"driving": 38.0, "transit": 24.0, "walking": 4.5}
MODE_DISTANCE_FACTOR = {"driving": 1.28, "transit": 1.40, "walking": 1.15}
```

- Haversine 계산 결과는 미터 정수로 반환한다.
- 예상 거리는 직선거리 × 이동수단별 보정계수로 계산한다.
- 예상 시간은 예상 거리 ÷ 정책 속도로 계산한다.
- geometry는 시작·도착 좌표 두 점만 보존한다.
- fingerprint에는 mode, 출발·도착 좌표, item ID·Day·순서·fixed를 포함한다.
- 정책 속도와 보정계수는 공식 교통 정보가 아니라 서비스 대체 계산임을 docstring에 명시한다.

**Step 4: Run tests to verify they pass**

Run: `python -m pytest apps/api/tests/test_route_planner.py -q`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/engine/route_planner.py apps/api/tests/test_route_planner.py
git commit -m "[동선] 예상 경로와 fingerprint 기반 추가"
```

### Task 2: 고정점 보존형 방문 순서 추천

**Files:**
- Modify: `apps/api/engine/route_planner.py`
- Modify: `apps/api/tests/test_route_planner.py`

**Step 1: Write the failing tests**

```python
from apps.api.engine.route_planner import build_day_proposal


def test_proposal_never_moves_fixed_item():
    items = [
        item("far", 126.20),
        item("fixed", 126.50, fixed=True),
        item("near", 126.51),
    ]
    proposal = build_day_proposal(items, matrix=fixture_matrix())
    assert proposal["recommended_item_ids"][1] == "fixed"


def test_proposal_is_deterministic_and_preserves_ids():
    first = build_day_proposal(day_items(), matrix=fixture_matrix())
    second = build_day_proposal(day_items(), matrix=fixture_matrix())
    assert first == second
    assert sorted(first["recommended_item_ids"]) == sorted(
        item["id"] for item in day_items()
    )


def test_no_proposal_when_improvement_is_below_threshold():
    result = build_day_proposal(day_items(), matrix=near_equal_matrix())
    assert result["proposal"] is None
    assert result["headline"] == "현재 동선이 적절합니다."
```

**Step 2: Run the tests and confirm failure**

Run: `python -m pytest apps/api/tests/test_route_planner.py -q`

Expected: FAIL because `build_day_proposal` does not exist.

**Step 3: Implement anchor-aware optimization**

- 날짜가 다른 item이 들어오면 `ValueError`로 거부한다.
- 출발점·도착점과 `fixed=True` item을 anchor로 둔다.
- anchor 사이의 movable item만 최근접 순서로 배치하고 결정론적 2-opt를 한 번 적용한다.
- 같은 비용이면 기존 순서를 보존한다.
- 추천은 `max(600초, 현재 이동시간의 10%)` 이상 절감할 때만 생성한다.
- operation은 다음 형태로 반환한다.

```python
{
    "type": "reorder_day_items",
    "day": 1,
    "ordered_item_ids": ["market", "cafe", "oreum"],
}
```

- 날씨 상태가 `adjust`인 장소, 운영정보가 `check_required`인 장소, 과도한 권역 왕복에는 정책 penalty를 적용하되 원본 route duration을 수정하지 않는다.
- 응답의 `reasons`에 이동시간 감소, 날씨 배치, 운영정보 확인 항목을 따로 기록한다.

**Step 4: Run tests**

Run: `python -m pytest apps/api/tests/test_route_planner.py -q`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/engine/route_planner.py apps/api/tests/test_route_planner.py
git commit -m "[동선] 시간 고정 보존형 순서 추천 추가"
```

### Task 3: 실제 자동차 경로 공급자와 부분 fallback

**Files:**
- Create: `apps/api/engine/route_provider.py`
- Create: `apps/api/tests/test_route_provider.py`
- Modify: `.env.example`

**Step 1: Write provider contract tests**

```python
import httpx

from apps.api.engine.route_provider import RouteProvider


def test_driving_provider_normalizes_verified_route(monkeypatch):
    monkeypatch.setenv("NAVER_DIRECTIONS_CLIENT_ID", "id")
    monkeypatch.setenv("NAVER_DIRECTIONS_CLIENT_SECRET", "secret")
    transport = httpx.MockTransport(
        lambda request: httpx.Response(200, json=naver_route_fixture())
    )
    segment = RouteProvider(transport=transport).segment(
        start(), goal(), mode="driving"
    )
    assert segment["status"] == "verified_route"
    assert segment["provider"] == "naver_directions"
    assert segment["distance_m"] == 12340
    assert segment["duration_s"] == 1560
    assert segment["geometry"][0] == {"lng": 126.5, "lat": 33.5}


def test_missing_key_uses_estimate_without_network(monkeypatch):
    monkeypatch.delenv("NAVER_DIRECTIONS_CLIENT_ID", raising=False)
    segment = RouteProvider().segment(start(), goal(), mode="driving")
    assert segment["status"] == "estimated_route"


def test_transit_and_walking_are_honest_estimates_in_first_release():
    provider = RouteProvider()
    assert provider.segment(start(), goal(), mode="transit")["status"] == "estimated_route"
    assert provider.segment(start(), goal(), mode="walking")["status"] == "estimated_route"
```

표준 `pytest monkeypatch`와 `httpx.MockTransport`를 사용해 새 테스트 의존성을 추가하지 않는다.

**Step 2: Run and confirm failure**

Run: `python -m pytest apps/api/tests/test_route_provider.py -q`

Expected: FAIL because the provider module is missing.

**Step 3: Implement provider adapter**

- `RouteProvider.segment(start, goal, mode)` 단일 인터페이스를 만든다.
- 자동차이고 두 서버 키가 있을 때만 Naver Directions adapter를 호출한다.
- 서버 키 이름은 `NAVER_DIRECTIONS_CLIENT_ID`, `NAVER_DIRECTIONS_CLIENT_SECRET`로 고정한다.
- `httpx.Client(timeout=4.0)`와 최대 1회 재시도를 사용한다.
- 응답의 거리, 시간, path를 공통 segment로 정규화한다.
- timeout, 4xx, 5xx, 잘못된 payload는 오류 유형을 내부 로그에 남기고 예상 segment를 반환한다.
- 대중교통·도보는 1차 출시에서 예상값으로 반환하고 UI가 실제 경로로 오인하지 않게 한다.
- 실제 키를 `.env.example`에 값 없이 추가한다.

**Step 4: Run tests**

Run: `python -m pytest apps/api/tests/test_route_provider.py -q`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/engine/route_provider.py apps/api/tests/test_route_provider.py .env.example
git commit -m "[동선] 실제 자동차 경로 공급자 연결"
```

### Task 4: 날짜별 Route Planner API

**Files:**
- Create: `apps/api/routes/route_plan.py`
- Create: `apps/api/tests/test_route_plan_route.py`
- Modify: `apps/api/main.py`

**Step 1: Write failing route tests**

```python
def test_route_plan_returns_current_and_recommended_days(client, monkeypatch):
    monkeypatch.setattr(route_plan_route, "RouteProvider", FakeProvider)
    response = client.post("/route/plan", json=valid_body())
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"verified_route", "mixed_route"}
    assert payload["days"][0]["current"]["total_duration_s"] > 0
    assert payload["proposal"]["operations"][0]["type"] == "reorder_day_items"


def test_route_plan_keeps_available_days_when_one_day_fails(client, monkeypatch):
    monkeypatch.setattr(route_plan_route, "RouteProvider", PartialFailProvider)
    payload = client.post("/route/plan", json=two_day_body()).json()
    assert payload["partial"] is True
    assert payload["days"][0]["status"] != "unavailable"
    assert payload["days"][1]["status"] == "estimated_route"


def test_route_plan_rejects_invalid_coordinates(client):
    body = valid_body()
    body["items"][0]["lat"] = 91
    assert client.post("/route/plan", json=body).status_code == 422
```

**Step 2: Run and confirm failure**

Run: `python -m pytest apps/api/tests/test_route_plan_route.py -q`

Expected: FAIL with 404.

**Step 3: Implement Pydantic schemas and route**

`RoutePlanBody` 계약:

```python
class RouteLocationBody(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    lat: float = Field(ge=32.0, le=34.0)
    lng: float = Field(ge=125.0, le=128.0)


class RoutePlanItemBody(RouteLocationBody):
    id: str = Field(min_length=1, max_length=220)
    day: int = Field(ge=1, le=14)
    daypart: Literal["morning", "afternoon", "evening"]
    fixed: bool = False
    weather_status: str | None = None
    operating_check_required: bool = False


class RoutePlanBody(BaseModel):
    mode: Literal["driving", "transit", "walking"] = "driving"
    origin: RouteLocationBody
    destination: RouteLocationBody
    items: list[RoutePlanItemBody] = Field(min_length=1, max_length=24)
    dismissed_proposal_fingerprints: list[str] = Field(default_factory=list, max_length=100)
```

- 날짜별 최대 12개 장소만 최적화하고 초과 항목은 현재 순서와 경고를 반환한다.
- 구간 계산은 bounded worker 4개로 제한한다.
- 일부 공급자 호출 실패 시 다른 날짜·구간 결과를 유지한다.
- `provider_meta`에 실제/예상 구간 수, 공급자, 확인 시각, 실패 이유를 반환한다.
- `main.py`에 router를 등록한다.

**Step 4: Run route and regression tests**

Run:

```bash
python -m pytest apps/api/tests/test_route_plan_route.py apps/api/tests/test_weather_report_route.py -q
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/routes/route_plan.py apps/api/tests/test_route_plan_route.py apps/api/main.py
git commit -m "[동선] 날짜별 경로 추천 API 추가"
```

### Task 5: 프런트 경로 타입과 API 클라이언트

**Files:**
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/api.ts`
- Create: `apps/web/src/api.route.test.ts`

**Step 1: Write the failing client test**

```typescript
it('posts normalized route plan request', async () => {
  fetchMock.mockResolvedValue(ok(routeResponse));
  await requestRoutePlan(request);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/route/plan'),
    expect.objectContaining({method: 'POST'}),
  );
  const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
  expect(body.mode).toBe('driving');
  expect(body.items[0]).toMatchObject({day: 1, daypart: 'morning'});
});
```

**Step 2: Run and confirm failure**

Run: `cd apps/web && npm test -- src/api.route.test.ts`

Expected: FAIL because route types/client are missing.

**Step 3: Add complete TypeScript contracts**

`types.ts`에 다음 핵심 타입을 추가한다.

```typescript
export type RouteMode = 'driving' | 'transit' | 'walking';
export type RouteStatus =
  | 'verified_route'
  | 'estimated_route'
  | 'mixed_route'
  | 'unavailable';

export interface RouteLocation {
  label: string;
  lat: number;
  lng: number;
}

export interface RouteSegment {
  from_id: string;
  to_id: string;
  distance_m: number;
  duration_s: number;
  status: RouteStatus;
  provider: string;
  geometry: Array<{lat: number; lng: number}>;
}

export interface RouteProposalOperation {
  type: 'reorder_day_items';
  day: number;
  ordered_item_ids: string[];
}
```

- request, day route, comparison, proposal, provider meta, response 타입을 API JSON과 1:1로 정의한다.
- `api.ts`의 `requestRoutePlan()`은 snake_case 변환만 담당하고 판단을 추가하지 않는다.

**Step 4: Run tests and type check**

Run:

```bash
cd apps/web
npm test -- src/api.route.test.ts
npm run lint
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/types.ts apps/web/src/api.ts apps/web/src/api.route.test.ts
git commit -m "[웹] 경로 추천 타입과 API 클라이언트 추가"
```

### Task 6: 원자적 경로 제안 적용과 되돌리기

**Files:**
- Create: `apps/web/src/routeProposal.ts`
- Create: `apps/web/src/routeProposal.test.ts`

**Step 1: Write failing proposal guard tests**

```typescript
it('does not change the plan before approval', () => {
  const preview = previewRouteProposal(plan, proposal);
  expect(plan.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  expect(preview.items.map((item) => item.id)).toEqual(['b', 'a', 'c']);
});

it('rejects stale proposals and fixed-item movement', () => {
  expect(applyRouteProposal(editedPlan, proposal).ok).toBe(false);
  expect(applyRouteProposal(fixedPlan, movesFixedProposal).ok).toBe(false);
});

it('undoes only the exact applied plan', () => {
  const applied = applyRouteProposal(plan, proposal);
  expect(undoRouteProposal(applied.items, applied.undo!).map((x) => x.id))
    .toEqual(plan.map((x) => x.id));
  expect(undoRouteProposal(manuallyEdited(applied.items), applied.undo!))
    .toEqual(manuallyEdited(applied.items));
});
```

**Step 2: Run and confirm failure**

Run: `cd apps/web && npm test -- src/routeProposal.test.ts`

Expected: FAIL because the module is missing.

**Step 3: Implement guards**

- `planFingerprint`는 기존 `weatherProposal.ts`에서 공용 `planFingerprint.ts`로 이동하거나 재사용하되 중복 구현하지 않는다.
- operation의 Day와 ID 집합이 현재 Day의 ID 집합과 정확히 같은지 검증한다.
- 고정 item의 배열 위치가 바뀌면 전체 operation을 거부한다.
- 여러 Day operation을 전부 검증한 뒤 clone에 한 번에 적용한다.
- undo에는 proposal ID, 적용 전 items, 적용 후 fingerprint를 보존한다.
- 사용자 수동 수정 후 undo는 no-op과 설명 메시지를 반환한다.

**Step 4: Run tests**

Run: `cd apps/web && npm test -- src/routeProposal.test.ts src/weatherProposal.test.ts`

Expected: PASS for both route and weather proposal contracts.

**Step 5: Commit**

```bash
git add apps/web/src/routeProposal.ts apps/web/src/routeProposal.test.ts apps/web/src/weatherProposal.ts
git commit -m "[웹] 동선 변경안 승인과 되돌리기 보호 추가"
```

### Task 7: 내 여행 동선 비교 카드

**Files:**
- Create: `apps/web/src/components/TravelRouteCard.tsx`
- Create: `apps/web/src/components/TravelRouteCard.test.tsx`

**Step 1: Write accessible UI tests**

```tsx
it('shows day tabs, mode controls, and current route summary', () => {
  render(<TravelRouteCard {...props} />);
  expect(screen.getByRole('tab', {name: 'Day 1'})).toBeVisible();
  expect(screen.getByRole('radio', {name: '자동차'})).toBeChecked();
  expect(screen.getByText(/총 이동/)).toBeVisible();
});

it('shows comparison and waits for explicit approval', async () => {
  render(<TravelRouteCard {...propsWithProposal} />);
  await user.click(screen.getByRole('button', {name: '동선 추천받기'}));
  expect(onApply).not.toHaveBeenCalled();
  expect(screen.getByText(/45분/)).toBeVisible();
  await user.click(screen.getByRole('button', {name: '이 순서로 적용'}));
  expect(onApply).toHaveBeenCalledTimes(1);
});

it('labels fallback without pretending it is verified', () => {
  render(<TravelRouteCard {...estimatedProps} />);
  expect(screen.getByText('예상 동선')).toBeVisible();
  expect(screen.queryByText('실제 경로 확인')).not.toBeInTheDocument();
});
```

**Step 2: Run and confirm failure**

Run: `cd apps/web && npm test -- src/components/TravelRouteCard.test.tsx`

Expected: FAIL because the component is missing.

**Step 3: Implement the UI shell**

- Day 탭, 이동수단 radio group, 숙소 왕복·직접 지정 control을 제공한다.
- 주소 자동완성은 1차 범위에서 제외하고 장소 카드 좌표 또는 사용자가 선택한 지도 좌표를 사용한다.
- 장소가 2곳 미만이면 버튼을 disabled하고 이유를 표시한다.
- `verified_route`, `estimated_route`, `mixed_route`, `unavailable` 배지를 서로 다른 문구로 표시한다.
- 현재·추천 순서, 총 시간·거리, 절감 효과, 가장 긴 구간과 추천 이유를 표시한다.
- `이 순서로 적용`, `기존 일정 유지`, `되돌리기`는 명확한 button label을 가진다.
- 모바일에서는 비교 패널을 세로로 쌓고 지도 아래에 요약을 둔다.

**Step 4: Run tests**

Run: `cd apps/web && npm test -- src/components/TravelRouteCard.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/components/TravelRouteCard.tsx apps/web/src/components/TravelRouteCard.test.tsx
git commit -m "[웹] 내 여행 동선 비교 카드 추가"
```

### Task 8: 번호 마커와 날짜별 경로선

**Files:**
- Create: `apps/web/src/components/TravelRouteMap.tsx`
- Create: `apps/web/src/components/TravelRouteMap.test.tsx`
- Modify: `apps/web/src/components/PackingDashboard.tsx`

**Step 1: Write map rendering tests**

```tsx
it('renders ordered marker labels and an accessible route summary', () => {
  render(<TravelRouteMap route={route} activeDay={1} />);
  expect(screen.getByLabelText('1. 숙소')).toBeVisible();
  expect(screen.getByLabelText('2. 시장')).toBeVisible();
  expect(screen.getByText('Day 1 동선 3개 구간')).toBeVisible();
});

it('keeps the fallback map when Naver SDK is unavailable', () => {
  render(<TravelRouteMap route={estimatedRoute} activeDay={1} />);
  expect(screen.getByText(/간이 지도/)).toBeVisible();
  expect(screen.getByText('예상 동선')).toBeVisible();
});
```

**Step 2: Run and confirm failure**

Run: `cd apps/web && npm test -- src/components/TravelRouteMap.test.tsx`

Expected: FAIL because the component is missing.

**Step 3: Extract and extend map behavior**

- 현재 `PackingDashboard.tsx` 내부의 지도 SDK 로드, 좌표 검증, fallback 투영을 `TravelRouteMap.tsx`로 이동한다.
- Naver SDK에서는 segment geometry로 `naver.maps.Polyline`을 만든다.
- Day별 색상은 고정 팔레트로 결정하고 범례에 같은 색을 사용한다.
- marker 번호는 추천 미리보기 상태에서 추천 순서를 사용한다.
- fallback SVG도 geometry가 있으면 polyline을 그리고 단순 두 점이면 점선으로 표시한다.
- cleanup에서 marker와 polyline을 모두 map에서 제거한다.
- 플랜이 없을 때의 기존 후보 지도는 동작을 유지한다.

**Step 4: Run map and legacy tests**

Run:

```bash
cd apps/web
npm test -- src/components/TravelRouteMap.test.tsx
node --test tests/map-layout.test.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/components/TravelRouteMap.tsx apps/web/src/components/TravelRouteMap.test.tsx apps/web/src/components/PackingDashboard.tsx
git commit -m "[웹] 날짜별 번호 마커와 경로선 표시"
```

### Task 9: App 상태, 날씨 재계산, 저장 마이그레이션 통합

**Files:**
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Create: `apps/web/src/routeIntegration.test.tsx`

**Step 1: Write integration tests**

```tsx
it('applies route proposal to the shared travel plan only after approval', async () => {
  render(<RouteIntegrationHarness />);
  await user.click(screen.getByRole('button', {name: '동선 추천받기'}));
  expect(planOrder()).toEqual(['a', 'b', 'c']);
  await user.click(screen.getByRole('button', {name: '이 순서로 적용'}));
  expect(planOrder()).toEqual(['b', 'a', 'c']);
});

it('invalidates route preview after weather changes the plan', async () => {
  render(<RouteAndWeatherHarness />);
  await openRoutePreview();
  await applyWeatherProposal();
  expect(screen.queryByText('이 순서로 적용')).not.toBeInTheDocument();
  expect(screen.getByText(/동선을 다시 계산/)).toBeVisible();
});

it('migrates old saved travel without route state', () => {
  const migrated = migrateSavedTravel(oldState);
  expect(migrated.routeDismissedFingerprints).toEqual([]);
  expect(migrated.routeUndo).toBeNull();
});
```

**Step 2: Run and confirm failure**

Run: `cd apps/web && npm test -- src/routeIntegration.test.tsx`

Expected: FAIL because route state and handlers are missing.

**Step 3: Integrate shared state safely**

- `SavedTravel`에 `routeDismissedFingerprints`, `routeUndo`, `routeActionMessage`를 추가한다.
- 테스트 가능하도록 `migrateSavedTravel`을 export하고 이전 localStorage 상태는 빈 배열·null로 마이그레이션한다.
- 경로 적용은 `selectedPlanItems` 배열 순서만 바꾸고 Day, daypart, startTime, fixed를 보존한다.
- 사용자가 장소 추가·삭제·시간 수정 또는 날씨 제안을 적용하면 오래된 route undo와 preview를 무효화한다.
- 동선 적용 후 plan fingerprint가 바뀌면 기존 weather report effect가 자동 재조회되는지 확인한다.
- 날씨 적용 후에는 Route Card가 기존 route response를 폐기하고 사용자가 다시 계산하도록 안내한다.
- 출발·도착 주소는 기본적으로 component session state에만 두고 localStorage에 저장하지 않는다.
- 사용자가 `이 출발·도착 저장`을 선택한 경우에만 label과 좌표를 저장하는 후속 옵션을 둔다. 1차 구현에서는 저장 checkbox를 노출하지 않아도 된다.

**Step 4: Run integration and all frontend tests**

Run:

```bash
cd apps/web
npm test
node --test tests/*.test.mjs
npm run lint
```

Expected: all tests and TypeScript checks pass.

**Step 5: Commit**

```bash
git add apps/web/src/types.ts apps/web/src/App.tsx apps/web/src/components/PackingDashboard.tsx apps/web/src/routeIntegration.test.tsx
git commit -m "[웹] 동선 승인 흐름을 여행 플랜과 날씨에 연결"
```

### Task 10: 운영 계약, 전체 검증, 배포 준비

**Files:**
- Modify: `README.md`
- Modify: `DECISIONS.md`
- Modify: `TRUST_ENGINE.md`
- Modify: `DEPLOYMENT_STATUS.md`
- Modify: `.env.example`

**Step 1: Update authoritative documentation**

- `DECISIONS.md`에 사용자 승인형 동선 추천, 실제/예상 경로 구분, 고정 일정 보존 결정을 추가한다.
- `TRUST_ENGINE.md`에 실제 경로 공급자와 서비스 정책 점수 분리, 확인 시점, 부분 실패, fallback 계약을 추가한다.
- `README.md`에 `내 여행 동선`, 새 API와 서버 환경변수를 추가한다.
- `DEPLOYMENT_STATUS.md`에는 로컬 검증 결과만 기록하고 배포 전에는 프로덕션 완료로 쓰지 않는다.
- `.env.example`의 키 설명은 서버 전용이며 프런트 번들에 포함하면 안 된다고 명시한다.

**Step 2: Run trust regression tests**

Run:

```bash
python -m pytest apps/api/tests/test_trust_score.py apps/api/tests/test_pack_integration.py -q
```

Expected: PASS or environment-dependent tests SKIPPED with no failures.

**Step 3: Run full backend suite**

Run: `python -m pytest -q`

Expected: no failures.

**Step 4: Run full frontend verification**

Run:

```bash
cd apps/web
npm test
node --test tests/*.test.mjs
npm run lint
npm run build
```

Expected: no test, type, or build failures. Record the Vite bundle-size warning separately if it remains.

**Step 5: Inspect changes and commit docs**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Then:

```bash
git add README.md DECISIONS.md TRUST_ENGINE.md DEPLOYMENT_STATUS.md .env.example
git commit -m "[문서] 여행 동선 추천 운영 계약 반영"
```

## 배포 후 스모크 체크리스트

코드 병합과 배포가 별도로 승인된 뒤에만 수행한다.

1. Railway `/health`가 200인지 확인한다.
2. Railway `/openapi.json`에 `/route/plan`이 있는지 확인한다.
3. 자동차 숙소 왕복 요청이 `verified_route` 또는 정직한 `estimated_route`를 반환하는지 확인한다.
4. 공급자 키를 사용할 수 없는 테스트 환경에서 기존 여행팩과 지도 마커가 유지되는지 확인한다.
5. Vercel 번들에 `내 여행 동선`, `동선 추천받기`, `이 순서로 적용`이 포함되는지 확인한다.
6. 실제 화면에서 추천 승인 전후의 플랜 순서와 되돌리기를 확인한다.
7. 설치된 PWA를 다시 열어 저장된 플랜 마이그레이션 오류가 없는지 확인한다.

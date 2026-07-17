# Weather Decision Report Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 기상청의 지역·시간대별 예보를 사용자 플랜과 연결해 일정 영향을 설명하고, 사용자가 승인할 때만 적용되는 변경안과 되돌리기를 제공한다.

**Architecture:** `weather.py`는 기상청 원본을 시간별 예보로 정규화하고, 새 `weather_report.py`는 시간대 집계·활동 영향·결정론적 변경안을 만든다. `POST /weather/report`는 플랜 스냅샷을 받아 부분 성공이 가능한 리포트를 반환하며, React는 변경안을 순수 함수로 검증·적용하고 직전 상태로 되돌린다.

**Tech Stack:** Python 3.11, FastAPI, Pydantic, Pytest, React 19, TypeScript, Vite, Vitest, Testing Library, Tailwind CSS

---

## 구현 범위

포함:

- 기상청 단기예보의 시간별 보존
- 오전·오후·저녁 집계
- 일정에 포함된 여러 지역 조회와 부분 성공
- 장소 유형별 날씨 영향
- 기존 플랜 안에서의 순서·날짜 변경안
- 변경 미리보기, 사용자 승인, 원자적 적용, 되돌리기
- 사용자가 유지한 제안 fingerprint 보존
- 기존 `/pack.weather` 호환

제외:

- 하루방을 통한 새로운 장소 웹 검색
- 배편·통제·행사 운영 API 추가
- 푸시 알림
- 로그인 플랜의 서버 버전·감사 이력
- 중기예보와 계절 통계

## Task 1: 시간별 기상 예보 계약 보존

**Files:**

- Modify: `apps/api/engine/weather.py`
- Modify: `apps/api/tests/test_weather.py`

### Step 1: 실패 테스트 작성

`test_weather.py`에 시간별 예보가 삭제되지 않는 계약을 추가한다.

```python
def test_parse_vilage_forecast_preserves_hourly_values():
    payload = _vilage_payload([
        _item("20990720", "0900", "SKY", "3"),
        _item("20990720", "0900", "POP", "70"),
        _item("20990720", "0900", "TMP", "24"),
        _item("20990720", "0900", "WSD", "5.2"),
        _item("20990720", "1500", "SKY", "1"),
        _item("20990720", "1500", "POP", "20"),
        _item("20990720", "1500", "TMP", "28"),
        _item("20990720", "1500", "WSD", "2.1"),
    ])

    parsed = parse_vilage_fcst_payload(
        payload,
        region="seongsan",
        target_start=date(2099, 7, 20),
        target_days=1,
    )

    assert [row["time"] for row in parsed["hourly_forecasts"]] == ["09:00", "15:00"]
    assert parsed["hourly_forecasts"][0]["precipitation_probability"] == 70
    assert parsed["hourly_forecasts"][1]["wind_speed"] == 2.1
```

기존 fixture가 없으면 `_vilage_payload`와 `_item`을 테스트 파일 안에 작은 helper로 만든다.

### Step 2: 실패 확인

Run:

```powershell
python -m pytest apps/api/tests/test_weather.py::test_parse_vilage_forecast_preserves_hourly_values -q
```

Expected: `KeyError: 'hourly_forecasts'`

### Step 3: 최소 구현

`weather.py`에 모든 미래 시점의 category를 묶는 함수를 추가한다.

```python
def _hourly_forecast_values(
    items: list[dict[str, Any]],
    *,
    target_start: date,
    target_days: int,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    # target range와 현재 이후 값만 포함
    # fcstDate+fcstTime으로 그룹핑
    # SKY, PTY, POP, TMP, WSD, REH를 public field로 변환
    ...
```

공개 행은 다음 필드만 가진다.

```python
{
    "date": "2099-07-20",
    "time": "09:00",
    "sky": "구름많음",
    "precipitation_type": "강수 없음",
    "precipitation_probability": 70,
    "temperature": 24.0,
    "wind_speed": 5.2,
    "humidity": None,
}
```

`parse_vilage_fcst_payload`의 기존 `forecast`, `daily_forecasts`, `summary`는 그대로 유지하고 `hourly_forecasts`만 추가한다. 예보 대상 시각인 `forecast_at`과 기상청 요청의 기준 발표 회차인 `source_issued_at`을 별도 필드로 보존한다. 기존 `issued_at_label`의 호환 의미는 바꾸지 않는다.

### Step 4: 회귀 테스트

Run:

```powershell
python -m pytest apps/api/tests/test_weather.py -q
```

Expected: all weather tests pass.

### Step 5: 커밋

```powershell
git add apps/api/engine/weather.py apps/api/tests/test_weather.py
git commit -m "[날씨] 시간별 기상 예보 보존"
```

## Task 2: 오전·오후·저녁 집계 도메인

**Files:**

- Create: `apps/api/engine/weather_report.py`
- Create: `apps/api/tests/test_weather_report.py`

### Step 1: 실패 테스트 작성

```python
from apps.api.engine.weather_report import aggregate_dayparts


def test_aggregate_dayparts_uses_worst_probability_and_wind():
    rows = [
        {"date": "2026-07-20", "time": "08:00", "sky": "흐림",
         "precipitation_type": "비", "precipitation_probability": 60,
         "temperature": 23.0, "wind_speed": 3.0, "humidity": 80},
        {"date": "2026-07-20", "time": "10:00", "sky": "흐림",
         "precipitation_type": "비", "precipitation_probability": 80,
         "temperature": 25.0, "wind_speed": 7.0, "humidity": 84},
    ]

    periods = aggregate_dayparts("seongsan", rows)

    morning = periods[0]
    assert morning["daypart"] == "morning"
    assert morning["precipitation_probability_max"] == 80
    assert morning["temperature_min"] == 23.0
    assert morning["temperature_max"] == 25.0
    assert morning["wind_speed_max"] == 7.0
```

빈 시간대가 `available=False`로 반환되는 테스트도 추가한다.

### Step 2: 실패 확인

Run:

```powershell
python -m pytest apps/api/tests/test_weather_report.py -q
```

Expected: module import fails.

### Step 3: 집계 구현

상수:

```python
DAYPART_HOURS = {
    "morning": range(6, 12),
    "afternoon": range(12, 18),
    "evening": range(18, 24),
}
```

집계 규칙:

- 강수확률: 최대
- 강수형태: 위험 순위 `없음 < 빗방울 < 비 < 진눈깨비 < 눈`
- 기온: 최소·최대
- 풍속: 평균·최대
- 습도: 평균
- 하늘: 최빈값, 동률이면 `맑음 < 구름많음 < 흐림`의 보수적 값
- 자료 없음: `available=False`, 수치 `None`

### Step 4: 테스트

Run:

```powershell
python -m pytest apps/api/tests/test_weather_report.py -q
```

Expected: all tests pass.

### Step 5: 커밋

```powershell
git add apps/api/engine/weather_report.py apps/api/tests/test_weather_report.py
git commit -m "[날씨] 여행 시간대별 예보 집계"
```

## Task 3: 장소 유형별 일정 영향 판단

**Files:**

- Modify: `apps/api/engine/weather_report.py`
- Modify: `apps/api/tests/test_weather_report.py`

### Step 1: 실패 테스트 작성

```python
from apps.api.engine.weather_report import evaluate_itinerary_impact


def test_oreum_rain_and_wind_recommends_adjustment():
    impact = evaluate_itinerary_impact(
        item={"id": "p1", "moment": "oreum", "region": "seongsan",
              "date": "2026-07-20", "daypart": "morning", "fixed": False},
        period={"available": True, "precipitation_probability_max": 80,
                "wind_speed_max": 8.0, "precipitation_type": "비"},
    )

    assert impact["status"] == "adjust"
    assert impact["signals"] == ["rain", "wind"]
    assert "기상청 예보" in impact["source_label"]


def test_indoor_place_remains_suitable_in_rain():
    impact = evaluate_itinerary_impact(
        item={"id": "p2", "moment": "culture_stop", "region": "seongsan",
              "date": "2026-07-20", "daypart": "morning", "fixed": False},
        period={"available": True, "precipitation_probability_max": 80,
                "wind_speed_max": 8.0, "precipitation_type": "비"},
    )
    assert impact["status"] == "suitable"
```

자료 없음은 `unknown`, 우도 강풍은 `official_check`, 일반적인 약한 비는 `prepare`인 테스트를 추가한다.

### Step 2: 실패 확인

Run:

```powershell
python -m pytest apps/api/tests/test_weather_report.py -k "impact or oreum or indoor" -q
```

Expected: function import fails.

### Step 3: 정책표 구현

판정 로직을 if문 곳곳에 흩뜨리지 말고 정책표와 작은 함수로 둔다.

```python
MOMENT_WEATHER_PROFILE = {
    "oreum": "outdoor_hike",
    "gotjawal": "outdoor_hike",
    "beach_walk": "coast",
    "sunset": "coast",
    "festival_event": "outdoor_event",
    "local_market": "outdoor_event",
    "culture_stop": "indoor",
    "quiet_cafe": "indoor",
}
```

초기 서비스 판단 기준:

- 야외 강수확률 40% 이상: `prepare`
- 야외 강수확률 70% 이상 또는 실제 강수 형태: `adjust`
- 오름·해안 풍속 4m/s 이상: `prepare`
- 오름·해안 풍속 9m/s 이상: `adjust`
- 우도 풍속 9m/s 이상: `official_check`
- 실내 장소: 강수·바람만으로 이동 제안하지 않음
- 공식 특보가 아닌 값은 빨간 안전 상태로 표시하지 않음

응답에는 `policy_version="weather-travel-v1"`을 넣어 임계값 변경을 추적한다.

### Step 4: 테스트

Run:

```powershell
python -m pytest apps/api/tests/test_weather_report.py -q
```

Expected: all tests pass.

### Step 5: 커밋

```powershell
git add apps/api/engine/weather_report.py apps/api/tests/test_weather_report.py
git commit -m "[날씨] 장소 유형별 일정 영향 판단"
```

## Task 4: 사용자 선택을 보존하는 변경안 생성

**Files:**

- Modify: `apps/api/engine/weather_report.py`
- Modify: `apps/api/tests/test_weather_report.py`

### Step 1: 실패 테스트 작성

```python
from apps.api.engine.weather_report import build_weather_proposals


def test_proposal_swaps_risky_outdoor_with_existing_indoor_item():
    items = [
        {"id": "outdoor", "name": "성산 오름", "day": 1,
         "date": "2026-07-20", "daypart": "morning", "moment": "oreum",
         "region": "seongsan", "fixed": False},
        {"id": "indoor", "name": "제주 전시", "day": 1,
         "date": "2026-07-20", "daypart": "afternoon", "moment": "culture_stop",
         "region": "seongsan", "fixed": False},
    ]
    impacts = [{"item_id": "outdoor", "status": "adjust", "signals": ["rain"]}]

    proposals = build_weather_proposals(items, impacts, dismissed=set())

    assert proposals[0]["operations"] == [
        {"type": "swap_daypart", "item_ids": ["outdoor", "indoor"]}
    ]


def test_fixed_item_is_never_moved():
    ...


def test_dismissed_fingerprint_is_not_returned():
    ...
```

목적지 시간대의 충돌, 대안 없음, 동일 입력 fingerprint 결정론 테스트도 추가한다.

### Step 2: 실패 확인

Run:

```powershell
python -m pytest apps/api/tests/test_weather_report.py -k proposal -q
```

Expected: function import fails.

### Step 3: 최소 생성기 구현

우선순위:

1. 같은 날짜의 실내·저위험 일정과 시간대 교환
2. 다른 날짜의 같은 시간대로 이동
3. 대안이 없으면 `operations=[]`, 재확인 안내

`proposal_id`는 UUID를 쓰되 `fingerprint`는 다음 정규화 값의 SHA-256 앞 16자로 만든다.

```text
policy_version + forecast_issued_at + item_id + from + to + operation_type
```

설명 문구는 template으로 만들고 LLM을 호출하지 않는다.

### Step 4: 테스트

Run:

```powershell
python -m pytest apps/api/tests/test_weather_report.py -q
```

Expected: all tests pass.

### Step 5: 커밋

```powershell
git add apps/api/engine/weather_report.py apps/api/tests/test_weather_report.py
git commit -m "[날씨] 사용자 승인형 일정 변경안 생성"
```

## Task 5: 다중 지역 리포트 API와 부분 성공

**Files:**

- Create: `apps/api/routes/weather_report.py`
- Create: `apps/api/tests/test_weather_report_route.py`
- Modify: `apps/api/main.py`
- Modify: `apps/api/engine/weather_report.py`
- Modify: `apps/api/engine/weather.py`

### Step 1: 실패 라우트 테스트 작성

```python
from fastapi.testclient import TestClient
from apps.api.main import app


def test_weather_report_returns_partial_multi_region_result(monkeypatch):
    def fake_fetch(region, **kwargs):
        if region == "udo":
            return {"available": False, "reason": "timeout", "region": region}
        return {"available": True, "region": region, "issued_at_label": "7월 20일 05시 예보",
                "hourly_forecasts": _hourly_rows(region)}

    monkeypatch.setattr("apps.api.routes.weather_report.weather_mod.smoke_kma_nowcast", fake_fetch)

    response = TestClient(app).post("/weather/report", json=_report_body())

    assert response.status_code == 200
    payload = response.json()
    assert payload["forecast_meta"]["partial"] is True
    assert payload["forecast_meta"]["regions_available"] == ["seongsan"]
    assert payload["forecast_meta"]["regions_unavailable"] == ["udo"]
```

빈 플랜 400, 모든 지역 실패 200+`status=unknown`, 고정 일정 보존 테스트를 추가한다.

### Step 2: 실패 확인

Run:

```powershell
python -m pytest apps/api/tests/test_weather_report_route.py -q
```

Expected: `/weather/report` returns 404.

### Step 3: Pydantic 계약과 route 구현

route의 request model:

```python
class WeatherPlanItemBody(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=200)
    day: int = Field(ge=1, le=14)
    date: date
    daypart: Literal["morning", "afternoon", "evening"]
    start_time: str | None = None
    region: str
    moment: str
    fixed: bool = False


class WeatherReportBody(BaseModel):
    start_date: date
    days: int = Field(ge=1, le=14)
    regions: list[str] = Field(min_length=1, max_length=12)
    items: list[WeatherPlanItemBody] = Field(min_length=1, max_length=100)
    dismissed_proposal_fingerprints: list[str] = Field(default_factory=list, max_length=200)
```

리포트 조립 순서:

1. items에서 실제 사용 지역 추출
2. 지역별 기상 조회
3. 성공 지역 시간대 집계
4. 일정 영향 판단
5. 변경안 생성
6. 전체 headline과 준비물 조립

지역 호출은 실제 일정에 포함된 지역으로 제한하고 `ThreadPoolExecutor(max_workers=min(3, region_count))`로 제한 병렬 조회한다. 각 호출의 기존 8초 timeout은 유지하고, 한 지역의 실패가 다른 지역 결과를 취소하지 않게 한다.

### Step 4: 공개 날씨 호환 필드 추가

`main._public_weather_snapshot`에 `hourly_forecasts`를 추가한다. 기존 field를 제거하지 않는다.

### Step 5: 테스트

Run:

```powershell
python -m pytest apps/api/tests/test_weather_report.py apps/api/tests/test_weather_report_route.py apps/api/tests/test_weather.py -q
```

Expected: all selected tests pass.

### Step 6: 커밋

```powershell
git add apps/api/routes/weather_report.py apps/api/tests/test_weather_report_route.py apps/api/main.py apps/api/engine/weather_report.py apps/api/engine/weather.py
git commit -m "[날씨] 다중 지역 의사결정 리포트 API"
```

## Task 6: 프론트 테스트 기반과 날씨 계약

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`
- Create: `apps/web/src/test/setup.ts`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/api.ts`

### Step 1: 테스트 도구 설치

Run:

```powershell
Set-Location apps/web
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
Set-Location ../..
```

`package.json`에 추가:

```json
"test": "vitest run"
```

### Step 2: Vitest smoke test 작성

`apps/web/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

`vite.config.ts`에 jsdom과 setup file을 지정하고, 작은 `types.test.ts`에서 Vitest가 실행되는지 확인한다.

Run:

```powershell
Set-Location apps/web
npm test
Set-Location ../..
```

Expected: smoke test passes.

### Step 3: 타입 계약 추가

`TravelPlanItem`에 `daypart`, `startTime`, `durationMinutes`, `fixed`, `reservationNote`를 추가한다. 다음 DTO를 추가한다.

```typescript
export type Daypart = 'morning' | 'afternoon' | 'evening';
export type WeatherImpactStatus = 'suitable' | 'prepare' | 'adjust' | 'official_check' | 'unknown';
export interface WeatherDecisionReportDto { /* API 응답과 1:1 */ }
export interface WeatherProposalDto { /* operations 포함 */ }
```

`requestWeatherReport(info, planItems, dismissedFingerprints)`를 `api.ts`에 추가한다.

### Step 4: 타입 검사

Run:

```powershell
Set-Location apps/web
npm run lint
npm test
Set-Location ../..
```

Expected: TypeScript and tests pass.

### Step 5: 커밋

```powershell
git add apps/web/package.json apps/web/package-lock.json apps/web/src/test/setup.ts apps/web/vite.config.ts apps/web/src/types.ts apps/web/src/api.ts
git commit -m "[웹] 날씨 리포트 타입과 테스트 기반 추가"
```

## Task 7: 변경안 원자적 적용과 되돌리기

**Files:**

- Create: `apps/web/src/weatherProposal.ts`
- Create: `apps/web/src/weatherProposal.test.ts`

### Step 1: 실패 테스트 작성

```typescript
it('does not change a plan before explicit apply', () => {
  const plan = samplePlan();
  const snapshot = structuredClone(plan);
  previewWeatherProposal(plan, sampleProposal());
  expect(plan).toEqual(snapshot);
});

it('applies all operations atomically', () => {
  const result = applyWeatherProposal(samplePlan(), sampleProposal());
  expect(result.ok).toBe(true);
  expect(result.items.find((item) => item.id === 'outdoor')?.daypart).toBe('afternoon');
});

it('rejects an outdated proposal without partial changes', () => {
  const proposal = {...sampleProposal(), basePlanFingerprint: 'old'};
  const result = applyWeatherProposal(samplePlan(), proposal);
  expect(result.ok).toBe(false);
  expect(result.items).toEqual(samplePlan());
});

it('restores the exact previous snapshot', () => {
  const before = samplePlan();
  const applied = applyWeatherProposal(before, sampleProposal());
  expect(undoWeatherProposal(applied.items, applied.undo!)).toEqual(before);
});
```

고정 일정 이동 거부와 충돌 operation 전체 취소 테스트를 추가한다.

### Step 2: 실패 확인

Run:

```powershell
Set-Location apps/web
npm test -- weatherProposal.test.ts
Set-Location ../..
```

Expected: module import fails.

### Step 3: 순수 함수 구현

공개 함수:

```typescript
planFingerprint(items: TravelPlanItem[]): string
previewWeatherProposal(items, proposal): ProposalPreview
applyWeatherProposal(items, proposal): ApplyProposalResult
undoWeatherProposal(items, undo): TravelPlanItem[]
```

모든 operation을 복사본에 검증한 뒤 한 번에 반환한다. 원본 배열과 item을 변경하지 않는다.

### Step 4: 테스트

Run:

```powershell
Set-Location apps/web
npm test -- weatherProposal.test.ts
Set-Location ../..
```

Expected: all proposal tests pass.

### Step 5: 커밋

```powershell
git add apps/web/src/weatherProposal.ts apps/web/src/weatherProposal.test.ts
git commit -m "[웹] 날씨 변경안 승인과 되돌리기 구현"
```

## Task 8: 날씨 의사결정 리포트 UI

**Files:**

- Create: `apps/web/src/components/WeatherDecisionReport.tsx`
- Create: `apps/web/src/components/WeatherDecisionReport.test.tsx`

### Step 1: 실패 컴포넌트 테스트 작성

```typescript
it('shows forecast source and affected itinerary', () => {
  render(<WeatherDecisionReport {...propsWithAdjustment()} />);
  expect(screen.getByText('조정 권장')).toBeInTheDocument();
  expect(screen.getByText(/기상청/)).toBeInTheDocument();
  expect(screen.getByText('성산 오름')).toBeInTheDocument();
});

it('does not apply until the user confirms', async () => {
  const onApply = vi.fn();
  render(<WeatherDecisionReport {...propsWithAdjustment()} onApply={onApply} />);
  await userEvent.click(screen.getByRole('button', {name: '변경안 보기'}));
  expect(onApply).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', {name: '변경안 적용'}));
  expect(onApply).toHaveBeenCalledTimes(1);
});

it('renders partial and unknown states without fabricated advice', () => {
  ...
});
```

### Step 2: 실패 확인

Run:

```powershell
Set-Location apps/web
npm test -- WeatherDecisionReport.test.tsx
Set-Location ../..
```

Expected: component import fails.

### Step 3: 컴포넌트 구현

화면 순서:

1. 전체 상태와 headline
2. 발표 시각·지역·부분 성공
3. 날짜 탭
4. 오전·오후·저녁 카드
5. 일정 영향
6. 변경안 accordion 또는 dialog
7. 준비물·재확인

색상만으로 상태를 전달하지 않는다. 버튼은 최소 44px, dialog에는 제목·설명·닫기·focus 복귀를 제공한다. 기존 제주 베이지·민트·감귤 팔레트를 유지한다.

### Step 4: 테스트와 타입 검사

Run:

```powershell
Set-Location apps/web
npm test -- WeatherDecisionReport.test.tsx
npm run lint
Set-Location ../..
```

Expected: tests and TypeScript pass.

### Step 5: 커밋

```powershell
git add apps/web/src/components/WeatherDecisionReport.tsx apps/web/src/components/WeatherDecisionReport.test.tsx
git commit -m "[웹] 여행 날씨 의사결정 리포트 화면 추가"
```

## Task 9: 플랜 상태와 리포트 통합

**Files:**

- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Modify: `apps/web/src/types.ts`
- Create: `apps/web/src/weatherIntegration.test.tsx`

### Step 1: 실패 통합 테스트 작성

```typescript
it('applies a proposal only after approval and exposes undo', async () => {
  render(<WeatherIntegrationHarness />);
  expect(screen.getByText('오전 · 성산 오름')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', {name: '변경안 적용'}));
  expect(screen.getByText('오후 · 성산 오름')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', {name: '되돌리기'}));
  expect(screen.getByText('오전 · 성산 오름')).toBeInTheDocument();
});
```

`기존 일정 유지` 후 fingerprint가 저장되고 같은 리포트에서 숨겨지는 테스트를 추가한다.

### Step 2: 실패 확인

Run:

```powershell
Set-Location apps/web
npm test -- weatherIntegration.test.tsx
Set-Location ../..
```

Expected: integration harness or handlers are missing.

### Step 3: 상태 확장

`SavedTravel`에 선택 필드를 추가한다.

```typescript
weatherDismissedFingerprints?: string[];
weatherUndo?: {
  proposalId: string;
  beforeItems: TravelPlanItem[];
  appliedPlanFingerprint: string;
} | null;
```

기존 localStorage migration에서 누락 필드를 빈 값으로 보정한다.

### Step 4: 시간대 편집과 리포트 연결

- 플랜 항목에 오전·오후·저녁 선택 UI 추가
- `fixed` 토글은 명확한 `시간 고정` 문구 사용
- 플랜이 있고 날짜·지역·시간대가 유효할 때 리포트 요청
- 변경 적용 handler는 `applyWeatherProposal` 결과가 `ok`일 때만 state 교체
- 되돌리기는 fingerprint가 맞을 때만 수행
- 변경 후 리포트 재요청

기존 `WeatherSignalCard`는 리포트 데이터가 없을 때의 compact fallback으로 유지한다.

### Step 5: 테스트와 빌드

Run:

```powershell
Set-Location apps/web
npm test
npm run lint
npm run build
Set-Location ../..
```

Expected: all frontend tests pass, TypeScript passes, production build succeeds.

### Step 6: 커밋

```powershell
git add apps/web/src/App.tsx apps/web/src/components/PackingDashboard.tsx apps/web/src/types.ts apps/web/src/weatherIntegration.test.tsx
git commit -m "[웹] 날씨 추천 승인 흐름을 여행 플랜에 연결"
```

## Task 10: 문서·회귀·전체 검증

**Files:**

- Modify: `README.md`
- Modify: `DECISIONS.md`
- Modify: `TRUST_ENGINE.md`
- Modify: `DEPLOYMENT_STATUS.md`
- Modify if required: `apps/api/engine/trust.py`
- Modify if required: `apps/api/tests/test_trust_score.py`

### Step 1: 결정과 계약 문서화

`DECISIONS.md`에 다음을 기록한다.

- 날씨 변경안은 추천이며 사용자 승인 없이 플랜을 수정하지 않는다.
- 기상청 원본과 서비스 판단 정책을 구분한다.
- 부분 실패 시 확인된 지역만 제공하고 예보 없는 일정의 위험을 만들지 않는다.

`TRUST_ENGINE.md`에는 장소의 날씨 적합도가 해당 일정 지역·날짜·시간대 리포트에서 와야 한다는 계약을 추가한다.

### Step 2: Trust Engine 회귀 확인

현재 `/pack`은 첫 지역의 compact weather snapshot을 사용한다. 새 리포트를 기존 Trust 점수에 무리하게 끼워 넣지 않는다. 1차에서는 카드별 상세 영향은 weather report에서 제공하고 기존 점수 계약은 유지한다.

Run:

```powershell
python -m pytest apps/api/tests/test_trust_score.py apps/api/tests/test_pack_integration.py -q
```

Expected: existing trust and pack tests pass.

### Step 3: 백엔드 전체 테스트

Run:

```powershell
python -m pytest -q
```

Expected: no failures. Existing environment-dependent skips may remain with unchanged reasons.

### Step 4: 프론트 전체 검증

Run:

```powershell
Set-Location apps/web
npm test
npm run lint
npm run build
Set-Location ../..
```

Expected: tests, TypeScript, and production build pass.

### Step 5: 변경 검사

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and only intended files remain.

### Step 6: 최종 커밋

```powershell
git add README.md DECISIONS.md TRUST_ENGINE.md DEPLOYMENT_STATUS.md
git commit -m "[문서] 날씨 의사결정 리포트 운영 계약 반영"
```

## 출시 확인 시나리오

1. 성산 오름을 오전, 실내 전시를 오후로 담는다.
2. 오전 강수확률·풍속이 조정 기준을 넘는 기상 fixture를 사용한다.
3. 리포트가 기존 일정은 그대로 둔 채 변경안을 표시하는지 확인한다.
4. `기존 일정 유지`를 선택하고 같은 제안이 반복되지 않는지 확인한다.
5. fixture의 위험 단계를 높였을 때만 다시 표시되는지 확인한다.
6. `변경안 적용` 전 미리보기와 적용 결과가 같은지 확인한다.
7. `되돌리기`로 원래 플랜이 복원되는지 확인한다.
8. 우도 지역 조회만 실패하게 하고 다른 지역 리포트가 유지되는지 확인한다.
9. 예보 범위 밖 날짜에서 변경안이 생성되지 않는지 확인한다.
10. 기상청 키 없이 기존 플랜·후보·PDF 기능이 계속 동작하는지 확인한다.

# Pack Your Jeju Service Evolution Phase 0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 공개 베타 전에 모델·검색 설정, 준비 상태, 요청 추적, 외부 호출 관측, 관리자 지표 보호, 프론트 번들 예산과 배포 스모크 검사를 갖춘다.

**Architecture:** 기존 Vercel React PWA와 Railway FastAPI 구조를 유지한다. 운영 설정은 하나의 타입으로 모으고, 요청 ID를 API부터 외부 검색·모델 로그까지 전달한다. Railway 준비 상태는 핵심 의존성만으로 판단하고, 선택 의존성 장애는 제한 상태로 노출한다.

**Tech Stack:** Python 3.11, FastAPI, Pydantic, SQLAlchemy, Pytest, React 19, TypeScript, Vite, PowerShell/Railway/Vercel

---

## 범위와 완료 기준

이 계획은 6개월 로드맵의 `0단계 운영 기반 정비`만 구현한다. 실제 Supabase 로그인과 사용자별 플랜 동기화는 Phase 1 계획으로 분리한다.

완료 조건:

- 모델명·timeout·출력 제한이 코드와 `.env.example`에서 일치한다.
- `/health/live`와 `/health/ready`가 생존 여부와 운영 준비 여부를 구분한다.
- 모든 API 응답에 `X-Request-ID`가 있고 외부 호출 로그와 연결된다.
- LLM·웹 검색 호출의 공급자, 모델, 상태, 지연, token 사용량, 오류 종류를 비밀값 없이 기록한다.
- 운영 지표 API가 운영자 권한 없이 노출되지 않는다.
- 프론트 프로덕션 빌드의 초기 JavaScript 번들이 설정한 예산을 넘으면 검증이 실패한다.
- 배포 후 핵심 엔드포인트를 한 명령으로 스모크 검사할 수 있다.
- 백엔드 테스트, 프론트 타입 검사, 빌드와 번들 예산 검사가 통과한다.

## Task 1: 운영 설정의 단일 권위 만들기

**Files:**

- Create: `apps/api/settings.py`
- Create: `apps/api/tests/test_settings.py`
- Modify: `apps/api/engine/llm.py`
- Modify: `apps/api/engine/haruban.py`
- Modify: `.env.example`
- Modify: `DECISIONS.md`

### Step 1: 실패 테스트 작성

`apps/api/tests/test_settings.py`를 만든다.

```python
from apps.api.settings import load_operational_settings


def test_operational_settings_have_safe_defaults(monkeypatch):
    for key in (
        "PYJ_CHAT_MODEL",
        "PYJ_WEB_SEARCH_MODEL",
        "PYJ_LLM_TIMEOUT_SECONDS",
        "PYJ_WEB_SEARCH_TIMEOUT_SECONDS",
    ):
        monkeypatch.delenv(key, raising=False)

    settings = load_operational_settings()

    assert settings.chat_model == "gpt-5-mini"
    assert settings.web_search_model == "gpt-4o"
    assert settings.llm_timeout_seconds == 15.0
    assert settings.web_search_timeout_seconds == 18.0


def test_operational_settings_reject_non_positive_timeout(monkeypatch):
    monkeypatch.setenv("PYJ_LLM_TIMEOUT_SECONDS", "0")

    try:
        load_operational_settings()
    except ValueError as error:
        assert "PYJ_LLM_TIMEOUT_SECONDS" in str(error)
    else:
        raise AssertionError("invalid timeout must fail")
```

### Step 2: 실패 확인

Run:

```powershell
python -m pytest apps/api/tests/test_settings.py -q
```

Expected: `ModuleNotFoundError: No module named 'apps.api.settings'`

### Step 3: 최소 설정 타입 구현

`apps/api/settings.py`에 불변 dataclass와 환경변수 파서를 만든다.

```python
from __future__ import annotations

import os
from dataclasses import dataclass


def _positive_float(name: str, default: float) -> float:
    raw = os.environ.get(name, str(default)).strip()
    value = float(raw)
    if value <= 0:
        raise ValueError(f"{name} must be positive")
    return value


@dataclass(frozen=True)
class OperationalSettings:
    chat_model: str
    web_search_model: str
    llm_timeout_seconds: float
    web_search_timeout_seconds: float
    web_search_max_output_tokens: int


def load_operational_settings() -> OperationalSettings:
    return OperationalSettings(
        chat_model=os.environ.get("PYJ_CHAT_MODEL", "gpt-5-mini").strip() or "gpt-5-mini",
        web_search_model=os.environ.get("PYJ_WEB_SEARCH_MODEL", "gpt-4o").strip() or "gpt-4o",
        llm_timeout_seconds=_positive_float("PYJ_LLM_TIMEOUT_SECONDS", 15.0),
        web_search_timeout_seconds=_positive_float("PYJ_WEB_SEARCH_TIMEOUT_SECONDS", 18.0),
        web_search_max_output_tokens=int(
            os.environ.get("PYJ_WEB_SEARCH_MAX_OUTPUT_TOKENS", "2200")
        ),
    )
```

`llm.py`와 `haruban.py`의 모델·timeout 상수를 이 설정에서 읽게 한다. OpenAI 클라이언트에는 `timeout`과 `max_retries=0`을 명시한다. 기존 키 미설정 폴백은 유지한다.

`.env.example`의 `gpt-5.3-mini 고정` 문구를 제거하고 실제 기본값과 운영 변수 다섯 개를 기록한다. `DECISIONS.md`에는 모델·검색 공급자를 운영 설정으로 관리하되 배포 전 평가를 통과해야 한다는 결정을 추가한다.

### Step 4: 단위·회귀 테스트

Run:

```powershell
python -m pytest apps/api/tests/test_settings.py apps/api/tests/test_llm.py apps/api/tests/test_haruban_agent.py -q
```

Expected: all selected tests pass.

### Step 5: 커밋

```powershell
git add apps/api/settings.py apps/api/tests/test_settings.py apps/api/engine/llm.py apps/api/engine/haruban.py .env.example DECISIONS.md
git commit -m "[운영] 모델과 검색 설정 단일화"
```

## Task 2: 생존 상태와 준비 상태 분리

**Files:**

- Create: `apps/api/readiness.py`
- Create: `apps/api/tests/test_readiness.py`
- Modify: `apps/api/main.py`
- Modify: `railway.toml`
- Modify: `README.md`

### Step 1: 실패 테스트 작성

```python
from fastapi.testclient import TestClient

from apps.api.main import app


def test_liveness_does_not_depend_on_database():
    response = TestClient(app).get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}


def test_readiness_returns_503_when_database_is_down(monkeypatch):
    monkeypatch.setattr("apps.api.readiness.db.ping", lambda: False)
    response = TestClient(app).get("/health/ready")
    assert response.status_code == 503
    payload = response.json()
    assert payload["status"] == "not_ready"
    assert payload["checks"]["database"] == "failed"


def test_readiness_marks_optional_llm_as_degraded(monkeypatch):
    monkeypatch.setattr("apps.api.readiness.db.ping", lambda: True)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = TestClient(app).get("/health/ready")
    assert response.status_code == 200
    assert response.json()["checks"]["llm"] == "degraded"
```

### Step 2: 실패 확인

Run:

```powershell
python -m pytest apps/api/tests/test_readiness.py -q
```

Expected: `/health/live` and `/health/ready` return 404.

### Step 3: 준비 상태 구현

`apps/api/readiness.py`에서 핵심과 선택 의존성을 분리한다.

- 핵심: DB 연결, bootstrap 실패 0건
- 선택: OpenAI 키, 기상청 키, Supabase Auth/Storage 설정
- 핵심 실패: HTTP 503, `status=not_ready`
- 선택 실패: HTTP 200, `status=degraded`
- 키 값이나 접속 문자열은 절대 응답하지 않는다.

`/health`는 기존 호환 응답을 유지한다. Railway의 `healthcheckPath`만 `/health/ready`로 바꾼다.

### Step 4: 테스트와 문서 확인

Run:

```powershell
python -m pytest apps/api/tests/test_readiness.py -q
```

Expected: all tests pass.

### Step 5: 커밋

```powershell
git add apps/api/readiness.py apps/api/tests/test_readiness.py apps/api/main.py railway.toml README.md
git commit -m "[운영] 서비스 준비 상태 분리"
```

## Task 3: 요청 ID와 안전한 구조화 로그 연결

**Files:**

- Create: `apps/api/request_context.py`
- Create: `apps/api/tests/test_request_context.py`
- Modify: `apps/api/main.py`
- Modify: `apps/api/logging.py`
- Modify: `apps/api/tests/test_event_logging.py`

### Step 1: 실패 테스트 작성

```python
from fastapi.testclient import TestClient

from apps.api.main import app
from apps.api.request_context import current_request_id


def test_api_returns_request_id_header():
    response = TestClient(app).get("/health/live")
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]


def test_valid_client_request_id_is_preserved():
    response = TestClient(app).get(
        "/health/live",
        headers={"X-Request-ID": "client-123"},
    )
    assert response.headers["X-Request-ID"] == "client-123"


def test_request_context_is_empty_outside_request():
    assert current_request_id() is None
```

`test_event_logging.py`에는 `request_id`가 자동 포함되고 `authorization`, API key, token, cookie가 제거되는 테스트를 추가한다.

### Step 2: 실패 확인

Run:

```powershell
python -m pytest apps/api/tests/test_request_context.py apps/api/tests/test_event_logging.py -q
```

Expected: request context module or response header assertion fails.

### Step 3: 미들웨어 구현

`ContextVar[str | None]`로 요청 ID를 저장한다.

- 유효한 `X-Request-ID`가 있으면 재사용
- 없거나 128자를 넘으면 UUID 생성
- 모든 응답에 `X-Request-ID` 추가
- 처리 완료 로그에 method, path, status, latency만 기록
- query, prompt, authorization, cookie, API key는 기록하지 않음

`log_contribution_event`와 새 운영 로그 함수는 현재 요청 ID를 자동으로 포함한다.

### Step 4: 테스트

Run:

```powershell
python -m pytest apps/api/tests/test_request_context.py apps/api/tests/test_event_logging.py -q
```

Expected: all tests pass.

### Step 5: 커밋

```powershell
git add apps/api/request_context.py apps/api/tests/test_request_context.py apps/api/main.py apps/api/logging.py apps/api/tests/test_event_logging.py
git commit -m "[운영] 요청 추적과 로그 비밀값 보호"
```

## Task 4: LLM·웹 검색 호출 관측

**Files:**

- Create: `apps/api/tests/test_provider_logging.py`
- Modify: `apps/api/logging.py`
- Modify: `apps/api/engine/llm.py`
- Modify: `apps/api/engine/haruban.py`
- Modify: `apps/api/tests/test_llm.py`
- Modify: `apps/api/tests/test_haruban_agent.py`

### Step 1: 실패 테스트 작성

```python
import json
import logging

from apps.api.logging import log_provider_call


def test_provider_log_contains_operational_fields_without_prompt(caplog):
    with caplog.at_level(logging.INFO, logger="pack_your_jeju.providers"):
        payload = log_provider_call(
            provider="openai",
            model="gpt-5-mini",
            operation="chat",
            status="success",
            latency_ms=321,
            input_tokens=100,
            output_tokens=50,
            prompt="must-not-be-logged",
        )

    assert payload["provider"] == "openai"
    assert payload["latency_ms"] == 321
    assert "prompt" not in payload
    assert "must-not-be-logged" not in caplog.records[-1].message
    assert json.loads(caplog.records[-1].message)["status"] == "success"
```

LLM과 웹 검색 테스트에는 성공, timeout, 일반 오류, 캐시 적중 각각 한 건의 provider event가 발생하는지 확인한다.

### Step 2: 실패 확인

Run:

```powershell
python -m pytest apps/api/tests/test_provider_logging.py -q
```

Expected: `log_provider_call` import fails.

### Step 3: 관측 구현

`log_provider_call`은 다음 필드만 허용한다.

```python
{
    "event": "provider_call",
    "request_id": "...",
    "provider": "openai",
    "model": "gpt-5-mini",
    "operation": "chat|tool_call|web_search",
    "status": "success|timeout|error|cache_hit|unavailable",
    "latency_ms": 321,
    "input_tokens": 100,
    "output_tokens": 50,
    "source_count": 3,
    "error_class": "APITimeoutError",
}
```

프롬프트, 사용자 질문 원문, 검색어 원문, 응답 본문, 키와 token은 기록하지 않는다. OpenAI 응답에 usage가 없으면 token 필드는 `None`으로 둔다. 오류 메시지 전체 대신 오류 클래스만 기록한다.

### Step 4: 테스트

Run:

```powershell
python -m pytest apps/api/tests/test_provider_logging.py apps/api/tests/test_llm.py apps/api/tests/test_haruban_agent.py -q
```

Expected: all selected tests pass.

### Step 5: 커밋

```powershell
git add apps/api/tests/test_provider_logging.py apps/api/logging.py apps/api/engine/llm.py apps/api/engine/haruban.py apps/api/tests/test_llm.py apps/api/tests/test_haruban_agent.py
git commit -m "[운영] 외부 AI 호출 관측 추가"
```

## Task 5: 관리자 운영 지표 보호와 공개 지표 최소화

**Files:**

- Create: `apps/api/routes/ops_admin.py`
- Create: `apps/api/tests/test_ops_admin.py`
- Modify: `apps/api/main.py`
- Modify: `apps/api/auth.py`
- Modify: `apps/api/routes/__init__.py`

### Step 1: 실패 테스트 작성

```python
from fastapi.testclient import TestClient

from apps.api.main import app


client = TestClient(app)


def test_admin_metrics_requires_login():
    response = client.get("/admin/metrics")
    assert response.status_code == 401


def test_admin_metrics_rejects_normal_user(monkeypatch, user_headers):
    response = client.get("/admin/metrics", headers=user_headers(role="user"))
    assert response.status_code == 403


def test_admin_metrics_allows_operator(monkeypatch, user_headers):
    response = client.get("/admin/metrics", headers=user_headers(role="operator"))
    assert response.status_code != 401
    assert response.status_code != 403
```

기존 `test_moderation_admin.py`의 인증 fixture를 공통화해 재사용한다.

### Step 2: 실패 확인

Run:

```powershell
python -m pytest apps/api/tests/test_ops_admin.py -q
```

Expected: current `/admin/metrics` returns 200 or DB-dependent status without auth.

### Step 3: 라우터 이동과 권한 적용

- `main.py`의 `/admin/metrics`를 `routes/ops_admin.py`로 이동
- `Depends(require_operator)` 적용
- 응답에서 사용자 질문·프롬프트·actor 식별값 제외
- DB 장애는 구조화된 `503 {"code":"metrics_unavailable","request_id":"..."}` 반환
- main에는 라우터 include만 남김

### Step 4: 테스트

Run:

```powershell
python -m pytest apps/api/tests/test_ops_admin.py apps/api/tests/test_moderation_admin.py -q
```

Expected: all tests pass.

### Step 5: 커밋

```powershell
git add apps/api/routes/ops_admin.py apps/api/tests/test_ops_admin.py apps/api/main.py apps/api/auth.py apps/api/routes/__init__.py
git commit -m "[보안] 운영 지표 관리자 권한 적용"
```

## Task 6: 초기 JavaScript 번들 예산 적용

**Files:**

- Create: `apps/web/scripts/check-bundle-budget.mjs`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/vite.config.ts`

### Step 1: 실패하는 번들 예산 검사 작성

`apps/web/scripts/check-bundle-budget.mjs`는 `dist/assets/index-*.js` 중 초기 엔트리 파일의 크기를 읽고 650 KiB를 넘으면 exit 1을 반환한다.

```javascript
import {readdir, stat} from 'node:fs/promises';
import path from 'node:path';

const assets = path.resolve('dist/assets');
const files = (await readdir(assets)).filter(
  (name) => /^index-.*\.js$/.test(name),
);
const sizes = await Promise.all(
  files.map(async (name) => ({
    name,
    bytes: (await stat(path.join(assets, name))).size,
  })),
);
const entry = sizes.sort((a, b) => b.bytes - a.bytes)[0];
const limit = 650 * 1024;

if (!entry || entry.bytes > limit) {
  console.error(`initial bundle exceeds budget: ${entry?.bytes ?? 0} > ${limit}`);
  process.exit(1);
}
console.log(`initial bundle within budget: ${entry.bytes} <= ${limit}`);
```

`package.json`에 추가한다.

```json
"build:budget": "npm run build && node scripts/check-bundle-budget.mjs"
```

### Step 2: 현재 실패 확인

Run:

```powershell
npm run build:budget
```

Expected: current initial bundle, approximately 728 KiB, exceeds the 650 KiB budget.

### Step 3: 화면 단위 코드 분할

`App.tsx`의 비초기 화면을 `React.lazy`로 변경한다.

- `VerifyPage`
- `TravelFeedback`
- `TrustMapDashboard`
- PDF 편집기와 관리자 화면이 상위 컴포넌트에서 정적 import되면 함께 분리

`Suspense` fallback은 기존 제주 디자인의 작은 skeleton을 사용한다. `vite.config.ts`에는 React, markdown/PDF처럼 안정적인 큰 vendor 그룹만 `manualChunks`로 분리한다. 임의로 세분화하지 않는다.

### Step 4: 예산과 타입 검사

Run:

```powershell
npm run lint
npm run build:budget
```

Expected: TypeScript passes and the initial entry chunk is no larger than 650 KiB.

### Step 5: 커밋

```powershell
git add apps/web/scripts/check-bundle-budget.mjs apps/web/package.json apps/web/src/App.tsx apps/web/vite.config.ts
git commit -m "[웹] 초기 번들 예산과 화면 분할 적용"
```

## Task 7: 배포 스모크 검사와 운영 런북

**Files:**

- Create: `scripts/smoke_service.py`
- Create: `apps/api/tests/test_smoke_contract.py`
- Create: `docs/operations/BETA_RUNBOOK.md`
- Modify: `DEPLOYMENT_STATUS.md`
- Modify: `README.md`

### Step 1: 스모크 계약 테스트 작성

원격 호출을 직접 테스트하지 않는다. `httpx.MockTransport`로 다음 계약을 검증한다.

```python
def test_smoke_requires_live_ready_and_pack_success(mock_transport):
    result = run_smoke(
        api_base_url="https://api.example.com",
        web_url="https://web.example.com",
        transport=mock_transport,
    )
    assert result.failed == 0
    assert {check.name for check in result.checks} >= {
        "web",
        "live",
        "ready",
        "coverage",
        "pack",
    }
```

준비 상태 503, pack 5xx, HTML 응답, timeout 각각 exit code 1이 되는 테스트를 추가한다.

### Step 2: 실패 확인

Run:

```powershell
python -m pytest apps/api/tests/test_smoke_contract.py -q
```

Expected: `scripts.smoke_service` import fails.

### Step 3: 스모크 스크립트 구현

CLI:

```powershell
python scripts/smoke_service.py `
  --web-url https://pack-your-jeju.vercel.app `
  --api-base-url https://pack-your-jeju-production.up.railway.app
```

검사 항목:

- Web GET 200과 HTML
- `/health/live` 200
- `/health/ready` 200, status `ready|degraded`
- `/region/coverage-preview?region=jeju_city` 200
- 최소 `/pack` 요청 200과 JSON 계약

기본 timeout은 요청당 10초, 전체 30초로 제한한다. 응답 본문 전체나 비밀값은 출력하지 않는다.

### Step 4: 베타 런북 작성

`docs/operations/BETA_RUNBOOK.md`에 다음을 기록한다.

- 배포 전 검사
- Railway/Vercel 환경변수 이름 목록과 소유 위치
- 키 교체 절차
- 하루방 지연·검색 timeout·DB 장애 대응
- 비용 급증 시 보호 모드
- 배포 후 스모크 명령
- 롤백 판단 기준
- 사용자 문의와 개인정보 삭제 처리

실제 키 값, 관리자 URL, 개인 이메일은 넣지 않는다.

### Step 5: 테스트

Run:

```powershell
python -m pytest apps/api/tests/test_smoke_contract.py -q
python scripts/smoke_service.py --help
```

Expected: tests pass and CLI help exits 0.

### Step 6: 커밋

```powershell
git add scripts/smoke_service.py apps/api/tests/test_smoke_contract.py docs/operations/BETA_RUNBOOK.md DEPLOYMENT_STATUS.md README.md
git commit -m "[운영] 공개 베타 스모크와 대응 런북 추가"
```

## Task 8: 전체 검증과 Phase 1 진입 판단

**Files:**

- Modify if needed: `DEPLOYMENT_STATUS.md`
- Modify if a decision changes: `DECISIONS.md`

### Step 1: 백엔드 전체 테스트

Run:

```powershell
python -m pytest -q
```

Expected: no failures. Existing environment-dependent skipped tests may remain skipped with their reason unchanged.

### Step 2: 프론트 전체 검증

Run:

```powershell
Set-Location apps/web
npm run lint
npm run build:budget
Set-Location ../..
```

Expected: TypeScript passes, production build succeeds, bundle budget passes.

### Step 3: 변경 검사

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and only intended files are modified.

### Step 4: 로컬 API 스모크

API를 별도 터미널에서 실행한다.

```powershell
python scripts/run_local_api.py
```

다른 터미널에서:

```powershell
python scripts/smoke_service.py `
  --web-url http://localhost:3000 `
  --api-base-url http://localhost:8000
```

Expected: all configured checks pass or optional providers are explicitly reported as degraded.

### Step 5: 문서와 결정 동기화

- 실제 기본 모델·timeout이 `.env.example`, `DECISIONS.md`, 코드에서 일치하는지 확인
- `DEPLOYMENT_STATUS.md`에 검증 일자와 실제 결과만 기록
- 남은 Phase 1 항목을 실제 로그인·플랜 동기화로 제한

### Step 6: 최종 커밋

```powershell
git add DEPLOYMENT_STATUS.md DECISIONS.md
git commit -m "[운영] 베타 기반 검증 결과 반영"
```

## Phase 1 진입 게이트

다음 조건을 모두 충족할 때만 실제 회원·플랜 동기화 구현 계획을 시작한다.

- 최근 배포의 `/health/ready`가 핵심 의존성 실패 없이 응답
- 하루방 timeout과 일반 오류가 서로 구분되어 로그에 남음
- 요청 ID로 사용자 오류와 공급자 로그를 연결 가능
- 운영 지표가 비회원에게 노출되지 않음
- 초기 번들이 650 KiB 예산 이내
- 배포 스모크 검사와 롤백 절차를 한 사람이 재현 가능
- 백엔드 전체 테스트와 프론트 검증 통과

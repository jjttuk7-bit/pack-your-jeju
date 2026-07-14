# Plan Feedback Trust Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 공공데이터·하루방 웹검색·사용자 직접입력으로 만든 여행 플랜을 저장하고, 로그인 사용자의 방문 피드백을 검증 가능한 근거 원장으로 축적해 운영자 승인 후 다음 하루방 추천에 반영한다.

**Architecture:** React/Vite 클라이언트는 비회원 플랜을 로컬에 보존하고 로그인 후 서버 플랜으로 멱등 병합한다. Railway의 FastAPI는 인증, 플랜, 장소 정규화, 피드백, 신뢰 프로필, 운영자 검토 API를 담당하고, Supabase PostgreSQL/Auth/비공개 Storage는 사용자·장기 데이터·증빙을 관리한다. 공공데이터 원본은 불변으로 유지하고 승인된 보정은 별도 버전 테이블에서 읽는다.

**Tech Stack:** Python 3.11, FastAPI, Pydantic 2, SQLAlchemy Core, PostgreSQL 15+, pgvector, pg_trgm, Supabase Auth/Storage/RLS, React 19, TypeScript 5.8, Vite 6, pytest 8

---

## 구현 전 원칙

- 작업은 별도 `codex/plan-feedback-trust-loop` worktree에서 수행한다.
- `TRUST_ENGINE.md`, `DECISIONS.md`의 D-28·D-29, 설계 문서를 먼저 읽는다.
- 기존 `/visit-signals`와 로컬 저장 플랜은 하위 호환으로 유지한다.
- 사용자 제보는 `place`와 공공데이터 원본을 직접 갱신하지 않는다.
- Supabase service-role key와 증빙 원본 URL은 브라우저 응답 또는 로그에 노출하지 않는다.
- 각 작업은 실패 테스트, 최소 구현, 통과 확인, 작은 커밋 순서로 진행한다.

### Task 1: 근거 원장 스키마와 부트스트랩 계약

**Files:**
- Modify: `packages/schema/init.sql`
- Create: `apps/api/tests/test_contribution_schema.py`
- Modify: `apps/api/bootstrap.py`

**Step 1: Write the failing schema contract test**

`apps/api/tests/test_contribution_schema.py`에 스키마가 다음 테이블과 제약을 포함하는지 검사한다.

```python
from pathlib import Path


SCHEMA = Path("packages/schema/init.sql").read_text(encoding="utf-8")


def test_contribution_ledger_tables_exist():
    for table in (
        "user_profile", "travel_plan", "plan_item", "evidence",
        "visit_feedback", "evidence_asset", "moderation_case",
        "moderation_decision", "place_trust_profile", "public_data_correction",
    ):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in SCHEMA


def test_public_data_correction_is_versioned_and_never_updates_place():
    assert "supersedes_id UUID" in SCHEMA
    assert "approved_by UUID" in SCHEMA
    assert "UPDATE place SET" not in SCHEMA.split("public_data_correction", 1)[1]
```

**Step 2: Run the test to verify it fails**

Run: `python -m pytest apps/api/tests/test_contribution_schema.py -v`

Expected: FAIL because the new ledger tables do not exist.

**Step 3: Add the append-only tables**

Add idempotent DDL for:

- `user_profile(id, auth_subject, display_name, role, status, created_at)`
- `travel_plan(id, owner_id, client_plan_id, title, start_date, days, regions, companion, purpose, visibility, created_at, updated_at)` with `UNIQUE(owner_id, client_plan_id)`
- `plan_item(id, plan_id, place_id, client_item_id, source_type, source_snapshot, day, visit_date, note, created_at)` with `UNIQUE(plan_id, client_item_id)`
- `evidence(id, place_id, plan_item_id, source_class, claim_type, claim_key, claim_value, url, checked_at, support_status, payload, created_at)`
- `visit_feedback(id, plan_item_id, author_id, visit_status, operation_status, mismatch_types, experience_tags, memo, submission_weight, moderation_status, created_at)`
- `evidence_asset(id, feedback_id, owner_id, asset_type, storage_path, verification_status, redacted_at, deleted_at, created_at)`
- `moderation_case(id, place_id, case_type, claim_key, status, priority, research_status, opened_at, updated_at)`
- `moderation_decision(id, case_id, reviewer_id, decision, rationale, evidence_ids, supersedes_id, created_at)`
- `place_trust_profile(place_id, identity_confidence, operation_confidence, freshness_status, field_confidence, reasons, calculated_at)`
- `public_data_correction(id, place_id, claim_key, corrected_value, decision_id, approved_by, effective_from, supersedes_id, revoked_at, created_at)`

Use explicit `CHECK` constraints for source, status, role, visibility and decision values. Add indexes for plan owner, feedback place/time, open moderation priority and current corrections.

**Step 4: Keep bootstrap idempotent**

Add a regression test to `test_contribution_schema.py` for `_split_statements()` and change `bootstrap.py` only if the new DDL contains syntax the current splitter cannot handle. Do not introduce triggers or `DO $$` blocks in this phase.

**Step 5: Run schema and existing API tests**

Run: `python -m pytest apps/api/tests/test_contribution_schema.py apps/api/tests/test_visit_signals.py -v`

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/schema/init.sql apps/api/bootstrap.py apps/api/tests/test_contribution_schema.py
git commit -m "[데이터] 플랜 피드백 근거 원장 스키마 추가"
```

### Task 2: 공급자 독립적인 인증 경계

**Files:**
- Modify: `pyproject.toml`
- Modify: `.env.example`
- Create: `apps/api/auth.py`
- Create: `apps/api/tests/test_auth.py`
- Modify: `apps/api/main.py`

**Step 1: Write failing authentication tests**

```python
def test_require_user_rejects_missing_bearer(client):
    response = client.post("/plans", json={"client_plan_id": "guest-1"})
    assert response.status_code == 401


def test_require_admin_rejects_normal_user(client, user_token):
    response = client.get(
        "/admin/moderation-cases", headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 403
```

Mock JWKS verification; tests must not call Supabase or the internet.

**Step 2: Run and verify failure**

Run: `python -m pytest apps/api/tests/test_auth.py -v`

Expected: FAIL because the dependencies and routes do not exist.

**Step 3: Implement `CurrentUser` and JWT verification**

Add `PyJWT[crypto]>=2.9` to `pyproject.toml`. Implement:

```python
@dataclass(frozen=True)
class CurrentUser:
    subject: str
    profile_id: str
    role: Literal["user", "moderator", "admin"]


def require_user(credentials=Depends(bearer)) -> CurrentUser: ...
def require_admin(user=Depends(require_user)) -> CurrentUser: ...
```

Verify issuer, audience, expiry and signature from `SUPABASE_JWKS_URL`. Cache JWKS with a bounded TTL. Return structured 401/403 errors and never log the token.

**Step 4: Document environment variables**

Add `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_AUDIENCE`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_EVIDENCE_BUCKET`. Clearly mark the service-role key as server-only.

**Step 5: Run tests**

Run: `python -m pytest apps/api/tests/test_auth.py -v`

Expected: PASS for missing, expired, wrong audience, normal user and admin cases.

**Step 6: Commit**

```bash
git add pyproject.toml .env.example apps/api/auth.py apps/api/tests/test_auth.py apps/api/main.py
git commit -m "[서버] Supabase 인증 경계 추가"
```

### Task 3: 플랜 저장과 비회원 플랜 멱등 병합

**Files:**
- Create: `apps/api/engine/plans.py`
- Create: `apps/api/routes/plans.py`
- Create: `apps/api/tests/test_plans.py`
- Modify: `apps/api/main.py`

**Step 1: Write failing plan API tests**

Cover:

- authenticated `POST /plans` creates a plan;
- repeating the same `client_plan_id` returns the same plan;
- three source types coexist in one plan;
- server ignores an owner id supplied in the body;
- `GET /plans/{id}` rejects another user;
- deleting an item does not delete its `Place` or evidence.

Use this request shape:

```json
{
  "client_plan_id": "local-uuid",
  "title": "애월 2박 3일",
  "start_date": "2026-08-01",
  "days": 3,
  "regions": ["aewol"],
  "companion": "friend",
  "purpose": "food",
  "items": [{
    "client_item_id": "web-1",
    "source_type": "web_search",
    "name": "후보 장소",
    "source_snapshot": {"url": "https://example.com", "checked_at": "2026-07-14T00:00:00Z"}
  }]
}
```

**Step 2: Run and verify failure**

Run: `python -m pytest apps/api/tests/test_plans.py -v`

Expected: FAIL with route not found.

**Step 3: Implement plan contracts and persistence**

Implement `create_or_merge_plan`, `get_plan`, `upsert_plan_item`, `remove_plan_item`. Use one transaction and `ON CONFLICT (owner_id, client_plan_id)` so a retry never duplicates the plan or items. Preserve `source_snapshot` without replacing missing fields with current place data.

**Step 4: Register routes**

Add:

- `POST /plans`
- `GET /plans`
- `GET /plans/{plan_id}`
- `PUT /plans/{plan_id}/items/{client_item_id}`
- `DELETE /plans/{plan_id}/items/{client_item_id}`

All routes require `CurrentUser` and enforce ownership in SQL.

**Step 5: Run tests**

Run: `python -m pytest apps/api/tests/test_plans.py -v`

Expected: PASS, including idempotent retry and cross-user denial.

**Step 6: Commit**

```bash
git add apps/api/engine/plans.py apps/api/routes/plans.py apps/api/tests/test_plans.py apps/api/main.py
git commit -m "[서버] 사용자 여행 플랜 저장 API 추가"
```

### Task 4: 사용자 직접입력 장소 정규화와 검토 대기

**Files:**
- Create: `apps/api/engine/place_identity.py`
- Create: `apps/api/tests/test_place_identity.py`
- Modify: `apps/api/engine/plans.py`
- Modify: `apps/api/routes/plans.py`

**Step 1: Write failing identity tests**

Test exact external-id matches, normalized address matches, close coordinates with similar Korean names, and ambiguous same-name places. An ambiguous result must be `needs_review`, not a new shared place.

```python
def test_ambiguous_user_place_waits_for_review(fake_places):
    result = resolve_user_place(
        name="바다카페", address=None, lat=None, lng=None, candidates=fake_places
    )
    assert result.status == "needs_review"
    assert result.place_id is None
```

**Step 2: Run and verify failure**

Run: `python -m pytest apps/api/tests/test_place_identity.py -v`

Expected: FAIL because `resolve_user_place` does not exist.

**Step 3: Implement deterministic matching**

Normalize whitespace, punctuation, 제주 행정구역 prefixes and road-address forms. Use pg_trgm only to retrieve candidates; make the final decision from explicit thresholds for name similarity, normalized address equality and coordinate distance. Return `matched`, `new_candidate`, or `needs_review` with reasons.

**Step 4: Connect direct input to plan upsert**

For `source_type=user_input`, save the plan item immediately. Link to an existing place only on a confident match. For `new_candidate` or `needs_review`, create a `ModerationCase` without publishing a shared place.

Add an admin-only promotion operation that requires one official or reliable platform source directly supporting place existence and address. Store `community_verified` internally in the first release, but keep public recommendation exposure behind `COMMUNITY_CANDIDATES_ENABLED=false` until Task 13 rollout approval.

**Step 5: Run tests**

Run: `python -m pytest apps/api/tests/test_place_identity.py apps/api/tests/test_plans.py -v`

Expected: PASS with deterministic outcomes.

**Step 6: Commit**

```bash
git add apps/api/engine/place_identity.py apps/api/tests/test_place_identity.py apps/api/engine/plans.py apps/api/routes/plans.py
git commit -m "[신뢰] 사용자 직접입력 장소 판별 추가"
```

### Task 5: 구조화 방문 피드백과 불변 근거 원장

**Files:**
- Create: `apps/api/engine/feedback_ledger.py`
- Create: `apps/api/routes/feedback.py`
- Create: `apps/api/tests/test_feedback_ledger.py`
- Modify: `apps/api/engine/visit_signals.py`
- Modify: `apps/api/main.py`

**Step 1: Write failing feedback tests**

Cover login requirement, plan ownership, valid visit/operation states, factual mismatches separate from experience tags, duplicate idempotency key, and append-only correction.

```python
def test_single_closure_report_never_creates_public_correction(client, user_headers, plan_item):
    response = client.post(
        f"/plans/{plan_item.plan_id}/items/{plan_item.id}/feedback",
        headers={**user_headers, "Idempotency-Key": "feedback-1"},
        json={"visit_status": "visited", "operation_status": "closure_suspected"},
    )
    assert response.status_code == 201
    assert response.json()["moderation_status"] == "collecting_signals"
    assert count_rows("public_data_correction") == 0
```

**Step 2: Run and verify failure**

Run: `python -m pytest apps/api/tests/test_feedback_ledger.py -v`

Expected: FAIL because the endpoint does not exist.

**Step 3: Implement feedback submission**

Add `POST /plans/{plan_id}/items/{item_id}/feedback`. Store the user's original text, structured fields, plan snapshot reference and calculated submission weight in one transaction. Return `201` on first submission and the same resource on an idempotent retry.

**Step 4: Preserve `/visit-signals` compatibility**

Keep the old endpoint and response fields. Adapt old payloads to the new ledger when the caller is authenticated; otherwise retain the existing local/demo behavior. Remove direct use of status-only deltas as the authoritative trust profile.

**Step 5: Run tests**

Run: `python -m pytest apps/api/tests/test_feedback_ledger.py apps/api/tests/test_visit_signals.py -v`

Expected: PASS and no regression in the old endpoint.

**Step 6: Commit**

```bash
git add apps/api/engine/feedback_ledger.py apps/api/routes/feedback.py apps/api/tests/test_feedback_ledger.py apps/api/engine/visit_signals.py apps/api/main.py
git commit -m "[신뢰] 방문 피드백 근거 원장 추가"
```

### Task 6: 선택 증빙의 비공개 업로드와 삭제

**Files:**
- Modify: `pyproject.toml`
- Create: `apps/api/storage.py`
- Create: `apps/api/routes/evidence_assets.py`
- Create: `apps/api/tests/test_evidence_assets.py`
- Modify: `apps/api/main.py`

**Step 1: Write failing storage tests**

Test that only the feedback owner can request an upload, paths are generated server-side, public URLs are never returned, unsupported MIME/size is rejected, deletion marks metadata and removes the object, and a storage failure does not delete the text feedback.

**Step 2: Run and verify failure**

Run: `python -m pytest apps/api/tests/test_evidence_assets.py -v`

Expected: FAIL because upload-intent routes do not exist.

**Step 3: Implement the server-side storage adapter**

Create signed upload intents for the private bucket using a path such as `{owner_id}/{feedback_id}/{asset_uuid}`. In the first release allow location metadata and ordinary visit photos only. Strip EXIF before completion and reject a file whose metadata removal cannot be verified. Keep receipt upload disabled until a quarantine-and-redaction processor has a separate approved design and test. Return a short-lived signed upload token, never the service-role key.

**Step 4: Add asset lifecycle routes**

- `POST /feedback/{feedback_id}/assets/upload-intent`
- `POST /feedback/{feedback_id}/assets/{asset_id}/complete`
- `DELETE /feedback/{feedback_id}/assets/{asset_id}`

The complete route verifies the object exists and EXIF is absent before setting `verification_status=pending`. Add retention metadata and a privileged deletion path. User deletion must remove the object and personal memo/linkage, append a deletion audit event and retain only non-identifying aggregate fields.

**Step 5: Run tests**

Run: `python -m pytest apps/api/tests/test_evidence_assets.py -v`

Expected: PASS with the Supabase client mocked.

**Step 6: Commit**

```bash
git add pyproject.toml apps/api/storage.py apps/api/routes/evidence_assets.py apps/api/tests/test_evidence_assets.py apps/api/main.py
git commit -m "[보안] 방문 증빙 비공개 저장 추가"
```

### Task 7: 현장 신뢰 프로필과 검토 건 자동 생성

**Files:**
- Create: `apps/api/engine/contribution_trust.py`
- Create: `apps/api/engine/moderation.py`
- Create: `apps/api/tests/test_contribution_trust.py`
- Modify: `TRUST_ENGINE.md`

**Step 1: Write failing trust-policy tests**

Test that:

- one report changes only `field_confidence` reasons;
- independent repeated reports raise priority;
- optional verified evidence increases weight within a cap;
- same-account repeats do not count as independent;
- a current official source conflict produces `conflicted`;
- no rule creates `public_data_correction` automatically.

**Step 2: Run and verify failure**

Run: `python -m pytest apps/api/tests/test_contribution_trust.py -v`

Expected: FAIL because the calculator does not exist.

**Step 3: Implement transparent calculation**

Implement pure functions returning dimension values and reason codes. Store the result in `place_trust_profile`, but keep all inputs in `evidence` and `visit_feedback` so the result can be rebuilt. Caps and thresholds must be named constants with tests.

Use this initial conservative policy:

```python
INDEPENDENT_REPORTS_TO_OPEN_CASE = 2
REPORT_WINDOW_DAYS = 30
NEW_ACCOUNT_DAYS = 7
NEW_ACCOUNT_WEIGHT = 0.5
MAX_SUBMISSION_WEIGHT = 1.5
```

A verified-evidence report plus one corroborating official/platform source may also open a case. One unapproved report is visible only to its author and moderators and has no public ranking effect. Public caution appears only after a case opens and research is `partial` or `conflicted`.

**Step 4: Create moderation cases**

Open or update one case per `(place_id, case_type, claim_key)` when thresholds are met. Set research state to `pending`; do not call web research inside the user request transaction. Queue work with an explicit database status so a worker can retry safely.

**Step 5: Update trust specification**

Add the four contribution dimensions, reason codes, thresholds, and the rule that field confidence never becomes an approved fact by itself.

**Step 6: Run tests**

Run: `python -m pytest apps/api/tests/test_contribution_trust.py apps/api/tests/test_trust_score.py -v`

Expected: PASS.

**Step 7: Commit**

```bash
git add apps/api/engine/contribution_trust.py apps/api/engine/moderation.py apps/api/tests/test_contribution_trust.py TRUST_ENGINE.md
git commit -m "[신뢰] 현장 신뢰 프로필과 검토 큐 추가"
```

### Task 8: 운영자 검토 API와 판정 버전

**Files:**
- Create: `apps/api/routes/moderation.py`
- Create: `apps/api/tests/test_moderation.py`
- Modify: `apps/api/engine/moderation.py`
- Modify: `apps/api/main.py`

**Step 1: Write failing moderation tests**

Cover admin-only access, evidence bundle shape, approve/hold/reject, mandatory rationale, approved correction creation, revocation, supersession and idempotent retry.

```python
def test_approval_creates_versioned_correction(client, admin_headers, review_case):
    response = client.post(
        f"/admin/moderation-cases/{review_case.id}/decisions",
        headers={**admin_headers, "Idempotency-Key": "decision-1"},
        json={
            "decision": "approve",
            "claim_key": "operation.status",
            "corrected_value": "temporarily_closed",
            "effective_from": "2026-07-14T00:00:00Z",
            "evidence_ids": ["official-evidence-id", "field-evidence-id"],
            "rationale": "최신 공식 공지와 현장 제보 3건 일치"
        },
    )
    assert response.status_code == 201
    assert response.json()["correction"]["effective_from"] is not None
```

**Step 2: Run and verify failure**

Run: `python -m pytest apps/api/tests/test_moderation.py -v`

Expected: FAIL because the routes do not exist.

**Step 3: Implement moderation routes**

- `GET /admin/moderation-cases`
- `GET /admin/moderation-cases/{id}`
- `POST /admin/moderation-cases/{id}/decisions`
- `POST /admin/moderation-decisions/{id}/revoke`

The detail response groups public data, official/platform evidence, user signal summary and private-asset metadata. The approval request must explicitly carry `claim_key`, `corrected_value`, `effective_from`, selected `evidence_ids` and rationale; the server verifies they belong to the case. Raw evidence assets require a separate short-lived viewer token and an audit entry.

**Step 4: Implement transactional decision logic**

Lock the open case, insert a decision version, create or revoke the correction, recalculate the trust profile and close/reopen the case in one transaction. Revoking the latest correction never reactivates an older correction automatically: it leaves no active correction, reopens the case and bumps the place/claim correction version so caches invalidate synchronously.

**Step 5: Run tests**

Run: `python -m pytest apps/api/tests/test_moderation.py -v`

Expected: PASS, including approval reversal.

**Step 6: Commit**

```bash
git add apps/api/routes/moderation.py apps/api/tests/test_moderation.py apps/api/engine/moderation.py apps/api/main.py
git commit -m "[운영] 공공데이터 보정 검토 API 추가"
```

### Task 9: Supabase 로그인과 로컬 플랜 동기화

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/vite-env.d.ts`
- Create: `apps/web/src/auth.ts`
- Create: `apps/web/src/planSync.ts`
- Create: `apps/web/tests/plan-sync.test.mjs`
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/App.tsx`

**Step 1: Install the browser SDK**

Run: `cd apps/web && npm install @supabase/supabase-js`

Expected: package and lockfile update without audit failure that blocks build.

**Step 2: Write failing sync tests**

Test conversion of old `user_added` into the new `user_input`, deterministic `client_plan_id`, idempotent merge payload, and preserving unsynced local state on network failure.

**Step 3: Run and verify failure**

Run: `node --test apps/web/tests/plan-sync.test.mjs`

Expected: FAIL because `planSync` helpers do not exist.

**Step 4: Implement Supabase client and authenticated API helper**

Use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the browser. Extend `post()`/`get()` to attach the current access token. Never add the service-role key to Vite variables.

**Step 5: Implement local-to-account merge**

Keep local creation available. On sign-in, send one idempotent `POST /plans` payload and replace local items only after server acknowledgement. On failure, show `기기에 안전하게 보관됨` and retry explicitly; never silently clear localStorage.

**Step 6: Run tests and typecheck**

Run: `node --test apps/web/tests/plan-sync.test.mjs`

Run: `cd apps/web && npm run lint && npm run build`

Expected: all PASS.

**Step 7: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/src/vite-env.d.ts apps/web/src/auth.ts apps/web/src/planSync.ts apps/web/tests/plan-sync.test.mjs apps/web/src/api.ts apps/web/src/App.tsx
git commit -m "[웹] 로그인 플랜 저장과 동기화 추가"
```

### Task 10: 구조화 피드백과 기여 상태 UI

**Files:**
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/components/TravelFeedback.tsx`
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Create: `apps/web/tests/feedback-contract.test.mjs`

**Step 1: Write failing web contract tests**

Test four source labels, structured feedback serialization, login-required submission, optional photo/location evidence, receipt upload disabled, and exact pending-copy text.

**Step 2: Run and verify failure**

Run: `node --test apps/web/tests/feedback-contract.test.mjs`

Expected: FAIL because `community_verified` and structured fields do not exist.

**Step 3: Extend types without breaking stored state**

Add `user_input` and `community_verified`, while migrating legacy `user_added` on load. Split `VisitCheck` into visit status, operation status, mismatch types, experience tags, memo, evidence metadata and moderation status. Preserve old fields during one compatibility release.

**Step 4: Build the feedback form**

Show factual change fields separately from experience fields. Make location/photo/receipt optional. Before authenticated submission, open login; after submission show:

`현장 신호에 반영되었습니다. 공공데이터 보정은 추가 확인과 운영자 검토 후 진행됩니다.`

Display `수집 중`, `추가 확인`, `검토 중`, `승인`, `기각` without implying that a queued report changed public data.

**Step 5: Run tests and build**

Run: `node --test apps/web/tests/*.test.mjs`

Run: `cd apps/web && npm run lint && npm run build`

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/web/src/types.ts apps/web/src/api.ts apps/web/src/components/TravelFeedback.tsx apps/web/src/components/PackingDashboard.tsx apps/web/tests/feedback-contract.test.mjs
git commit -m "[웹] 구조화 방문 피드백 화면 추가"
```

### Task 11: 관리자 근거 비교 화면

**Files:**
- Create: `apps/web/src/components/ModerationDashboard.tsx`
- Create: `apps/web/src/moderation.ts`
- Create: `apps/web/tests/moderation-view.test.mjs`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/api.ts`

**Step 1: Write failing view-model tests**

Test grouping into public data, official, platform and user signals; conflicted sources remain visible; raw asset URLs are absent; approve requires rationale.

**Step 2: Run and verify failure**

Run: `node --test apps/web/tests/moderation-view.test.mjs`

Expected: FAIL because the view model does not exist.

**Step 3: Implement the admin-only dashboard**

Provide filters for case type, priority, status and region. The detail pane must show the claim being decided, current public value, latest source timestamps, independent user count, evidence verification level and previous decisions side by side.

**Step 4: Implement safe decisions**

Require rationale for all decisions, a second confirmation for approval/revocation, and display the generated correction preview before submit. Treat 409 as a stale-case refresh, not a generic failure.

**Step 5: Run tests and build**

Run: `node --test apps/web/tests/moderation-view.test.mjs`

Run: `cd apps/web && npm run lint && npm run build`

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/web/src/components/ModerationDashboard.tsx apps/web/src/moderation.ts apps/web/tests/moderation-view.test.mjs apps/web/src/App.tsx apps/web/src/api.ts
git commit -m "[운영] 사용자 제보 근거 검토 화면 추가"
```

### Task 12: 승인 보정의 하루방 교차확인 반영

**Files:**
- Create: `apps/api/engine/corrections.py`
- Create: `apps/api/tests/test_corrections.py`
- Modify: `apps/api/engine/trust.py`
- Modify: `apps/api/engine/haruban.py`
- Modify: `apps/api/engine/assemble.py`
- Modify: `TRUST_ENGINE.md`

**Step 1: Write failing correction tests**

Cover active latest correction, revoked correction, conflicting current official source, and unapproved feedback exclusion.

```python
def test_unapproved_feedback_never_becomes_haruban_fact():
    context = build_place_context(feedbacks=[closure_report()], corrections=[])
    answer = assemble_place_answer(context)
    assert "폐업했습니다" not in answer
    assert "폐업 의심 제보가 있어 추가 확인 필요" in answer
```

**Step 2: Run and verify failure**

Run: `python -m pytest apps/api/tests/test_corrections.py -v`

Expected: FAIL because approved correction lookup is not connected.

**Step 3: Implement correction lookup**

Read only the latest non-revoked correction per place/claim. Return the decision id, effective time, rationale summary and supporting evidence ids. Never flatten a correction into the `place` row.

**Step 4: Integrate with trust and answer assembly**

Use approved corrections in the final public-data crosscheck layer. If a newer official source conflicts, mark `conflicted` and reopen moderation instead of silently choosing one. A single unapproved field report is never shown to other users and never changes ranking. A clearly labeled caution signal may appear only after the configured case-opening threshold is met and research is `partial` or `conflicted`.

**Step 5: Run trust regression tests**

Run: `python -m pytest apps/api/tests/test_corrections.py apps/api/tests/test_trust_score.py apps/api/tests/test_haruban_agent.py apps/api/tests/test_assemble.py -v`

Expected: PASS with citations and timestamps preserved.

**Step 6: Commit**

```bash
git add apps/api/engine/corrections.py apps/api/tests/test_corrections.py apps/api/engine/trust.py apps/api/engine/haruban.py apps/api/engine/assemble.py TRUST_ENGINE.md
git commit -m "[하루방] 승인된 현장 보정 근거 연결"
```

### Task 13: Supabase 전환, RLS, 관측과 롤백 검증

**Files:**
- Create: `packages/schema/supabase_rls.sql`
- Create: `scripts/verify_supabase_migration.py`
- Create: `apps/api/tests/test_migration_verification.py`
- Modify: `docs/deploy.md`
- Modify: `DEPLOYMENT_STATUS.md`

**Step 1: Write failing migration verification tests**

Test row counts, primary keys, plan/item ownership, evidence references, active corrections, extensions and checksum comparison. The verifier must redact connection credentials.

**Step 2: Run and verify failure**

Run: `python -m pytest apps/api/tests/test_migration_verification.py -v`

Expected: FAIL because the verifier does not exist.

**Step 3: Add RLS policies**

Policies must enforce:

- users read/write only their plans, items, feedback and asset metadata;
- community-verified places and approved corrections are readable;
- raw evidence and moderation tables are moderator/admin only;
- service role is used only from Railway;
- evidence bucket is private and paths are owner scoped.

**Step 4: Implement dry-run migration verification**

The script accepts source and target database URLs through environment variables, emits a JSON report, makes no writes by default and requires `--apply` for any repair. Verify `vector` and `pg_trgm`, schema objects, counts, sampled checksums and foreign keys.

**Step 5: Document staged cutover**

Document backup, schema apply, data copy, verification, read-only window, Railway `DATABASE_URL` switch, health check, smoke tests and rollback. Do not dual-write: Railway is the source before cutover and Supabase is the sole source after cutover. If rollback is needed after Supabase accepts writes, keep the app read-only while exporting and verifying the delta back to Railway. Add latency checks for Railway-to-Supabase connections and pool settings.

**Step 6: Run complete verification**

Run: `python -m pytest -q`

Run: `cd apps/web && npm run lint && npm run build`

Run: `python -m ruff check apps packages scripts`

Expected: all commands exit 0.

**Step 7: Commit**

```bash
git add packages/schema/supabase_rls.sql scripts/verify_supabase_migration.py apps/api/tests/test_migration_verification.py docs/deploy.md DEPLOYMENT_STATUS.md
git commit -m "[배포] Supabase 전환과 롤백 검증 추가"
```

## 최종 수용 테스트

1. 비회원이 세 출처의 장소로 플랜을 만든다.
2. 로그인 후 같은 플랜을 두 번 동기화해도 플랜과 항목이 중복되지 않는다.
3. 사용자 직접입력 장소가 개인 플랜에는 즉시 보이고 공용 후보에는 즉시 나타나지 않는다.
4. 운영자가 존재·주소 근거를 승인하면 장소가 내부 `community_verified`가 되지만 기능 플래그를 열기 전에는 공용 추천에 나타나지 않는다.
5. 한 사용자가 폐업 의심을 제출해도 공공데이터, 공용 주의 문구, 추천 순위와 하루방 확정 사실은 변하지 않는다.
6. 독립 사용자 2명의 최근 일치 제보 또는 증빙 1건과 외부 근거 1건이 있으면 운영자 검토 건이 생성된다.
7. 운영자가 웹 근거를 확인해 승인하면 주장 키·보정값·유효 시점이 있는 버전 정보가 생성된다.
8. 다음 하루방 질문에서 보정 정보가 판단 근거와 확인 시점과 함께 표시된다.
9. 승인 취소 후 과거 보정은 자동 부활하지 않고 하루방은 재검토 상태를 표시한다.
10. 사진 저장소가 실패해도 텍스트 피드백과 플랜은 보존된다.
11. 영수증 업로드는 가림 처리 기능이 준비되기 전까지 제공되지 않고 사진은 EXIF 제거가 확인되어야 완료된다.
12. 사용자 삭제 요청 후 비공개 증빙과 개인 연결·자유 메모가 제거되고 삭제 사건과 비식별 집계만 남는다.

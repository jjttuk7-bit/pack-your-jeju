# Haruban Agent Unlock Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 하루방 에이전트가 대화 중 여행팩 생성, 리뷰 검증, 지역 커버리지 비교, 폼 보강 제안을 도구로 실행하고 안전한 근거 기반 답변을 제공하게 한다.

**Architecture:** `apps/api/engine/haruban.py`의 기존 function-calling 도구 루프를 유지하고, 내부 API 로직을 직접 재사용하는 도구 러너를 추가한다. LLM은 도구 선택과 답변 조립만 맡고, API 키가 없거나 LLM 응답이 약할 때는 `_fallback_reply_from_tool_messages`가 마지막 도구 결과를 사용자 문장으로 바꾼다.

**Tech Stack:** Python 3.11, FastAPI engine modules, SQLAlchemy, pytest, OpenAI chat completions tools.

---

### Task 1: Add Tool Schemas For New Capabilities

**Files:**
- Modify: `apps/api/engine/haruban.py`
- Test: `apps/api/tests/test_haruban_agent.py`

**Step 1: Write failing schema tests**

Add tests that assert `TOOLS` includes the four new tool names and user-facing descriptions:

```python
def test_haruban_tools_include_unlocked_agent_capabilities():
    tool_names = {t["function"]["name"] for t in haruban.TOOLS}

    assert "build_pack" in tool_names
    assert "verify_review" in tool_names
    assert "preview_region_coverage" in tool_names
    assert "suggest_form_augment" in tool_names


def test_build_pack_tool_requires_form_state():
    tool = next(t for t in haruban.TOOLS if t["function"]["name"] == "build_pack")
    props = tool["function"]["parameters"]["properties"]

    assert "form_state" in props
    assert "여행팩" in tool["function"]["description"]
    assert "공공데이터" in tool["function"]["description"]
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py::test_haruban_tools_include_unlocked_agent_capabilities apps/api/tests/test_haruban_agent.py::test_build_pack_tool_requires_form_state -q`

Expected: FAIL because tool names are not present.

**Step 3: Add minimal tool definitions**

In `TOOLS`, add function schemas:

- `build_pack(form_state: object)`
- `verify_review(text: string)`
- `preview_region_coverage(regions: array[string])`
- `suggest_form_augment(form_state: object)`

Each description must explicitly say returned facts are limited to public-data/tool results.

**Step 4: Run test to verify it passes**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py::test_haruban_tools_include_unlocked_agent_capabilities apps/api/tests/test_haruban_agent.py::test_build_pack_tool_requires_form_state -q`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py
git commit -m "[agent] 하루방 확장 도구 스키마 추가"
```

### Task 2: Implement `build_pack` Runner

**Files:**
- Modify: `apps/api/engine/haruban.py`
- Test: `apps/api/tests/test_haruban_agent.py`

**Step 1: Write failing tests**

Add a unit test with monkeypatched dependencies so it does not require DB fixtures:

```python
def test_haruban_build_pack_runner_summarizes_pack(monkeypatch):
    class FakeReq:
        regions = ["seongsan"]
        moments = ["local_food"]
        companion = "solo"
        purpose = "food"
        days = 2
        start_date = __import__("datetime").date(2026, 7, 10)

    class FakeFilterBundle:
        per_moment = ["fake-filter"]

    class FakeIntro:
        text = "성산 현지 맛집 중심으로 조립했어요."
        llm_used = False

    class FakeItem:
        name = "소심한이층"
        badge = "verified"
        note = ""
        address = "서귀포시 성산읍"

    class FakeSection:
        moment = "local_food"
        items = [FakeItem()]
        fallback = None
        observed_reasons = []

    monkeypatch.setattr(haruban.filters_mod.PackRequest, "from_dict", lambda _: FakeReq())
    monkeypatch.setattr(haruban.filters_mod, "build_filters", lambda _: FakeFilterBundle())
    monkeypatch.setattr(haruban.weather_mod, "smoke_kma_nowcast", lambda *a, **k: {"available": True, "summary": "바람 확인"})
    monkeypatch.setattr(haruban.trust_mod, "judge_section", lambda *a, **k: FakeSection())
    monkeypatch.setattr(haruban.assemble_mod, "compose_intro", lambda *a, **k: FakeIntro())
    monkeypatch.setattr(haruban.assemble_mod, "dispatch_itinerary", lambda *a, **k: [{"day": 1, "items": []}])

    result = haruban._run_build_pack({"form_state": {"regions": ["seongsan"]}})

    assert result["available"] is True
    assert result["intro"]["text"] == "성산 현지 맛집 중심으로 조립했어요."
    assert result["sections"][0]["items"][0]["name"] == "소심한이층"
    assert result["weather"]["summary"] == "바람 확인"
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py::test_haruban_build_pack_runner_summarizes_pack -q`

Expected: FAIL because `_run_build_pack` does not exist.

**Step 3: Implement minimal runner**

Import `assemble as assemble_mod` near other engine imports. Add `_run_build_pack(args: dict) -> dict`:

- Read `form_state`.
- Validate with `filters_mod.PackRequest.from_dict`.
- Build filters.
- Call `weather_mod.smoke_kma_nowcast`.
- Judge each section using `trust_mod.judge_section`.
- Compose intro and itinerary.
- Return compact dict with `available`, `intro`, `sections`, `weather`, `itinerary`.
- On validation errors return `{"available": False, "error": "...", "fallback_reason": "out_of_scope"}`.

**Step 4: Register runner**

Add `"build_pack": _run_build_pack` to `TOOL_RUNNERS`.

**Step 5: Run test to verify it passes**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py::test_haruban_build_pack_runner_summarizes_pack -q`

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py
git commit -m "[agent] 하루방 팩 생성 도구 구현"
```

### Task 3: Implement Review Verification Tool

**Files:**
- Modify: `apps/api/engine/haruban.py`
- Test: `apps/api/tests/test_haruban_agent.py`

**Step 1: Write failing test**

```python
def test_haruban_verify_review_runner_serializes_claims(monkeypatch):
    class FakeClaim:
        text = "A 식당은 폐업했다."
        verdict = "contradicted"
        fallback_reason = "contradicted"
        matched_name = "A 식당"
        matched_external_id = "v1"
        reason = "수정요청에서 폐업 신호가 확인됩니다."
        sources = ["visitjeju"]

    monkeypatch.setattr(haruban.verify_mod, "verify_text", lambda text: [FakeClaim()])

    result = haruban._run_verify_review({"text": "A 식당은 폐업했다."})

    assert result["claims"][0]["verdict"] == "contradicted"
    assert result["claims"][0]["matched_name"] == "A 식당"
    assert result["claims"][0]["sources"] == ["visitjeju"]
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py::test_haruban_verify_review_runner_serializes_claims -q`

Expected: FAIL because `_run_verify_review` does not exist.

**Step 3: Implement runner**

Add `_run_verify_review(args: dict) -> dict` that calls `verify_mod.verify_text(text)` and serializes:

- `text`
- `verdict`
- `fallback_reason`
- `matched_name`
- `matched_external_id`
- `reason`
- `sources`

Register `"verify_review": _run_verify_review`.

**Step 4: Run test to verify it passes**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py::test_haruban_verify_review_runner_serializes_claims -q`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py
git commit -m "[agent] 하루방 리뷰 검증 도구 구현"
```

### Task 4: Implement Region Coverage And Augment Tools

**Files:**
- Modify: `apps/api/engine/haruban.py`
- Test: `apps/api/tests/test_haruban_agent.py`

**Step 1: Write failing tests**

```python
def test_haruban_region_coverage_runner_handles_multiple_regions(monkeypatch):
    monkeypatch.setattr(
        haruban.region_coverage_mod,
        "build_region_preview",
        lambda region: {"region": region, "moments": [{"moment": "beach_walk", "count": 4}]},
    )

    result = haruban._run_preview_region_coverage({"regions": ["seongsan", "gujwa"]})

    assert [r["region"] for r in result["regions"]] == ["seongsan", "gujwa"]


def test_haruban_augment_runner_serializes_suggestions(monkeypatch):
    class FakeSuggestion:
        field = "moments"
        kind = "add"
        values = ["beach_walk"]
        labels = ["바다 산책"]
        reason = "성산에서 확인된 후보가 많습니다."
        counts = {"beach_walk": 4}

    class FakeResult:
        available = True
        suggestions = [FakeSuggestion()]
        llm_used = False
        reason = ""

    monkeypatch.setattr(haruban.augment_mod, "build_augment", lambda form_state: FakeResult())

    result = haruban._run_suggest_form_augment({"form_state": {"regions": ["seongsan"]}})

    assert result["suggestions"][0]["field"] == "moments"
    assert result["suggestions"][0]["values"] == ["beach_walk"]
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py::test_haruban_region_coverage_runner_handles_multiple_regions apps/api/tests/test_haruban_agent.py::test_haruban_augment_runner_serializes_suggestions -q`

Expected: FAIL because modules/runners are missing.

**Step 3: Implement runners**

Import:

```python
from apps.api.engine import augment as augment_mod
from apps.api.engine import region_coverage as region_coverage_mod
```

Add:

- `_run_preview_region_coverage(args)` loops through valid `regions` and calls `region_coverage_mod.build_region_preview`.
- `_run_suggest_form_augment(args)` calls `augment_mod.build_augment` and serializes suggestions.

Register both in `TOOL_RUNNERS`.

**Step 4: Run tests to verify they pass**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py::test_haruban_region_coverage_runner_handles_multiple_regions apps/api/tests/test_haruban_agent.py::test_haruban_augment_runner_serializes_suggestions -q`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py
git commit -m "[agent] 하루방 커버리지 보강 도구 구현"
```

### Task 5: Add Deterministic Routing Helpers

**Files:**
- Modify: `apps/api/engine/haruban.py`
- Test: `apps/api/tests/test_haruban_agent.py`

**Step 1: Write failing tests**

```python
def test_haruban_builds_pack_tool_pool_for_pack_request(monkeypatch):
    called = {}

    def fake_build_pack(args):
        called.update(args)
        return {"available": True, "sections": []}

    monkeypatch.setattr(haruban, "_run_build_pack", fake_build_pack)

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "이 조건으로 팩 만들어줘"}],
        {"regions": ["seongsan"], "moments": ["local_food"], "days": 2},
    )

    assert result["tool"] == "build_pack"
    assert called["form_state"]["regions"] == ["seongsan"]


def test_haruban_routes_review_question_to_verify_review(monkeypatch):
    monkeypatch.setattr(haruban, "_run_verify_review", lambda args: {"claims": []})

    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "블로그에서 봤는데 이 리뷰 맞아? 성산 A는 폐업했다."}],
        {},
    )

    assert result["tool"] == "verify_review"
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py::test_haruban_builds_pack_tool_pool_for_pack_request apps/api/tests/test_haruban_agent.py::test_haruban_routes_review_question_to_verify_review -q`

Expected: FAIL because routing does not choose the new tools.

**Step 3: Implement routing**

Update `_build_search_pool_context` before existing search/detail routing:

- If latest user text contains `팩`, `일정`, `코스`, `만들어`, `짜줘`, route to `build_pack`.
- If latest user text contains `리뷰`, `블로그`, `맞아`, `사실`, `검증`, route to `verify_review` when text length is enough.
- If latest user text compares regions using `좋아`, `비교`, `어디`, `지역 추천`, route to `preview_region_coverage`.
- If latest user text asks `폼`, `조건`, `바꾸`, `추천 조합`, route to `suggest_form_augment`.

Keep `get_place_detail` priority for specific place detail/transit/fix request questions.

**Step 4: Run tests to verify they pass**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py::test_haruban_builds_pack_tool_pool_for_pack_request apps/api/tests/test_haruban_agent.py::test_haruban_routes_review_question_to_verify_review -q`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py
git commit -m "[agent] 하루방 확장 도구 라우팅 추가"
```

### Task 6: Add Fallback Replies For New Tool Results

**Files:**
- Modify: `apps/api/engine/haruban.py`
- Test: `apps/api/tests/test_haruban_agent.py`

**Step 1: Write failing tests**

```python
def test_haruban_fallback_replies_from_build_pack_result():
    reply = haruban._fallback_reply_from_tool_messages([
        {
            "role": "tool",
            "name": "build_pack",
            "content": json.dumps({
                "available": True,
                "intro": {"text": "성산 현지 맛집 중심으로 조립했어요."},
                "sections": [
                    {
                        "moment": "local_food",
                        "items": [{"name": "소심한이층", "badge": "verified"}],
                        "fallback": None,
                    }
                ],
                "weather": {"summary": "바람 확인"},
            }, ensure_ascii=False),
        }
    ])

    assert "성산 현지 맛집" in reply
    assert "소심한이층" in reply
    assert "바람 확인" in reply


def test_haruban_fallback_replies_from_verify_review_result():
    reply = haruban._fallback_reply_from_tool_messages([
        {
            "role": "tool",
            "name": "verify_review",
            "content": json.dumps({
                "claims": [
                    {
                        "text": "A는 폐업했다.",
                        "verdict": "contradicted",
                        "fallback_reason": "contradicted",
                        "matched_name": "A",
                        "reason": "폐업 신호가 확인됩니다.",
                    }
                ],
            }, ensure_ascii=False),
        }
    ])

    assert "A는 폐업했다" in reply
    assert "폐업 신호" in reply
    assert "공공데이터 기준" in reply
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py::test_haruban_fallback_replies_from_build_pack_result apps/api/tests/test_haruban_agent.py::test_haruban_fallback_replies_from_verify_review_result -q`

Expected: FAIL because fallback formatter does not handle new tool names.

**Step 3: Implement fallback formatters**

In `_fallback_reply_from_tool_messages`, add branches for:

- `build_pack`
- `verify_review`
- `preview_region_coverage`
- `suggest_form_augment`

Keep copy user-facing. Do not say `DB/RAG`.

**Step 4: Run tests to verify they pass**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py::test_haruban_fallback_replies_from_build_pack_result apps/api/tests/test_haruban_agent.py::test_haruban_fallback_replies_from_verify_review_result -q`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py
git commit -m "[agent] 하루방 확장 도구 폴백 답변 추가"
```

### Task 7: End-To-End Regression

**Files:**
- Modify only if a regression appears: `apps/api/engine/haruban.py`
- Test: `apps/api/tests/test_haruban_agent.py`, `apps/api/tests/test_pack_integration.py`, `apps/api/tests/test_verify.py`, `apps/api/tests/test_llm.py`

**Step 1: Run focused Haruban suite**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py -q`

Expected: PASS.

**Step 2: Run affected API suites**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py apps/api/tests/test_pack_integration.py apps/api/tests/test_verify.py apps/api/tests/test_llm.py -q`

Expected: PASS.

**Step 3: Run golden set if DB is available**

Run: `python -m packages.eval.run --out data/eval-reports`

Expected: PASS with verified precision, fallback accuracy, badge accuracy above thresholds. If DB is unavailable, record the exact failure and skip only this gate.

**Step 4: Inspect final diff**

Run: `git diff -- apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py docs/plans/2026-07-10-haruban-agent-unlock-design.md docs/plans/2026-07-10-haruban-agent-unlock-implementation.md`

Expected: Only intentional agent tool expansion and tests.

**Step 5: Commit final verification notes if needed**

If only code/test changes exist, no extra commit is needed beyond task commits. If documentation was updated during execution:

```bash
git add docs/plans/2026-07-10-haruban-agent-unlock-implementation.md
git commit -m "[docs] 하루방 기능 해제 구현 계획 보강"
```

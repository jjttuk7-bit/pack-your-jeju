# Haruban Multisource Web Research Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 하루방이 추천 및 후속 질문을 다중 관점 웹 리서치로 처리하고, 출처 역할·부분 실패·충분한 답변 계약과 공공데이터 후순위 원칙을 지키게 한다.

**Architecture:** `apps/api/engine/haruban.py`의 기존 OpenAI Responses API 웹 검색 호출을 유지하되 검색 계획, 출처 분류, 결과 병합 헬퍼를 추가한다. 라우팅은 현재 메시지가 아니라 최근 대화의 웹 의도까지 보고 결정하며, 명시적 공공데이터 요청만 기존 `search_places` 경로를 우선한다. 모든 행동 변경은 `apps/api/tests/test_haruban_agent.py`에서 실패를 확인한 뒤 구현한다.

**Tech Stack:** Python 3.11, FastAPI, OpenAI Responses API web search, pytest.

---

### Task 1: Conversation-Aware Web Routing

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`
- Modify: `apps/api/engine/haruban.py`

**Step 1: Write failing routing tests**

Add tests for these behaviors:

```python
def test_haruban_keeps_web_intent_for_oreum_followup(monkeypatch):
    conv = [
        {"role": "user", "content": "구좌에서 가볼 만한 지역들을 알려줘"},
        {"role": "assistant", "content": "웹 출처를 확인해 구좌를 정리했습니다."},
        {"role": "user", "content": "구좌의 오름들 정보는?"},
    ]
    result = haruban._build_search_pool_context(conv, {})
    assert result["tool"] == "web_search_jeju"


def test_haruban_keeps_web_intent_for_restaurant_followup(monkeypatch):
    conv = [
        {"role": "user", "content": "구좌에서 가볼 만한 지역들을 알려줘"},
        {"role": "assistant", "content": "웹 출처를 확인해 구좌를 정리했습니다."},
        {"role": "user", "content": "구좌에서 가장 맛집은?"},
    ]
    result = haruban._build_search_pool_context(conv, {})
    assert result["tool"] == "web_search_jeju"


def test_explicit_public_data_request_still_routes_to_search_places(monkeypatch):
    result = haruban._build_search_pool_context(
        [{"role": "user", "content": "공공데이터 기준으로 구좌 오름 후보 수를 알려줘"}],
        {},
    )
    assert result["tool"] == "search_places"
```

Monkeypatch `_run_web_search_jeju` and `_run_search_places` with deterministic payloads so tests exercise routing without network or DB access.

**Step 2: Run tests and verify RED**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py -q`

Expected: oreum or restaurant follow-up routes to `search_places`, proving the current-message-only bug.

**Step 3: Implement minimal routing helpers**

Add:

```python
def _is_explicit_public_data_question(text_in: str) -> bool:
    return bool(re.search(r"공공\s*데이터|내부\s*데이터|DB\s*기준|후보\s*수", text_in, re.I))


def _conversation_has_web_intent(conv: list[dict]) -> bool:
    recent = conv[-6:]
    return any(
        message.get("role") == "user" and _is_web_search_question(message.get("content") or "")
        for message in recent[:-1]
    )


def _should_use_web_research(conv: list[dict]) -> bool:
    last_user = _latest_user_text(conv)
    if _is_explicit_public_data_question(last_user):
        return False
    if _is_web_search_question(last_user):
        return True
    followup = bool(re.search(r"추천|맛집|식당|카페|오름|관광|가볼|어디|정보|가장|더|비교", last_user))
    return followup and _conversation_has_web_intent(conv)
```

Use `_should_use_web_research(conv)` before detail and `search_places` routing where current information or recommendation is requested. Keep explicit public-data queries on the internal path.

**Step 4: Run tests and verify GREEN**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py -q`

Expected: all routing tests pass.

**Step 5: Commit**

```bash
git add apps/api/tests/test_haruban_agent.py apps/api/engine/haruban.py
git commit -m "[agent] 후속 질문 웹 리서치 의도 유지"
```

### Task 2: Search Plan And Source Metadata

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`
- Modify: `apps/api/engine/haruban.py`

**Step 1: Write failing search-plan tests**

Add tests that require:

```python
def test_build_web_search_plan_covers_source_roles():
    plan = haruban._build_web_search_plan("구좌 맛집 추천", "혼자 점심")
    assert 2 <= len(plan) <= 3
    assert {item["source_class"] for item in plan} >= {"official", "experience"}
    assert len({item["query"] for item in plan}) == len(plan)


def test_dedupe_sources_adds_class_and_checked_at():
    sources = haruban._dedupe_sources([
        {"title": "비짓제주", "url": "https://www.visitjeju.net/kr/detail/view?contentsid=1"},
        {"title": "비짓제주 중복", "url": "https://www.visitjeju.net/kr/detail/view?contentsid=1"},
    ])
    assert len(sources) == 1
    assert sources[0]["source_class"] == "official"
    assert sources[0]["checked_at"]
```

**Step 2: Run tests and verify RED**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py -q`

Expected: `_build_web_search_plan` is missing and source metadata assertions fail.

**Step 3: Implement minimal plan and classification**

Add `_classify_web_source(url, title, snippet)`, `_build_web_search_plan(query, context)`, and ISO-8601 `checked_at` metadata in `_dedupe_sources`.

Use conservative domain sets:

- official: `.go.kr`, `visitjeju.net`, recognized public or operating-owner cues
- platform: map, booking, local media domains or title cues
- experience: blog, YouTube, Instagram, review cues
- fallback: `web`

**Step 4: Run tests and verify GREEN**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py -q`

Expected: plan and metadata tests pass.

**Step 5: Commit**

```bash
git add apps/api/tests/test_haruban_agent.py apps/api/engine/haruban.py
git commit -m "[research] 웹 검색 계획과 출처 분류 추가"
```

### Task 3: Multi-Query Research And Partial Failure

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`
- Modify: `apps/api/engine/haruban.py`

**Step 1: Write failing orchestration tests**

Monkeypatch a single-query helper and assert:

- three planned queries can be issued;
- one successful query plus failures returns `available=True`, `research_status="partial"`;
- all failures return `research_status="unavailable"`;
- duplicate sources across calls are merged;
- original and executed queries are returned;
- all-empty first pass triggers one simplified retry, without exceeding four total calls.

**Step 2: Run tests and verify RED**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py -q`

Expected: current `_perform_web_search_jeju` makes one call and lacks `research_status` and `queries`.

**Step 3: Extract single-query helper**

Create `_perform_single_web_search(query, context, source_class)` around the current Responses API call. Increase `max_output_tokens` from 600 to a bounded value appropriate for evidence-rich output, such as 1400.

**Step 4: Implement orchestrator**

Make `_perform_web_search_jeju`:

1. build the plan;
2. execute each query independently;
3. merge answers and sources;
4. retry once with a simplified query only when no usable source exists;
5. return `sufficient`, `partial`, or `unavailable` based on successful calls and source availability.

Extend `WebSearchResult` and `_run_web_search_jeju` serialization with `queries` and `research_status`.

**Step 5: Run tests and verify GREEN**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py -q`

Expected: all orchestration tests and existing tests pass.

**Step 6: Commit**

```bash
git add apps/api/tests/test_haruban_agent.py apps/api/engine/haruban.py
git commit -m "[research] 다중 검색과 부분 실패 처리"
```

### Task 4: Answer Contract And Transparent Fallback

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`
- Modify: `apps/api/engine/haruban.py`

**Step 1: Write failing answer-contract tests**

Add assertions that:

- the system prompt does not contain `카카오·네이버·블로그 리뷰를 근거로 삼지 마라`;
- the system prompt does not require facts to come only from public data;
- the prompt requires direct conclusion, candidate reasons, comparison, caveats, source links, and optional final public-data cross-check;
- web-search failure fallback does not say `지역이나 순간을 하나 고르면 확인된 후보부터 좁혀드릴게요` or automatically mention public-data candidates;
- successful fallback renders source-class labels and does not duplicate the same URL;
- partial research is disclosed without discarding available evidence.

**Step 2: Run tests and verify RED**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py -q`

Expected: old review prohibition, public-data-only wording, or fallback text causes failures.

**Step 3: Update prompts and fallback**

Replace the web search prompt with evidence-rich instructions. Replace `_BASE_SYSTEM_PROMPT` rules with the approved source roles and adaptive answer contract. Update `_fallback_reply_from_tool_messages` to distinguish `partial` and `unavailable`, cite sources, and avoid public-data substitution.

**Step 4: Run tests and verify GREEN**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py -q`

Expected: all Haruban tests pass.

**Step 5: Commit**

```bash
git add apps/api/tests/test_haruban_agent.py apps/api/engine/haruban.py
git commit -m "[agent] 웹 근거 중심 답변 계약 적용"
```

### Task 5: Regression Verification

**Files:**
- Verify: `apps/api/engine/haruban.py`
- Verify: `apps/api/tests/test_haruban_agent.py`

**Step 1: Run focused tests**

Run: `python -m pytest apps/api/tests/test_haruban_agent.py -q`

Expected: all tests pass.

**Step 2: Run related API tests**

Run: `python -m pytest apps/api/tests/test_llm.py apps/api/tests/test_pack_integration.py apps/api/tests/test_haruban_agent.py -q`

Expected: all tests pass.

**Step 3: Check obsolete runtime policy**

Run: `rg -n "짧게 답하세요|카카오·네이버·블로그 리뷰를 근거로 삼지|공공데이터 기준으로 다시 좁혀" apps/api/engine/haruban.py`

Expected: no active matches.

**Step 4: Inspect diff**

Run: `git diff --check && git diff main...HEAD -- apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py`

Expected: no whitespace errors; changes are scoped to Haruban research behavior and tests.

**Step 5: Document external verification limitation**

If `OPENAI_API_KEY` or network access is unavailable, report that automated tests cover orchestration with deterministic fakes but a live web call was not verified. Do not claim live-search success without executing it.

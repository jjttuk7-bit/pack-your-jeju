# Haruban Total Latency Budget Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep Haruban web-research retry behavior while bounding both sequential search attempts to a combined 20-second timeout budget and reducing GPT-5 mini final-answer reasoning latency.

**Architecture:** Pass an explicit timeout into each built-in web-search request instead of using one global per-call timeout. Allocate 14 seconds to the primary query and at most 6 seconds to the expanded retry, then request low reasoning effort for GPT-5 family final chat completions. Preserve transparent unavailable-state handling and existing source contracts.

**Tech Stack:** Python 3.11, FastAPI service layer, OpenAI Python SDK, pytest

---

### Task 1: Bound sequential web-search attempts

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`
- Modify: `apps/api/engine/haruban.py`

**Step 1: Write the failing regression test**

Update the retry test so its fake single-search function accepts `timeout_seconds`, records the value, and asserts:

```python
assert timeout_seconds == [
    haruban.WEB_SEARCH_PRIMARY_TIMEOUT_SECONDS,
    haruban.WEB_SEARCH_RETRY_TIMEOUT_SECONDS,
]
assert sum(timeout_seconds) <= haruban.WEB_SEARCH_TOTAL_BUDGET_SECONDS
```

Also update the successful-first-search test to assert only the primary timeout is used.

**Step 2: Run the focused tests and verify RED**

Run:

```powershell
python -m pytest apps\api\tests\test_haruban_agent.py -q -k "retries_web_search_once_with_broader_query or one_builtin_search_for_original_question"
```

Expected: FAIL because the timeout constants and `timeout_seconds` argument do not exist.

**Step 3: Implement the minimum timeout-budget change**

In `apps/api/engine/haruban.py`:

```python
WEB_SEARCH_TOTAL_BUDGET_SECONDS = 20.0
WEB_SEARCH_PRIMARY_TIMEOUT_SECONDS = 14.0
WEB_SEARCH_RETRY_TIMEOUT_SECONDS = 6.0
```

Add `timeout_seconds` to `_perform_single_web_search`, pass it to `OpenAI(timeout=...)`, and log it with `elapsed_ms`. Call the primary search with the primary limit and the expanded retry with the retry limit.

**Step 4: Run the focused tests and verify GREEN**

Run the same focused pytest command.

Expected: selected tests PASS.

**Step 5: Commit**

```powershell
git add apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py
git commit -m "[개선] 하루방 웹검색 전체 지연 예산 적용"
```

### Task 2: Reduce GPT-5 mini final-answer reasoning latency

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`
- Modify: `apps/api/engine/haruban.py`

**Step 1: Write the failing regression test**

Extend the existing captured Chat Completions request test and assert:

```python
assert captured["reasoning_effort"] == "low"
```

Keep non-GPT-5 behavior free of unsupported reasoning parameters if an existing test covers alternate model names.

**Step 2: Run the focused test and verify RED**

Run:

```powershell
python -m pytest apps\api\tests\test_haruban_agent.py -q -k "chat_completion"
```

Expected: FAIL because `_chat_turn_raw` does not pass `reasoning_effort`.

**Step 3: Implement the minimum request change**

Build the Chat Completions keyword arguments before the SDK call. For model IDs starting with `gpt-5`, add:

```python
request_kwargs["reasoning_effort"] = "low"
```

Do not change the model ID, prompts, tools, or output-token ceiling.

**Step 4: Run the focused test and verify GREEN**

Run the same focused pytest command.

Expected: selected tests PASS.

**Step 5: Commit**

```powershell
git add apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py
git commit -m "[개선] 하루방 최종 답변 추론 지연 축소"
```

### Task 3: Verify integration and prepare deployment

**Files:**
- Verify: `apps/api/engine/haruban.py`
- Verify: `apps/api/tests/test_haruban_agent.py`
- Verify: `apps/api/tests/test_llm.py`

**Step 1: Run Haruban and LLM regression tests**

```powershell
python -m pytest apps\api\tests\test_haruban_agent.py apps\api\tests\test_llm.py -q
```

Expected: all selected tests PASS.

**Step 2: Inspect the final diff**

```powershell
git diff main...HEAD -- apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py
```

Confirm the change only introduces per-attempt timeouts, low GPT-5 reasoning effort, and related tests/logging.

**Step 3: Push after explicit user authorization**

Push the feature branch, then fast-forward the Railway deployment branch only after the user asks for deployment.

**Step 4: Verify production logs after Railway redeploys**

For one representative restaurant query, confirm Railway logs contain:

- primary search `timeout_seconds=14`
- retry search `timeout_seconds=6` only when needed
- total `haruban chat_turn completed ... elapsed_ms=...`

Measure end-to-end browser time. Target: normally under 30 seconds when both web-search attempts time out.

# Haruban Search Model Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Use GPT-4o for one bounded built-in web-search request while retaining GPT-5 mini for final evidence synthesis.

**Architecture:** Introduce a dedicated web-search model and a single 18-second search attempt with one tool call. Remove the immediate expanded-query retry and preserve transparent unavailable-state handling.

**Tech Stack:** Python 3.11, OpenAI Python SDK, pytest

---

### Task 1: Specify the single-search contract

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`

**Step 1: Write failing tests**

- Assert the Responses request uses `haruban.WEB_SEARCH_MODEL == "gpt-4o"`.
- Assert `max_tool_calls == 1`.
- Replace the retry test with a test asserting one failed call produces `queries == [original_query]`.
- Assert the fallback text does not say “여러 관점”.

**Step 2: Verify RED**

Run:

```powershell
python -m pytest apps\api\tests\test_haruban_agent.py -q -k "single_web_search or does_not_retry or web_failure_fallback"
```

Expected: FAIL because the dedicated model, one-call setting, and no-retry behavior are not implemented.

### Task 2: Implement model separation and remove retry

**Files:**
- Modify: `apps/api/engine/haruban.py`

**Step 1: Add search constants**

```python
WEB_SEARCH_MODEL = "gpt-4o"
WEB_SEARCH_TIMEOUT_SECONDS = 18.0
```

**Step 2: Update the Responses request**

- Use `model=WEB_SEARCH_MODEL`.
- Use `max_tool_calls=1`.
- Log the search model.

**Step 3: Remove immediate expanded-query retry**

- `_perform_web_search_jeju` calls `_perform_single_web_search` once.
- It returns only the original query in `queries`.

**Step 4: Update the transparent fallback copy**

- Replace “웹 출처를 여러 관점으로 확인했지만” with “웹 출처를 확인했지만”.

**Step 5: Verify GREEN**

Run the focused pytest command from Task 1.

### Task 3: Regression verification and deployment

**Files:**
- Verify: `apps/api/engine/haruban.py`
- Verify: `apps/api/tests/test_haruban_agent.py`
- Verify: `apps/api/tests/test_llm.py`

**Step 1: Run related tests**

```powershell
python -m pytest apps\api\tests\test_haruban_agent.py apps\api\tests\test_llm.py -q
```

**Step 2: Inspect the diff and commit**

Confirm only search model selection, single-attempt behavior, copy, logging, and tests changed.

**Step 3: Push to `main` after verification**

Fast-forward the Railway deployment branch without touching the dirty local `main` worktree.

**Step 4: Verify the deployed API**

Send the same restaurant question and record elapsed time, reply, and tool trace. Confirm Railway logs show `model=gpt-4o`, `timeout_seconds=18.0`, and no retry call.

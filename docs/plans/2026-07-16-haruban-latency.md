# Haruban Latency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Haruban web-research answers return faster and expose latency in Railway logs.

**Architecture:** Keep the current web-first route, but lower the per-search wait budget and log elapsed time at each boundary. Avoid new config surfaces; this is a demo-oriented constant and observability change.

**Tech Stack:** Python 3.11, FastAPI, OpenAI Python SDK, pytest.

---

### Task 1: Update Tests First

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`

**Step 1: Write the failing tests**

Change the existing web search timeout assertion to expect `20.0`. Add assertions that web search calls pass `max_output_tokens=2200`, and add a unit test that `chat_turn` logs total latency.

**Step 2: Run tests to verify failure**

Run:

```powershell
pytest apps/api/tests/test_haruban_agent.py -q
```

Expected: fail because production code still uses `60.0`, `4000`, and no total latency log.

### Task 2: Implement Latency Budget

**Files:**
- Modify: `apps/api/engine/haruban.py`

**Step 1: Lower constants**

Set `WEB_SEARCH_TIMEOUT_SECONDS = 20.0` and add `WEB_SEARCH_MAX_OUTPUT_TOKENS = 2200`.

**Step 2: Use the constant**

Replace the hard-coded `max_output_tokens=4000` in `_perform_single_web_search`.

### Task 3: Add Timing Logs

**Files:**
- Modify: `apps/api/engine/haruban.py`

**Step 1: Add timing helper**

Import `perf_counter` from `time`.

**Step 2: Log durations**

Log elapsed milliseconds for search pool preload, single web search, chat completion, and total `chat_turn`.

### Task 4: Verify

Run:

```powershell
pytest apps/api/tests/test_haruban_agent.py -q
```

Then run the narrower LLM tests:

```powershell
pytest apps/api/tests/test_llm.py -q
```

Expected: all selected tests pass.

# Haruban Free Claim Evidence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent Haruban from converting missing fee information into a confirmed free-admission claim.

**Architecture:** Strengthen both research and answer prompts with an explicit absence-of-evidence rule. Apply one shared deterministic guard to every web-backed final reply, while preserving claims that explicitly say an official source confirms free admission.

**Tech Stack:** Python 3.11, pytest, OpenAI Responses/Chat integrations

---

### Task 1: Add explicit prompt rules

**Files:**
- Modify: `apps/api/engine/haruban.py`
- Modify: `apps/api/tests/test_haruban_agent.py`

**Step 1:** Add failing assertions that the web-search prompt and `_BASE_SYSTEM_PROMPT` state that missing fee guidance is not evidence of free admission.

**Step 2:** Run the focused prompt tests and confirm RED.

**Step 3:** Add the minimal Korean rules to both prompts.

**Step 4:** Run the focused tests and confirm GREEN.

**Step 5:** Commit with `[개선] 무료 주장 근거 규칙 강화`.

### Task 2: Guard web-backed final answers

**Files:**
- Modify: `apps/api/engine/haruban.py`
- Modify: `apps/api/tests/test_haruban_agent.py`

**Step 1:** Add failing tests for:

- `입장료 안내가 없다` plus `무료 방문 가능` becomes cautious wording.
- `공식 홈페이지에서 입장료 무료로 명시` remains unchanged.
- unrelated answers remain unchanged.

**Step 2:** Run the focused tests and confirm RED.

**Step 3:** Implement `_guard_unsupported_free_claims(reply)` with explicit-free-evidence and absence-evidence predicates.

**Step 4:** Call the guard from the common preloaded fallback, normal preloaded web final response, and web search result creation.

**Step 5:** Run focused and full Haruban tests, then commit with `[개선] 정보 부재 기반 무료 단정 방지`.

### Task 3: Verify and release

**Files:**
- No new files unless verification exposes a defect.

**Step 1:** Run `python -m pytest apps/api/tests -q`.

**Step 2:** Run `npm test` and `npm run lint` from `apps/web`.

**Step 3:** Run `git diff --check` and confirm the worktree is clean.

**Step 4:** Fast-forward merge to `main`, rerun tests on `main`, push, and confirm Vercel Production is Ready with HTTP 200.

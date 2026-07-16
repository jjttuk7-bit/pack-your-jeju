# Haruban Source and Candidate Quality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent non-place text from becoming plan candidates and enforce source-role boundaries without adding another model call.

**Architecture:** Restrict candidate parsing to the structured recommendation section, reject non-place numeric labels, expand experience-source classification, and strengthen the existing GPT-4o search prompt.

**Tech Stack:** Python 3.11, regular expressions, OpenAI Responses API, pytest

---

### Task 1: Lock source classification behavior

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`
- Modify: `apps/api/engine/haruban.py`

1. Add failing tests for Tistory and Naver Blog classification as `experience`.
2. Run the focused tests and confirm RED.
3. Extend `_classify_web_source` with explicit personal-publishing hosts.
4. Run the focused tests and confirm GREEN.

### Task 2: Restrict structured candidate extraction

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`
- Modify: `apps/api/engine/haruban.py`

1. Add a failing test with valid recommendation places and a bold price in `## 방문 팁`.
2. Assert only the valid places are returned.
3. Add a failing test for bold text without a structured place field.
4. Extract only the `## 추천 장소` section.
5. Require a structured place field and reject price/unit-shaped names.
6. Run focused tests and confirm GREEN.

### Task 3: Strengthen source-role instructions

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`
- Modify: `apps/api/engine/haruban.py`

1. Extend the captured prompt test with assertions for exact place names and official/platform-only operating facts.
2. Run the test and confirm RED.
3. Add the minimum prompt rules.
4. Run the test and confirm GREEN.

### Task 4: Verify, deploy, and measure

1. Run:

```powershell
python -m pytest apps\api\tests\test_haruban_agent.py apps\api\tests\test_llm.py -q
```

2. Inspect `git diff --check` and the scoped diff.
3. Commit with `[개선] 하루방 출처와 후보 품질 보강`.
4. Fast-forward remote `main`.
5. Call the production API with the same restaurant question.
6. Confirm no numeric price candidate and record source classes and elapsed time.

# Haruban Region Overview Quality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Route recognized Jeju region-overview questions to web research and place mixed-source disclosure after the direct answer.

**Architecture:** Add one narrow region-overview intent predicate near the existing Haruban routing predicates. Give it precedence over free-advice routing and reuse the existing `web_search_jeju` pool so form context, source metadata, caching, and failure handling remain unchanged. Change only the presentation order of the existing mixed-source guardrail.

**Tech Stack:** Python 3.11+, FastAPI engine helpers, pytest

---

### Task 1: Lock the region-overview routing contract

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`
- Modify: `apps/api/engine/haruban.py`

**Step 1: Write the failing tests**

Add tests that assert:

```python
conv = [{"role": "user", "content": "안덕은 어떤 곳이야?"}]
assert haruban._should_use_web_research(conv) is True
assert haruban._should_answer_without_search(conv) is False
```

Stub `_run_web_search_jeju`, build the search pool with selected regions and moments,
and assert the exact query and serialized form context are preserved.

Change the existing `제주시는 어떤곳을 가보면 좋은지 알려줘` assertion from
free advice to web research. Keep `제주는 처음인데 어떻게 여행계획을 세우면 좋을지 알려줘`
on the free-advice path.

**Step 2: Run tests to verify RED**

Run:

```powershell
python -m pytest apps/api/tests/test_haruban_agent.py -q -k "region_overview or broad_advice"
```

Expected: the Andeok routing test fails because `_should_use_web_research` is `False`.

**Step 3: Implement the minimal routing predicate**

Add:

```python
def _is_region_overview_question(text_in: str, form_state: dict | None = None) -> bool:
    has_region = bool(_infer_regions_from_text(text_in, form_state or {}))
    asks_overview = bool(re.search(
        r"어떤\s*곳|어떤\s*동네|지역\s*(?:특징|성격|분위기)|"
        r"어떤\s*지역|지역.*어때|어떤\s*매력",
        text_in,
    ))
    return has_region and asks_overview
```

Use it in `_should_use_web_research`. Remove `어떤\s*곳` from the generic free-advice predicate so an identified region cannot be swallowed by that path.

**Step 4: Run focused tests to verify GREEN**

Run the focused command from Step 2.

Expected: all selected tests pass.

**Step 5: Commit**

```powershell
git add apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py
git commit -m "[개선] 지역 개요 질문 웹 리서치 연결"
```

### Task 2: Put the answer before the source-role disclosure

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`
- Modify: `apps/api/engine/haruban.py`

**Step 1: Write the failing test**

Extend the mixed-source guardrail test so the result starts with the original direct answer
and ends with the source-role disclosure:

```python
assert guarded.startswith("안덕은")
assert guarded.rfind("출처 구성:") > guarded.find("안덕은")
```

Continue asserting that unsupported universal official-source claims are removed.

**Step 2: Run the test to verify RED**

Run:

```powershell
python -m pytest apps/api/tests/test_haruban_agent.py::test_web_source_role_guardrail_replaces_universal_official_claim -q
```

Expected: FAIL because the current implementation prepends the disclosure.

**Step 3: Implement the minimal ordering change**

Return the cleaned answer first and append a short `확인 범위` paragraph containing the
existing source counts and operational-information caution.

**Step 4: Run the test to verify GREEN**

Run the command from Step 2.

Expected: PASS.

**Step 5: Commit**

```powershell
git add apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py
git commit -m "[개선] 웹 답변 결론 우선 배치"
```

### Task 3: Verify the complete change

**Files:**
- Verify: `apps/api/engine/haruban.py`
- Verify: `apps/api/tests/test_haruban_agent.py`
- Verify: `TRUST_ENGINE.md`
- Verify: `DECISIONS.md`

**Step 1: Run the Haruban suite**

```powershell
python -m pytest apps/api/tests/test_haruban_agent.py -q
```

Expected: all tests pass.

**Step 2: Run the API suite**

```powershell
python -m pytest apps/api/tests -q
```

Expected: all tests pass.

**Step 3: Run static and diff checks**

```powershell
python -m compileall -q apps/api
git diff --check
git status --short
```

Expected: no compile or whitespace errors; only intended files differ.

**Step 4: Review authoritative docs**

Confirm the implementation follows the existing web-first and direct-conclusion rules in
`TRUST_ENGINE.md` and `DECISIONS.md`. Do not add a new decision because this repairs an
existing active contract rather than creating a new product policy.

**Step 5: Request review and integrate**

Run a final read-only code review, commit any necessary corrections, fast-forward merge into
`main`, rerun focused verification on `main`, and push only after confirmed success.

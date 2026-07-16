# Haruban Flexible Candidate Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore Haruban recommendation checkboxes when GPT returns bold section headings, bullet-dot fields, and bold source-link labels.

**Architecture:** Keep the existing deterministic extraction path but parse the recommendation section and candidate headings line by line. Accept known Markdown presentation variants while preserving the requirement for structured place fields and a source URL.

**Tech Stack:** Python 3.11, regular expressions, pytest, FastAPI, React contract tests

---

### Task 1: Lock the production failure format with a regression test

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`

**Step 1: Write the failing test**

Add a test containing:

```python
answer = """
**추천 장소**
**자매국수**
• 특징: 고기국수 전문점 ([**TripPick**](https://trippick.co/food))
• 위치: 제주시 항골남길 46

**우진해장국**
• 특징: 고사리육개장 전문 ([**Visit Jeju**](https://visitjeju.net/place))
• 위치: 제주시 서사로 11

**방문 팁**
운영 정보는 방문 전 확인합니다.
"""
```

Assert that the extracted names are `자매국수`, `우진해장국`, and that `TripPick`, `Visit Jeju` are not candidates.

**Step 2: Run the focused test to verify RED**

Run:

```powershell
python -m pytest apps\api\tests\test_haruban_agent.py -k "candidate_extraction_accepts_bold_section_and_bullet_dot" -q
```

Expected: FAIL because the current parser only recognizes `## 추천 장소`.

### Task 2: Implement tolerant deterministic parsing

**Files:**
- Modify: `apps/api/engine/haruban.py:881-997`
- Test: `apps/api/tests/test_haruban_agent.py`

**Step 1: Add minimal parser helpers**

- Locate either `## 추천 장소` or a full-line `**추천 장소**`.
- Stop at the next H2 heading or known full-line bold section heading.
- Find candidate headings only when the full line matches an optional list marker followed by `**고유명**`.
- Treat `-`, `*`, and `•` as valid structured-field prefixes.

**Step 2: Preserve safety checks**

- Require at least one structured place field.
- Require at least one URL inside the same candidate block.
- Keep duplicate-name and numeric-unit rejection.
- Keep the six-candidate limit.

**Step 3: Run the focused test to verify GREEN**

Run:

```powershell
python -m pytest apps\api\tests\test_haruban_agent.py -k "candidate_extraction" -q
```

Expected: all candidate extraction tests PASS.

### Task 3: Verify API and frontend contracts

**Files:**
- Test: `apps/api/tests/test_haruban_agent.py`
- Test: `apps/web/tests/haruban-plan-selection.test.mjs`

**Step 1: Run related backend tests**

```powershell
python -m pytest apps\api\tests\test_haruban_agent.py apps\api\tests\test_llm.py -q
```

**Step 2: Run frontend contract tests**

```powershell
Set-Location apps\web
node --test tests/*.test.mjs
npm run lint
npm run build
```

Expected: all commands exit 0.

### Task 4: Commit, push, and production-check

**Step 1: Inspect**

```powershell
git diff --check
git status --short
```

**Step 2: Commit**

```powershell
git add apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py docs/plans/2026-07-16-haruban-flexible-candidate-extraction-design.md docs/plans/2026-07-16-haruban-flexible-candidate-extraction.md
git commit -m "[수정] 하루방 추천 후보 형식 호환"
```

**Step 3: Push**

```powershell
git push origin HEAD:main
```

**Step 4: Production verification**

Call `/agent/chat` with `최근 제주시 맛집들 알려줘` and the current form state. Confirm:

- `available=true`
- `place_candidates` contains real restaurant names
- no source-domain candidate is present
- the deployed frontend bundle still contains the immediate-plan-add behavior

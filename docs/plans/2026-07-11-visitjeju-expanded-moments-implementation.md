# VisitJeju Expanded Moments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add four VisitJeju-backed moment cards so users can select accommodation, festival/event, souvenir shopping, and culture stops in the existing Pack Your Jeju form.

**Architecture:** Extend the existing `moment -> category` mapping instead of creating a second selection model. The API, region coverage, Haruban labels, PDF labels, and frontend card data should all share the same new IDs. The trust engine remains unchanged because these categories already flow through `place.category` and existing fallback handling.

**Tech Stack:** Python 3.11/FastAPI tests with pytest, React/TypeScript/Vite frontend, existing custom SVG moment icons.

---

### Task 1: Backend Moment Mapping

**Files:**
- Modify: `apps/api/engine/filters.py`
- Modify: `apps/api/engine/haruban.py`
- Modify: `apps/api/engine/assemble.py`
- Modify: `apps/api/engine/region_coverage.py`
- Modify: `apps/api/engine/packpdf.py`
- Test: `apps/api/tests/test_filters.py`
- Test: `apps/api/tests/test_haruban_agent.py`

**Step 1: Write failing tests**

Add tests asserting `MOMENT_TO_CATEGORY` has 12 IDs and maps:

```python
assert MOMENT_TO_CATEGORY["stay"] == "accommodation"
assert MOMENT_TO_CATEGORY["festival_event"] == "festival"
assert MOMENT_TO_CATEGORY["souvenir_shopping"] == "shopping"
assert MOMENT_TO_CATEGORY["culture_stop"] == "culture"
```

Add a build filter test for one new card:

```python
f = build_filters(_req(moments=["stay"]))
assert f.per_moment[0].primary_category == "accommodation"
```

**Step 2: Run test to verify failure**

Run: `python -m pytest apps\api\tests\test_filters.py -q`

Expected: FAIL because new moment IDs are missing.

**Step 3: Implement minimal backend mapping**

Add four mappings to `MOMENT_TO_CATEGORY` and add Korean labels to all backend label dictionaries.

**Step 4: Run API tests**

Run: `python -m pytest apps\api\tests\test_filters.py apps\api\tests\test_haruban_agent.py apps\api\tests\test_region_coverage.py -q`

Expected: PASS.

### Task 2: Frontend Moment Cards

**Files:**
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/data.ts`
- Modify: `apps/web/src/components/marks/MomentIcon.tsx`

**Step 1: Write failing TypeScript-facing changes**

Extend `MomentId` with `stay`, `festival_event`, `souvenir_shopping`, `culture_stop`. Add four entries to `MOMENTS` with titles, descriptions, packing recommendations, and concise custom icons.

**Step 2: Run frontend validation**

Run: `npm test -- --run`

Expected: existing frontend tests should pass if present.

Run: `npm run lint`

Expected: PASS.

### Task 3: Full Verification and Commit

**Files:**
- Verify all modified files.

**Step 1: Run full API tests**

Run: `python -m pytest apps\api\tests -q`

Expected: PASS.

**Step 2: Run frontend checks**

Run from `apps/web`: `npm run lint`

Expected: PASS.

**Step 3: Commit**

```bash
git add docs/plans/2026-07-11-visitjeju-expanded-moments-design.md docs/plans/2026-07-11-visitjeju-expanded-moments-implementation.md apps/api apps/web
git commit -m "[moment] 비짓제주 확장 카드 추가"
```

# Haruban General Question Quality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 하루방이 일반 제주 질문에 바로 답하고, 추천·검증·최신성 질문은 기존 도구 경로로 보내도록 한다.

**Architecture:** `apps/api/engine/haruban.py`에 일반 질문 분류 함수와 템플릿 답변 함수를 추가한다. `chat_turn` 초입에서 이 경로를 먼저 확인하되, 장소 추천/상세/교통/날씨/리뷰 질문은 기존 도구 경로를 우선한다.

**Tech Stack:** Python 3.11, pytest, FastAPI engine module.

---

### Task 1: Add Failing Tests

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`

**Steps:**
1. Add tests for airport region, first Jeju trip, Jeju City broad guide, and recommendation exclusion.
2. Run targeted tests.
3. Confirm at least one new test fails before implementation.

### Task 2: Implement General Question Router

**Files:**
- Modify: `apps/api/engine/haruban.py`

**Steps:**
1. Add `_is_general_knowledge_question`.
2. Add `_template_general_question_answer`.
3. Add `_try_general_question_answer`.
4. Call it at the start of `chat_turn`.

### Task 3: Verify

**Commands:**
- `python -m pytest apps/api/tests/test_haruban_agent.py -q`
- `python -m pytest apps/api/tests -q`

Expected: all tests pass.

### Task 4: Commit

**Files to stage:**
- `apps/api/engine/haruban.py`
- `apps/api/tests/test_haruban_agent.py`
- `docs/plans/2026-07-11-haruban-general-question-quality-design.md`
- `docs/plans/2026-07-11-haruban-general-question-quality-implementation.md`

**Commit message:**
- `[agent] 하루방 일반 질문 응답 개선`

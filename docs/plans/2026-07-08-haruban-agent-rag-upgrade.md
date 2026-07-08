# Haruban Agent RAG Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 하루방 에이전트를 DB 결과 나열형 봇에서 gpt-5-mini 중심의 공공데이터 근거 상담 에이전트로 개선한다.

**Architecture:** gpt-5-mini가 사용자 질문을 먼저 해석하고, 장소 추천·개수·검증처럼 사실 확인이 필요한 질문에만 RAG 도구를 호출한다. 도구 결과는 답변의 원자료로만 쓰고, 사용자에게는 내부 용어 대신 공공데이터 기준과 확인 한계를 자연스럽게 설명한다.

**Tech Stack:** FastAPI, OpenAI gpt-5-mini chat completions with tools, React/Vite, existing search/verify engine.

---

### Task 1: Prompt Policy

**Files:**
- Modify: `apps/api/engine/haruban.py`
- Test: `apps/api/tests/test_haruban_agent.py`

**Steps:**
1. Update the system prompt so gpt-5-mini answers general travel guidance directly.
2. Keep tool-first behavior only for factual recommendations, counts, candidate lists, and review verification.
3. Add a user-facing answer structure: direct answer, reason, evidence boundary, next narrowing choice.
4. Add tests that assert the prompt frames gpt-5-mini as the primary reasoning layer and avoids the old "저희 DB/RAG 검색 기준" phrase.

### Task 2: Tool Result Language

**Files:**
- Modify: `apps/api/engine/haruban.py`
- Test: `apps/api/tests/test_haruban_agent.py`

**Steps:**
1. Rename internal "RAG 검색" wording in tool descriptions to "공공데이터 근거 검색".
2. Change the search result note to "제주를 담다가 참조하는 공공데이터 기준".
3. Keep total_count and items available for the model so factual count questions remain grounded.

### Task 3: Frontend Agent Tone

**Files:**
- Modify: `apps/web/src/components/HarubanChat.tsx`

**Steps:**
1. Change the panel subtitle from "gpt-5-mini RAG 여행 조율" to a public-data phrasing.
2. Change empty-state and loading copy to avoid exposing internal RAG terms.
3. Hide raw OpenAI error messages from users and show a short retry message instead.

### Task 4: Verification

**Commands:**
- `pytest apps/api/tests/test_haruban_agent.py`
- `npm run lint` in `apps/web`
- `npm run build` in `apps/web`

**Expected:** all commands pass. The Vite chunk-size warning is acceptable because it predates this change.

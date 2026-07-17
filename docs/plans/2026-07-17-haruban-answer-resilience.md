# Haruban Answer Resilience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve usable preloaded research when final answer generation fails and keep long chat histories below the API message limit.

**Architecture:** The API will convert final-model failures into the existing evidence-based tool fallback only when a preloaded tool result exists. The web client will use a small pure history builder that filters UI-only entries and retains the latest 24 messages before calling `/agent/chat`.

**Tech Stack:** Python 3.11, pytest, FastAPI/Pydantic, React 19, TypeScript, Vitest

---

### Task 1: Preserve preloaded research on final model failure

**Files:**
- Modify: `apps/api/tests/test_haruban_agent.py`
- Modify: `apps/api/engine/haruban.py`

**Step 1: Write the failing exception regression test**

Add a test that builds a valid `web_search_jeju` pool context, makes `OpenAI.chat.completions.create` raise `TimeoutError`, and asserts:

```python
assert turn.available is True
assert "안덕은" in turn.reply_text
assert turn.answer_contract == contract
assert turn.place_candidates == candidates
assert "fallback" in turn.reason
```

**Step 2: Run the test to verify RED**

Run:

```powershell
python -m pytest apps/api/tests/test_haruban_agent.py::test_preloaded_search_falls_back_when_final_model_call_fails -q
```

Expected: FAIL because the current result has `available=False` and an empty reply.

**Step 3: Implement the minimal failure conversion**

Add a small helper in `haruban.py` that returns a populated `HarubanTurn` from `_fallback_reply_from_tool_messages(conv)` while preserving trace, contract, and candidates. Use it in the model-call exception branch only when `preloaded_tool` is present.

**Step 4: Run the test to verify GREEN**

Run the same focused pytest command. Expected: PASS.

**Step 5: Add and verify the no-choice regression**

Add `test_preloaded_search_falls_back_when_final_model_returns_no_choice`, confirm it fails, then use the same helper in the no-choice branch when `preloaded_tool` exists. Run both focused tests and expect 2 passed.

### Task 2: Limit transmitted chat history to the latest 24 messages

**Files:**
- Create: `apps/web/src/harubanChatHistory.ts`
- Create: `apps/web/src/harubanChatHistory.test.ts`
- Modify: `apps/web/src/components/HarubanChat.tsx`

**Step 1: Write the failing history-builder test**

Define the desired API in the test:

```typescript
const history = buildHarubanChatHistory(entries);
expect(history).toHaveLength(24);
expect(history[0]?.content).toBe('message-7');
expect(history[23]?.content).toBe('message-30');
```

Also assert that `intro` entries are excluded and user/assistant roles retain chronological order.

**Step 2: Run the test to verify RED**

Run:

```powershell
npm test -- --run src/harubanChatHistory.test.ts
```

from `apps/web`. Expected: FAIL because the module does not exist.

**Step 3: Implement the pure helper**

Create an exported history-entry input type, `HARUBAN_CHAT_HISTORY_LIMIT = 24`, and `buildHarubanChatHistory`. Filter to user/assistant entries, map roles and content, then call `.slice(-HARUBAN_CHAT_HISTORY_LIMIT)`.

**Step 4: Run the test to verify GREEN**

Run the focused Vitest command again. Expected: PASS.

**Step 5: Connect the helper**

Replace the inline filter/map block in `HarubanChat.tsx` with `buildHarubanChatHistory(nextEntries)`. Keep `intro` rendering and full local UI history unchanged.

**Step 6: Run focused tests and type checking**

Run:

```powershell
npm test -- --run src/harubanChatHistory.test.ts
npm run lint
```

Expected: focused test and TypeScript compilation pass.

### Task 3: Full verification

**Files:**
- Verify all files changed in Tasks 1 and 2

**Step 1: Run API tests**

```powershell
python -m pytest apps/api/tests -q
```

Expected: all API tests pass.

**Step 2: Run web tests**

```powershell
npm test
```

from `apps/web`. Expected: all web tests pass.

**Step 3: Run web type checking**

```powershell
npm run lint
```

Expected: `tsc --noEmit` exits 0.

**Step 4: Validate the patch**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only the planned files plus pre-existing user changes appear.


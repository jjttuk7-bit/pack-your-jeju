# Haruban Adaptive Routing and Session Memory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Route unfamiliar Jeju questions to evidence-gathering by default and preserve compact conversational context for the lifetime of the open chat.

**Architecture:** The API will use a deterministic route decision that recognizes only safe no-search, out-of-scope, and unresolved-follow-up cases; remaining Jeju-context questions will preload web research. The React client will maintain a bounded structured conversation state in memory, send it beside the latest 24 messages, and update it from each user question and structured API response.

**Tech Stack:** Python 3.11, FastAPI, Pydantic, pytest, React 19, TypeScript, Vitest

---

### Task 1: Add conservative default routing for unfamiliar Jeju questions

**Files:**
- Modify: `apps/api/engine/haruban.py`
- Modify: `apps/api/tests/test_haruban_agent.py`

**Step 1: Write a failing table-driven routing test**

Add a test covering unfamiliar factual forms:

```python
@pytest.mark.parametrize("question", [
    "안덕 이름의 유래는?",
    "안덕은 뭐 하는 데야?",
    "안덕이 알려진 이유가 뭐야?",
    "안덕 분위기를 설명해줘",
])
def test_unfamiliar_jeju_fact_questions_default_to_web_research(monkeypatch, question):
    captured = {}
    monkeypatch.setattr(haruban, "_run_web_search_jeju", lambda args: captured.update(args) or {
        "available": True, "query": args["query"], "answer": "확인", "sources": []
    })
    pool = haruban._build_search_pool_context(
        [{"role": "user", "content": question}],
        {"regions": ["andeok"]},
    )
    assert pool["tool"] == "web_search_jeju"
    assert captured["query"] == question
```

**Step 2: Run the focused test and verify RED**

Run:

```powershell
python -m pytest apps/api/tests/test_haruban_agent.py::test_unfamiliar_jeju_fact_questions_default_to_web_research -q
```

Expected: the unrecognized forms return no web search pool.

**Step 3: Implement the conservative default**

Add focused predicates:

```python
def _has_jeju_context(text_in: str, form_state: dict, conversation_state: dict | None = None) -> bool: ...
def _is_safe_no_search_question(text_in: str) -> bool: ...
def _is_clearly_out_of_scope_question(text_in: str) -> bool: ...
```

Extend `_should_use_web_research` with optional `form_state` and `conversation_state`. Preserve explicit public-data, weather, internal-tool, and free-advice routes. Return `True` for remaining questions when `_has_jeju_context` is true.

Pass the two states from `_build_search_pool_context`.

**Step 4: Run the focused test and verify GREEN**

Run the focused test again. Expected: all parameter cases pass.

**Step 5: Add guardrail tests**

Add tests asserting these do not preload web research:

- `안녕` → social response route
- `제주 여행 일정은 어떻게 짜?` → free-advice route
- `서울 맛집 추천해줘` → out-of-scope route
- explicit public-data count question → existing internal route

Run the new guardrail tests and relevant existing routing tests.

**Step 6: Commit**

```powershell
git add apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py
git commit -m "[개선] 낯선 제주 질문 웹 조사 기본값 적용"
```

### Task 2: Resolve short follow-ups or ask for their target

**Files:**
- Modify: `apps/api/engine/haruban.py`
- Modify: `apps/api/tests/test_haruban_agent.py`

**Step 1: Write failing follow-up tests**

Add tests for:

```python
state = {
    "last_user_question": "안덕은 어떤 곳이야?",
    "last_research_query": "안덕은 어떤 곳이야?",
    "active_regions": ["andeok"],
    "active_place_names": ["산방산"],
    "web_research_active": True,
}
```

Assert `거기는 왜 유명해?` produces `web_search_jeju` and its query contains both the new question and prior subject. Assert the same question without state returns a deterministic clarification rather than calling the model.

**Step 2: Run the tests and verify RED**

Expected: `_build_search_pool_context` ignores state and `chat_turn` cannot clarify deterministically.

**Step 3: Implement follow-up resolution**

Add:

```python
def _is_short_contextual_followup(text_in: str) -> bool: ...
def _resolve_web_research_query(last_user: str, conversation_state: dict | None) -> str: ...
def _try_context_clarification_answer(messages_in: list[dict], conversation_state: dict | None) -> str: ...
```

Use only bounded state fields. If no subject exists, return one short Korean clarification. If a subject exists, create a search query containing the current wording, prior question/query, active region, and at most five active place names.

**Step 4: Run tests and verify GREEN**

Run the focused follow-up tests. Expected: pass.

**Step 5: Commit**

```powershell
git add apps/api/engine/haruban.py apps/api/tests/test_haruban_agent.py
git commit -m "[개선] 짧은 후속 질문의 조사 문맥 복원"
```

### Task 3: Add the session-memory API contract

**Files:**
- Modify: `apps/api/main.py`
- Modify: `apps/api/engine/haruban.py`
- Modify: `apps/api/tests/test_agent_endpoints.py`
- Modify: `apps/api/tests/test_haruban_agent.py`

**Step 1: Write failing contract tests**

Add an endpoint test that posts:

```json
{
  "messages": [{"role": "user", "content": "거기는 왜 유명해?"}],
  "form_state": {"regions": ["andeok"]},
  "conversation_state": {
    "last_research_query": "안덕은 어떤 곳이야?",
    "active_regions": ["andeok"],
    "active_place_names": ["산방산"],
    "web_research_active": true
  }
}
```

Assert the endpoint passes the bounded state to `chat_turn`. Add engine tests asserting the system prompt and web-search context include the state.

**Step 2: Run tests and verify RED**

Expected: `conversation_state` is ignored and `chat_turn` does not accept it.

**Step 3: Implement the API boundary**

Add a Pydantic `HarubangConversationState` with bounded lists and strings, add it to `HarubangChatBody`, and pass its dumped value to:

```python
chat_turn(messages_in, body.form_state, conversation_state=...)
```

Extend `chat_turn` and `_build_search_pool_context` with optional state. Add `_conversation_context_block` and include only non-empty bounded fields in the system/search context.

**Step 4: Run tests and verify GREEN**

Run the endpoint and engine contract tests. Expected: pass.

**Step 5: Commit**

```powershell
git add apps/api/main.py apps/api/engine/haruban.py apps/api/tests/test_agent_endpoints.py apps/api/tests/test_haruban_agent.py
git commit -m "[API] 하루방 세션 문맥 계약 추가"
```

### Task 4: Build bounded in-memory conversation state in the web client

**Files:**
- Create: `apps/web/src/harubanConversationState.ts`
- Create: `apps/web/src/harubanConversationState.test.ts`
- Modify: `apps/web/src/api.ts`

**Step 1: Write the failing pure-state tests**

Define and test:

```typescript
const next = updateHarubanConversationState(previous, {
  question: '그건 빼고 다른 곳',
  formState: { regions: ['andeok'] },
  response,
});
```

Assert:

- last question and web search query update
- active candidates come from the latest response
- shown candidates are deduplicated
- an exclusion utterance is retained verbatim
- active candidates, shown candidates, and exclusions respect fixed caps
- `createInitialHarubanConversationState()` returns a fresh empty object

**Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- --run src/harubanConversationState.test.ts
```

Expected: module not found.

**Step 3: Implement the pure state module**

Export:

```typescript
export interface HarubanConversationState { ... }
export function createInitialHarubanConversationState(): HarubanConversationState { ... }
export function updateHarubanConversationState(...): HarubanConversationState { ... }
```

Use deterministic response metadata only. Keep at most 5 active places, 40 shown places, 10 exclusion utterances, and 8 active regions.

**Step 4: Extend the API client**

Add `conversationState` to `requestHarubanChat` and serialize it as `conversation_state`. Keep it required at the call site and strongly typed.

**Step 5: Run focused tests and type checking**

Run the focused Vitest test and `npm run lint`. Expected: pass after the component is connected in Task 5; before then, TypeScript may identify the missing call argument.

**Step 6: Commit**

```powershell
git add apps/web/src/api.ts apps/web/src/harubanConversationState.ts apps/web/src/harubanConversationState.test.ts
git commit -m "[프론트] 하루방 세션 문맥 상태 모델 추가"
```

### Task 5: Connect session memory to the chat lifetime

**Files:**
- Modify: `apps/web/src/components/HarubanChat.tsx`
- Modify: `apps/web/src/harubanConversationState.test.ts`

**Step 1: Add a failing integration-oriented state test**

Add a test showing two sequential updates preserve the first response's shown candidate while activating the second response's candidates. This proves rolling state behavior independently of React rendering.

**Step 2: Verify RED, then implement the minimal state behavior**

If the state reducer already satisfies the test, strengthen the test to cover exclusion or bounded deduplication and confirm it fails before changing implementation.

**Step 3: Connect React state**

Initialize:

```typescript
const [conversationState, setConversationState] = useState(
  createInitialHarubanConversationState,
);
```

Send it through `requestHarubanChat`. After an available response, update it with the current question, form state, and structured response. Do not use `localStorage`, session storage, cookies, or server-side session identifiers.

**Step 4: Run focused web tests and type checking**

Run:

```powershell
npm test -- --run src/harubanChatHistory.test.ts src/harubanConversationState.test.ts
npm run lint
```

Expected: pass.

**Step 5: Commit**

```powershell
git add apps/web/src/components/HarubanChat.tsx apps/web/src/harubanConversationState.test.ts
git commit -m "[프론트] 하루방 채팅에 세션 문맥 연결"
```

### Task 6: Full question-matrix and regression verification

**Files:**
- Modify only if a test exposes a defect in planned files

**Step 1: Run focused API routing tests**

```powershell
python -m pytest apps/api/tests/test_haruban_agent.py apps/api/tests/test_agent_endpoints.py -q
```

Expected: pass.

**Step 2: Run the full API suite**

```powershell
python -m pytest apps/api/tests -q
```

Expected: pass.

**Step 3: Run the full web suite**

```powershell
npm test
npm run lint
```

from `apps/web`. Expected: all tests and `tsc --noEmit` pass.

**Step 4: Validate patch scope**

```powershell
git diff --check
git status --short
git diff main...HEAD --stat
```

Expected: clean worktree and only the planned API, web, tests, and plan files differ.


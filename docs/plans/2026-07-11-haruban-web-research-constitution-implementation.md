# Haruban Web Research Constitution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 하루방 에이전트의 권위 문서를 웹 리서치 우선, 다층 출처 평가, 충분한 답변, 공공데이터 후순위 교차확인 체계로 전면 개정한다.

**Architecture:** `AGENTS.md`가 작업 헌법과 제품 원칙을 선언하고, `DECISIONS.md`가 기존 해커톤·공공데이터 전용 결정을 폐기한 이력을 보존하며, `TRUST_ENGINE.md`가 실제 검색·출처 평가·답변 조립 규칙을 정의한다. 기존 하루방 품질 설계와 구현 계획에는 대체 표시를 추가해 서로 다른 권위 문서가 동시에 유효한 것처럼 보이지 않게 한다.

**Tech Stack:** Markdown, Mermaid, Git, ripgrep.

---

### Task 1: Rewrite The Repository Constitution

**Files:**
- Modify: `AGENTS.md`

**Step 1: Replace the product identity**

Replace the hackathon and public-data-pack identity with a production Jeju travel research service. State that Haruban is a multi-turn web research agent and that the product optimizes for useful, sourced decisions rather than public-data coverage counts.

**Step 2: Replace the absolute rules**

Define these binding rules:

- recommendation and current-information questions are web-search-first;
- factual claims require traceable web or internal-data evidence;
- official, platform, experience, and public-data sources have distinct roles;
- changing facts require current verification and an as-of time;
- follow-up turns retain region, candidates, exclusions, and source intent;
- failed web research cannot silently fall back to a public-data candidate list;
- public data appears only as a final cross-check when relevant;
- answer length follows question complexity and must include enough reasoning to support a choice;
- uncertainty and source conflicts are disclosed;
- the service remains useful when one source or model is unavailable.

**Step 3: Replace obsolete scope guards**

Remove the four-day-project, no-multi-turn, no-review-recommendation, and public-data-only restrictions. Keep only production-relevant scope controls such as no fabricated facts, no unsupported ranking claims, and no hidden source substitution.

**Step 4: Update workflow and quality checklist**

Require source-aware tests and checks for search execution, citation relevance, freshness, conversation continuity, answer completeness, and public-data cross-check placement.

**Step 5: Review the file**

Run: `Get-Content -Raw AGENTS.md`

Expected: no statement identifies Pack Your Jeju as a four-day hackathon or forbids multi-turn conversation and review-based recommendation evidence.

**Step 6: Commit**

```bash
git add AGENTS.md
git commit -m "[agent] 하루방 운영 헌법 전면 개정"
```

### Task 2: Supersede The Old Decisions

**Files:**
- Modify: `DECISIONS.md`

**Step 1: Preserve decision history explicitly**

Add a superseded-status convention. Mark decisions based on the hackathon-only scope and public-data-only recommendation model as superseded rather than deleting history without explanation.

**Step 2: Add production decisions**

Record new decisions covering:

- production-service direction;
- web research as the default recommendation path;
- multi-source evidence roles;
- reviews and social content as experience evidence;
- public data as a final cross-check;
- multi-turn context retention;
- adaptive answer depth;
- transparent search failure and source conflict handling;
- quality evaluation based on grounded usefulness instead of candidate counts.

**Step 3: Check contradictions**

Run: `rg -n "4일|멀티턴|리뷰는 추천에 쓰지|공공데이터 근거만|웹" DECISIONS.md`

Expected: obsolete decisions are visibly marked superseded and new active decisions establish web-first behavior.

**Step 4: Commit**

```bash
git add DECISIONS.md
git commit -m "[decision] 웹 리서치 우선 결정 반영"
```

### Task 3: Redesign The Trust And Research Engine Specification

**Files:**
- Modify: `TRUST_ENGINE.md`

**Step 1: Replace the DB-only pipeline**

Specify this flow: understand conversation context, plan searches, collect diverse sources, normalize claims, assess source role and freshness, compare candidates, cross-check internal public data, compose cited answer, log research quality.

**Step 2: Define source classes and claim rules**

Add official, platform, experience, and internal public-data source classes. Define which claim types each can support and require stronger corroboration for changing or commercially consequential facts.

**Step 3: Redefine fallback behavior**

Keep `out_of_scope`, `coverage_gap`, `retrieval_miss`, and `contradicted` only for internal-data diagnostics. Add web-research states such as `sufficient`, `partial`, `conflicted`, and `unavailable`, with explicit retry and user-facing disclosure rules.

**Step 4: Define the answer contract**

Require direct conclusion, evidence-based candidates, comparison, caveats, inline source links, verification time for volatile facts, and an optional final `공공데이터 교차확인` section.

**Step 5: Define logging and quality metrics**

Specify fields for query variants, source classes, domains, publication or verification dates, supported claims, conflicts, retries, internal cross-check results, answer depth, and latency.

**Step 6: Review the full specification**

Run: `Get-Content -Raw TRUST_ENGINE.md`

Expected: the document no longer says DB is the only fact provider, and public data is clearly a final cross-check.

**Step 7: Commit**

```bash
git add TRUST_ENGINE.md
git commit -m "[trust] 웹 리서치 신뢰 엔진 재설계"
```

### Task 4: Retire Conflicting Haruban Plans

**Files:**
- Modify: `docs/plans/2026-07-09-haruban-agent-quality-design.md`
- Modify: `docs/plans/2026-07-09-haruban-agent-quality-implementation.md`

**Step 1: Add superseded notices**

At the top of both files, state that they were superseded on 2026-07-11 by `docs/plans/2026-07-11-haruban-web-research-constitution-design.md`. Explain that their DB-only and short-answer requirements must not be implemented.

**Step 2: Verify the notices**

Run: `rg -n "Superseded|대체|2026-07-11" docs/plans/2026-07-09-haruban-agent-quality-*.md`

Expected: both documents visibly identify the new authority.

**Step 3: Commit**

```bash
git add docs/plans/2026-07-09-haruban-agent-quality-design.md docs/plans/2026-07-09-haruban-agent-quality-implementation.md
git commit -m "[docs] 기존 하루방 품질 계획 폐기 표시"
```

### Task 5: Cross-Document Reader And Consistency Check

**Files:**
- Verify: `AGENTS.md`
- Verify: `DECISIONS.md`
- Verify: `TRUST_ENGINE.md`
- Verify: `docs/plans/2026-07-11-haruban-web-research-constitution-design.md`

**Step 1: Search for prohibited active assumptions**

Run: `rg -n "4일짜리|멀티턴 대화.*하지|리뷰는 추천에 쓰지|사실 정보는 반드시 DB|공공데이터 근거만" AGENTS.md DECISIONS.md TRUST_ENGINE.md`

Expected: no active rule contains these assumptions; historical text in `DECISIONS.md` is explicitly marked superseded.

**Step 2: Search for required active principles**

Run: `rg -n "웹 검색|공식 출처|플랫폼 출처|경험 출처|공공데이터 교차|후속 질문|출처 충돌|답변" AGENTS.md DECISIONS.md TRUST_ENGINE.md`

Expected: all three authority documents cover their relevant parts of the new model.

**Step 3: Inspect the complete diff**

Run: `git diff HEAD~4 -- AGENTS.md DECISIONS.md TRUST_ENGINE.md docs/plans/2026-07-09-haruban-agent-quality-design.md docs/plans/2026-07-09-haruban-agent-quality-implementation.md docs/plans/2026-07-11-haruban-web-research-constitution-design.md docs/plans/2026-07-11-haruban-web-research-constitution-implementation.md`

Expected: the documents consistently describe web-first research and public-data-last cross-checking without weakening the no-fabrication rule.

**Step 4: Reader test**

Ask a fresh reviewer to answer these questions using only the revised documents:

1. What must Haruban do when asked for Gujwa restaurants?
2. May Haruban use reviews, and for what kinds of claims?
3. What happens when web search fails?
4. When and where is public data shown?
5. How long should an answer be?
6. What should a follow-up question inherit?

Expected: the reviewer answers consistently with the approved design and reports no authority conflict.

**Step 5: Final status check**

Run: `git status --short`

Expected: unrelated pre-existing untracked files remain untouched; all constitution changes are committed.

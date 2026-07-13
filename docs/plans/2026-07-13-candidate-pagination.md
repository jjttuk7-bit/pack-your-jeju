# Candidate Pagination Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 순간별 최초 후보 5곳을 유지하면서 사용자가 전체 개수와 다음 후보를 중복 없이 계속 탐색하게 한다.

**Architecture:** 기존 `/pack` section에 선택적 페이지 메타데이터를 추가하고, 동일한 여행 필터로 다음 후보를 반환하는 `POST /pack/candidates`를 만든다. 프론트는 순간별 목록에 다음 페이지를 누적하며 기존 PDF·요일별 일정 응답은 변경하지 않는다.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy, pytest, React 19, TypeScript, Tailwind CSS 4, Node test runner

---

### Task 1: 검색 페이지 단위 계약

**Files:**
- Modify: `apps/api/tests/test_candidate_limit.py`
- Modify: `apps/api/engine/search.py`

**Steps:**
1. 첫 페이지와 다음 페이지가 겹치지 않고 전체 개수·다음 cursor를 반환하는 실패 테스트를 작성한다.
2. `python -m pytest apps/api/tests/test_candidate_limit.py -q`로 의도한 실패를 확인한다.
3. opaque offset cursor, exact-first 정렬, count와 page 조회를 최소 구현한다.
4. 같은 테스트가 통과하는지 확인한다.

### Task 2: `/pack` 메타데이터와 다음 후보 API

**Files:**
- Modify: `apps/api/main.py`
- Modify: `apps/api/engine/trust.py`
- Modify: `apps/api/tests/test_pack_integration.py`
- Create: `apps/api/tests/test_candidate_pagination.py`

**Steps:**
1. section 메타데이터, 다음 페이지, 잘못된 cursor 계약의 실패 테스트를 작성한다.
2. 대상 테스트가 기능 부재로 실패하는지 확인한다.
3. `Section` 페이지 필드, 직렬화, `CandidatePageBody`, `POST /pack/candidates`를 구현한다.
4. 기존 `/pack` 테스트와 새 API 테스트를 함께 실행한다.

### Task 3: 프론트 API와 상태 병합

**Files:**
- Modify: `apps/web/src/types.ts`
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Create: `apps/web/tests/candidate-pagination.test.mjs`

**Steps:**
1. 전체/표시 개수와 다른 후보 버튼, 중복 제거 병합 계약의 실패 테스트를 작성한다.
2. `node --test tests/candidate-pagination.test.mjs`의 실패를 확인한다.
3. 타입, API 클라이언트, 순간별 loading/error 상태와 누적 병합을 구현한다.
4. Node 테스트와 `npm run lint`를 실행한다.

### Task 4: 정책 문서와 전체 회귀 검증

**Files:**
- Modify: `DECISIONS.md`
- Modify: `TRUST_ENGINE.md`

**Steps:**
1. 고정 후보 수를 완결성 지표로 사용하지 않고 점진적 탐색을 제공한다는 결정을 기록한다.
2. Python 전체 테스트, Node 테스트, TypeScript 검사와 Vite 빌드를 실행한다.
3. 모바일 브라우저에서 전체 개수·다른 후보 보기·완료/오류 상태를 확인한다.
4. `[web] 후보 탐색 페이지네이션 추가` 형식으로 커밋한다.

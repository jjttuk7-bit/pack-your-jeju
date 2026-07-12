# Haruban Readable Answers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 하루방 웹 조사 답변을 간결한 Markdown 브리핑으로 생성하고 채팅 패널에서 읽기 좋은 구조로 렌더링한다.

**Architecture:** API 시스템 프롬프트에 출력 구조와 길이 제한을 명시한다. 웹 클라이언트는 검증된 Markdown 렌더러로 어시스턴트 답변만 변환하고 기존 답변 계약 배지는 그대로 유지한다.

**Tech Stack:** Python, pytest, React 19, TypeScript, react-markdown, remark-gfm, Tailwind CSS, Vite

---

### Task 1: 답변 형식 계약

**Files:**
- Modify: `apps/api/engine/haruban.py`
- Test: `apps/api/tests/test_haruban_agent.py`

1. 시스템 프롬프트가 Markdown 구조, 최대 추천 수, 반복 안내 제거를 요구하는 실패 테스트를 작성한다.
2. 테스트를 실행해 실패를 확인한다.
3. `_BASE_SYSTEM_PROMPT`에 간결한 여행 브리핑 출력 계약을 추가한다.
4. 하루방 테스트를 실행해 통과를 확인한다.

### Task 2: Markdown 렌더링

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/components/HarubanChat.tsx`

1. `react-markdown`과 `remark-gfm`을 설치한다.
2. 어시스턴트 답변을 전용 `AssistantMarkdown` 컴포넌트로 렌더링한다.
3. 제목, 문단, 목록, 강조, 링크의 채팅 전용 스타일을 지정한다.
4. 외부 링크에 새 탭, `noopener noreferrer`, 명확한 포커스 스타일을 적용한다.

### Task 3: 검증과 배포

**Files:**
- Verify: `apps/api/tests/test_haruban_agent.py`
- Verify: `apps/web/src/components/HarubanChat.tsx`

1. API 테스트를 실행한다.
2. 웹 타입 검사와 프로덕션 빌드를 실행한다.
3. 로컬 화면을 데스크톱·모바일에서 확인한다.
4. 변경 파일만 커밋하고 `main`에 푸시한다.
5. Railway 배포 성공과 운영 답변 표시를 확인한다.


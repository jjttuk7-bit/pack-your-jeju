# Competition Landing Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reposition the landing page as a competition-ready public-data AI service page.

**Architecture:** Keep the existing React component structure and visual system, then replace copy and preview cards. Avoid broad layout refactors so the current polished landing remains stable.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind utility classes, Motion.

---

### Task 1: Landing Copy Redesign

**Files:**
- Modify: `apps/web/src/components/LandingPage.tsx`

**Step 1: Update hero**

Change the badge, headline, description, CTA, and preview card to emphasize:

- 2026 제주 공공데이터·AI 활용 창업경진대회
- 제주형 신뢰 여행 플랫폼
- 기상·교통·수정요청·비짓제주 확장 데이터

**Step 2: Update middle sections**

Revise Trust Engine, data flow, trust cycle, and how-it-works copy to focus on competition scoring language.

**Step 3: Verify no stale phrases**

Run:

```powershell
rg -n "아이펠|해커톤|프리|GPT-5-mini RAG Design" apps\web\src\components\LandingPage.tsx
```

Expected: no stale competition framing phrases.

### Task 2: Frontend Validation

**Files:**
- Validate: `apps/web/src/components/LandingPage.tsx`

**Step 1: Type check**

Run from `apps/web`:

```powershell
npm run lint
```

Expected: PASS.

**Step 2: Production build**

Run from `apps/web`:

```powershell
npm run build
```

Expected: PASS, with existing chunk-size warning acceptable.

### Task 3: Commit

**Files:**
- Stage the two plan files and `LandingPage.tsx`.

Commit:

```powershell
git add docs/plans/2026-07-11-competition-landing-redesign-design.md docs/plans/2026-07-11-competition-landing-redesign-implementation.md apps/web/src/components/LandingPage.tsx
git commit -m "[web] 경진대회용 랜딩 전환"
```

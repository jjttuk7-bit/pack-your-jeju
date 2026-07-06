# Travel Plan PDF Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the saved PDF from a journal-style result archive into a practical trip plan.

**Architecture:** Keep `/pack/pdf` deterministic and grounded in the existing pack response. Rename UI/PDF language from journal to travel plan, add a plan summary and agent briefing, improve day blocks with time-of-day slots and richer place details, and reframe data gaps as plan notes.

**Tech Stack:** FastAPI, ReportLab, React/TypeScript.

---

### Task 1: Rename User-Facing PDF Actions

**Files:**
- Modify: `apps/web/src/components/PackingDashboard.tsx`
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/components/LandingPage.tsx`

**Steps:**
1. Replace journal wording with travel plan wording.
2. Rename share copy from result sharing to plan sharing.
3. Keep API endpoint unchanged.

### Task 2: Rework PDF Structure

**Files:**
- Modify: `apps/api/engine/packpdf.py`
- Modify: `apps/api/main.py`

**Steps:**
1. Update footer, title, filename intent, and cover language.
2. Add trip summary and agent briefing sections.
3. Replace simple day blocks with morning/lunch/afternoon/evening flow labels.
4. Add place details from existing DB-backed fields only.
5. Replace the final gap page with data-limited plan notes.

### Task 3: Verify

**Commands:**
- `python -m py_compile apps/api/engine/packpdf.py apps/api/main.py`
- `npm run lint` in `apps/web`
- `npm run build` in `apps/web`
- text search for removed journal/banned wording in touched files


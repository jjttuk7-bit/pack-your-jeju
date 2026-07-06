# Haruban Agent Briefing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Haruban feel like a data-backed travel agent instead of a long gap-list renderer.

**Architecture:** Keep the existing `/agent/intro` and `/agent/chat` contract. Improve the web intro block into a compact briefing card, group gaps by region, and only expand details on demand. Clean backend prompt/template wording without changing fact-generation boundaries.

**Tech Stack:** React, TypeScript, FastAPI Python, existing OpenAI/tool loop.

---

### Task 1: Web Agent Briefing

**Files:**
- Modify: `apps/web/src/components/HarubanChat.tsx`

**Steps:**
1. Rename visible header copy from `하루방` to `하루방 에이전트`.
2. Replace flat coverage text with three compact briefing chips.
3. Replace the full gap list with grouped, collapsed `데이터가 부족한 조합`.
4. Add small action copy: confirmed candidates first, expand all combinations.

### Task 2: Backend Agent Tone

**Files:**
- Modify: `apps/api/engine/haruban.py`

**Steps:**
1. Remove banned wording from prompts and comments.
2. Keep the "do not assert absence" wording intact.
3. Adjust template greeting to say data-limited combinations are summarized below.

### Task 3: Verification

**Commands:**
- `npm run lint` in `apps/web`
- `npm run build` in `apps/web`
- targeted text search for banned wording in touched files


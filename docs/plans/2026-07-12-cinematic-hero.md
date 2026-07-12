# Cinematic Hero Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 제주 바다 히어로 이미지를 가벼운 시네마틱 영상처럼 표현한다.

**Architecture:** 히어로 이미지에 GPU 가속 CSS transform 애니메이션을 적용하고 별도 빛 레이어를 추가한다. 사용자 인터페이스는 움직이지 않으며 모션 감소 설정을 준수한다.

**Tech Stack:** React, TypeScript, CSS keyframes, Vite

---

### Task 1: 시네마틱 레이어

- Modify: `apps/web/src/components/LandingPage.tsx`
- Modify: `apps/web/src/index.css`

1. 히어로 이미지에 전용 클래스를 추가한다.
2. 비상호작용 빛 레이어를 추가한다.
3. 확대·이동 및 빛 변화 키프레임을 작성한다.
4. 모션 감소 미디어 쿼리에서 애니메이션을 해제한다.

### Task 2: 검증과 배포

1. 타입 검사와 프로덕션 빌드를 실행한다.
2. 데스크톱·모바일에서 텍스트 고정과 이미지 프레이밍을 확인한다.
3. 커밋 후 Vercel 프로덕션에 배포한다.


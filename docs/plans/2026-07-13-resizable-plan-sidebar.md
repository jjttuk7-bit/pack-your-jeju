# Resizable Plan Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 데스크톱 여행 플랜 사이드바의 폭을 사용자가 조절하고 저장할 수 있게 한다.

**Architecture:** `PackingDashboard`가 사이드바 폭 상태와 Pointer Events를 관리한다. CSS 변수로 기존 그리드의 첫 번째 열 폭을 변경하고 로컬 저장소에 마지막 폭을 보존한다.

**Tech Stack:** React, TypeScript, Tailwind CSS, Pointer Events, localStorage

---

1. 사이드바 폭 상수와 저장 상태를 추가한다.
2. 포인터 이동 시 대시보드 너비에 맞춰 폭을 제한한다.
3. 데스크톱 그리드에 CSS 변수와 리사이즈 핸들을 연결한다.
4. 타입 검사와 프로덕션 빌드를 실행한다.
5. 데스크톱·모바일 레이아웃과 폭 저장을 확인한다.
6. 커밋 후 Vercel 프로덕션에 배포한다.

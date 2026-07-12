# Haruban Window Controls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 하루방 에이전트 패널의 명칭, 대비, 데스크톱 이동 및 크기 조절 기능을 개선한다.

**Architecture:** `HarubanChat`이 데스크톱 패널 좌표와 크기를 상태로 관리한다. Pointer Events로 이동 및 8방향 리사이즈를 처리하며 모바일에서는 기존 고정 레이아웃으로 전환한다.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Pointer Events, Vite

---

1. 패널 좌표와 크기, 데스크톱 여부를 관리하는 상태와 경계 계산을 추가한다.
2. 헤더 이동과 8방향 리사이즈 핸들을 연결한다.
3. 모델명을 사용자 가치 중심 문구로 교체하고 패널 대비를 높인다.
4. 타입 검사와 프로덕션 빌드를 실행한다.
5. 데스크톱과 모바일에서 실제 상호작용과 배치를 확인한다.
6. 변경 파일만 커밋하고 Vercel 프로덕션에 배포한다.

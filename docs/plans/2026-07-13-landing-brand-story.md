# Landing Brand Story Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 제주 일러스트레이션을 활용한 브랜드 소개 섹션을 랜딩에 추가한다.

**Architecture:** 사용자 제공 이미지를 웹용 JPEG로 최적화해 정적 자산으로 저장한다. 기존 사진 갤러리와 플래닝 섹션 사이에 전체 폭 에디토리얼 레이아웃을 추가한다.

**Tech Stack:** React, TypeScript, Tailwind CSS, JPEG, Vite

---

1. 사용자 이미지를 `apps/web/public/images`에 웹용으로 저장한다.
2. `LandingPage.tsx`에 반응형 브랜드 소개 섹션을 추가한다.
3. 타입 검사와 프로덕션 빌드를 실행한다.
4. 데스크톱과 모바일에서 이미지 크롭과 문구 배치를 확인한다.
5. 커밋 후 Vercel 프로덕션에 배포한다.


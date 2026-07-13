# Landing Journey Infographic Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 제주를 담다의 검색·검증·플랜·피드백 가치를 보여주는 반응형 랜딩 인포그래픽을 추가한다.

**Architecture:** `LandingPage`에 정적 단계 데이터와 반응형 여정 섹션을 추가한다. 기존 Motion 진입 애니메이션과 CTA 함수를 재사용한다.

**Tech Stack:** React, TypeScript, Tailwind CSS, Motion, Lucide Icons

---

1. 네 단계 인포그래픽 데이터를 정의한다.
2. 일러스트와 사용 안내 사이에 전체 폭 여정 섹션을 추가한다.
3. 데이터 근거가 하나의 플랜으로 합쳐지는 결론 영역과 CTA를 연결한다.
4. 타입 검사와 프로덕션 빌드를 실행한다.
5. 데스크톱·모바일 화면을 시각 검증한다.
6. 커밋 후 Vercel 프로덕션에 배포한다.

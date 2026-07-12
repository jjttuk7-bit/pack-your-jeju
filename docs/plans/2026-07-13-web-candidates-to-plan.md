# Web Candidates To Plan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 하루방 웹검색 장소를 사용자가 선택해 기존 여행 플랜과 방문 피드백에 활용할 수 있게 한다.

**Architecture:** 백엔드가 웹검색 Markdown과 URL 인용을 `place_candidates`로 구조화한다. 프론트는 체크형 후보 목록을 렌더링하고 기존 `TravelPlanItem`에 `web_search` 출처 메타데이터를 추가한다.

**Tech Stack:** FastAPI, Python, React, TypeScript, pytest, Vite

---

1. 웹검색 후보 구조화와 응답 전달 테스트를 작성한다.
2. 출처가 연결된 장소만 구조화해 `/agent/chat`에 포함한다.
3. 웹검색 후보 체크 및 일괄 플랜 추가 UI를 구현한다.
4. 플랜 출처 배지, 원문 링크, 방문 피드백 안내를 확장한다.
5. API 테스트, 타입 검사, 빌드와 브라우저 상호작용을 검증한다.
6. Railway와 Vercel에 배포하고 실제 웹검색 후보 저장을 확인한다.

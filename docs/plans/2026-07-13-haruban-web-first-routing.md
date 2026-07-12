# Haruban Web-First Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 지역 추천 질문이 공공데이터 상세조회로 오분류되지 않고 OpenAI 웹검색과 재검색을 거쳐 출처 기반 답변을 반환하게 한다.

**Architecture:** `HarubanChat`의 검색 풀 라우터에서 추천 표현과 장소 상세 표현을 분리한다. Responses API 웹검색 결과에 인용 출처가 없을 때 지역 맥락을 보강한 검색어로 한 번 재시도한다.

**Tech Stack:** Python 3.11, OpenAI Responses API, pytest

---

1. 첨부 화면 질문의 잘못된 상세조회 라우팅을 재현하는 테스트를 추가한다.
2. 웹검색 1회 실패 뒤 재검색을 요구하는 테스트를 추가한다.
3. 상세질문 정규식과 추천질문 판별식을 수정한다.
4. 지역 맥락을 포함한 제한적 재검색을 구현한다.
5. 하루방 전체 테스트를 실행한다.
6. 프로덕션 배포 후 동일 질문으로 실제 웹검색 답변과 도구 추적을 확인한다.

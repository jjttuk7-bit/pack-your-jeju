# 제주를 담다 사용자 매뉴얼 v1.1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 서비스 URL·QR 코드·PWA 설치 안내를 포함하고 개발자 내용을 제외한 12쪽 사용자 매뉴얼 PDF를 생성한다.

**Architecture:** 기존 ReportLab 생성기와 화면 자산을 재사용하고, 표지에 링크·QR을 추가하며 PWA 전용 페이지를 빠른 시작 다음에 삽입한다. PDF 생성 후 pypdf와 페이지 이미지 렌더링으로 링크·내용·페이지 배치를 검증한다.

**Tech Stack:** Python, ReportLab, pypdf, PyMuPDF, PIL

---

### Task 1: 생성기 최신화

**Files:**
- Modify: `scripts/generate_user_manual_pdf.py`

1. 서비스 URL 상수를 추가한다.
2. 표지 버전을 v1.1, 날짜를 2026-07-15로 바꾼다.
3. 표지에 QR 코드와 클릭 가능한 URL을 추가한다.
4. 빠른 시작 페이지에 직접 접속 주소를 추가한다.
5. PWA 설치 전용 페이지를 삽입한다.
6. GitHub·개발자·관리자 관련 문구가 없도록 유지한다.

### Task 2: PDF 생성

**Files:**
- Create: `docs/제주를_담다_사용자_매뉴얼_v1.1.pdf`

1. 기존 화면 자산 4개의 존재를 확인한다.
2. ReportLab 생성기를 실행한다.
3. 출력 파일이 열리고 12쪽인지 확인한다.

### Task 3: 내용·링크·시각 검증

**Files:**
- Create: `tmp_user_manual_v11_review/`

1. PDF 텍스트에서 서비스 URL, PWA, Android, iPhone, PC를 확인한다.
2. PDF URI annotation이 서비스 URL을 가리키는지 확인한다.
3. 금지어가 없는지 확인한다.
4. 12쪽을 이미지로 렌더링해 연락시트와 핵심 페이지를 확인한다.
5. 잘림이나 겹침이 있으면 생성기를 조정하고 재검증한다.


# User Manual Current UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 최신 지도·순간별 장소 이미지·플랜·하루방 화면을 반영하고 표지 배경 글자를 제거한 12페이지 제출용 사용자 매뉴얼 v1.2 PDF를 만든다.

**Architecture:** 현재 배포 서비스를 Microsoft Edge의 Chrome DevTools Protocol로 자동 조작해 최신 화면 자산을 생성한다. 기존 ReportLab 매뉴얼 생성기를 전용 worktree로 가져와 PWA 페이지와 최신 캡처를 포함하도록 갱신하고, pypdf·PyMuPDF로 내용·링크·페이지·시각 품질을 검증한다.

**Tech Stack:** Python 3.11, ReportLab, Pillow, pypdf, PyMuPDF, Microsoft Edge CDP, Node.js

---

### Task 1: 매뉴얼 원본과 검증 계약을 worktree에 보존

**Files:**
- Create: `scripts/generate_user_manual_pdf.py`
- Create: `docs/manual_assets/01_landing.png`
- Create: `docs/manual_assets/02_region_and_moment.png`
- Create: `docs/manual_assets/03_pack_overview.png`
- Create: `docs/manual_assets/04_more_candidates.png`
- Create: `scripts/validate_user_manual_current_ui.py`

**Step 1: Copy the existing untracked source and assets**

루트 작업 폴더의 생성기와 캡처 4장을 worktree로 복사한다. 루트 파일은 수정하지 않는다.

**Step 2: Write the failing validation**

검증기는 다음을 요구한다.

- PDF 12페이지
- 버전 `v1.2`, 날짜 `2026-07-16`
- 서비스 URL과 URI annotation
- PWA, Android, iPhone, PC, 인터넷 연결 안내
- 최신 지도, 순간별 장소 이미지, 지도 마커, 하루방 웹검색, 플랜 담기 문구
- 표지의 대형 장식 글자 없음
- 최신 화면 자산 6개 존재

**Step 3: Run and verify failure**

```powershell
$env:PYTHONPATH='C:\tmp\jeju-pdf-review'; python scripts/validate_user_manual_current_ui.py
```

Expected: v1.2 PDF와 최신 자산이 없어 FAIL.

**Step 4: Commit**

```powershell
git add scripts/generate_user_manual_pdf.py scripts/validate_user_manual_current_ui.py docs/manual_assets
git commit -m "[검증] 사용자 매뉴얼 최신 UI 계약 추가"
```

### Task 2: 최신 서비스 화면 자동 캡처

**Files:**
- Create: `scripts/capture_user_manual_current_ui.mjs`
- Update: `docs/manual_assets/01_landing.png`
- Update: `docs/manual_assets/02_region_and_moment.png`
- Update: `docs/manual_assets/03_pack_overview.png`
- Update: `docs/manual_assets/04_more_candidates.png`
- Create: `docs/manual_assets/05_plan_map.png`
- Create: `docs/manual_assets/06_haruban_research.png`

**Step 1: Launch Edge headless with remote debugging**

임시 사용자 프로필과 CDP 포트를 사용해 `https://pack-your-jeju.vercel.app/`를 연다.

**Step 2: Capture the landing page**

브라우저 UI 없이 랜딩 화면만 캡처한다.

**Step 3: Select a region, conditions, and moments**

현재 DOM에서 버튼과 입력 필드를 탐색한 뒤 애월 또는 실제 후보가 충분한 지역, 여행 조건, 두 개 이상의 순간을 선택한다.

**Step 4: Capture current map and moments**

제주 지도, 지역 선택 상태, 현재 순간 카드가 함께 보이는 화면을 캡처한다.

**Step 5: Build a pack and capture the result**

제주팩 생성 완료를 기다린 뒤 다음을 각각 캡처한다.

- 지도 마커·전체 요약·순간별 후보·체크리스트
- 실제 장소 대표이미지가 포함된 후보 카드와 추가 후보 탐색
- 플랜에 담은 장소와 지도·저장·공유 영역

**Step 6: Capture Haruban**

하루방 패널을 열고 현재 안내·검색 근거·출처·주의점·플랜 담기 UI를 캡처한다. 외부 API가 제한 상태면 성공 답변을 꾸미지 않고 현재 제한 상태와 코드로 검증된 기능 설명을 함께 사용한다.

**Step 7: Inspect all six images**

개인정보, 브라우저 요소, API 키, 관리자 주소가 없고 장소 이미지와 지도 마커가 선명한지 확인한다.

### Task 3: ReportLab 생성기 v1.2 개정

**Files:**
- Modify: `scripts/generate_user_manual_pdf.py`
- Create: `docs/제주를_담다_사용자_매뉴얼_v1.2.pdf`

**Step 1: Update cover**

- 서비스명 유지
- 대형 배경 `담다` 제거
- `USER GUIDE · v1.2`
- `2026-07-16`
- 서비스 URL·QR·클릭 링크 유지

**Step 2: Preserve the PWA page**

Android Chrome, iPhone Safari, PC Chrome·Edge, 삭제·업데이트·인터넷 연결 주의를 3페이지에 유지한다.

**Step 3: Replace pages 4–9 images and copy**

최신 자산 6개를 페이지 목적에 맞춰 배치한다. 장소 대표이미지, 지도 마커, 순간별 후보가 본문 설명과 직접 연결되도록 캡션을 고친다.

**Step 4: Update page 10**

최신 하루방 캡처와 다음 기능을 설명한다.

- 멀티턴 문맥 유지
- 웹 원문 재검색
- 공식·플랫폼·경험 출처 역할
- 최신성·충돌·주의점
- 후보를 플랜에 담기
- 리뷰 검증

**Step 5: Keep exactly 12 pages**

이미지 크기와 문단을 조절해 페이지 수를 늘리지 않는다.

**Step 6: Generate PDF**

```powershell
python scripts/generate_user_manual_pdf.py
```

### Task 4: 자동·시각 검증과 제출 폴더 교체

**Files:**
- Copy: `C:\Users\USER\Desktop\제주를담다 공모전 자료\07_제주를담다_사용자_매뉴얼_PWA_포함.pdf`

**Step 1: Run validation**

```powershell
$env:PYTHONPATH='C:\tmp\jeju-pdf-review'; python scripts/validate_user_manual_current_ui.py
```

Expected: `pages=12 required_missing=0 forbidden_found=0 uri_links>=1 PASS`.

**Step 2: Render all 12 pages**

PyMuPDF로 모든 페이지를 PNG로 렌더링한다.

**Step 3: Inspect visual quality**

표지, PWA, 지도·순간, 제주팩, 장소 이미지, 플랜, 10페이지 하루방, 피드백, 문제 해결 페이지의 선명도·잘림·겹침·여백을 확인한다.

**Step 4: Copy the verified PDF**

검증된 v1.2 PDF만 공모전 자료 폴더의 07번 파일로 덮어쓴다.

**Step 5: Verify hash and commit**

```powershell
git add scripts/generate_user_manual_pdf.py scripts/capture_user_manual_current_ui.mjs scripts/validate_user_manual_current_ui.py docs/manual_assets docs/제주를_담다_사용자_매뉴얼_v1.2.pdf
git commit -m "[문서] 사용자 매뉴얼 최신 UI 개정"
```

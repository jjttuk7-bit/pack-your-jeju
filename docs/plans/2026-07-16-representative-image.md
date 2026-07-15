# Representative Image Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 공공데이터 라이프사이클을 한눈에 보여주는 정확한 494×375px 제주를 담다 대표이미지를 생성한다.

**Architecture:** `imagegen`으로 텍스트 없는 제주·데이터 순환 배경을 생성하고, Pillow 합성 스크립트가 브랜드 색상, 제주 실루엣, 단계 아이콘, 정확한 한글 문구를 배치한다. 생성 결과는 크기·색상 모드·텍스트·안전 여백을 검사한 뒤 공모전 자료 폴더에 복사한다.

**Tech Stack:** built-in image generation, Python 3.11, Pillow, PNG

---

### Task 1: 합성 규격 검사 작성

**Files:**
- Create: `scripts/validate_jeju_representative_image.py`

**Step 1: Write the failing validation**

검사 항목:

- 파일 존재
- 크기 `(494, 375)`
- PNG, RGB/RGBA
- 가장자리 투명·검정 잘림 없음
- 최소 색상 다양성

**Step 2: Run and verify failure**

```powershell
python scripts/validate_jeju_representative_image.py
```

Expected: 이미지가 없어 FAIL.

### Task 2: 텍스트 없는 배경 비주얼 생성

**Files:**
- Create: `docs/competition/2026-jeju-public-data-ai/assets/representative-image-background.png`

**Step 1: Generate with @imagegen**

프롬프트는 청록·오프화이트·주황, 제주도 실루엣, 공공데이터·AI·여행·피드백 순환, 깨끗한 벡터 인포그래픽 배경을 요청한다. 텍스트·로고·워터마크·UI 스크린샷은 제외한다.

**Step 2: Inspect the result**

제주 실루엣, 순환감, 색상, 텍스트 부재, 개인정보 부재를 확인한다.

### Task 3: 정확한 한글과 순환 구조 합성

**Files:**
- Create: `scripts/generate_jeju_representative_image.py`
- Create: `docs/competition/2026-jeju-public-data-ai/06_제주를담다_대표이미지_494x375.png`

**Step 1: Build the 494×375 canvas**

배경 이미지를 중앙 크롭하고 청록 오버레이를 적용해 텍스트 대비를 확보한다.

**Step 2: Draw exact text**

```text
공공데이터·RAG·Trust Engine으로 만드는
제주 여행 신뢰 라이프사이클

제주를 담다

공공데이터 / 하루방 RAG / 사용자 입력 / 신뢰 판정 / 실제 여행 / 피드백 / 근거 데이터

여행으로 검증하고, 데이터로 다시 강화합니다
```

**Step 3: Draw icons and arrows**

단순한 원형 노드와 시계 방향 화살표로 7단계를 연결한다.

**Step 4: Generate final PNG**

```powershell
python scripts/generate_jeju_representative_image.py
```

### Task 4: 검증과 폴더 저장

**Files:**
- Copy: `C:\Users\USER\Desktop\제주를담다 공모전 자료\06_제주를담다_대표이미지_494x375.png`

**Step 1: Run validation**

```powershell
python scripts/validate_jeju_representative_image.py
```

Expected: `size=494x375 format=PNG PASS`.

**Step 2: Inspect at original size**

상단·하단 문구, 7단계명, 제주 중심 요소, 화살표, 안전 여백을 육안 확인한다.

**Step 3: Copy to the contest folder**

검증된 PNG만 데스크톱 공모전 자료 폴더에 복사한다.

**Step 4: Verify hash**

프로젝트 원본과 데스크톱 복사본의 SHA-256이 일치하는지 확인한다.

**Step 5: Commit**

```powershell
git add scripts/generate_jeju_representative_image.py scripts/validate_jeju_representative_image.py docs/competition/2026-jeju-public-data-ai/assets/representative-image-background.png docs/competition/2026-jeju-public-data-ai/06_제주를담다_대표이미지_494x375.png
git commit -m "[디자인] 공모전 대표이미지 제작"
```

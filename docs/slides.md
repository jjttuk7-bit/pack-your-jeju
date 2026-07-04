---
marp: true
theme: default
paginate: true
size: 16:9
html: true
style: |
  section {
    font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
    padding: 60px 80px;
  }
  section.lead { text-align: center; }
  h1 { font-size: 2.4em; }
  h2 { font-size: 1.7em; color: #E76F51; }
  .hero { font-size: 9em; font-weight: 900; color: #E76F51; text-align: center; display: block; line-height: 1; }
  .subtle { color: #888; font-size: 0.75em; }
  .kicker { color: #E76F51; font-weight: 700; letter-spacing: 0.05em; font-size: 1.2em; }
  .principle { font-size: 1.4em; line-height: 1.6; }
  table { font-size: 0.85em; }
  section img[alt~="donut"] { display: block; margin: 0 auto; }
---



<!-- _class: lead -->
<!-- 슬라이드 1 — 타이틀. T+0:00 · 10초 -->

# Pack Your Jeju 🍊

## 짐을 싸기 전에, 그 순간이 진짜인지부터 확인합니다.

<span class="subtle">아이펠톤 2026 · 4일 · 5인</span>

---

<!-- 슬라이드 2 — 큰 숫자 하나. T+0:15 · 15초 -->
<!-- 발표자: "이 숫자가 무엇일까요" — 3초 정지 -->

<div class="hero">1,686</div>

---

<!-- 슬라이드 3 — 정체 공개 + 도넛. T+0:30 · 30초 -->
<!-- 도넛은 packages/eval/analyze_fix_requests.py로 CSV에서 실측 생성.
     data/eval/fix_request_dist.json 이 그 근거. -->

## 비짓제주 콘텐츠 수정요청

![donut w:900](./donut.png)

<span class="subtle">키워드 규칙 분류 · data/eval/fix_request_dist.json 감사 가능</span>

---

<!-- 슬라이드 4 — 실 데이터 top 인사이트. T+1:00 · 20초 -->
<!-- 원래 초안의 "폐업 · 운영시간 · 주소"는 서사 강조였음.
     실측: 운영시간(30%)이 압도적, 폐업은 23건. 서사를 실 데이터에 맞춤. -->

## 가장 자주 낡는 것: **운영시간 (500건, 30%)**

<div class="principle">

⏰ 운영시간 변경 · **500건**
📸 이미지·상세정보 갱신 · **229건**
🚪 폐업·이전 확인 · **23건** ← *"확인됨" 데모 근거*

</div>

<span class="subtle">공식 포털조차 이 속도로 낡습니다. 개인 블로그·챗봇은 어떨까요.</span>

---

<!-- 슬라이드 5 — 문제 정의 + 제품명. T+1:20 · 25초 -->
<!-- 여기서부터 프론트 데모 화면으로 넘어감. 슬라이드 대신 라이브. -->

## 그래서 짐 싸기 앱에 신뢰 엔진을 심었습니다

# Pack Your Jeju

<span class="kicker">근거 없이 답하지 않는다.</span>

---

<!-- 슬라이드 6 — 라이브 데모 시작 안내판. T+1:30 · 라이브 5분 -->
<!-- 이 슬라이드는 발표자가 화면 전환할 때 순간적으로 보임.
     본편은 프론트 UI 라이브. -->

# 라이브 데모

<span class="subtle">애월 · 부모님과 · 힐링</span>

---

<!-- 슬라이드 7 — 정직함 장면 요약. 라이브 후 회고용.
     또는 라이브 실패 백업 슬라이드. -->

## 정직함의 두 얼굴

|  | 사용자가 보는 것 | 시스템이 하는 것 |
|---|---|---|
| 🔵 verified | 배지 + 출처 링크 | valid_until 통과 + tombstone 없음 확인 |
| ⚠️ caution | "정보 미확인" 문구 | 요구 amenity 결측 또는 수정요청 이력 |
| × contradicted | "폐업 확인됩니다" | tombstone / 반증 존재 시 유일하게 단언 |
| — coverage_gap | "저희 데이터 기준 확인 안 됨" | **절대 '없다'고 단언하지 않음** |

---

<!-- 슬라이드 8 — 킥1 하이라이트 안내판. T+3:50 -->

# 킥 1

## AI가 AI를 팩트체크합니다

<span class="subtle">/verify — 블로그 리뷰 문장별 판정</span>

---

<!-- 슬라이드 9 — 아키텍처 1장. T+5:50 · 20초 -->

## 파이프라인

```
요청
  → filters   (LLM 없음, 폼이 이미 구조화)
  → search    (region + category)
  → trust     (fallback 4분기 판정 + 배지)
  → assemble  (LLM 조립 · 새 사실 금지 · 실패 시 템플릿)
```

<span class="kicker">LLM은 사실을 만들 권한이 코드에 없습니다.</span>

---

<!-- 슬라이드 10 — 게이트. T+6:15 · 20초 -->

## 골든셋 게이트

| 지표 | 값 | 임계 |
|---|---|---|
| Verified Precision | **1.00** | ≥ 0.9 🟢 |
| Fallback Accuracy | **1.00** | ≥ 0.9 🟢 |
| Badge Accuracy | **1.00** | ≥ 0.8 🟢 |

> 통과하지 못하면 `exit(1)`.
> **배포가 물리적으로 차단됩니다.**

<span class="subtle">15문항 중 4문항은 "답하지 않아야 정답" 케이스</span>

---

<!-- 슬라이드 11 — QR. T+6:50 · 15초 -->
<!-- 실물 QR 이미지는 발표 당일 노트북 IP 확정 후 삽입.
     qrencode "http://<노트북-IP>:8000/" -o docs/qr.png 로 생성. -->

<!-- _class: lead -->

# 직접 만들어보세요

![w:300](./qr-placeholder.png)

<span class="subtle">http://[본인노트북IP]:8000/</span>

---

<!-- 슬라이드 12 — 라이브 대시보드. T+7:10 · 30초 -->

## 지금 이 순간

- 요청 **N건**
- verified **N%**
- coverage_gap **N건**

<span class="kicker">발표하는 동안에도 운영 중입니다.</span>

<span class="subtle">/admin/metrics · fallback_reason 분포 = 다음 데이터 우선순위</span>

---

<!-- 슬라이드 13 — 다음 단계. T+7:40 · 30초 -->

## 다음 단계

**지역 팩 아키텍처**
데이터 어댑터만 갈아끼우면 부산 팩, 도쿄 팩

**여행 일정 전체 검증**
/verify 파이프라인을 예약·경로에도

**다국어 확장**
비짓제주 en · cn · jp locale 그대로 활용

---

<!-- 슬라이드 14 — 마무리. T+8:10 -->

<!-- _class: lead -->

# 저희는 세 가지를 지킵니다

<div class="principle">

**출처를 붙입니다.**
**최신만 답합니다.**
**안 지어냅니다.**

</div>

<span class="subtle">Pack Your Jeju · 감사합니다</span>

---

<!-- ===== 백업 슬라이드 (발표 본편에서 안 씀, Q&A 대응용) ===== -->

<!-- Backup A — 4분기 개념도 -->

## Backup · fallback 4분기

| reason | 정의 | 사용자 문구 |
|---|---|---|
| out_of_scope | 제주/여행 밖 | "정보 범위 밖" |
| **contradicted** | 반증 존재 | "폐업/변경 **확인됩니다**" — 유일한 단언 |
| retrieval_miss | 있는데 못 찾음 | (재시도로 해소, 관측 로그에만) |
| coverage_gap | 데이터에 없음 | "저희 데이터 기준으로 확인되지 않음" |

<span class="kicker">"없다는 근거" 와 "근거가 없음" 은 다른 진술입니다.</span>

---

<!-- Backup B — 스코프 방어 -->

## Backup · 하지 않은 것들

- ❌ Blue/Green 실 인프라 · Prefect · Langfuse
- ❌ 실시간 경로 추천 (교통은 접근성 검증만)
- ❌ Google Maps (제주 지역 선택 UI가 대체)
- ❌ 멀티턴 대화 (폼이 이미 구조화 필터 제공)
- ❌ 카카오/네이버 리뷰를 추천 근거로 사용

<span class="subtle">스코프를 줄이는 결정도 결정입니다. (DECISIONS.md D-04, D-08, D-10, D-13)</span>

---

<!-- Backup C — 데이터 규모 -->

## Backup · 실 데이터

- raw_source: **5,756 rows** (비짓제주 전량)
- place (정제 후): **4,422 rows**
- 커버 지역: **12/12**
- 커버 카테고리: **8/8**
- 판정 신호: valid_until · tombstoned · has_fix_request · amenities

<span class="subtle">시연용 시드 데이터가 아닙니다.</span>

---

<!-- Backup D — 게이트 상세 -->

## Backup · 골든셋 12문항 · ★4 데모

| ★ | ID | 시나리오 | 기대 |
|---|---|---|---|
| ★ | G05 | citrus × 7월 | coverage_gap ("확인되지 않음") |
| ★ | G11 | 우도 × oreum | 인근 지역 완화 + retrieval_miss 관측 |
| ★ | G13 | 존재하지 않는 가게 verify | coverage_gap (단언 금지) |
| ★ | G14 | 폐업 가게 verify | contradicted (근거 있음) |

<span class="subtle">발표에서 라이브로 보여드린 4장면입니다.</span>

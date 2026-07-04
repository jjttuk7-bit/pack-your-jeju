# PLAN_4DAYS.md — 4일 × 5인 실행 체크리스트

## 역할

| # | 역할 | 담당 |
|---|---|---|
| R1 | 데이터 | 수집·정제·신뢰신호 |
| R2 | RAG 백엔드 | engine/ 전체 (filters·search·trust·assemble·verify) |
| R3 | 품질검증 | 스키마·query_log·eval 러너·admin (경량) |
| R4 | 프론트 | 제주판 UI·배지·대시보드 |
| R5 | PM·발표 | 골든셋·데모·히든킥·리허설 |

매일 아침 15분 스탠드업: 어제 종료 기준 달성 여부 → 오늘 체크리스트 확인 → 블로커 공유.

---

## Day 1 — 뼈대

**R1 데이터**
- [ ] 비짓제주 `--probe` → 필드 매핑 확정, 팀 공유
- [ ] 파일 4종(위생등급/주차장/정류장/수정요청) 다운로드, 헤더 기록
- [ ] 카테고리별 수집 백그라운드 시작

**R2 백엔드**
- [ ] 기존 Pack Your Moment 코드 구조 파악 (오전 집중)
- [ ] engine/ 골격 생성, filters.py 완성 (LLM 불필요 — 매핑 테이블)
- [ ] gpt-5.3-mini 호출 유틸 + 키 없을 때 폴백 확인

**R3 품질검증**
- [ ] init.sql 적용, docker compose 기동
- [ ] query_log 테이블 + 적재 함수

**R4 프론트**
- [ ] 에디션 브랜치 분리 (원본 보호 — DECISIONS D-03)
- [ ] 여행지 입력 → 제주 12지역 칩 UI 교체
- [ ] 순간 카드 8종 데이터 교체 (MOMENT_CARDS.md의 card_id 일치)
- [ ] 해외여행 토글 숨김

**R5 PM**
- [ ] 골든셋 15문항 초안 (EVAL_GOLDENSET.md 표 기준, FILL_ME 상태로)
- [ ] 수정요청 CSV 분석 착수 (킥3 숫자 뽑기)

**Day1 종료 기준**: place 테이블에 애월 데이터 존재 + 프론트에서 제주판 카드 선택 가능 + filters.py 단위 테스트 통과.

---

## Day 2 — /pack 관통

**R1**: process.py 완성 (지역 정규화·info_type/valid_until 강제·bbox 검증) → 정제 데이터 적재
**R2**: search.py (place/food/transit) + trust.py (fallback 4분기 + 배지) — **오늘의 핵심**
**R3**: eval 러너 골격 (엔진 직접 호출 방식) + fallback_reason 로깅 연결
**R4**: 대시보드 배지 컴포넌트 (더미값) + 팩 섹션 레이아웃
**R5**: 골든셋 FILL_ME를 실제 contentsid로 교체 시작, 킥3 슬라이드 완성

**Day2 종료 기준**: `/pack` 호출 → 배지·fallback_reason 포함 JSON이 end-to-end 반환. **이것이 데모 최소 안전판.**

---

## Day 3 — 심장 (검증모드 + 배지 실연동 + 게이트)

**R1**: 수정요청 contentsid ↔ place 매핑 (has_fix_request), tombstone 확인
**R2**: assemble.py (LLM 문구 + 템플릿 폴백) + **verify.py (킥1 데모)** — 오늘의 핵심
**R3**: eval 게이트 완성 (3지표 + exit(1)) + /admin/metrics
**R4**: **배지 실제값 렌더링 + /verify 화면 (붙여넣기 → 문장 하이라이트)** — 오늘의 핵심
**R5**: 킥1 환각/폐업 리뷰 시나리오 사전 테스트 (G14와 겸용), Q&A 카드 작성

**Day3 종료 기준**: 골든셋 ★4문항(G05/G11/G13/G14) 라이브 통과 + eval 게이트 green.

---

## Day 4 — 통합·배포·리허설

**오전 (전원)**
- [ ] 배포 (프론트 Vercel + API Railway/유사 + DB Neon/유사) — QR 접속 확인
- [ ] eval 최종 실행, 결과 캡처 보관
- [ ] 버그 픽스 마감 (오전까지만)

**오후 (R5 주도)**
- [ ] 3막 풀리허설 × 2회 이상 (DEMO_PRESENTATION.md)
- [ ] 킥1 라이브 실패 대비 전 구간 스크린 녹화
- [ ] "다음 단계" 슬라이드 (지역 팩 확장·플랜 검증·다국어) 확정

---

## 리스크 대응표

| 리스크 | 신호 | 대응 |
|---|---|---|
| 비짓제주 수집 지연 | Day1 저녁까지 place 비어있음 | probe 덤프 기반 시드 데이터 수동 20건 투입, 수집은 병행 |
| LLM 문구 품질/지연 | p95 > 4초 | 템플릿 폴백으로 전환 (기능 아님, 감성 문구일 뿐) |
| 배지 로직 복잡화 | Day3 오전까지 trust.py 미완 | caution 세부 사유 축소 (verified/caution/gap 3종으로 강등) — 4분기 fallback은 유지 |
| 프론트 통합 지연 | Day3 저녁 배지 미렌더 | 대시보드 대신 /pack JSON 응답을 정리된 뷰어로 데모 (최후 수단) |

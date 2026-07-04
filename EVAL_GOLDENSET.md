# EVAL_GOLDENSET.md — 골든셋 15문항 + 품질 게이트

> 원칙: 개수보다 **fallback 4분기와 배지 체계를 전부 커버**하는 것이 우선.
> "답을 잘하는 케이스"만이 아니라 **"답하지 않아야 정답인 케이스"**를 반드시 포함한다.

## 1. 게이트 규칙

`python -m packages.eval.run` 실행 → 지표 미달 시 `exit(1)`.

| 지표 | 정의 | 게이트 |
|---|---|---|
| Verified Precision | verified 배지 항목 중 골든셋 정답과 일치 비율 | ≥ 0.9 |
| Fallback Accuracy | fallback 케이스에서 올바른 reason으로 분류한 비율 | ≥ 0.9 |
| Badge Accuracy | caution/contradicted 기대 케이스의 배지 일치율 | ≥ 0.8 |

발표 멘트와의 연결: *"이 게이트를 통과하지 못하면 저희는 배포하지 않습니다"* — eval.py의 exit(1)이 이 문장의 실제 구현이다.

## 2. 골든셋 15문항 구성 설계

형식 (golden_set.jsonl, 한 줄당 하나):
```jsonc
{
  "id": "G01",
  "request": {"region":"aewol","start_date":"2026-07-03","days":3,"companion":"solo","purpose":"healing","moments":["oreum"]},
  "expect": {
    "moment": "oreum",
    "must_include_external_ids": ["FILL_ME"],   // 수집 후 실제 contentsid로 교체
    "min_verified": 1,
    "fallback_reason": null
  }
}
```

| # | 카드/시나리오 | 기대 결과 | 검증 포인트 |
|---|---|---|---|
| G01 | oreum × 애월 | verified ≥ 1 (새별오름 등) + 🚗 배지 | 기본 검색 + 교통 |
| G02 | oreum × parents | 비포장/난이도 정보 표시 or "미확인" 명시 | companion 필터 |
| G03 | beach_walk × 한림 (7월) | verified + 개장기간 표시 | seasonal 정상 |
| G04 | beach_walk × 겨울 날짜 | caution("유효기간 경과/임박") 또는 개장기간 밖 명시 | seasonal 만료 |
| G05 | **citrus × 7월** | **fallback 또는 "시즌 아님" 명시** | ★ Freshness 핵심 데모 |
| G06 | local_market × 여행일이 오일장 주기와 일치 | 개장일 계산 표시 | periodic |
| G07 | local_market × 주기 불일치 | "기간 중 개장일 없음" (coverage_gap 아님) | periodic 구분 |
| G08 | local_food × 제주시 | verified + 위생등급 표시 | food 기본 |
| G09 | local_food × 수정요청 걸린 가게 | **caution ⚠️** ("수정요청 이력") | 신뢰 하향 신호 |
| G10 | local_food × tombstoned 가게 (verify로) | **contradicted ×** ("폐업 확인") | 반증 단언 |
| G11 | **quiet_cafe × 우도** | **coverage_gap** + "저희 데이터 기준" 문구 | ★ 커버리지갭 문구 검증 |
| G12 | /verify: 실존 장소 정확 리뷰 | 문장 verified | 검증 모드 기본 |
| G13 | /verify: **존재하지 않는 가게** 리뷰 | coverage_gap ("확인되지 않음", "없다" 단언 금지) | ★ 인식론 규칙 |
| G14 | /verify: 폐업 가게 추천 리뷰 (킥1 시나리오) | contradicted + 근거 | ★ 킥1 리허설 겸용 |
| G15 | kids × 키즈 정보 결측 장소 | 항목 유지 + "아동 동반 정보 미확인" | 조용히 빼지 않기 규칙 |

★ 표시 4개(G05·G11·G13·G14)는 데모 시나리오와 직결 — **리허설에서 이 4개를 라이브로 보여준다.**

## 3. 러너 구현 지침 (packages/eval/run.py)

- 골든셋을 순회하며 `/pack` 또는 `/verify`를 (서버 없이) 엔진 함수 직접 호출로 실행.
- external_id 기반 비교 (이름 문자열 비교 금지 — 재수집에도 유효).
- 결과 리포트: 문항별 pass/fail + 지표 3종 + 실패 문항의 실제 응답 덤프.
- `FILL_ME`가 남아 있으면 해당 문항 skip + 경고 (Day2까지 채우는 것이 PM 태스크).

## 4. 운영 규칙

- Day3 이후 코드 변경 시 반드시 eval 재실행. 실패 상태로 main에 머지 금지.
- 데모 전날(Day4 오전) 최종 실행 결과를 캡처해 Q&A 대비 자료로 보관.

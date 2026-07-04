# Pack Your Jeju 🍊

> **"짐을 싸기 전에, 그 순간이 진짜인지부터 확인합니다."**
>
> 기존 앱 Pack Your Moment의 제주 특화 에디션.
> 사용자가 여행지·동행자·순간을 선택하면, 지역·음식·교통을 **공공데이터 근거로 검증**해
> 하나의 "팩(Pack)"으로 조립해 돌려주는 신뢰 기반 여행 준비 서비스.

- 대회: 아이펠톤 (4일, 20개 팀, 목표 **1등**)
- 개발 도구: Claude Code (문서 우선 방법론)
- LLM: OpenAI GPT-5.3-mini 고정
- 원본 앱: Pack Your Moment (범용) — **본 프로젝트는 별도 에디션/브랜치. 원본을 직접 수정하지 않는다.**

## 문서 지도

| 문서 | 역할 | 주 독자 |
|---|---|---|
| [CLAUDE.md](CLAUDE.md) | Claude Code 작업 헌법 — 원칙·구조·금지사항 | Claude Code |
| [DECISIONS.md](DECISIONS.md) | 확정 의사결정 로그 (번복 금지 목록) | 전원 |
| [PRD.md](PRD.md) | 제품 스펙 — 화면·플로우·팩 조립 | 프론트, RAG백엔드 |
| [MOMENT_CARDS.md](MOMENT_CARDS.md) | 제주 전용 순간 카드 스펙 (Day1 프론트 작업 스펙) | 프론트, PM |
| [TRUST_ENGINE.md](TRUST_ENGINE.md) | 신뢰 엔진 — fallback 4분기·배지·의사코드 | RAG백엔드 |
| [DATA_PIPELINE.md](DATA_PIPELINE.md) | 데이터 소스·스키마·수집 | 데이터 |
| [EVAL_GOLDENSET.md](EVAL_GOLDENSET.md) | 골든셋 15문항 + 품질 게이트 | 품질검증, PM |
| [PLAN_4DAYS.md](PLAN_4DAYS.md) | 4일 × 5인 실행 체크리스트 | 전원 |
| [DEMO_PRESENTATION.md](DEMO_PRESENTATION.md) | 발표 3막·히든킥·Q&A·우승 전략 | PM·발표 |

## 시작 순서 (Day1 아침)

1. 전원이 `DECISIONS.md`를 읽는다 — 이미 결정된 것을 다시 논쟁하지 않기 위해.
2. 각자 역할 문서를 읽는다 (위 표의 "주 독자").
3. Claude Code 세션 시작 시 `CLAUDE.md`가 자동 로드되는지 확인한다.
4. `PLAN_4DAYS.md`의 Day1 체크리스트로 착수한다.

## 한 문장 원칙

**근거 없이 답하지 않는다.** 못 채우는 카테고리가 나오는 것이 버그가 아니라, 이 시스템이 정직하다는 증거다.

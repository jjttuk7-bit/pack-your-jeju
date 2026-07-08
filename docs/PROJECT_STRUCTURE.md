# 프로젝트 구조

이 문서는 `제주를 담다` 저장소를 외부에 공유할 때 기준이 되는 폴더 구조를 설명합니다.

## 루트

| 경로 | 역할 |
| --- | --- |
| `README.md` | 서비스 소개, 실행 방법, 평가 항목 매핑 |
| `Dockerfile` | Railway API 배포용 컨테이너 |
| `docker-compose.yml` | 로컬 PostgreSQL + pgvector 실행 |
| `pyproject.toml` | Python 패키지와 테스트 설정 |
| `railway.toml` | Railway 배포 설정 |
| `.env.example` | API 환경변수 예시 |

## 애플리케이션

```text
apps/
├─ api/
├─ pipelines/
└─ web/
```

### `apps/api`

FastAPI 백엔드입니다.

- `main.py`: `/pack`, `/verify`, `/agent/*`, `/visit-signals`, `/health`
- `engine/search.py`: DB 검색과 교통 접근성 체크
- `engine/trust.py`: 배지, fallback, 신뢰 점수 산출
- `engine/weather.py`: 기상청 단기예보 조회 및 여행 기간 요약
- `engine/visit_signals.py`: 방문 피드백 저장과 신뢰도 업데이트 시뮬레이션
- `engine/haruban.py`: 하루방 에이전트 브리핑
- `tests/`: API와 엔진 테스트

### `apps/pipelines`

공공데이터 수집과 정규화 파이프라인입니다.

- `ingest_visitjeju.py`: 비짓제주 API 수집
- `process.py`: 원천 데이터 정규화 및 지역/카테고리 매핑
- `ingest_file.py`: 수정요청 CSV, 주차장, 정류장 데이터 적재

### `apps/web`

React/Vite 프론트엔드입니다.

- `src/App.tsx`: 앱 상태와 화면 전환
- `src/components/LandingPage.tsx`: 랜딩 페이지
- `src/components/TrustMapDashboard.tsx`: 지역 신뢰 대시보드
- `src/components/PackingDashboard.tsx`: 팩 결과, 플랜, 지도, 피드백, 짐 추천
- `src/components/HarubanChat.tsx`: 하루방 에이전트
- `src/components/VerifyPage.tsx`: 리뷰 검증 화면
- `public/`: 아이콘과 제주 지도 실루엣 자산

## 데이터와 평가

```text
data/
└─ sources/

packages/
├─ schema/
└─ eval/
```

- `data/sources/`: 외부 공개 원본 데이터 중 저장소에 보관하는 파일
- `packages/schema/init.sql`: 권위 DB 스키마
- `packages/eval/golden_set.jsonl`: 골든셋
- `packages/eval/run.py`: 평가 러너

재생성 가능한 수집 로그, 스모크 응답, PDF 결과물은 커밋하지 않습니다.

## 문서

```text
docs/
├─ eval/
├─ plans/
├─ deploy.md
├─ local_demo.md
└─ COMPETITION_PRODUCT_PLAN.md
```

- `docs/deploy.md`: Vercel + Railway 배포 절차
- `docs/local_demo.md`: 로컬 데모 순서
- `docs/eval/`: 평가 리포트와 RAG 설계 설명
- `docs/plans/`: 기능별 설계 기록
- `docs/COMPETITION_PRODUCT_PLAN.md`: 경진대회 제품 방향

## 스크립트

`scripts/`에는 데모, 발표자료, 통계 생성용 보조 스크립트가 있습니다. 서비스 런타임 필수 경로는 아닙니다.

## 정리 기준

- 루트에는 실행과 이해에 필요한 파일만 둡니다.
- 공공 원본 데이터는 `data/sources/`에 둡니다.
- 생성물은 가능하면 `docs/` 또는 `.gitignore` 대상에 둡니다.
- 서비스 코드와 발표 산출물은 섞지 않습니다.

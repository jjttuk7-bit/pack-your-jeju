# 제주를 담다

> 제주 여행을 떠나기 전, 확인한 웹 근거와 공공데이터의 장소·주의 신호를 여행팩에 담아주는 신뢰 기반 여행 준비 서비스입니다.

`제주를 담다`는 지역, 기간, 동행자, 여행 순간을 선택하면 확인한 웹 근거와 비짓제주·교통·수정요청·기상청 데이터를 함께 살펴 장소 후보를 비교하고, 사용자가 고른 후보를 하나의 여행팩으로 정리합니다. 핵심은 장소를 많이 보여주는 것이 아니라, **무엇을 믿어도 되는지와 무엇을 확인해야 하는지**를 분리해서 보여주는 것입니다.

## 핵심 가치

- **근거 기반 추천**: 장소명, 주소, 운영 정보는 확인한 웹 원문 또는 내부 공공데이터에 연결하고 출처 역할을 구분합니다.
- **정직한 부족함 표시**: 데이터가 부족한 조합은 억지로 채우지 않고 확인 필요 항목으로 분리합니다.
- **신뢰도 루프**: 방문 후 피드백을 기록하고, 신뢰도 변화와 공공데이터 수정요청 큐로 이어지는 흐름을 보여줍니다.
- **여행팩 조립**: 공공데이터·하루방 웹검색·사용자 직접입력 후보를 한 플랜에 담고 지도·날씨·맞춤 짐·공유 문구를 정리합니다.
- **날씨 의사결정**: 지역·날짜·오전/오후/저녁 예보를 일정과 연결하고, 변경 이유와 대안을 보여준 뒤 사용자가 승인할 때만 반영합니다.
- **데모 안정성**: OpenAI API 키가 없어도 템플릿 폴백으로 동작하고, 네이버 지도 인증 실패 시에도 간이 제주 지도에 마커를 표시합니다.

## 주요 화면

- **랜딩 페이지**: 문제 정의, 신뢰 구조, 서비스 흐름 소개
- **지역 신뢰 대시보드**: 제주 지역을 지도 형태로 선택하고 추천 가능성·데이터 부족 신호 확인
- **팩 만들기**: 여행 조건과 순간 카드를 선택해 공공데이터 후보 생성
- **플랜 만들기**: 후보를 플랜에 담고 방문 후 피드백, 신뢰도 업데이트, 맞춤 짐 확인
- **여행 날씨 리포트**: 일정별 비·바람 영향을 확인하고 변경안 미리보기·적용·되돌리기 수행
- **리뷰 검증**: 후기 문장을 원본 데이터와 대조해 확인/주의/미확인으로 분류

## 평가 항목 매핑

| 평가 영역 | 구현 포인트 |
| --- | --- |
| 문제 정의·기획 | 제주 여행자가 겪는 정보 과잉, 운영 정보 불일치, 후기 신뢰 문제를 여행 준비 흐름으로 해결 |
| 모델 설계·활용 | 운영 환경에서 선택한 모델로 확인된 검색 근거를 해석·비교·조립하고 결정론적 규칙과 분리 |
| 서비스 견고성 | 키 미설정·외부 API 실패·지도 인증 실패 시 폴백 제공, 프론트/백엔드 분리 배포 |
| 신뢰성·설득력 | 원본 출처, 신뢰 점수, 확인 필요 항목, 수정요청 이력, 방문 피드백 루프를 UI에 노출 |
| 보안 | API 키는 환경변수로만 주입, GitHub에 키를 커밋하지 않음 |

## 기술 스택

| 영역 | 스택 |
| --- | --- |
| Web | React, Vite, TypeScript, Tailwind CSS, lucide-react |
| API | FastAPI, Python 3.11, SQLAlchemy Core |
| Data | PostgreSQL, pgvector, pg_trgm |
| AI | OpenAI API(모델은 운영 환경 설정), 웹 리서치, RAG |
| Deploy | Vercel(Web), Railway(API + DB) |

## 폴더 구조

```text
pack-your-jeju/
├─ apps/
│  ├─ api/          # FastAPI, trust engine, RAG, weather, visit feedback API
│  ├─ pipelines/    # 비짓제주·교통·CSV 데이터 수집/정규화
│  └─ web/          # React/Vite 프론트엔드
├─ data/
│  └─ sources/      # 공개 원본 데이터 중 커밋해 둔 소스
├─ docs/            # 배포, 발표, 평가, 설계 문서
├─ packages/
│  ├─ schema/       # DB DDL
│  └─ eval/         # 골든셋 평가 러너
├─ scripts/         # 데모·발표자료·통계 생성 스크립트
├─ docker-compose.yml
├─ Dockerfile
└─ README.md
```

자세한 구조는 [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)를 참고하세요.

## 로컬 실행

### 1. 백엔드

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .

# 선택: 로컬 DB를 쓸 경우
docker compose up -d

uvicorn apps.api.main:app --port 8000 --reload
```

기본 API 주소는 `http://localhost:8000`입니다.

### 2. 프론트

```powershell
cd apps/web
npm install
npm run dev
```

기본 프론트 주소는 `http://localhost:5173`입니다.

## 환경변수

### API

| 이름 | 설명 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `OPENAI_API_KEY` | 선택. 없으면 템플릿 폴백 |
| `VISITJEJU_API_KEY` | 비짓제주 재수집 시 필요 |
| `DATA_GO_KR_SERVICE_KEY` | 기상청 단기예보 `getVilageFcst` 조회 키 |
| `KMA_SERVICE_KEY` | 선택. 구조화 예보 키가 없을 때 사용하는 기상청 API Hub 키 |
| `CORS_ALLOW_ORIGINS` | 허용할 프론트 도메인 |

### Web

| 이름 | 설명 |
| --- | --- |
| `VITE_API_BASE_URL` | Railway API URL |
| `VITE_NAVER_MAP_CLIENT_ID` | 선택. 네이버 지도 JavaScript API Client ID |

네이버 지도는 Vercel 환경변수에 `VITE_NAVER_MAP_CLIENT_ID`를 넣고, 네이버 클라우드 콘솔에서 배포 도메인을 Web 서비스 URL로 허용해야 합니다.

## 데이터

현재 저장소에 포함된 원본 공개 데이터:

- `data/sources/visitjeju_fix_requests_20250806.csv`: 비짓제주 콘텐츠 수정요청 공개 CSV

대용량 원본, 수집 로그, 스모크 응답 JSON, PDF 산출물은 재생성 가능한 파일로 보고 `.gitignore`에서 제외합니다. 자세한 기준은 [data/README.md](data/README.md)를 참고하세요.

## 제출 산출물

프리아이펠 제출용 제안서, 작업내역, 20분 발표자료 구성안은 [docs/submission](docs/submission)에서 확인할 수 있습니다.

## 검증

```powershell
# 백엔드 테스트
python -m pytest apps/api/tests

# 프론트 테스트·타입 검사·빌드
cd apps/web
npm test
node --test tests/*.test.mjs
npm run lint
npm run build

# 골든셋 평가
python -m packages.eval.run --out docs/eval
```

최근 작업에서 확인한 핵심 검증:

- `/pack` 통합 테스트 통과
- 지역·날짜·시간대별 날씨 리포트와 부분 성공 처리
- 사용자 승인형 일정 변경·기존 일정 유지·되돌리기
- 플랜 장소 좌표 응답 및 지도 마커 표시
- 방문 피드백 신뢰도 업데이트 흐름
- 네이버 지도 인증 실패 fallback

## 배포

- Web: Vercel, root directory `apps/web`
- API: Railway, root `Dockerfile`
- DB: Railway PostgreSQL + `vector`, `pg_trgm` 확장

자세한 절차는 [docs/deploy.md](docs/deploy.md)를 참고하세요.

## 프로젝트 원칙

1. 사실 정보는 확인한 웹 원문 또는 내부 공공데이터에 근거하고 출처 역할을 구분합니다.
2. LLM은 확인된 근거를 해석·비교·조립하며, 없는 사실을 추가하지 않습니다.
3. 데이터가 부족하면 추천으로 채우지 않고 부족함을 표시합니다.
4. `OPENAI_API_KEY`가 없어도 데모 시나리오는 동작해야 합니다.
5. API 키와 개인 환경 파일은 커밋하지 않습니다.
6. 날씨 변경안은 추천이며 사용자가 승인하기 전에는 플랜을 수정하지 않습니다.

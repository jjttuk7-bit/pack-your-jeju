# 배포 상태 및 로드맵

> 마지막 업데이트: 2026-07-05
> 이 문서는 프로덕션 배포의 현재 스냅샷과 다음 작업을 기록한다. 검증된 사실만 담고, 아직 안 한 것은 명시적으로 "남은 작업"에 둔다.

## 1. 현재 상태

### 인프라
| 계층 | 위치 | 상태 |
|---|---|---|
| API | Railway `skillful-alignment / production` / `pack-your-jeju` | Online |
| DB | Railway Postgres (같은 프로젝트) | Online |
| 프론트 | Vercel | 미배포 |
| 도메인 (API) | `https://pack-your-jeju-production.up.railway.app` | 발급됨 |

### 데이터
- `raw_source`: 5,756건 (비짓제주)
- `place`: 4,422건 (정제 후)
- `place.has_fix_request=true`: 556건 (수정요청 CSV 1,686행 중 매칭)
- `place.tombstoned=true`: 1건 (`애월오누이 제주` — G14 데모 시드)
- `transit_point`: 0건 (미적재)
- `query_log`: 자동 적재 중

### 엔드포인트 검증 (2026-07-05 마지막 검증)
| 엔드포인트 | 응답 | 비고 |
|---|---|---|
| `GET /health` | 200 `{db:true, bootstrap:{applied:11, failed:0}}` | 스키마 자동 부트스트랩 정상 |
| `POST /pack` | 200 실제 items 반환, `verified` 배지 | 서귀포/커플/힐링 3일 시나리오 |
| `POST /verify` | 200 3-verdict 재현 (contradicted / verified / coverage_gap) | 킥1 데모 대본 `data/verify_kick1_g14.json` |
| `GET /admin/metrics` | 200 `query_log` 집계 정상 | p50=12ms |

### 골든셋 게이트
- 러너: `python -m packages.eval.run --out data/eval-reports`
- 최근 결과: **12/12 통과, 3지표 모두 1.00** (verified_precision · fallback_accuracy · badge_accuracy)
- 리포트: `data/eval-reports/eval-20260704-2200.{json,md}` (발표 캡처용)

## 2. 이번 세션에서 처리한 것

### 코드 변경
- `apps/api/db.py` — Railway가 주는 `postgres://` / `postgresql://` prefix를 SQLAlchemy 2 + psycopg3 dialect(`postgresql+psycopg://`)로 자동 정규화. `ping()` 실패 시 원인을 로그로 남기도록 수정.
- `apps/api/bootstrap.py` — Startup lifespan에서 `packages/schema/init.sql`을 문장 단위로 idempotent 실행. 신규 Railway 프로젝트도 스키마 수동 적재 불필요.
- `apps/api/main.py` — Lifespan 컨텍스트 매니저로 부트스트랩 훅. `/health` 응답에 `bootstrap` 통계(`applied`, `failed`) 노출.
- `.env.example` — Railway 프로덕션 API URL을 예시로 반영.
- Dockerfile CMD — `${PORT}` 확장을 Dockerfile에 위임 (`railway.toml` startCommand 제거).

### 인프라 조정
- Railway `pack-your-jeju` 서비스에 `DATABASE_URL` 변수를 `${{Postgres.DATABASE_URL}}` 참조로 연결.
- 로컬에서 Railway `DATABASE_PUBLIC_URL`로 원격 DB에 파이프라인 실행.

### 데이터 적재
- `apps.pipelines.ingest_visitjeju --fetch-all` → `raw_source` 5,756건 INSERT.
- `apps.pipelines.process` → `place` 4,422건 UPSERT.
- `apps.pipelines.ingest_file --fix-request-csv <파일>` → 1,686행 처리, 556건 place에 `has_fix_request=true` UPDATE.
- 데모 시드 (수동 SQL, G14용): `애월오누이 제주` place `tombstoned=true`.

### 킥1 데모 대본 확정 (`/verify` 3-verdict)
- `apps/api/engine/verify.py` — 판정 순서 개선: 정확 부분 문자열 매칭(`_match_from_sentence`)을 조사-휴리스틱보다 우선. LLM 없이도 카테고리 명사 오탐 원천 차단.
- 대본: `data/verify_kick1_g14.json`
  1. `애월오누이 제주 정말 맛있어요` → **contradicted** ("폐업/이전이 확인됩니다")
  2. `라임오렌지카페앤플라워는 조용해서 좋았어요` → **verified**
  3. `가짜식당은 별로였어요` → **coverage_gap**

### 골든셋 게이트 GREEN
- `python -m packages.eval.run --out data/eval-reports` → 12/12 통과, 3지표 모두 1.00.
- 리포트 파일 저장: `data/eval-reports/eval-*.json`, `data/eval-reports/eval-*.md`.

## 3. 알려진 이슈

### 3.1 Railway Auto Deploy 미동작 (근본 원인 미해결)
- 증상: `git push` 후 Railway가 자동으로 새 배포를 시작하지 않음. Settings → Source 화면 하단에 "GitHub Repo not found" 배너.
- 임시 회피: Settings → Source의 **Check for updates** 버튼을 눌러 수동으로 upstream 갱신 → 배포 트리거됨. 빈 커밋 push는 감지 못 함.
- 미확인: 두 번째 Railway 프로젝트 `heroic-contentment`와의 웹훅 라우팅 충돌 가능성.
- GitHub App 권한(https://github.com/settings/installations)은 정상 확인. `pack-your-jeju` 저장소 access 있음, code/deployments write 권한 있음.

### 3.2 응답 필드 관찰
- `transit.parking: false`, `bus_walkable: false` 항상 반환됨. → `transit_point` 미적재가 원인.
- `intro.llm_used: false` — Railway에 `OPENAI_API_KEY` 미설정, 템플릿 폴백 정상 동작. (CLAUDE.md 절대 규칙 6 준수)

## 4. 남은 작업 (우선순위)

### P0 — 완료 ✅
- [x] `/verify` 프로덕션 스모크 → 3-verdict 데모 대본 확정
- [x] 수정요청 CSV 적재 → 킥3 오프닝 숫자 확보 (1,686 → 556)
- [x] 골든셋 러너 실행 → 게이트 GREEN
- [x] 킥1 하이라이트(contradicted) 시연 재현 (G14 tombstone 시드)

### P1 — 시연 품질에 직접 영향
- [ ] **Vercel 프론트 배포** — 킥4 QR의 실체. `docs/deploy.md §2` 참조.
  - Root Directory: `apps/web`
  - `VITE_API_BASE_URL=https://pack-your-jeju-production.up.railway.app`
- [ ] **Railway CORS 갱신** — Vercel 도메인 확정 후 `CORS_ALLOW_ORIGINS` 환경변수 갱신.
- [ ] **`transit_point` 적재** — 주차장/정류장 CSV. 이후 응답에서 `parking_count > 0`, `bus_walkable: true` 확인.
  - `python -m apps.pipelines.ingest_file --parking-csv <path>`
  - `python -m apps.pipelines.ingest_file --busstop-csv <path>`
- [ ] **Railway Auto Deploy 정상화** — Settings → Source Disconnect/Reconnect 재시도 또는 Upstream **Eject**. 목표: `git push`만으로 반영.

### P2 — 배지·문구 완성도
- [ ] **위생등급 CSV** — `--hygiene-csv <path>`. `place.hygiene_grade` 채워짐.
- [ ] **`OPENAI_API_KEY` 세팅** — Railway `pack-your-jeju` 서비스 Variables에 추가. 이후 `intro.text` 감성 문구, `llm_used: true`.
- [ ] **킥3 유형별 카운트** — 수정요청 CSV의 폐업/이전/시간변경 유형 분포. 오프닝 슬라이드 세부 수치.

### P3 — 발표 리허설·백업
- [ ] 데모 대본 전 구간 스크린 녹화 (킥1 · `/pack` · `/admin/metrics`)
- [ ] 발표장 Wi-Fi 사전 테스트, 로컬 실행 노트북 백업
- [ ] "지역 팩 아키텍처" 다음 단계 슬라이드 확정

## 5. 로컬 재현 지침 (다음 개발자용)

```powershell
# 1) .env 준비
copy .env.example .env
# 편집기로 .env 열어서:
#   VISITJEJU_API_KEY=<발급받은 키>
#   DATABASE_URL=<Railway DATABASE_PUBLIC_URL>?sslmode=require

# 2) 접속 검증
python -c "from apps.api import db; print(db.ping())"   # True 나오면 OK

# 3) 데이터 심기 (원격 DB에 UPSERT — 원본 유지, idempotent)
python -m apps.pipelines.ingest_visitjeju --fetch-all                   # 5-10분
python -m apps.pipelines.process                                        # 30초 이내
python -m apps.pipelines.ingest_file --fix-request-csv "제주관광공사_비짓제주(VISIT JEJU)_콘텐츠수정요청_20250806 (1).CSV"

# 4) 데모용 tombstone 시드 (G14 재현 — 골든셋과 일치)
#    아래 SQL을 psql 또는 Railway SQL Console에서 1회 실행:
#      UPDATE place SET tombstoned=true WHERE name='애월오누이 제주';

# 5) 골든셋 게이트 (12/12 GREEN 확인)
python -m packages.eval.run --out data/eval-reports

# 6) 프로덕션 스모크
curl --ssl-no-revoke https://pack-your-jeju-production.up.railway.app/health

curl --ssl-no-revoke -X POST https://pack-your-jeju-production.up.railway.app/pack `
  -H "Content-Type: application/json" `
  -d '{"region":"seogwipo","start_date":"2026-07-10","days":3,"companion":"couple","purpose":"healing","moments":["sunset","quiet_cafe","local_food"]}'
```

`DATABASE_PUBLIC_URL` 위치: Railway → `Postgres` 서비스 → Variables 탭 (`DATABASE_URL`이 아님 — 내부 host는 로컬에서 접근 불가).

## 6. 관련 파일

- 배포 가이드 (전체 절차): `docs/deploy.md`
- 프로젝트 헌법: `CLAUDE.md`
- 데이터 파이프라인 스펙: `DATA_PIPELINE.md`
- 트러스트 엔진 스펙: `TRUST_ENGINE.md`
- DDL: `packages/schema/init.sql`
- 부트스트랩 로직: `apps/api/bootstrap.py`
- DB 유틸: `apps/api/db.py`

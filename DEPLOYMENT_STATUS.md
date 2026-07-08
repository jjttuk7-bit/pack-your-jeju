# 배포 상태 및 로드맵

> 마지막 업데이트: 2026-07-06
> 이 문서는 프로덕션 배포의 현재 스냅샷과 다음 작업을 기록한다. 검증된 사실만 담고, 아직 안 한 것은 명시적으로 "남은 작업"에 둔다.

## 1. 현재 상태

### 인프라
| 계층 | 위치 | 상태 |
|---|---|---|
| API | Railway `skillful-alignment / production` / `pack-your-jeju` | Online |
| DB | Railway Postgres (같은 프로젝트) | Online |
| 프론트 | Vercel — `pack-your-jeju.vercel.app` | Online |
| 도메인 (API) | `https://pack-your-jeju-production.up.railway.app` | 발급됨 |
| 도메인 (프론트) | `https://pack-your-jeju.vercel.app` | 발급됨 |
| QR (킥4) | `docs/qr.png` (370×370) | 생성됨 |

### 데이터
- `raw_source`: 5,756건 (비짓제주)
- `place`: 4,422건 (정제 후)
- `place.has_fix_request=true`: 556건 (수정요청 CSV 1,686행 중 매칭)
- `place.tombstoned=true`: 1건 (`애월오누이 제주` — G14 데모 시드)
- `transit_point`: **5,828건** — parking 1,557 (2026-04-16) + busstop 4,271 (TAGO 국토부)
- `query_log`: 자동 적재 중

### 엔드포인트 검증 (2026-07-06 마지막 검증)
| 엔드포인트 | 응답 | 비고 |
|---|---|---|
| `GET /health` | 200 `{db:true, bootstrap:{applied:11, failed:0}}` | 스키마 자동 부트스트랩 정상 |
| `POST /pack` | 200 실제 items 반환, `verified` 배지 + 상세 확장 필드 (address, amenities, category, hygiene_grade, region) | 서귀포/커플/힐링 3일 시나리오 |
| `POST /pack/pdf` | 200 `application/pdf`, ~82KB, filename 자동 조립 | 여행 저널 다운로드. Content-Disposition으로 파일명 지정 |
| `POST /verify` | 200 3-verdict 재현 (contradicted / verified / coverage_gap) | 킥1 데모 대본 `data/verify_kick1_g14.json` |
| `POST /agent/intro` | 200 하이라이트 6곳 + coverage + gaps | 폼 임계 도달 시 하루방 능동 인사 (Phase D) |
| `POST /agent/chat` | 200 하루방 대화 (도구 실행 루프) | OPENAI_API_KEY 있으면 활성 |
| `POST /agent/parse` | 200 자연어 → PackRequest 파싱 | Phase A |
| `GET /admin/metrics` | 200 `query_log` 집계 정상 | p50=16ms · 배지 5종 실 데이터 회전 |

### 골든셋 게이트
- 러너: `python -m packages.eval.run --out data/eval-reports`
- 최근 결과: **12/12 통과, 3지표 모두 1.00** (verified_precision · fallback_accuracy · badge_accuracy)
- 리포트: `data/eval-reports/eval-20260704-2200.{json,md}` (발표 캡처용)

## 2. 이번 세션에서 처리한 것 (2026-07-06)

### 하루방 Phase D — 능동 인사 (`POST /agent/intro`)
- 폼에서 `regions ≥ 1 AND moments ≥ 1` 최초 충족 시 하루방 위젯이 스스로 팝업 + 첫 인사.
- 결정적 파이프라인: `filters → search_strict → badge_item → 라운드 로빈 하이라이트 6개`.
- LLM은 greeting + reason 한 줄만. candidates 밖 external_id는 무조건 폐기.
- 미가용 시 템플릿 greeting + reason 생략, 카드는 정상 노출 (규칙 6).
- 프론트: `HarubanChat.tsx` 임계 트리거 + `HighlightCard` 카드 그리드 + gap 섹션.
- 서브타이틀: "정직한 제주 여행 도우미" → **"제주 여행길 지킴이"** (원칙 vs 캐릭터 성격 분리).
- 이미 폼에 있는 조합은 disabled + "이미 폼에 있어요" 배지 (UX 오해 방지).

### 카드 클릭 상세 확장 (accordion)
- 신규 공통 컴포넌트 `PlaceDetail.tsx` — 대시보드 팩 카드와 하루방 하이라이트 카드 양쪽에서 재사용.
- 노출: 주소 · 정보 신선도(info_type/valid_until) · 분류 · 아이 동반 · 접근성 · 위생등급 · 주차 · 대중교통 · 연락처 · caution 사유 · 근거 URL.
- 결측 필드는 조용히 숨기지 않고 **"저희 데이터로 미확인"** 배지로 명시 (원칙 3).
- 백엔드 응답 보강: `BadgedItem`에 `address · category · amenities · hygiene_grade` 추가.

### 여행 저널 PDF 다운로드 (`POST /pack/pdf`)
- `apps/api/engine/packpdf.py` — reportlab 감성 톤 A4 저널.
- 표지: `PACK YOUR JEJU` 키커 + "이 여행을, 정직하게 담았습니다." + 폼 요약 부제 + coverage chip.
- 본문: Day별 헤더 (요일·지역) + place 카드 (순간·이름·주소·caution·근거) + 미확인 조합 amber 노트.
- 마지막 페이지: **"정직하게, 확인되지 않은 것들"** — 전체 gap 조합 요약.
- 폰트 fallback: NanumGothic (프로덕션) → Windows 맑은 고딕 (로컬) → reportlab 내장 CID `HYGothic-Medium` (최후 안전판).
- 프론트: 대시보드 요약 카드 아래 CTA **"이 여행을 저널로 저장"** (BookOpenCheck + Download).

### 팀 공유 문서
- `docs/team_briefing.pdf` — A4 12장. 프로젝트 정체성 · 아키텍처 · 워크플로우 · Q&A · 팀 액션. `scripts/build_team_briefing_pdf.py`로 재생성 가능.
- `docs/pack_your_jeju_slides.pptx` — 발표용 20×11.25 와이드 18장. SolarFit 구조 참조, Pack Your Jeju 컬러(Citrus/Basalt/Ivory/Mint). `scripts/build_slides_pptx.py`로 재생성 가능.

### 로컬 개발 편의
- `scripts/run_local_api.py` — `python -m uvicorn` sys.path 이슈 우회. `python scripts/run_local_api.py` 한 줄로 API 부팅.
- CORS 기본 허용 목록에 `http://127.0.0.1:3000`, `http://127.0.0.1:5173` 추가 (Windows에서 localhost≠127.0.0.1 preflight 실패 회피).
- Vite 기본 API URL을 `http://127.0.0.1:8000`으로 고정 (IPv6/IPv4 어긋남 회피).

### 인프라 조정
- `pyproject.toml`에 `reportlab>=4.0` 추가.
- `Dockerfile`에 한글 폰트 설치 (`fonts-nanum`). `fonts-nanum-coding`는 Debian bookworm-slim에 없어 제거.

### 이전 세션 (2026-07-05 이하 · 이력 유지)

**Railway 배포 안정화 · 스키마 자동 부트스트랩**
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

### Vercel 프론트 배포
- Root Directory: `apps/web`, Framework: Vite. `apps/web/vercel.json`이 buildCommand/outputDirectory/SPA rewrites 자동 처리.
- 환경변수: `VITE_API_BASE_URL=https://pack-your-jeju-production.up.railway.app` (Production/Preview/Development 모두).
- CORS: 백엔드 `main.py:40`의 `.vercel.app` regex로 자동 허용 → 별도 갱신 불필요.
- 최근 1h 트래픽 관측(`/admin/metrics`): 5종 배지(verified/caution/coverage_gap/outdated/contradicted) 전부 실 데이터로 회전 중, p50=13ms.
- 킥4 QR: `docs/qr.png` (370×370, `qrcode` 파이썬 라이브러리로 생성).
- Railway Auto Deploy 정상화: Settings → Source → Branch → `Enable`. 이후 `git push`만으로 자동 배포.

### 지역 다중 선택 + 요일 그룹핑 (2026-07-05)
- 원 스코프 D-10 "지역 하나만 선택"의 UX 한계를 발견: 실제 제주 여행은 여러 지역 순회.
- `PackRequest.regions: tuple[str,...]` (backward compat: `region` 단일도 허용).
- `MomentFilter.regions`, `search_strict/relaxed`가 지역 합집합 검색.
- `assemble.dispatch_itinerary` 규칙:
  - 규칙 A (다중 지역): 지역별 요일 그룹핑. 지역 수 > days면 `_REGION_CLUSTER`(east/west/south)로 인접 지역 묶어 배정. 지역 내 items는 요일간 순환.
  - 규칙 B (단일 지역): 순간별 순환 (하루 다양성).
- 응답 확장: `itinerary: [{day, date, items, regions, unavailable_moments}]`.
- 프론트: `RegionChips` 다중 선택, `PackingDashboard` 뷰 스위처(순간별 · 요일별), `ItineraryDayCard` 지역 뱃지 + `UnavailableNote`.

### 빈 요일 세밀 진단 (2026-07-05)
- `_compute_unavailable`: (요일 regions × selected_moments) 중 items가 없는 조합 나열.
- 프론트 문구: "{지역}에서는 {순간}이(가) 저희가 참조하는 공공데이터 기준으로 확인되지 않았습니다".
- items 있는 요일도 부분 미확인 노출.
- CLAUDE.md 절대 규칙 3(coverage_gap 인식론 규칙) UI 마감.

## 3. 알려진 이슈

### 3.1 Railway Auto Deploy (2026-07-06 관찰: 정상)
- 이번 세션에서 5개 커밋(하루방 Phase D · 카드 확장 · PDF 3연속 수정) 모두 Auto Deploy로 반영됨.
- 실측 진단으로 확인: **웹훅은 정상 감지되고 있었다.** 이전 세션 진단 "Auto Deploy 미동작"은 별도 원인(Docker 빌드 실패)에서 발생한 오해였을 가능성.
- 이번 세션의 배포 실패 원인은 **Dockerfile의 `fonts-nanum-coding` 패키지가 Debian slim에 없음** → 이미지 빌드 [3/7]에서 실패 → 옛 이미지 유지. 커밋 `2bf7582`로 해결.
- 이력용 참고: 이전 세션에서 "GitHub Repo not found" 배너를 봤다면 Settings → Source → **Check for updates**로 강제 재감지 가능.

### 3.2 응답 필드 관찰
- `intro.llm_used: false` — Railway에 `OPENAI_API_KEY` 미설정, 템플릿 폴백 정상 동작. (CLAUDE.md 절대 규칙 6 준수)
- `hygiene_grade: null` — 위생등급 CSV 미적재 상태 (P2). 상세 확장 UI는 이 필드 결측 시 라인 자체를 안 그림.
- `amenities.phone` — 유의미한 값들이 실제로 등장. 상세 확장의 "연락처" 라인에 노출됨.

## 4. 남은 작업 (우선순위)

### P0 — 완료 ✅
- [x] `/verify` 프로덕션 스모크 → 3-verdict 데모 대본 확정
- [x] 수정요청 CSV 적재 → 킥3 오프닝 숫자 확보 (1,686 → 556)
- [x] 골든셋 러너 실행 → 게이트 GREEN
- [x] 킥1 하이라이트(contradicted) 시연 재현 (G14 tombstone 시드)

### P1 — 시연 품질에 직접 영향 (전량 완료 ✅)
- [x] **Vercel 프론트 배포** — `pack-your-jeju.vercel.app` Online.
- [x] **CORS 정합성** — `.vercel.app` regex가 이미 커버.
- [x] **킥4 QR 생성** — `docs/qr.png` 370×370.
- [x] **`transit_point` 적재** — parking 1,557 (공영주차장 CSV) + busstop 4,271 (TAGO 국토부 API).
- [x] **Railway Auto Deploy 정상화** — Settings → Source → Enable. `git push`만으로 반영.
- [x] **지역 다중 선택 + 요일 그룹핑** — 실제 제주 여행 UX 반영.
- [x] **빈 요일 세밀 진단** — 정직 UI 마감.

### P2 — 배지·문구 완성도
- [ ] **위생등급 CSV** — `--hygiene-csv <path>`. `place.hygiene_grade` 채워짐. (지엽적, 스킵 가능)
- [ ] **`OPENAI_API_KEY` 세팅** — 발표 전 사용자 준비 예정. Railway Variables에 추가하면 `intro.llm_used: true` + 하루방 greeting/reason 라이브.
- [ ] **골든셋 문항 확장** — 15 → 20 (하루방 능동 인사 · 카드 상세 확장 · 저널 다운로드 시나리오 커버).
- [x] **킥3 유형별 카운트** — `scripts/kick3_stats.py` + `docs/kick3_stats.md`. 372건이 물리적 변화(폐업 20·이전 26·시간 235·주소 91), 톱3=591건(35%).
- [x] **하루방 능동 인사** — 폼 임계 도달 시 자동 팝업 + 하이라이트 카드 (2026-07-06).
- [x] **카드 상세 확장** — accordion으로 근거 있는 값 노출, 결측은 '미확인' 표기 (2026-07-06).
- [x] **여행 저널 PDF 다운로드** — `/pack/pdf` + 대시보드 CTA (2026-07-06).

### P3 — 발표 리허설·백업
- [x] **팀 발표 브리핑 PDF** — `docs/team_briefing.pdf` (A4 12장).
- [x] **발표 pptx** — `docs/pack_your_jeju_slides.pptx` (16:9 와이드 18장).
- [ ] **발표 pptx QR 실제 이미지 삽입** — 지금 자리표시자. `docs/qr.png`로 교체.
- [ ] **표지 팀명·팀원 이름** — 표지에 슬롯만 준비된 상태. 확정 시 반영.
- [ ] 데모 대본 전 구간 스크린 녹화 (킥1 · `/pack` · `/pack/pdf` · `/agent/intro` · `/admin/metrics`).
- [ ] 발표장 Wi-Fi 사전 테스트, 로컬 실행 노트북 백업.

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
python -m apps.pipelines.ingest_file --fix-request-csv data/sources/visitjeju_fix_requests_20250806.csv

# 3-b) 주차장 · 정류장 (교통 배지)
python -m apps.pipelines.ingest_file --parking-csv data/parking/jeju_city_parking.csv --parking-csv data/parking/seogwipo_parking.csv
$env:TAGO_BUS_API_KEY = "<data.go.kr TAGO 인증키>"
python -m apps.pipelines.ingest_tago_busstop                            # ~5초, 4,271건

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

### 문서
- 배포 가이드 (전체 절차): `docs/deploy.md`
- 프로젝트 헌법: `CLAUDE.md`
- 데이터 파이프라인 스펙: `DATA_PIPELINE.md`
- 트러스트 엔진 스펙: `TRUST_ENGINE.md`
- 발표 대본: `docs/slides_script.md`
- 팀 브리핑 PDF: `docs/team_briefing.pdf` (생성기: `scripts/build_team_briefing_pdf.py`)
- 발표 pptx: `docs/pack_your_jeju_slides.pptx` (생성기: `scripts/build_slides_pptx.py`)

### 백엔드
- DDL: `packages/schema/init.sql`
- 부트스트랩 로직: `apps/api/bootstrap.py`
- DB 유틸: `apps/api/db.py`
- 하루방 능동 인사: `apps/api/engine/haruban.py` (`build_intro`)
- 팩 저널 PDF: `apps/api/engine/packpdf.py`
- 트러스트 엔진: `apps/api/engine/trust.py` (`BadgedItem`에 상세 필드 포함)

### 프론트
- 하루방 챗 위젯: `apps/web/src/components/HarubanChat.tsx`
- 팩 카드 · 저장 CTA: `apps/web/src/components/PackingDashboard.tsx`
- 공통 상세 패널: `apps/web/src/components/PlaceDetail.tsx`

### 스크립트
- 로컬 API 부팅: `scripts/run_local_api.py`
- 킥3 통계 재생성: `scripts/kick3_stats.py`
- 발표 브리핑 PDF 재생성: `scripts/build_team_briefing_pdf.py`
- 발표 pptx 재생성: `scripts/build_slides_pptx.py`

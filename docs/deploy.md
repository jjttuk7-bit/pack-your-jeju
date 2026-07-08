# 배포 가이드 — Vercel (프론트) + Railway (백엔드+DB)

> Pack Your Jeju는 백엔드(FastAPI + Postgres+pgvector)와 프론트(React+Vite)를 각자 잘하는 곳에 배포합니다.
> 로컬 데모만 필요하면 `scripts/demo.ps1`을 사용하세요.

## 아키텍처

```
관객 브라우저
    ↓ HTTPS
[Vercel]                              [Railway]
pack-your-jeju.vercel.app  ─fetch→   pack-your-jeju-api.railway.app
(apps/web · React+Vite)                ├─ FastAPI 컨테이너 (Dockerfile)
                                       └─ Postgres 서비스 (pgvector 확장)
```

## 1. 백엔드 · Railway

### 1.1 저장소 연결
1. https://railway.app 로그인 → **New Project → Deploy from GitHub Repo**
2. `jjttuk7-bit/pack-your-jeju` 선택
3. 감지된 서비스: `Dockerfile` 자동 인식 (railway.toml 있음)

### 1.2 Postgres 애드온
1. 프로젝트 캔버스에서 **Add → Database → Postgres** 선택
2. 생성 후 Postgres 서비스 → **Variables** → `DATABASE_URL` 복사
3. Postgres 서비스 → **Data** 탭 → SQL Console 열고 아래 실행:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```
4. `packages/schema/init.sql` 내용 전체를 붙여넣어 실행 (테이블 생성)

### 1.3 백엔드 서비스 환경변수 설정
`Pack Your Jeju API` 서비스 → **Variables**:

| 이름 | 값 |
|---|---|
| `DATABASE_URL` | Postgres 서비스의 `DATABASE_URL` (뒤에 `?sslmode=require` 붙이기) |
| `OPENAI_API_KEY` | (선택) 없으면 템플릿 문구 폴백 |
| `VISITJEJU_API_KEY` | 재수집 시 필요 |
| `CORS_ALLOW_ORIGINS` | Vercel URL 확정 후 세팅 (예: `https://pack-your-jeju.vercel.app`) |

### 1.4 데이터 심기 (로컬에서 Railway DB 대상으로 1회 실행)
```powershell
# 로컬 환경변수에 Railway DATABASE_URL 임시 세팅
$env:DATABASE_URL = "postgresql+psycopg://...?sslmode=require"
$env:VISITJEJU_API_KEY = "ce98..."

# 5,756건 수집 → raw_source
python -m apps.pipelines.ingest_visitjeju --fetch-all

# 정제 → place (4,422건)
python -m apps.pipelines.process

# 수정요청 CSV 실적재
python -m apps.pipelines.ingest_file --fix-request-csv data/sources/visitjeju_fix_requests_20250806.csv
```

### 1.5 배포 확인
- Railway가 build & deploy → 도메인 발급 (예: `https://xxx.up.railway.app`)
- `curl https://xxx.up.railway.app/health` → `{"status":"ok","db":true}`
- `curl https://xxx.up.railway.app/admin/metrics` → 집계 JSON

## 2. 프론트 · Vercel

### 2.1 저장소 연결
1. https://vercel.com → **Add New Project → Import Git Repository**
2. `jjttuk7-bit/pack-your-jeju` 선택
3. **Root Directory** = `apps/web` (중요!)
4. Framework Preset = **Vite** (자동 감지되지만 확인)

### 2.2 환경변수
Project Settings → **Environment Variables**:

| 이름 | 값 |
|---|---|
| `VITE_API_BASE_URL` | Railway 백엔드 URL (예: `https://xxx.up.railway.app`) |
| `VITE_NAVER_MAP_CLIENT_ID` | 선택. 네이버 지도 JavaScript API Client ID |

네이버 지도를 실제로 띄우려면 네이버 클라우드 콘솔에서 Vercel 배포 도메인도 Web 서비스 URL로 허용해야 합니다.

### 2.3 배포
- Deploy 클릭
- 도메인 확인 (예: `pack-your-jeju.vercel.app`)

### 2.4 백엔드 CORS 갱신
Railway 백엔드 서비스 → Variables 편집:
```
CORS_ALLOW_ORIGINS=https://pack-your-jeju.vercel.app
```
저장하면 자동 재배포. `regex`도 `vercel.app` 도메인은 이미 허용 상태.

## 3. QR 생성 (발표용)

```powershell
# 로컬 시스템에 qrencode 설치 후
qrencode -o docs/qr.png "https://pack-your-jeju.vercel.app"
```
`docs/slides.md`의 슬라이드 11 이미지 참조를 `./qr.png`로 바꾸고 재렌더.

## 4. 롤백 / 대안

- 배포 실패 시 로컬 데모(`scripts/demo.ps1`)로 즉시 전환 가능. 모든 시연 로직이 로컬에서도 완결됨.
- Railway 유료 리소스 걱정되면 Hobby 티어 무료 크레딧으로 충분 (LLM 미사용 시 응답 100~500ms).

## 5. 로컬 개발 (프론트 + 백엔드 동시)

터미널 두 개:
```powershell
# 터미널 1 — 백엔드
docker compose up -d db
uvicorn apps.api.main:app --port 8000 --reload

# 터미널 2 — 프론트
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

`apps/web/.env` 만들어 `VITE_API_BASE_URL=http://localhost:8000` 설정.

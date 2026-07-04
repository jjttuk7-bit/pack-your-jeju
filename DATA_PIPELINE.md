# DATA_PIPELINE.md — 데이터 소스·스키마·수집

## 1. 데이터 소스 (확정)

| # | 소스 | 방식 | 커버 | 담당 작업 |
|---|---|---|---|---|
| S1 | 비짓제주 API | REST (키 확보됨) | 관광지·카페·음식·체험 — 카드 8종의 주력 | `--probe`로 c1~c5 실제 분류 확정 후 카테고리별 전량 수집 |
| S2 | 위생등급/모범음식점 파일 | CSV (공공데이터포털, 키 불필요) | `local_food` 배지 보강 | 다운로드 → ingest_file |
| S3 | C-ITS 주차장 파일 | CSV (키 불필요) | 교통 배지 🚗 | 다운로드 → ingest_file |
| S4 | 버스정류장 파일 | CSV (키 불필요) | 교통 배지 🚌 | 다운로드 → ingest_file |
| S5 | 비짓제주 콘텐츠수정요청 (1,686건) | CSV (키 불필요) | 신뢰 하향 신호 + 킥3 발표 근거 | 다운로드 → 분석(PM) + contentsid 매핑(데이터) |

> 주의: 실제 파일의 컬럼명은 다운로드 후 확인하고 매핑을 확정한다. 아래 스키마의 소스 컬럼명은 가정이므로 ingest_file.py에서 방어적으로 탐색할 것.

## 2. 권위 DDL (packages/schema/init.sql)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- 장소명 fuzzy 매칭용

CREATE TABLE raw_source (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,                       -- visitjeju | hygiene | parking | busstop | fixreq
  external_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  checksum TEXT NOT NULL,                     -- sha256(payload) 증분 판정
  tombstoned BOOLEAN DEFAULT false,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE TABLE place (
  id BIGSERIAL PRIMARY KEY,
  external_id TEXT UNIQUE,                    -- visitjeju contentsid
  name TEXT NOT NULL,
  category TEXT NOT NULL,                     -- oreum|beach|cafe|food|market|forest|experience|viewpoint
  region_normalized TEXT NOT NULL,            -- 지역 선택 UI 12개 값과 일치
  address TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION, -- 제주 bbox 검증 (33.1~33.6, 126.1~127.0)
  info_type TEXT NOT NULL,                    -- static | seasonal | periodic
  valid_until TIMESTAMPTZ NOT NULL,           -- NOT NULL이 원칙을 강제한다
  periodic_rule TEXT,                         -- 오일장: "2,7"
  amenities JSONB DEFAULT '{}',               -- {"kids":true,"parking":true,...} 결측은 키 부재로 표현
  hygiene_grade TEXT,                         -- 위생등급 (food만)
  has_fix_request BOOLEAN DEFAULT false,      -- S5 매핑 결과
  tombstoned BOOLEAN DEFAULT false,
  source_url TEXT,
  embedding vector(1536),                     -- text-embedding-3-small (스트레치: 텍스트 검색으로 대체 가능)
  search_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', name || ' ' || coalesce(address,''))) STORED,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON place USING gin (search_tsv);
CREATE INDEX ON place USING gin (name gin_trgm_ops);
CREATE INDEX ON place (region_normalized, category);

CREATE TABLE transit_point (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,                         -- parking | busstop
  name TEXT,
  lat DOUBLE PRECISION NOT NULL, lng DOUBLE PRECISION NOT NULL,
  capacity INT
);
CREATE INDEX ON transit_point (kind);
```

교통 근접 판정: PostGIS 없이 위경도 하버사인 근사(파이썬) 또는 단순 bbox — 반경 500m(busstop)/1km(parking)면 충분. 4일 프로젝트에서 earthdistance 확장 설치가 막히면 파이썬 계산으로 폴백.

## 3. 수집 규칙

### ingest_visitjeju.py
1. **첫 실행은 반드시 `--probe`**: 1페이지 원본을 raw dump해 실제 필드명(contentsid, contentscd, region1cd, latitude...) 확정. 클라이언트는 필드 위치를 방어적으로 탐색.
2. 페이지 순회 → raw_source UPSERT. checksum 비교: 신규 INSERT / 변경 UPDATE / 동일 skip.
3. 이번 실행에 미등장 external_id → `tombstoned=true` (즉시 삭제 금지 — contradicted 판정의 근거).
4. 멱등성 검증: 연속 2회 실행 시 두 번째는 updated=0, inserted=0.

### ingest_file.py (S2~S5 공용)
- 입력: CSV 경로 + 소스명. 컬럼 매핑은 소스별 dict로 관리 (다운로드 후 실제 헤더 보고 확정).
- S5(수정요청): contentsid 기준으로 place.has_fix_request 업데이트. 매칭 안 되는 행은 스킵하되 카운트 로깅 (킥3 분석에 사용).

### process.py
1. 지역 정규화: 주소 → 12개 region 값. 매핑 실패는 '제주시'/'서귀포시' 상위로 폴백.
2. 카테고리 매핑: contentscd → 내부 8종 카테고리. **카드와 매핑 안 되는 카테고리는 버리지 말고 category='other'로 보존** (verify에서 쓰일 수 있음).
3. info_type/valid_until 강제: 축제·체험=seasonal(종료일), 오일장=periodic, 그 외=static(+90d). **못 채우면 place에 넣지 않는다.**
4. 좌표 검증: 제주 bbox 밖이면 좌표만 NULL 처리(항목은 보존, 교통 배지만 비활성).

## 4. Day1 데이터 담당 체크리스트

- [ ] 비짓제주 `--probe` 실행, 필드 매핑 확정 (팀 공유)
- [ ] S2~S5 파일 4종 다운로드, 실제 컬럼 헤더 기록
- [ ] init.sql 적용, docker compose로 DB 기동 확인
- [ ] 비짓제주 카테고리별 수집 백그라운드 시작
- [ ] Day1 종료 기준: `SELECT count(*) FROM place WHERE region_normalized='aewol'` 이 0이 아닐 것

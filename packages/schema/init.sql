-- Pack Your Jeju 권위 DDL
-- 출처: DATA_PIPELINE.md §2 + TRUST_ENGINE.md §7
-- 원칙: valid_until NOT NULL이 "근거 없이 답하지 않는다"를 스키마 레벨에서 강제한다.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS raw_source (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,                       -- visitjeju | hygiene | parking | busstop | fixreq
  external_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  checksum TEXT NOT NULL,                     -- sha256(payload) 증분 판정
  tombstoned BOOLEAN DEFAULT false,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS place (
  id BIGSERIAL PRIMARY KEY,
  external_id TEXT UNIQUE,                    -- visitjeju contentsid
  name TEXT NOT NULL,
  category TEXT NOT NULL,                     -- oreum|beach|cafe|food|market|forest|experience|viewpoint|other
  region_normalized TEXT NOT NULL,            -- 지역 선택 UI 12값
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  info_type TEXT NOT NULL,                    -- static | seasonal | periodic
  valid_until TIMESTAMPTZ NOT NULL,
  periodic_rule TEXT,                         -- 오일장: "2,7"
  amenities JSONB DEFAULT '{}'::jsonb,
  hygiene_grade TEXT,
  has_fix_request BOOLEAN DEFAULT false,
  tombstoned BOOLEAN DEFAULT false,
  source_url TEXT,
  embedding vector(1536),
  search_tsv tsvector GENERATED ALWAYS AS
    (to_tsvector('simple', name || ' ' || coalesce(address, ''))) STORED,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS place_search_tsv_idx ON place USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS place_name_trgm_idx ON place USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS place_region_category_idx ON place (region_normalized, category);

CREATE TABLE IF NOT EXISTS transit_point (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,                         -- parking | busstop
  name TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  capacity INT
);
CREATE INDEX IF NOT EXISTS transit_point_kind_idx ON transit_point (kind);

-- query_log: TRUST_ENGINE.md §7 (킥4 /admin/metrics 소스)
CREATE TABLE IF NOT EXISTS query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,                     -- pack | verify
  request JSONB NOT NULL,
  badge_counts JSONB,
  fallback_reasons TEXT[],                    -- 섹션별 사유 (retrieval_miss 관측용 포함)
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS query_log_created_at_idx ON query_log (created_at DESC);

-- visit_signal: 제안서 핵심 루프 "다녀올수록 신뢰도가 자란다"의 저장소.
-- 방문 신호는 새 추천 사실을 만들지 않고, 장소 신뢰 점수의 visit_signal 축에만 반영한다.
CREATE TABLE IF NOT EXISTS visit_signal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  place_name TEXT,
  status TEXT NOT NULL CHECK (
    status IN ('visited', 'not_visited', 'changed', 'info_mismatch', 'satisfied', 'unsatisfied')
  ),
  mismatch_reason TEXT,
  memo TEXT,
  previous_trust_score INT CHECK (previous_trust_score BETWEEN 0 AND 100),
  updated_trust_score INT CHECK (updated_trust_score BETWEEN 0 AND 100),
  score_breakdown JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS visit_signal_external_id_created_idx
  ON visit_signal (external_id, created_at DESC);

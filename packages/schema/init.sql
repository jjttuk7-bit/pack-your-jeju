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
  category TEXT NOT NULL,                     -- oreum|beach|cafe|food|market|forest|experience|viewpoint|culture|festival|shopping|accommodation|other
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

CREATE TABLE IF NOT EXISTS fix_request_detail (
  id BIGSERIAL PRIMARY KEY,
  request_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT,
  address TEXT,
  road_address TEXT,
  intro TEXT,
  change_text TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'general',
  before_text TEXT,
  after_text TEXT,
  display_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (request_id, external_id)
);
CREATE INDEX IF NOT EXISTS fix_request_detail_external_id_idx
  ON fix_request_detail (external_id, id DESC);
CREATE INDEX IF NOT EXISTS fix_request_detail_change_type_idx
  ON fix_request_detail (change_type);

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

-- public_data_feedback_queue: 방문 후 사용자가 남긴 수정 의견을 공공데이터 수정요청으로
-- 넘길 수 있는 내부 큐. 실제 외부 제출은 운영자 확인 후 별도 배치/관리 화면에서 처리한다.
CREATE TABLE IF NOT EXISTS public_data_feedback_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_signal_id UUID REFERENCES visit_signal(id) ON DELETE SET NULL,
  external_id TEXT NOT NULL,
  place_name TEXT,
  status TEXT NOT NULL,
  mismatch_reason TEXT,
  feedback_text TEXT NOT NULL,
  target_source TEXT NOT NULL DEFAULT 'public_data_correction_queue',
  delivery_status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS public_data_feedback_queue_status_idx
  ON public_data_feedback_queue (delivery_status, created_at DESC);

-- Corrective migration (2026-07-07):
-- `애월오누이 제주` was used as an early G14 demo tombstone seed, but it is a real
-- operating place in the VisitJeju dataset. Do not label real businesses as closed
-- unless the source data itself provides a current tombstone signal.
UPDATE place
   SET tombstoned = false,
       has_fix_request = false,
       updated_at = now()
 WHERE external_id = 'CNTS_200000000014203'
   AND name = '애월오누이 제주'
   AND tombstoned = true;

-- 플랜 피드백 근거 원장. 공공데이터 원본과 사용자 기여를 분리해 보존한다.
CREATE TABLE IF NOT EXISTS user_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'operator', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS travel_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES user_profile(id) ON DELETE SET NULL,
  client_plan_id TEXT NOT NULL,
  title TEXT,
  start_date DATE,
  days INT CHECK (days BETWEEN 1 AND 365),
  regions TEXT[] NOT NULL DEFAULT '{}'::text[],
  companion TEXT,
  purpose TEXT,
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'unlisted', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, client_plan_id)
);
CREATE INDEX IF NOT EXISTS travel_plan_owner_updated_idx
  ON travel_plan (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS plan_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES travel_plan(id) ON DELETE RESTRICT,
  place_id BIGINT REFERENCES place(id) ON DELETE RESTRICT,
  client_item_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (
    source_type IN ('public_data', 'web_search', 'user_input', 'community_verified')
  ),
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  day INT CHECK (day >= 1),
  visit_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, client_item_id)
);
CREATE INDEX IF NOT EXISTS plan_item_plan_day_idx
  ON plan_item (plan_id, day, created_at);
CREATE INDEX IF NOT EXISTS plan_item_place_created_idx
  ON plan_item (place_id, created_at DESC);

CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id BIGINT NOT NULL REFERENCES place(id) ON DELETE RESTRICT,
  plan_item_id UUID REFERENCES plan_item(id) ON DELETE RESTRICT,
  source_class TEXT NOT NULL CHECK (
    source_class IN ('official', 'platform', 'experience', 'public_data', 'user_feedback')
  ),
  claim_type TEXT NOT NULL CHECK (claim_type IN ('fact', 'experience')),
  claim_key TEXT NOT NULL,
  claim_value JSONB NOT NULL,
  url TEXT,
  checked_at TIMESTAMPTZ,
  support_status TEXT NOT NULL CHECK (
    support_status IN (
      'supported', 'partially_supported', 'conflicted', 'inferred', 'unsupported'
    )
  ),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evidence_place_checked_idx
  ON evidence (place_id, checked_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS visit_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_item_id UUID NOT NULL REFERENCES plan_item(id) ON DELETE RESTRICT,
  place_id BIGINT REFERENCES place(id) ON DELETE RESTRICT,
  author_id UUID REFERENCES user_profile(id) ON DELETE SET NULL,
  visit_status TEXT NOT NULL CHECK (
    visit_status IN ('visited', 'not_visited', 'could_not_find')
  ),
  operation_status TEXT CHECK (
    operation_status IN (
      'open', 'closed', 'temporarily_closed', 'closure_suspected',
      'moved_suspected', 'unknown'
    )
  ),
  mismatch_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  experience_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  memo TEXT,
  submission_weight NUMERIC(4, 3) NOT NULL DEFAULT 1.000
    CHECK (submission_weight BETWEEN 0 AND 1.5),
  moderation_status TEXT NOT NULL DEFAULT 'collecting_signals' CHECK (
    moderation_status IN (
      'collecting_signals', 'needs_more_evidence', 'under_review', 'approved', 'rejected'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS visit_feedback_plan_item_created_idx
  ON visit_feedback (plan_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS visit_feedback_place_created_idx
  ON visit_feedback (place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS visit_feedback_author_created_idx
  ON visit_feedback (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS evidence_asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES visit_feedback(id) ON DELETE RESTRICT,
  owner_id UUID REFERENCES user_profile(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('location', 'photo', 'receipt')),
  storage_path TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (
    verification_status IN ('unverified', 'verified', 'rejected', 'deleted')
  ),
  redacted_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evidence_asset_feedback_idx
  ON evidence_asset (feedback_id, created_at DESC);

CREATE TABLE IF NOT EXISTS moderation_case (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id BIGINT NOT NULL REFERENCES place(id) ON DELETE RESTRICT,
  case_type TEXT NOT NULL CHECK (
    case_type IN (
      'new_place', 'closure_suspected', 'relocation_suspected',
      'info_mismatch', 'evidence_conflict'
    )
  ),
  claim_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'researching', 'review_pending', 'resolved', 'dismissed')
  ),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  research_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    research_status IN (
      'pending', 'running', 'sufficient', 'partial', 'conflicted', 'unavailable'
    )
  ),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_case_open_priority_idx
  ON moderation_case (priority, opened_at)
  WHERE status IN ('open', 'researching', 'review_pending');

CREATE TABLE IF NOT EXISTS moderation_decision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES moderation_case(id) ON DELETE RESTRICT,
  reviewer_id UUID REFERENCES user_profile(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'hold', 'reject', 'revoke')),
  rationale TEXT NOT NULL,
  evidence_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  supersedes_id UUID REFERENCES moderation_decision(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_decision_case_created_idx
  ON moderation_decision (case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS place_trust_profile (
  place_id BIGINT PRIMARY KEY REFERENCES place(id) ON DELETE RESTRICT,
  identity_confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.000
    CHECK (identity_confidence BETWEEN 0 AND 1),
  operation_confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.000
    CHECK (operation_confidence BETWEEN 0 AND 1),
  freshness_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (freshness_status IN ('fresh', 'stale', 'unknown')),
  field_confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public_data_correction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id BIGINT NOT NULL REFERENCES place(id) ON DELETE RESTRICT,
  claim_key TEXT NOT NULL,
  corrected_value JSONB NOT NULL,
  decision_id UUID NOT NULL REFERENCES moderation_decision(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES user_profile(id) ON DELETE SET NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  supersedes_id UUID REFERENCES public_data_correction(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS public_data_correction_current_idx
  ON public_data_correction (place_id, claim_key, effective_from DESC)
  WHERE revoked_at IS NULL;

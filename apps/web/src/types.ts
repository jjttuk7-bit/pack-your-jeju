// 제주 전용 타입 정의.
// backend(apps/api)의 region_normalized / MOMENT_TO_CATEGORY / COMPANIONS / PURPOSES와 값 맞춤.

export type RegionId =
  | 'jeju_city'
  | 'seogwipo'
  | 'aewol'
  | 'hallim'
  | 'seongsan'
  | 'jocheon'
  | 'gujwa'
  | 'andeok'
  | 'daejeong'
  | 'pyoseon'
  | 'namwon'
  | 'udo';

export type CompanionValue = 'solo' | 'couple' | 'friend' | 'family' | 'kids' | 'parents';
export type PurposeValue = 'healing' | 'sightseeing' | 'food' | 'activity' | 'hocance';

export interface TravelInfo {
  // 12지역 칩 다중 선택. 실제 제주 여행 UX 반영 (한 지역만 다니지 않음).
  // 백엔드 dispatch_itinerary가 선택된 지역들을 요일별로 그룹핑한다.
  regions: RegionId[];
  startDate: string;            // yyyy-mm-dd
  durationDays: number;
  companion: CompanionValue;
  purpose: PurposeValue;
  // 자유 텍스트. 사실 검증엔 영향 없음(폼이 이미 필터를 제공).
  // 백엔드 assemble.py의 감성 문구 톤에만 반영.
  specialNotes?: string;
}

export type MomentId =
  | 'oreum'
  | 'beach_walk'
  | 'sunset'
  | 'local_market'
  | 'local_food'
  | 'quiet_cafe'
  | 'gotjawal'
  | 'citrus'
  | 'stay'
  | 'festival_event'
  | 'souvenir_shopping'
  | 'culture_stop';

export interface TravelMoment {
  id: MomentId;
  title: string;
  emoji: string;
  description: string;
  recommendations: string[];
  wittyRecommendation?: string;
}

export interface PackingItem {
  id: string;
  name: string;
  momentId?: MomentId | 'basic' | 'not-to-pack';
  custom?: boolean;
}

export interface MemoryTask {
  id: string;
  description: string;
}

export type Daypart = 'morning' | 'afternoon' | 'evening';

export interface TravelPlanItem {
  id: string;
  name: string;
  moment: MomentId | string;
  source: 'public_data' | 'web_search' | 'user_added';
  badge?: BadgeKind;
  external_id?: string;
  region?: string | null;
  address?: string | null;
  note?: string | null;
  day?: number | null;
  date?: string | null;
  daypart?: Daypart;
  startTime?: string | null;
  durationMinutes?: number | null;
  fixed?: boolean;
  reservationNote?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  trust_score?: number;
  score_breakdown?: TrustScoreBreakdown;
  check_required?: string[];
  source_title?: string | null;
  source_url?: string | null;
  checked_at?: string | null;
  search_query?: string | null;
}

export interface WeatherUndoState {
  proposalId: string;
  beforeItems: TravelPlanItem[];
  appliedPlanFingerprint: string;
}

export interface WeatherReportPlanItem {
  id: string;
  name: string;
  day: number;
  date: string;
  daypart: Daypart;
  startTime?: string | null;
  durationMinutes?: number | null;
  region: string;
  moment: MomentId | string;
  fixed: boolean;
  reservationNote?: string | null;
}

export interface WeatherReportRequest {
  startDate: string;
  days: number;
  regions: string[];
  items: WeatherReportPlanItem[];
  dismissedProposalFingerprints: string[];
}

export type WeatherDecisionStatus =
  | 'unknown'
  | 'suitable'
  | 'prepare'
  | 'adjust'
  | 'official_check';

export interface WeatherDaypartPeriod {
  region: string;
  date: string;
  daypart: Daypart;
  available: boolean;
  sky?: string;
  precipitation_type?: string;
  precipitation_probability_max?: number | null;
  temperature_min?: number | null;
  temperature_max?: number | null;
  wind_speed_average?: number | null;
  wind_speed_max?: number | null;
  humidity_average?: number | null;
  source_issued_at?: string | null;
  source_issued_at_label?: string | null;
}

export interface WeatherItineraryImpact {
  item_id: string;
  region: string;
  date: string;
  daypart: Daypart;
  status: WeatherDecisionStatus;
  signals: string[];
  reason: string;
  policy_version: string;
  source_label: string;
  profile?: string;
  forecast_issued_at?: string | null;
}

export interface WeatherProposalOperation {
  type: 'swap_daypart';
  item_ids: [string, string];
}

export interface WeatherChangeProposal {
  proposal_id: string;
  fingerprint: string;
  basePlanFingerprint?: string;
  severity: 'adjust';
  reason: string;
  signals: string[];
  operations: WeatherProposalOperation[];
  affected_item_ids: string[];
  requires_recalculation: boolean;
}

export interface WeatherReportResponse {
  status: WeatherDecisionStatus;
  headline: string;
  periods: WeatherDaypartPeriod[];
  impacts: WeatherItineraryImpact[];
  proposals: WeatherChangeProposal[];
  forecast_meta: {
    provider: string;
    requested_regions: string[];
    available_regions: string[];
    unavailable_regions: string[];
    partial: boolean;
    issues: Array<{
      region: string;
      source_issued_at?: string | null;
      source_issued_at_label?: string | null;
    }>;
    failures: Array<{region: string; reason: string}>;
  };
}

export type VisitCheckStatus =
  | 'visited'
  | 'not_visited'
  | 'changed'
  | 'info_mismatch'
  | 'satisfied'
  | 'unsatisfied';

export interface VisitCheck {
  status: VisitCheckStatus;
  previousTrustScore?: number;
  updatedTrustScore?: number;
  trustDelta?: number;
  saved?: boolean;
  publicDataQueued?: boolean;
  publicDataStatus?: string;
  memo?: string;
  operationStatus?: 'open' | 'closed' | 'temporarily_closed' | 'closure_suspected' | 'moved_suspected' | 'unknown';
  mismatchTypes?: string[];
  updatedAt: string;
}

// 앱 상태(로컬 스토리지 지속). step에 verify 뷰 추가.
export interface SavedTravel {
  info: TravelInfo;
  selectedMomentIds: MomentId[];
  checkedItemIds: string[];
  checkedMemoryIds: string[];
  customBasicItems: string[];
  customMomentItems: Record<MomentId, string[]>;
  step: 'setup' | 'dashboard' | 'feedback' | 'verify';
  customMemories?: string[];
  selectedPlanItems?: TravelPlanItem[];
  visitChecks?: Record<string, VisitCheck>;
  weatherDismissedFingerprints?: string[];
  weatherUndo?: WeatherUndoState | null;
  weatherActionMessage?: string | null;
}

// ─────────────────────────────────────────────────────
// 백엔드 응답 타입 (apps/api/main.py /pack, /verify 스키마와 일치)
// ─────────────────────────────────────────────────────

export type BadgeKind = 'verified' | 'caution' | 'contradicted' | 'reference';

export interface FixRequestDetailDto {
  count: number;
  requests: Array<{
    request_id?: string | null;
    title?: string | null;
    address?: string | null;
    road_address?: string | null;
    intro?: string | null;
    change_type?: string;
    change_type_label?: string;
    change_text?: string | null;
    before_text?: string | null;
    after_text?: string | null;
    display_text?: string | null;
  }>;
}

export interface PackItemDto {
  name: string;
  badge: BadgeKind;
  external_id: string;
  sources: { name: string; url: string }[];
  freshness: { info_type: string; valid_until: string | null };
  transit: { parking: boolean; parking_count: number; bus_walkable: boolean };
  note: string | null;
  // 상세 확장 UI용 (선택 필드; 결측이면 프론트에서 '미확인' 표기)
  address?: string | null;
  category?: string;
  latitude?: number | null;
  longitude?: number | null;
  amenities?: Record<string, unknown> | null;
  hygiene_grade?: string | null;
  region?: string;
  trust_score?: number;
  score_breakdown?: TrustScoreBreakdown;
  check_required?: string[];
  fix_request?: FixRequestDetailDto | null;
}

export type TrustScoreBreakdown = Record<
  string,
  {
    points: number;
    max: number;
    status: string;
    provider?: string;
    risk_level?: string;
    signals?: string[];
    labels?: string[];
    summary?: string;
    issued_at_label?: string;
  }
>;

export interface WeatherSnapshotDto {
  available: boolean;
  provider?: string;
  risk_level?: 'normal' | 'watch' | 'caution' | string;
  signals?: string[];
  labels?: string[];
  summary?: string;
  issued_at_label?: string;
  daily_forecasts?: {
    available: boolean;
    provider?: string;
    risk_level?: 'normal' | 'watch' | 'caution' | string;
    signals?: string[];
    labels?: string[];
    summary?: string;
    issued_at_label?: string;
    date?: string;
    date_label?: string;
    forecast?: {
      sky?: string;
      precipitation_type?: string;
      precipitation_probability?: number | null;
      temperature?: number | null;
      wind_speed?: number | null;
      humidity?: number | null;
      fcst_date?: string;
      fcst_time?: string;
    };
  }[];
  region?: string;
  source?: string;
  http_status?: number;
}

export interface VisitSignalResponse {
  saved: boolean;
  db_available: boolean;
  signal_id: string | null;
  previous_trust_score: number;
  updated_trust_score: number;
  trust_delta: number;
  public_data_report: {
    queued: boolean;
    delivery_status: string;
    report_id?: string;
    payload?: Record<string, unknown>;
  };
  message: string;
}

export type FallbackReason = 'out_of_scope' | 'contradicted' | 'retrieval_miss' | 'coverage_gap';

export interface SectionDto {
  moment: MomentId | string;
  items: PackItemDto[];
  fallback: { reason: FallbackReason; message: string; stats: any } | null;
  total_count?: number;
  shown_count?: number;
  has_more?: boolean;
  next_cursor?: string | null;
}

export type CandidatePageResponse = SectionDto;

export interface ItineraryItemDto extends PackItemDto {
  moment: MomentId | string;
}

export interface ItineraryDayDto {
  day: number;                     // 1-indexed
  date: string;                    // yyyy-mm-dd
  items: ItineraryItemDto[];
  regions: string[];               // 이 요일에 방문할 지역들 (다중 지역 선택 시)
  // (region × moment) 조합 중 items가 하나도 없는 것들.
  // 신뢰 기반 원칙(CLAUDE.md 절대 규칙 3): "저희 데이터로 확인되지 않았다"를 이유와 함께 노출.
  unavailable_moments?: { region: string; moment: string }[];
}

export interface PackResponse {
  pack_id: string;
  intro: { text: string; llm_used: boolean };
  sections: SectionDto[];
  itinerary?: ItineraryDayDto[];   // 규칙 기반 요일별 재배치 (LLM 없음)
  weather?: WeatherSnapshotDto;
  packing_additions: { item: string; reason: string; badge: BadgeKind; source?: string }[];
  log_id: string | null;
}

export type VerifyVerdict =
  | 'verified'
  | 'outdated'
  | 'contradicted'
  | 'coverage_gap'
  | 'retrieval_miss'
  | 'out_of_scope';

export interface VerifiedClaimDto {
  text: string;
  verdict: VerifyVerdict;
  fallback_reason: FallbackReason | null;
  matched_name: string | null;
  matched_external_id: string | null;
  reason: string;
  sources: { name: string; url: string }[];
}

export interface VerifyResponse {
  log_id: string | null;
  claims: VerifiedClaimDto[];
}

export interface RegionCoverageMomentDto {
  moment: MomentId | string;
  moment_label: string;
  category: string;
  verified: number;
  caution: number;
  coverage_gap: boolean;
}

export interface RegionCoveragePreview {
  region: RegionId | string;
  region_label: string;
  total_places: number;
  moments: RegionCoverageMomentDto[];
  recommended_moments: string[];
  weak_moments: string[];
  briefing: string;
}

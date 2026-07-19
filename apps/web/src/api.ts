// 백엔드(FastAPI) 클라이언트.
// Vercel env `VITE_API_BASE_URL`로 Railway URL 인젝트.
// 미설정 시 로컬 개발 기본값 http://localhost:8000.
//
// apps/api/main.py의 스키마와 1:1 정합:
//   POST /pack   → PackResponse
//   POST /verify → VerifyResponse

import type {
  TravelInfo,
  MomentId,
  PackResponse,
  CandidatePageResponse,
  RegionCoveragePreview,
  VisitSignalResponse,
  VisitCheckStatus,
  VerifyResponse,
  WeatherReportRequest,
  WeatherReportResponse,
  RoutePlanRequest,
  RoutePlanResponse,
} from './types';

// 로컬 dev 기본값은 127.0.0.1로 고정 (Windows에서 localhost는 IPv6로 해석되어
// uvicorn 기본 IPv4 바인딩과 어긋나는 사례가 있어 발생하는 Failed to fetch를 회피).
// 배포 환경은 VITE_API_BASE_URL이 주입되므로 이 기본값이 쓰이지 않는다.
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://127.0.0.1:8000';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.detail?.message ?? '';
    } catch {}
    throw new Error(`${path} ${res.status} ${detail || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.detail?.message ?? '';
    } catch {}
    throw new Error(`${path} ${res.status} ${detail || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function requestPack(info: TravelInfo, moments: MomentId[]): Promise<PackResponse> {
  const body: Record<string, unknown> = {
    regions: info.regions,
    start_date: info.startDate,
    days: info.durationDays,
    companion: info.companion,
    purpose: info.purpose,
    moments,
  };
  const notes = info.specialNotes?.trim();
  if (notes) body.special_notes = notes;
  return post<PackResponse>('/pack', body);
}

export function requestCandidatePage(
  info: TravelInfo,
  moments: MomentId[],
  moment: MomentId | string,
  cursor: string,
): Promise<CandidatePageResponse> {
  const body: Record<string, unknown> = {
    regions: info.regions,
    start_date: info.startDate,
    days: info.durationDays,
    companion: info.companion,
    purpose: info.purpose,
    moments,
    moment,
    cursor,
  };
  const notes = info.specialNotes?.trim();
  if (notes) body.special_notes = notes;
  return post<CandidatePageResponse>('/pack/candidates', body);
}

export function requestRegionCoveragePreview(
  region: string,
): Promise<RegionCoveragePreview> {
  return get<RegionCoveragePreview>(
    `/region/coverage-preview?region=${encodeURIComponent(region)}`,
  );
}

export function requestWeatherReport(
  request: WeatherReportRequest,
): Promise<WeatherReportResponse> {
  return post<WeatherReportResponse>('/weather/report', {
    start_date: request.startDate,
    days: request.days,
    regions: request.regions,
    items: request.items.map((item) => ({
      id: item.id,
      name: item.name,
      day: item.day,
      date: item.date,
      daypart: item.daypart,
      start_time: item.startTime ?? null,
      duration_minutes: item.durationMinutes ?? null,
      region: item.region,
      moment: item.moment,
      fixed: item.fixed,
      reservation_note: item.reservationNote ?? null,
    })),
    dismissed_proposal_fingerprints: request.dismissedProposalFingerprints,
  });
}

export function requestRoutePlan(
  request: RoutePlanRequest,
): Promise<RoutePlanResponse> {
  return post<RoutePlanResponse>('/route/plan', {
    mode: request.mode,
    origin: request.origin,
    destination: request.destination,
    items: request.items.map((item) => ({
      id: item.id,
      label: item.label,
      lat: item.lat,
      lng: item.lng,
      day: item.day,
      daypart: item.daypart,
      fixed: item.fixed,
      weather_status: item.weatherStatus ?? null,
      operating_check_required: item.operatingCheckRequired ?? false,
    })),
    dismissed_proposal_fingerprints: request.dismissedProposalFingerprints,
  });
}

// 여행플랜 PDF 다운로드 — 서버가 조립한 pdf를 그대로 받아 브라우저 다운로드.
export async function downloadPackPdf(
  info: TravelInfo,
  moments: MomentId[],
): Promise<{ filename: string; blob: Blob }> {
  const body: Record<string, unknown> = {
    regions: info.regions,
    start_date: info.startDate,
    days: info.durationDays,
    companion: info.companion,
    purpose: info.purpose,
    moments,
  };
  const notes = info.specialNotes?.trim();
  if (notes) body.special_notes = notes;

  const res = await fetch(`${API_BASE_URL}/pack/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.detail?.message ?? ''; } catch {}
    throw new Error(`/pack/pdf ${res.status} ${detail || res.statusText}`);
  }

  // 서버가 넘긴 Content-Disposition에서 filename 추출. 없으면 fallback.
  let filename = `pack-your-jeju_${info.startDate}.pdf`;
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename="?([^";]+)"?/.exec(cd);
  if (m) filename = m[1];

  return { filename, blob: await res.blob() };
}

export interface TravelPlanPdfRequestItem {
  id: string;
  name: string;
  day: number;
  order: number;
  start_time: string | null;
  fixed: boolean;
  source: 'public_data' | 'web_search' | 'user_added';
  address: string | null;
  memo: string | null;
  badge: string | null;
  source_title: string | null;
  source_url: string | null;
  checked_at: string | null;
  check_required: string[];
}

export interface TravelPlanPdfRequest {
  title: string;
  travel: {
    regions: string[];
    start_date: string;
    days: number;
    companion: string;
    purpose: string;
    moments: string[];
  };
  items: TravelPlanPdfRequestItem[];
  packing_items: string[];
}

export async function downloadTravelPlanPdf(
  request: TravelPlanPdfRequest,
): Promise<{ filename: string; blob: Blob }> {
  const res = await fetch(`${API_BASE_URL}/plan/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const payload = await res.json();
      detail = typeof payload?.detail === 'string'
        ? payload.detail
        : payload?.detail?.message ?? '';
    } catch {}
    throw new Error(`/plan/pdf ${res.status} ${detail || res.statusText}`);
  }

  let filename = `pack-your-jeju-passport_${request.travel.start_date}.pdf`;
  const contentDisposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="?([^";]+)"?/.exec(contentDisposition);
  if (match) filename = match[1];

  return { filename, blob: await res.blob() };
}

export function requestVerify(text: string): Promise<VerifyResponse> {
  return post<VerifyResponse>('/verify', { text });
}

export function requestVisitSignal(body: {
  external_id: string;
  place_name?: string;
  status: VisitCheckStatus;
  mismatch_reason?: string;
  memo?: string;
  feedback_text?: string;
  previous_trust_score?: number;
  score_breakdown?: Record<string, unknown>;
}): Promise<VisitSignalResponse> {
  return post<VisitSignalResponse>('/visit-signals', body);
}

// 자연어 상담 레이어 (신뢰 기반 에이전트 Phase A).
// 응답의 available=false면 프론트는 폼 fallback으로 안내한다.
export interface ParsedRequestDto {
  regions: string[];
  start_date: string;
  days: number;
  companion: string;
  purpose: string;
  moments: string[];
  special_notes: string;
  reasoning: string;
}
export interface AgentParseResponse {
  available: boolean;
  reason: string;
  parsed: ParsedRequestDto | null;
}
export function requestAgentParse(text: string): Promise<AgentParseResponse> {
  return post<AgentParseResponse>('/agent/parse', { text });
}

// 하루방 챗 (Phase C — 대화형 + 도구 사용 에이전트).
export interface HarubanChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}
export interface HarubanConversationState {
  last_user_question: string;
  last_research_query: string;
  active_regions: string[];
  active_place_names: string[];
  shown_place_names: string[];
  excluded_constraints: string[];
  web_research_active: boolean;
}
export interface HarubanFormSuggestion {
  regions?: string[];
  companion?: string;
  purpose?: string;
  moments?: string[];
  days?: number;
  start_date?: string;
  reason: string;
}
export interface HarubanChatResponse {
  available: boolean;
  reply_text: string;
  form_suggestion: HarubanFormSuggestion | null;
  tool_trace: any[];
  reason: string;
  answer_contract?: HarubanAnswerContract;
  place_candidates?: HarubanWebPlaceCandidate[];
}
export interface HarubanWebPlaceCandidate {
  id: string;
  name: string;
  region: string;
  moment: string;
  address?: string | null;
  note?: string | null;
  source_title: string;
  source_url: string;
  source_class?: 'official' | 'platform' | 'experience' | 'web' | string;
  checked_at: string;
  search_query: string;
}
export interface HarubanAnswerContract {
  answer_type: string;
  source_type: string;
  confidence: 'low' | 'medium' | 'high' | string;
  requires_tool: boolean;
  limitations: string[];
}
export function requestHarubanChat(
  messages: HarubanChatMessage[],
  formState: Record<string, unknown>,
  conversationState: HarubanConversationState,
): Promise<HarubanChatResponse> {
  return post<HarubanChatResponse>('/agent/chat', {
    messages,
    form_state: formState,
    conversation_state: conversationState,
  });
}

// 하루방 인사 (임계 도달 시 자동 팝업).
// 폼 상태만 넘기면 결정론적 DB 조회로 하이라이트를 뽑고, LLM은 greeting + reason만.
export interface HarubanIntroHighlight {
  external_id: string;
  name: string;
  region: string;
  region_label: string;
  moment: string;
  moment_label: string;
  address: string | null;
  badge: 'verified' | 'caution' | 'contradicted' | string;
  note: string | null;
  sources: Array<{ name: string; url: string }>;
  transit: { parking: boolean; parking_count: number; bus_walkable: boolean };
  reason: string | null;
  // 상세 확장 UI용 (선택 필드)
  category?: string;
  amenities?: Record<string, unknown> | null;
  hygiene_grade?: string | null;
  freshness?: { info_type: string; valid_until: string | null };
}
export interface HarubanIntroGap {
  region: string;
  region_label: string;
  moment: string;
  moment_label: string;
  note: string;
}
export interface HarubanIntroCoverage {
  verified: number;
  caution: number;
  total: number;
  gap_combos: number;
}
export interface HarubanIntroResponse {
  available: boolean;
  greeting: string;
  highlights: HarubanIntroHighlight[];
  coverage: HarubanIntroCoverage;
  gaps: HarubanIntroGap[];
  llm_used: boolean;
  reason: string;
}
export function requestHarubanIntro(
  formState: Record<string, unknown>,
): Promise<HarubanIntroResponse> {
  return post<HarubanIntroResponse>('/agent/intro', {
    form_state: formState,
  });
}

// Phase E — 폼 필드 증강 제안.
export interface HarubanAugmentSuggestion {
  field: string;
  kind: string;
  values: string[];
  labels: string[];
  reason: string;
  counts: Record<string, unknown>;
}
export interface HarubanAugmentResponse {
  available: boolean;
  suggestions: HarubanAugmentSuggestion[];
  llm_used: boolean;
  reason: string;
}
export function requestHarubanAugment(
  formState: Record<string, unknown>,
): Promise<HarubanAugmentResponse> {
  return post<HarubanAugmentResponse>('/agent/augment', {
    form_state: formState,
  });
}

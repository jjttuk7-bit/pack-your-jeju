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
  region: RegionId;             // 12지역 칩 하나 선택. destination 자유입력·해외 토글 삭제됨.
  startDate: string;            // yyyy-mm-dd
  durationDays: number;
  companion: CompanionValue;
  purpose: PurposeValue;
}

export type MomentId =
  | 'oreum'
  | 'beach_walk'
  | 'sunset'
  | 'local_market'
  | 'local_food'
  | 'quiet_cafe'
  | 'gotjawal'
  | 'citrus';

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

// 앱 상태(로컬 스토리지 지속). step에 verify 뷰 추가.
export interface SavedTravel {
  info: TravelInfo;
  selectedMomentIds: MomentId[];
  checkedItemIds: string[];
  checkedMemoryIds: string[];
  customBasicItems: string[];
  customMomentItems: Record<MomentId, string[]>;
  step: 'setup' | 'dashboard' | 'verify';
  customMemories?: string[];
}

// ─────────────────────────────────────────────────────
// 백엔드 응답 타입 (apps/api/main.py /pack, /verify 스키마와 일치)
// ─────────────────────────────────────────────────────

export type BadgeKind = 'verified' | 'caution' | 'contradicted' | 'reference';

export interface PackItemDto {
  name: string;
  badge: BadgeKind;
  external_id: string;
  sources: { name: string; url: string }[];
  freshness: { info_type: string; valid_until: string | null };
  transit: { parking: boolean; parking_count: number; bus_walkable: boolean };
  note: string | null;
}

export type FallbackReason = 'out_of_scope' | 'contradicted' | 'retrieval_miss' | 'coverage_gap';

export interface SectionDto {
  moment: MomentId | string;
  items: PackItemDto[];
  fallback: { reason: FallbackReason; message: string; stats: any } | null;
}

export interface PackResponse {
  pack_id: string;
  intro: { text: string; llm_used: boolean };
  sections: SectionDto[];
  packing_additions: { item: string; reason: string; badge: BadgeKind; source?: string }[];
  log_id: string | null;
}

export type VerifyVerdict = 'verified' | 'outdated' | 'contradicted' | 'coverage_gap';

export interface VerifiedClaimDto {
  text: string;
  verdict: VerifyVerdict;
  matched_name: string | null;
  matched_external_id: string | null;
  reason: string;
  sources: { name: string; url: string }[];
}

export interface VerifyResponse {
  log_id: string | null;
  claims: VerifiedClaimDto[];
}

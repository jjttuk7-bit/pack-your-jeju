import {
  MapPin,
  Clock,
  Baby,
  Accessibility,
  ParkingCircle,
  Bus,
  UtensilsCrossed,
  AlertTriangle,
  ExternalLink,
  Info,
} from 'lucide-react';

// 팩 카드와 하루방 하이라이트 카드 양쪽에서 공유하는 상세 패널.
// 원칙: DB에서 조회한 근거 값만 노출. 결측(null/undefined)은 조용히 숨기지 않고
// 명시적으로 '미확인' 배지로 표기 (CLAUDE.md 절대 규칙 1·3).

export interface PlaceDetailProps {
  externalId: string;
  address?: string | null;
  category?: string;
  amenities?: Record<string, unknown> | null;
  freshness?: { info_type: string; valid_until: string | null } | null;
  transit?: { parking: boolean; parking_count: number; bus_walkable: boolean } | null;
  hygieneGrade?: string | null;
  note?: string | null;                // caution 사유 등 이미 조립된 문구
  sources?: Array<{ name: string; url: string }>;
}

const CATEGORY_LABEL_KO: Record<string, string> = {
  oreum: '오름',
  beach: '해변',
  viewpoint: '전망 · 노을 명소',
  market: '재래시장',
  food: '음식점',
  cafe: '카페',
  forest: '숲 · 곶자왈',
  experience: '체험',
};

const INFO_TYPE_LABEL_KO: Record<string, string> = {
  static: '상시 정보',
  seasonal: '시즌 정보',
  periodic: '주기 정보 (오일장 등)',
};

function fmtDateKo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

function boolish(v: unknown): boolean | null {
  // amenities 값이 true/false/누락 셋 다 등장.
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  return null;
}

export default function PlaceDetail(props: PlaceDetailProps) {
  const {
    address, category, amenities, freshness, transit,
    hygieneGrade, note, sources,
  } = props;

  const kids = boolish(amenities?.kids);
  const accessibility = boolish(amenities?.accessibility);
  // amenities.phone은 문자열 값. 채워져 있으면 근거 있는 정보.
  const phone = typeof amenities?.phone === 'string' ? (amenities?.phone as string) : null;

  return (
    <div className="space-y-2 pt-2 pb-1 text-[11.5px] text-basalt-2">
      {/* 주소 */}
      <DetailRow icon={<MapPin className="w-3.5 h-3.5" />} label="주소">
        {address ? (
          <span className="text-basalt">{address}</span>
        ) : (
          <MissingBadge />
        )}
      </DetailRow>

      {/* 정보 유형 · 유효기간 */}
      <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="정보 신선도">
        {freshness ? (
          <span>
            <span className="text-basalt">
              {INFO_TYPE_LABEL_KO[freshness.info_type] ?? freshness.info_type}
            </span>
            {freshness.valid_until && (
              <span className="text-basalt-2/70">
                {' · 저희 데이터 유효기간 '}
                {fmtDateKo(freshness.valid_until)}
              </span>
            )}
          </span>
        ) : (
          <MissingBadge />
        )}
      </DetailRow>

      {/* 카테고리 */}
      {category && (
        <DetailRow icon={<Info className="w-3.5 h-3.5" />} label="분류">
          <span className="text-basalt">{CATEGORY_LABEL_KO[category] ?? category}</span>
        </DetailRow>
      )}

      {/* 편의: 아이 · 접근성 · 위생등급. 각각 확인/미확인 명시. */}
      <DetailRow icon={<Baby className="w-3.5 h-3.5" />} label="아이 동반">
        {kids === true ? (
          <span className="text-mint">확인됨</span>
        ) : kids === false ? (
          <span className="text-basalt-2/70">불가로 표시됨</span>
        ) : (
          <MissingBadge />
        )}
      </DetailRow>

      <DetailRow icon={<Accessibility className="w-3.5 h-3.5" />} label="접근성 정보">
        {accessibility === true ? (
          <span className="text-mint">확인됨</span>
        ) : accessibility === false ? (
          <span className="text-basalt-2/70">불가로 표시됨</span>
        ) : (
          <MissingBadge />
        )}
      </DetailRow>

      {hygieneGrade && (
        <DetailRow icon={<UtensilsCrossed className="w-3.5 h-3.5" />} label="위생등급">
          <span className="text-mint">{hygieneGrade}</span>
        </DetailRow>
      )}

      {/* 교통 */}
      <DetailRow icon={<ParkingCircle className="w-3.5 h-3.5" />} label="주차">
        {transit?.parking ? (
          <span className="text-mint">
            근처 공영주차장 {transit.parking_count}곳 확인
          </span>
        ) : (
          <span className="text-basalt-2/70">
            반경 1km 이내 공영주차장 미확인
          </span>
        )}
      </DetailRow>

      <DetailRow icon={<Bus className="w-3.5 h-3.5" />} label="대중교통">
        {transit?.bus_walkable ? (
          <span className="text-mint">500m 이내 버스정류장 확인</span>
        ) : (
          <span className="text-basalt-2/70">500m 이내 버스정류장 미확인</span>
        )}
      </DetailRow>

      {/* 연락처가 있으면 정보로 노출 (근거 있음) */}
      {phone && (
        <DetailRow icon={<Info className="w-3.5 h-3.5" />} label="연락처">
          <span className="text-basalt">{phone}</span>
        </DetailRow>
      )}

      {/* caution 사유 등 note */}
      {note && (
        <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-1.5 mt-2">
          <AlertTriangle className="w-3 h-3 text-amber-700 mt-0.5 shrink-0" />
          <span className="text-[11px] text-amber-900 leading-snug">{note}</span>
        </div>
      )}

      {/* 근거 링크 */}
      {sources && sources.length > 0 && (
        <div className="pt-1.5 flex flex-wrap gap-2">
          {sources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10.5px] text-basalt-2/80 underline underline-offset-2 hover:text-basalt"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              근거: {s.name}
            </a>
          ))}
        </div>
      )}

      <div className="pt-1 text-[10px] text-basalt-2/50 leading-snug">
        저희 공공데이터에서 조회한 값만 표시했습니다. 결측 항목은 지어내지 않고
        '미확인'으로 남겨둡니다.
      </div>
    </div>
  );
}

function DetailRow({
  icon, label, children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="shrink-0 w-4 flex justify-center text-basalt-2/70 mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1 leading-snug">
        <span className="text-basalt-2/70 mr-1.5">{label}</span>
        {children}
      </div>
    </div>
  );
}

function MissingBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-basalt-2/25 bg-white text-[10px] text-basalt-2/70">
      저희 데이터로 미확인
    </span>
  );
}

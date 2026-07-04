import { TravelMoment, RegionId, CompanionValue, PurposeValue } from './types';

// ─────────────────────────────────────────────────────
// 제주 12지역 (backend의 region_normalized 값과 1:1)
// D-02 · CLAUDE.md 저장소 구조
// ─────────────────────────────────────────────────────
export interface RegionEntry {
  value: RegionId;
  label: string;
  emoji: string;
  landmarks: string[];   // 대표 관광지 3개 — "그 이름이면 이 지역이에요" 힌트용
}

export const REGIONS: RegionEntry[] = [
  { value: 'jeju_city', label: '제주시',   emoji: '🏙️', landmarks: ['한라산', '용두암', '이호테우해변'] },
  { value: 'seogwipo',  label: '서귀포',   emoji: '🌆', landmarks: ['정방폭포', '이중섭 거리', '매일올레시장'] },
  { value: 'aewol',     label: '애월',     emoji: '🌅', landmarks: ['새별오름', '곽지해수욕장', '애월카페거리'] },
  { value: 'hallim',    label: '한림',     emoji: '🌾', landmarks: ['협재해수욕장', '한림공원', '금오름'] },
  { value: 'seongsan',  label: '성산',     emoji: '🌋', landmarks: ['성산일출봉', '섭지코지', '광치기해변'] },
  { value: 'jocheon',   label: '조천',     emoji: '🌊', landmarks: ['함덕해수욕장', '사려니숲길', '조천만세동산'] },
  { value: 'gujwa',     label: '구좌',     emoji: '🧡', landmarks: ['만장굴', '월정리해수욕장', '비자림'] },
  { value: 'andeok',    label: '안덕',     emoji: '⛰️', landmarks: ['산방산', '안덕계곡', '오설록티뮤지엄'] },
  { value: 'daejeong',  label: '대정',     emoji: '🌾', landmarks: ['송악산', '알뜨르비행장', '마라도 선착장'] },
  { value: 'pyoseon',   label: '표선',     emoji: '🏖️', landmarks: ['표선해수욕장', '성읍민속마을', '붉은오름'] },
  { value: 'namwon',    label: '남원',     emoji: '🌳', landmarks: ['큰엉해안경승지', '위미리 동백', '쇠소깍'] },
  { value: 'udo',       label: '우도',     emoji: '🐚', landmarks: ['우도등대', '검멀레해수욕장', '서빈백사'] },
];

// 역방향 안내: 유명 관광지 → 어느 지역인지 즉시 알려주기 (하단 배너용 짧은 리스트)
export const LANDMARK_HINTS: { name: string; regionLabel: string }[] = [
  { name: '한라산',       regionLabel: '제주시' },
  { name: '새별오름',     regionLabel: '애월' },
  { name: '협재해수욕장', regionLabel: '한림' },
  { name: '성산일출봉',   regionLabel: '성산' },
  { name: '만장굴',       regionLabel: '구좌' },
  { name: '산방산',       regionLabel: '안덕' },
  { name: '송악산',       regionLabel: '대정' },
  { name: '우도등대',     regionLabel: '우도' },
];

export const COMPANIONS: { value: CompanionValue; label: string }[] = [
  { value: 'solo',    label: '혼자만의 충전' },
  { value: 'couple',  label: '사랑하는 연인' },
  { value: 'friend',  label: '편안한 친구' },
  { value: 'family',  label: '따뜻한 가족' },
  { value: 'kids',    label: '아이와 눈높이' },
  { value: 'parents', label: '부모님과 효도' },
];

export const PURPOSES: { value: PurposeValue; label: string }[] = [
  { value: 'healing',     label: '쉼과 치유 (힐링)' },
  { value: 'sightseeing', label: '알찬 탐방 (관광)' },
  { value: 'food',        label: '새로운 맛 (식도락)' },
  { value: 'activity',    label: '역동적인 즐거움 (액티비티)' },
  { value: 'hocance',     label: '여유로운 호캉스' },
];

// ─────────────────────────────────────────────────────
// 제주 순간 카드 8종 (MOMENT_CARDS.md 스펙)
// ─────────────────────────────────────────────────────
export const MOMENTS: TravelMoment[] = [
  {
    id: 'oreum',
    title: '오름에 올라 바람 맞기',
    emoji: '🌋',
    description: '봉긋 솟은 제주의 작은 산, 오름 위에서 바람과 하늘을 마주해요.',
    recommendations: [
      '비포장 구간에도 든든한 트레킹 운동화',
      '체온 조절이 쉬운 얇은 바람막이',
      '햇살 강한 능선에서 필수인 챙 있는 모자',
      '땀을 즉시 닦아줄 미니 스포츠 타올',
      '바람 부는 정상에서 흔들리지 않는 스마트폰 스트랩',
    ],
    wittyRecommendation: '내려온 뒤 갈아 신을 편한 슬립온 한 켤레',
  },
  {
    id: 'beach_walk',
    title: '바다 산책하기',
    emoji: '🌊',
    description: '파도 소리와 함께 고운 모래사장을 맨발로 거닐며 제주 바람을 느껴보세요.',
    recommendations: [
      '모래를 가볍게 털어내기 위한 미니 타올',
      '맨발 산책 후 신기 편한 조리·슬리퍼',
      '바닷바람에 펄럭이지 않는 시원한 셔츠',
      '가볍게 펴고 앉을 휴대용 돗자리',
      '햇살을 막아줄 자외선 차단제(선크림)',
    ],
    wittyRecommendation: '젖은 신발을 챙기기 위한 친환경 지퍼백',
  },
  {
    id: 'sunset',
    title: '노을 명소에서 멍 때리기',
    emoji: '🌅',
    description: '서쪽 해안에서 붉게 물드는 하늘을 바라보며 하루를 마감해요.',
    recommendations: [
      '해가 진 뒤 급격히 서늘해지는 저녁을 위한 얇은 카디건',
      '한 손에 잡히는 미니 삼각대',
      '고정된 시간에 노을을 놓치지 않을 알림·기록용 노트',
      '노을이 뜨는 방향을 미리 확인할 나침반 앱',
    ],
    wittyRecommendation: '따끈한 커피 담을 텀블러 (일몰 대기 시간 필수)',
  },
  {
    id: 'local_market',
    title: '로컬 시장 투어',
    emoji: '🧺',
    description: '오일장·전통시장에서 제주 어르신들의 리듬을 그대로 느껴보세요.',
    recommendations: [
      '현금(제주 오일장은 카드가 안 되는 노점이 여전히 있어요)',
      '어깨끈이 넉넉한 에코백',
      '즉석 먹거리용 물티슈',
      '제주 방언 몇 마디 익혀두는 것 (예: 혼저옵서예)',
    ],
    wittyRecommendation: '냉장이 필요한 해산물을 담을 알루미늄 보냉백',
  },
  {
    id: 'local_food',
    title: '진정한 현지 맛집 투어',
    emoji: '🍜',
    description: '블로그 리뷰 이상의 로컬 찐 맛집을 찾아 제주 맛의 지평을 넓혀요.',
    recommendations: [
      '허리춤이 넉넉한 편한 밴딩 바지',
      '과식과 매운 향신료에 안심을 주는 소화제',
      '식사 후 손 닦을 대용량 물티슈',
      '입가심 박하 사탕',
      '제주 웨이팅 앱(캐치테이블·구글맵) 미리 설치',
    ],
    wittyRecommendation: '흑돼지·고기국수를 참을 수 없는 위장을 위한 소화 효소',
  },
  {
    id: 'quiet_cafe',
    title: '카페에서 글쓰기',
    emoji: '☕',
    description: '한적한 제주 카페 창가에 앉아 머릿속 생각들을 문장으로 기록해요.',
    recommendations: [
      '여행지의 감성이 배는 무지 다이어리',
      '잉크가 잘 마르는 검은 펜',
      '주변 소음을 지울 헤드폰/에어팟',
      '영감을 즉시 받아 적을 디지털 디바이스',
    ],
    wittyRecommendation: '카페 명함이나 영수증을 모아둘 납작한 봉투',
  },
  {
    id: 'gotjawal',
    title: '곶자왈 숲 산책',
    emoji: '🌿',
    description: '용암 지대 위에 자란 원시림, 곶자왈의 서늘한 공기를 마셔요.',
    recommendations: [
      '방수 트레킹화 (곶자왈 바닥은 물기가 남아있는 곳이 많아요)',
      '얇은 긴팔·긴바지 (모기·습기·나뭇가지 대비)',
      '수분 보충용 500ml 텀블러',
      '길이 헷갈릴 때 도움이 될 오프라인 지도',
    ],
    wittyRecommendation: '작은 곤충 대비 천연 오일 스프레이',
  },
  {
    id: 'citrus',
    title: '감귤밭 체험',
    emoji: '🍊',
    description: '노랗게 물든 감귤밭에서 직접 수확하고 향을 마셔요.',
    recommendations: [
      '옷에 즙 튀어도 괜찮은 편한 상하의',
      '즉시 손 닦을 물티슈',
      '수확한 감귤 담아올 대형 지퍼백',
      '체험장에서 알려주는 수확 시기(대체로 10~1월)를 미리 확인',
    ],
    wittyRecommendation: '감귤 향을 담아 갈 미니 유리병',
  },
];

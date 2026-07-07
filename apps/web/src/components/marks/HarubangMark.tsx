/**
 * 하루방(돌하르방) SVG 마스코트 — 신뢰 기반 에이전트 캐릭터.
 * 큰 얼굴과 반짝이는 눈의 친근함만 벤치마킹하고,
 * 감귤색 목도리와 데이터 배지로 제주를 담다만의 안내자 톤을 만든다.
 */
export default function HarubangMark({
  className = 'w-12 h-12',
  color,
}: {
  className?: string;
  color?: string;
}) {
  const stone = color ?? '#8F9298';
  const stoneLight = '#C6C8CD';
  const stoneMid = '#A5A8AE';
  const stoneShadow = '#676B72';
  const eye = '#171515';
  const citrus = '#EF5B2A';
  const citrusLight = '#FFB36C';
  const mint = '#4B8A78';

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="하루방 (제주를 담다 에이전트)"
    >
      <defs>
        <radialGradient id="haruban-face" cx="0.38" cy="0.24" r="0.82">
          <stop offset="0" stopColor={stoneLight} />
          <stop offset="0.58" stopColor={stone} />
          <stop offset="1" stopColor={stoneShadow} />
        </radialGradient>
        <linearGradient id="haruban-hat" x1="14" x2="50" y1="6" y2="25">
          <stop offset="0" stopColor={stoneLight} />
          <stop offset="0.58" stopColor={stone} />
          <stop offset="1" stopColor={stoneShadow} />
        </linearGradient>
      </defs>

      <ellipse cx="32" cy="60" rx="18" ry="2.4" fill="#2A1F16" opacity="0.12" />

      {/* 한 손 인사, 한 손은 가이드 배지 쪽으로 */}
      <path d="M 15.2 40 Q 8.2 36.2, 7.5 29.5" stroke={stoneShadow} strokeWidth="6.4" strokeLinecap="round" fill="none" />
      <g stroke={stoneShadow} strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M 7.1 29.5 L 3.8 26.8" />
        <path d="M 8.1 28.8 L 7 24.7" />
        <path d="M 9.7 28.9 L 11.5 25.2" />
      </g>
      <path d="M 48.5 41 Q 52.5 44.5, 55.5 49" stroke={stoneShadow} strokeWidth="6.2" strokeLinecap="round" fill="none" />

      {/* 몸통 */}
      <path d="M 20.5 42.5 Q 32 38.8, 43.5 42.5 L 47 59 L 17 59 Z" fill={stoneShadow} />
      <path d="M 18.7 47.2 Q 32 42.8, 45.3 47.2 L 45.8 59 L 18.2 59 Z" fill={stoneMid} />

      {/* 감귤색 목도리 */}
      <path d="M 19 43.6 Q 32 48.8, 45 43.6 L 43.7 49.5 Q 32 53.2, 20.3 49.5 Z" fill={citrus} />
      <path d="M 32.2 47.8 L 38.2 58.5 L 32.9 56.7 L 29.8 59 L 27.6 48.8 Z" fill={citrusLight} />

      {/* 제주를 담다 데이터 배지 */}
      <g transform="translate(42 48)">
        <circle cx="0" cy="0" r="6.2" fill="#FFFFFF" opacity="0.96" />
        <circle cx="0" cy="0" r="5.4" fill="none" stroke={mint} strokeWidth="1" />
        <path d="M -2.5 0.2 L -0.7 2.1 L 2.9 -2" stroke={mint} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* 귀 */}
      <ellipse cx="11.9" cy="31.2" rx="4.1" ry="6.8" fill={stoneShadow} />
      <ellipse cx="52.1" cy="31.2" rx="4.1" ry="6.8" fill={stoneShadow} />
      <ellipse cx="12.8" cy="31.4" rx="2" ry="4" fill={stoneMid} opacity="0.8" />
      <ellipse cx="51.2" cy="31.4" rx="2" ry="4" fill={stoneMid} opacity="0.8" />

      {/* 얼굴 */}
      <path
        d="M 12.7 26.5 Q 13.1 13.5, 32 13.3 Q 50.9 13.5, 51.3 26.5 Q 51.5 44.5, 32 47.8 Q 12.5 44.5, 12.7 26.5 Z"
        fill="url(#haruban-face)"
      />

      {/* 둥근 돌하르방 모자 */}
      <path
        d="M 13 18 Q 16 6.5, 32 5 Q 48 6.5, 51 18 Q 45.5 20.6, 32 20.6 Q 18.5 20.6, 13 18 Z"
        fill="url(#haruban-hat)"
      />
      <path
        d="M 9.8 19.4 Q 12 15, 17.8 14.8 L 46.2 14.8 Q 52 15, 54.2 19.4 Q 51.6 25.5, 32 25.5 Q 12.4 25.5, 9.8 19.4 Z"
        fill={stoneMid}
      />
      <path d="M 13 20.2 Q 32 25.5, 51 20.2" stroke={stoneShadow} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.32" />
      <g fill={stoneShadow} opacity="0.26">
        <circle cx="44.6" cy="16.7" r="1" />
        <circle cx="47.7" cy="17.9" r="1.1" />
        <circle cx="45.7" cy="20.3" r="0.9" />
      </g>

      {/* 눈썹과 반짝이는 눈 */}
      <path d="M 21.5 27.3 Q 24.1 25.9, 26.9 27" stroke={eye} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M 37.1 27 Q 39.9 25.9, 42.5 27.3" stroke={eye} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <ellipse cx="24.5" cy="33" rx="3.25" ry="5" fill={eye} />
      <ellipse cx="39.5" cy="33" rx="3.25" ry="5" fill={eye} />
      <circle cx="23.4" cy="30.7" r="0.95" fill="#FFFFFF" />
      <circle cx="38.4" cy="30.7" r="0.95" fill="#FFFFFF" />
      <circle cx="25.6" cy="35.4" r="0.45" fill="#FFFFFF" opacity="0.6" />
      <circle cx="40.6" cy="35.4" r="0.45" fill="#FFFFFF" opacity="0.6" />

      {/* 활짝 웃는 입 */}
      <path d="M 25.5 38.7 Q 32 47.3, 38.5 38.7 Q 32 35.6, 25.5 38.7 Z" fill="#6B3324" />
      <path d="M 29.2 43.5 Q 32 45.1, 34.8 43.5" stroke="#E9865C" strokeWidth="2" strokeLinecap="round" fill="none" />
      <ellipse cx="21" cy="38.5" rx="2.3" ry="1.2" fill="#F0B7A8" opacity="0.45" />
      <ellipse cx="43" cy="38.5" rx="2.3" ry="1.2" fill="#F0B7A8" opacity="0.45" />

      {/* 현무암 표면 텍스처 */}
      <g fill={stoneShadow} opacity="0.16">
        <circle cx="18.4" cy="30" r="0.45" />
        <circle cx="30" cy="26.5" r="0.38" />
        <circle cx="45.2" cy="34.5" r="0.45" />
        <circle cx="34.8" cy="39.4" r="0.35" />
        <circle cx="20.6" cy="42.4" r="0.4" />
      </g>
    </svg>
  );
}

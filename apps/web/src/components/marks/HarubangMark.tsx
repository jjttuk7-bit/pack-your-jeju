/**
 * 하루방(돌하르방) SVG 마스코트 — 신뢰 기반 에이전트 캐릭터.
 * 제주 상징은 유지하되, 안내자답게 둥근 표정과 따뜻한 색을 더했다.
 */
export default function HarubangMark({
  className = 'w-12 h-12',
  color,
}: {
  className?: string;
  color?: string;
}) {
  const stone = color ?? '#75685B';
  const stoneLight = '#A49483';
  const stoneWarm = '#C4B4A0';
  const stoneShadow = '#4E4338';
  const eye = '#2C2119';
  const citrus = '#EF5B2A';
  const leaf = '#4B8A78';

  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="하루방 (제주를 담다 에이전트)"
    >
      <defs>
        <radialGradient id="haruban-body" cx="0.42" cy="0.26" r="0.82">
          <stop offset="0" stopColor={stoneLight} />
          <stop offset="0.62" stopColor={stone} />
          <stop offset="1" stopColor={stoneShadow} />
        </radialGradient>
        <linearGradient id="haruban-hat" x1="18" x2="46" y1="9" y2="25">
          <stop offset="0" stopColor={stoneLight} />
          <stop offset="1" stopColor={stoneShadow} />
        </linearGradient>
      </defs>

      <ellipse cx="32" cy="58" rx="18" ry="3.2" fill="#2A1F16" opacity="0.12" />

      {/* 몸통 */}
      <path
        d="M 15.5 43.5 Q 15.5 58, 32 60 Q 48.5 58, 48.5 43.5 L 46.8 33 Q 45.8 22.5, 32 22.5 Q 18.2 22.5, 17.2 33 Z"
        fill="url(#haruban-body)"
      />

      {/* 모자 */}
      <path
        d="M 12.5 23 Q 20 12.5, 32 9.5 Q 44 12.5, 51.5 23 Q 45 26.5, 32 26.5 Q 19 26.5, 12.5 23 Z"
        fill="url(#haruban-hat)"
      />
      <ellipse cx="32" cy="14.5" rx="9.8" ry="6.8" fill={stoneShadow} opacity="0.92" />
      <path
        d="M 15 22.5 Q 32 12, 49 22.5"
        stroke={stoneWarm}
        strokeWidth="1.2"
        fill="none"
        opacity="0.55"
      />

      {/* 얼굴 */}
      <ellipse cx="32" cy="31.5" rx="13" ry="10.2" fill={stone} />
      <ellipse cx="23.7" cy="35.3" rx="2.3" ry="1.4" fill="#EAB7A1" opacity="0.55" />
      <ellipse cx="40.3" cy="35.3" rx="2.3" ry="1.4" fill="#EAB7A1" opacity="0.55" />

      {/* 부드러운 눈 */}
      <path d="M 23.8 30.4 Q 26.2 28.7, 28.6 30.4" stroke={eye} strokeWidth="1.9" strokeLinecap="round" fill="none" />
      <path d="M 35.4 30.4 Q 37.8 28.7, 40.2 30.4" stroke={eye} strokeWidth="1.9" strokeLinecap="round" fill="none" />

      {/* 코와 웃는 입 */}
      <path
        d="M 32 31 L 29.8 39.2 Q 32 41.2, 34.2 39.2 Z"
        fill={stoneWarm}
      />
      <path
        d="M 27.7 42 Q 32 45.4, 36.3 42"
        stroke={stoneShadow}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* 손과 감귤 배지 */}
      <ellipse cx="23.6" cy="51.3" rx="3.8" ry="3" fill={stoneLight} />
      <ellipse cx="40.4" cy="51.3" rx="3.8" ry="3" fill={stoneLight} />
      <path
        d="M 24 51.5 Q 32 55, 40 51.5"
        stroke={stoneShadow}
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />
      <circle cx="32" cy="50.2" r="4.2" fill={citrus} />
      <path d="M 32 46.4 Q 34.5 43.7, 37.1 46.2 Q 34.5 47, 32.5 46.8" fill={leaf} />
      <path d="M 29.9 48.7 Q 32 47.2, 34.1 48.7" stroke="#FFB079" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.75" />

      {/* 현무암 표면 텍스처 */}
      <g fill={stoneShadow} opacity="0.35">
        <circle cx="20.2" cy="40.5" r="0.7" />
        <circle cx="44.2" cy="38.2" r="0.65" />
        <circle cx="22.4" cy="47.4" r="0.55" />
        <circle cx="42.7" cy="45.8" r="0.55" />
        <circle cx="31.2" cy="55.4" r="0.5" />
      </g>
    </svg>
  );
}

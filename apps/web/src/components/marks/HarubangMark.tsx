/**
 * 하루방(돌하르방) SVG 마스코트 — 정직 에이전트 캐릭터.
 * 제주 상징 돌하르방을 단순화한 표현: 넓은 모자·긴 코·손이 배 위.
 * 이모지가 아닌 브랜드 마크로 승격 — 검증 엔진의 얼굴이다.
 */
export default function HarubangMark({
  className = 'w-10 h-10',
  color,
}: {
  className?: string;
  color?: string;
}) {
  const stone = color ?? '#6B5D50';    // 현무암 어두운 톤
  const stoneLight = '#8A7A6B';         // 밝은 부분
  const stoneShadow = '#4A3F35';        // 그림자
  const eye = '#2A1F16';                // 눈
  const nose = '#9E8A7A';               // 코 하이라이트
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="하루방 (Pack Your Jeju 에이전트)"
    >
      <defs>
        <radialGradient id="haruban-body" cx="0.5" cy="0.35">
          <stop offset="0" stopColor={stoneLight} />
          <stop offset="0.7" stopColor={stone} />
          <stop offset="1" stopColor={stoneShadow} />
        </radialGradient>
      </defs>

      {/* 몸통 (넓은 상체) */}
      <path
        d="M 16 44 Q 16 58, 32 60 Q 48 58, 48 44 L 46 32 Q 46 22, 32 22 Q 18 22, 18 32 Z"
        fill="url(#haruban-body)"
      />

      {/* 모자 (넓은 챙, 위 좁아지는 형태) */}
      <path
        d="M 14 22 Q 32 6, 50 22 Q 46 24, 32 24 Q 18 24, 14 22 Z"
        fill={stone}
      />
      <ellipse cx="32" cy="12" rx="10" ry="7" fill={stoneShadow} />
      {/* 모자 챙 하이라이트 */}
      <path
        d="M 14 22 Q 32 8, 50 22"
        stroke={stoneLight}
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />

      {/* 얼굴 배경 (모자 아래) */}
      <ellipse cx="32" cy="30" rx="12" ry="9" fill={stone} />

      {/* 눈 (좌우, 큰 원) */}
      <ellipse cx="26" cy="29" rx="2.6" ry="3.2" fill={eye} />
      <ellipse cx="38" cy="29" rx="2.6" ry="3.2" fill={eye} />
      {/* 눈 하이라이트 */}
      <circle cx="26.8" cy="28" r="0.6" fill="#FFFFFF" opacity="0.7" />
      <circle cx="38.8" cy="28" r="0.6" fill="#FFFFFF" opacity="0.7" />

      {/* 코 (긴 삼각형) */}
      <path
        d="M 32 30 L 30 38 Q 32 40, 34 38 Z"
        fill={nose}
      />

      {/* 입 (작은 아치) */}
      <path
        d="M 29 41 Q 32 43, 35 41"
        stroke={stoneShadow}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* 두 손 (배 위) */}
      <ellipse cx="24" cy="52" rx="3.5" ry="2.8" fill={stoneLight} />
      <ellipse cx="40" cy="52" rx="3.5" ry="2.8" fill={stoneLight} />
      <path
        d="M 24 52 Q 32 55, 40 52"
        stroke={stoneShadow}
        strokeWidth="0.6"
        fill="none"
        opacity="0.5"
      />

      {/* 현무암 표면 점점 (텍스처) */}
      <g fill={stoneShadow} opacity="0.35">
        <circle cx="20" cy="40" r="0.7" />
        <circle cx="44" cy="36" r="0.7" />
        <circle cx="22" cy="48" r="0.6" />
        <circle cx="42" cy="46" r="0.6" />
        <circle cx="30" cy="52" r="0.5" />
      </g>
    </svg>
  );
}

/**
 * 커스텀 감귤 마스코트 SVG.
 * 🍊 이모지 대체 — 이모지 특유의 AI 시그니처를 제거하고 브랜드 마크로 승격.
 */
export default function CitrusMark({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Pack Your Jeju"
    >
      {/* 잎 (뒷쪽) */}
      <path
        d="M 32 12 C 26 8, 20 8, 18 10 C 22 14, 28 16, 32 16 Z"
        fill="#4A8779"
      />
      <path
        d="M 32 12 C 26 8, 20 8, 18 10"
        stroke="#3B6E62"
        strokeWidth="1"
        fill="none"
      />

      {/* 줄기 */}
      <path
        d="M 32 12 C 32 14, 32 16, 32 18"
        stroke="#3B6E62"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* 감귤 본체 (그라디언트) */}
      <defs>
        <radialGradient id="citrus-fill" cx="0.42" cy="0.36">
          <stop offset="0" stopColor="#FBB56B" />
          <stop offset="0.6" stopColor="#EB7B34" />
          <stop offset="1" stopColor="#B94E1E" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="38" r="20" fill="url(#citrus-fill)" />

      {/* 하이라이트 */}
      <ellipse
        cx="25"
        cy="32"
        rx="5"
        ry="3"
        fill="#FFE4C2"
        opacity="0.65"
      />

      {/* 껍질 텍스처 dots */}
      <g fill="#B94E1E" opacity="0.45">
        <circle cx="38" cy="34" r="0.9" />
        <circle cx="42" cy="40" r="0.9" />
        <circle cx="30" cy="46" r="0.9" />
        <circle cx="24" cy="42" r="0.9" />
        <circle cx="36" cy="48" r="0.9" />
        <circle cx="44" cy="46" r="0.7" />
        <circle cx="22" cy="36" r="0.7" />
      </g>

      {/* 감귤 아래 배꼽 */}
      <circle cx="32" cy="55" r="1.5" fill="#8A3712" opacity="0.5" />
    </svg>
  );
}

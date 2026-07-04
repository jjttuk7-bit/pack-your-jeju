/**
 * 현무암 돌담 패턴 — 배경 하단에 subtle하게 깔림.
 * 제주 로컬 시그니처. AI스러운 그라디언트/카드 tag 완전 벗어남.
 */
export default function StoneWallPattern({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <pattern id="stones" x="0" y="0" width="80" height="60" patternUnits="userSpaceOnUse">
          {/* 아래단 큰 돌 */}
          <path d="M 5 55 Q 15 45 30 48 Q 45 44 55 50 Q 70 47 78 55 L 78 60 L 5 60 Z" fill="#3B3F41" opacity="0.14" />
          <path d="M 5 55 Q 15 45 30 48 Q 45 44 55 50 Q 70 47 78 55" stroke="#2E3235" strokeWidth="0.8" fill="none" opacity="0.22" />
          {/* 중간단 돌 */}
          <path d="M 0 42 Q 12 34 25 38 Q 40 33 55 40 Q 70 35 80 42 L 80 48 L 0 48 Z" fill="#3B3F41" opacity="0.12" />
          <path d="M 0 42 Q 12 34 25 38 Q 40 33 55 40 Q 70 35 80 42" stroke="#2E3235" strokeWidth="0.8" fill="none" opacity="0.2" />
          {/* 윗단 작은 돌 */}
          <path d="M 8 32 Q 20 26 34 30 Q 48 25 62 32 Q 72 28 78 34" stroke="#2E3235" strokeWidth="0.7" fill="none" opacity="0.18" />
          <ellipse cx="20" cy="28" rx="7" ry="3" fill="#3B3F41" opacity="0.09" />
          <ellipse cx="50" cy="30" rx="8" ry="3.5" fill="#3B3F41" opacity="0.09" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#stones)" />
    </svg>
  );
}

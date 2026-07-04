/**
 * 파도 라인 SVG — 헤더 밑 데코 · 배경 액센트로 사용.
 */
export default function WaveLine({ className = 'w-full h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 30"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M 0 15 Q 30 5 60 15 T 120 15 T 180 15 T 240 15 T 300 15 T 360 15 L 400 15"
        stroke="#4A8779"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M 0 22 Q 40 14 80 22 T 160 22 T 240 22 T 320 22 T 400 22"
        stroke="#4A8779"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        opacity="0.28"
      />
    </svg>
  );
}

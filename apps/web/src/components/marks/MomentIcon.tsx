/**
 * 순간 카드 8종 커스텀 SVG 아이콘.
 * 이모지 🌋🌊🌅🧺🍜☕🌿🍊를 대체 — AI 시그니처 마지막 잔재 제거.
 *
 * 공통 규칙:
 *   viewBox 32×32
 *   citrus / mint / basalt 팔레트만 사용
 *   line + fill 혼합 스타일, stroke round
 */
import type { ReactNode } from 'react';
import type { MomentId } from '../../types';

const CITRUS = '#E7683A';
const CITRUS_2 = '#C24B26';
const CITRUS_LIGHT = '#F4A971';
const MINT = '#4A8779';
const MINT_LIGHT = '#8BB2A6';
const BASALT = '#2E3235';
const EARTH = '#C9A97F';

function Oreum() {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M 4 26 Q 10 14 16 14 Q 22 14 28 26 Z" fill={MINT} opacity="0.85" />
      <path d="M 8 26 Q 12 18 16 18 Q 20 18 24 26 Z" fill={MINT_LIGHT} opacity="0.7" />
      <circle cx="16" cy="12" r="1.2" fill={CITRUS} />
      <path d="M 4 26 L 28 26" stroke={BASALT} strokeWidth="0.8" opacity="0.5" />
    </svg>
  );
}

function BeachWalk() {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* 태양 */}
      <circle cx="23" cy="10" r="3" fill={CITRUS_LIGHT} />
      {/* 파도 3겹 */}
      <path d="M 3 18 Q 8 15 13 18 T 23 18 T 29 18" stroke={MINT} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M 3 22 Q 9 19 15 22 T 29 22" stroke={MINT} strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.7" />
      <path d="M 3 26 Q 10 23 17 26 T 29 26" stroke={MINT_LIGHT} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

function Sunset() {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* 반쪽 해 */}
      <defs>
        <linearGradient id="sun-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CITRUS_LIGHT} />
          <stop offset="1" stopColor={CITRUS} />
        </linearGradient>
      </defs>
      <path d="M 8 20 A 8 8 0 0 1 24 20 Z" fill="url(#sun-grad)" />
      {/* 수평선 */}
      <line x1="3" y1="20" x2="29" y2="20" stroke={BASALT} strokeWidth="0.8" />
      {/* 파도 */}
      <path d="M 3 24 Q 8 22 13 24 T 23 24 T 29 24" stroke={MINT} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M 3 27 Q 9 25 15 27 T 29 27" stroke={MINT} strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.4" />
      {/* 새 */}
      <path d="M 6 10 Q 8 8 10 10 M 12 12 Q 14 10 16 12" stroke={BASALT} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function LocalMarket() {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* 바구니 */}
      <path d="M 6 14 L 26 14 L 24 27 Q 24 28 23 28 L 9 28 Q 8 28 8 27 Z" fill={EARTH} />
      <path d="M 6 14 L 26 14 L 24 27 Q 24 28 23 28 L 9 28 Q 8 28 8 27 Z" stroke={BASALT} strokeWidth="0.8" fill="none" />
      {/* 손잡이 */}
      <path d="M 10 14 Q 10 6 16 6 Q 22 6 22 14" stroke={BASALT} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* 안의 감귤 두 개 */}
      <circle cx="13" cy="19" r="2.5" fill={CITRUS} />
      <circle cx="19" cy="20" r="2.5" fill={CITRUS_LIGHT} />
      {/* 잎 */}
      <path d="M 13 16 Q 14 15 15 16" stroke={MINT} strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* 짠 직조 라인 */}
      <path d="M 8 20 L 24 20" stroke={BASALT} strokeWidth="0.4" opacity="0.4" />
      <path d="M 9 24 L 23 24" stroke={BASALT} strokeWidth="0.4" opacity="0.4" />
    </svg>
  );
}

function LocalFood() {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* 김 (steam) */}
      <path d="M 12 4 Q 10 7 12 10 M 16 3 Q 14 6 16 9 M 20 4 Q 18 7 20 10" stroke={BASALT} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5" />
      {/* 그릇 */}
      <path d="M 4 14 L 28 14 Q 26 26 16 26 Q 6 26 4 14 Z" fill={CITRUS_LIGHT} />
      <path d="M 4 14 L 28 14 Q 26 26 16 26 Q 6 26 4 14 Z" stroke={CITRUS_2} strokeWidth="1" fill="none" />
      {/* 국물 라인 */}
      <path d="M 7 16 L 25 16" stroke={CITRUS} strokeWidth="0.6" opacity="0.5" />
      {/* 젓가락 */}
      <path d="M 24 8 L 30 20" stroke={BASALT} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M 27 8 L 32 21" stroke={BASALT} strokeWidth="1.1" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}

function QuietCafe() {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* 김 (steam) */}
      <path d="M 12 4 Q 11 7 13 10 M 16 3 Q 15 6 17 9 M 20 4 Q 19 7 21 10" stroke={BASALT} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.45" />
      {/* 컵 */}
      <path d="M 6 12 L 22 12 L 20 26 Q 20 27 19 27 L 9 27 Q 8 27 8 26 Z" fill="#FFFEFA" />
      <path d="M 6 12 L 22 12 L 20 26 Q 20 27 19 27 L 9 27 Q 8 27 8 26 Z" stroke={BASALT} strokeWidth="1.2" fill="none" />
      {/* 커피 표면 */}
      <ellipse cx="14" cy="12" rx="8" ry="1.5" fill={CITRUS_2} />
      {/* 손잡이 */}
      <path d="M 22 15 Q 27 15 27 20 Q 27 24 22 24" stroke={BASALT} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* 접시 */}
      <ellipse cx="14" cy="28" rx="10" ry="1.5" fill={EARTH} opacity="0.5" />
    </svg>
  );
}

function Gotjawal() {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* 뒷쪽 나무 */}
      <path d="M 8 26 L 8 18 Q 6 16 8 14 Q 6 12 8 10 Q 8 6 12 8 Q 14 6 15 10" fill={MINT_LIGHT} opacity="0.8" />
      {/* 앞쪽 나무 */}
      <path d="M 16 28 L 16 20 Q 14 18 16 16 Q 14 14 16 12 Q 14 10 17 8 Q 18 6 20 8 Q 24 8 24 12 Q 26 14 24 16 Q 26 18 24 20" fill={MINT} />
      {/* 줄기 강조 라인 */}
      <path d="M 16 28 L 16 20" stroke={BASALT} strokeWidth="0.8" opacity="0.6" />
      <path d="M 8 26 L 8 18" stroke={BASALT} strokeWidth="0.7" opacity="0.5" />
      {/* 바닥 */}
      <path d="M 4 28 L 28 28" stroke={BASALT} strokeWidth="0.8" opacity="0.5" />
      <ellipse cx="16" cy="28.5" rx="12" ry="1" fill={BASALT} opacity="0.1" />
    </svg>
  );
}

function Citrus() {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* 잎 */}
      <path d="M 18 8 Q 14 4 10 6 Q 12 10 18 10 Z" fill={MINT} />
      <path d="M 18 8 Q 14 4 10 6" stroke="#3B6E62" strokeWidth="0.6" fill="none" />
      {/* 줄기 */}
      <path d="M 18 8 L 18 12" stroke="#3B6E62" strokeWidth="1" strokeLinecap="round" />
      {/* 감귤 본체 */}
      <defs>
        <radialGradient id="mi-citrus-fill" cx="0.42" cy="0.4">
          <stop offset="0" stopColor="#FBB56B" />
          <stop offset="1" stopColor={CITRUS_2} />
        </radialGradient>
      </defs>
      <circle cx="17" cy="21" r="9" fill="url(#mi-citrus-fill)" />
      <ellipse cx="13" cy="17" rx="2" ry="1.2" fill="#FFE4C2" opacity="0.6" />
      {/* dot texture */}
      <g fill={CITRUS_2} opacity="0.5">
        <circle cx="22" cy="20" r="0.5" />
        <circle cx="19" cy="26" r="0.5" />
        <circle cx="14" cy="25" r="0.5" />
        <circle cx="22" cy="25" r="0.4" />
      </g>
    </svg>
  );
}

const MAP: Record<MomentId, () => ReactNode> = {
  oreum: Oreum,
  beach_walk: BeachWalk,
  sunset: Sunset,
  local_market: LocalMarket,
  local_food: LocalFood,
  quiet_cafe: QuietCafe,
  gotjawal: Gotjawal,
  citrus: Citrus,
};

export default function MomentIcon({ id, className = 'w-8 h-8' }: { id: MomentId; className?: string }) {
  const Icon = MAP[id];
  if (!Icon) return null;
  return (
    <span className={className}>
      <Icon />
    </span>
  );
}

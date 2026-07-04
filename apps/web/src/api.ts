// 백엔드(FastAPI) 클라이언트.
// Vercel env `VITE_API_BASE_URL`로 Railway URL 인젝트.
// 미설정 시 로컬 개발 기본값 http://localhost:8000.
//
// apps/api/main.py의 스키마와 1:1 정합:
//   POST /pack   → PackResponse
//   POST /verify → VerifyResponse

import type {
  TravelInfo,
  MomentId,
  PackResponse,
  VerifyResponse,
} from './types';

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8000';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.detail?.message ?? '';
    } catch {}
    throw new Error(`${path} ${res.status} ${detail || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function requestPack(info: TravelInfo, moments: MomentId[]): Promise<PackResponse> {
  const body: Record<string, unknown> = {
    region: info.region,
    start_date: info.startDate,
    days: info.durationDays,
    companion: info.companion,
    purpose: info.purpose,
    moments,
  };
  const notes = info.specialNotes?.trim();
  if (notes) body.special_notes = notes;
  return post<PackResponse>('/pack', body);
}

export function requestVerify(text: string): Promise<VerifyResponse> {
  return post<VerifyResponse>('/verify', { text });
}

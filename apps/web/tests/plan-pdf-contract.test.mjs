import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildInitialPlanPdfDraft,
  buildTravelPlanPdfRequest,
} from '../src/planPdf.ts';


const info = {
  regions: ['jeju_city'],
  startDate: '2026-07-16',
  durationDays: 2,
  companion: 'solo',
  purpose: 'healing',
};

const selectedItem = {
  id: 'web-1',
  name: '우진해장국',
  moment: 'local_food',
  source: 'web_search',
  address: '제주시 서사로 11',
  note: '아침 식사 후보',
  source_title: '비짓제주',
  source_url: 'https://example.com/woojin',
  checked_at: '2026-07-16T10:00:00+09:00',
  check_required: ['operating', 'parking'],
};


test('selected plan draft maps to the personal PDF API contract', () => {
  const draft = buildInitialPlanPdfDraft([selectedItem], 2, '나의 제주 여권');
  draft.items[0].pdfMemo = '첫날 아침에 방문';

  const request = buildTravelPlanPdfRequest(
    info,
    ['local_food'],
    draft,
    ['보조배터리'],
  );

  assert.deepEqual(request, {
    title: '나의 제주 여권',
    travel: {
      regions: ['jeju_city'],
      start_date: '2026-07-16',
      days: 2,
      companion: 'solo',
      purpose: 'healing',
      moments: ['local_food'],
    },
    items: [
      {
        id: 'web-1',
        name: '우진해장국',
        day: 1,
        order: 1,
        source: 'web_search',
        address: '제주시 서사로 11',
        memo: '첫날 아침에 방문',
        badge: null,
        source_title: '비짓제주',
        source_url: 'https://example.com/woojin',
        checked_at: '2026-07-16T10:00:00+09:00',
        check_required: ['operating', 'parking'],
      },
    ],
    packing_items: ['보조배터리'],
  });
});


test('download client posts to /plan/pdf and keeps a PDF fallback filename', () => {
  const source = fs.readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8');

  assert.match(source, /export async function downloadTravelPlanPdf/);
  assert.match(source, /`\$\{API_BASE_URL\}\/plan\/pdf`/);
  assert.match(source, /JSON\.stringify\(request\)/);
  assert.match(source, /pack-your-jeju-passport[^`]*\.pdf/);
  assert.doesNotMatch(source, /text\/plain/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  hasFinishedCandidateSection,
  mergeCandidateSection,
} from '../src/candidatePagination.ts';

const apiSource = readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');
const dashboardSource = readFileSync(
  new URL('../src/components/PackingDashboard.tsx', import.meta.url),
  'utf8',
);

test('candidate page API carries the opaque cursor with the original trip filters', () => {
  assert.match(apiSource, /export function requestCandidatePage/);
  assert.match(apiSource, /post<CandidatePageResponse>\('\/pack\/candidates'/);
  assert.match(apiSource, /cursor/);
  assert.match(apiSource, /moment/);
});

test('section response exposes progressive candidate metadata', () => {
  assert.match(typesSource, /total_count\?: number/);
  assert.match(typesSource, /shown_count\?: number/);
  assert.match(typesSource, /has_more\?: boolean/);
  assert.match(typesSource, /next_cursor\?: string \| null/);
});

test('moment section offers more candidates and reports progress', () => {
  assert.match(dashboardSource, /candidate-progress-\$\{section\.moment\}/);
  assert.match(dashboardSource, /전체 \{section\.total_count\.toLocaleString\(\)\}곳 중/);
  assert.match(dashboardSource, /다른 후보 5곳 보기/);
  assert.match(dashboardSource, /전체 후보를 모두 확인했습니다/);
  assert.match(dashboardSource, /mergeCandidateSection\(current, page\)/);
});

test('candidate pages merge without duplicates and finish at the reported total', () => {
  const current = {
    moment: 'oreum',
    items: [
      { external_id: 'place-1' },
      { external_id: 'place-2' },
      { external_id: 'place-3' },
      { external_id: 'place-4' },
      { external_id: 'place-5' },
    ],
    fallback: null,
    total_count: 7,
    shown_count: 5,
    has_more: true,
    next_cursor: 'page-2',
  };
  const page = {
    moment: 'oreum',
    items: [
      { external_id: 'place-5' },
      { external_id: 'place-6' },
      { external_id: 'place-7' },
    ],
    fallback: null,
    total_count: 7,
    shown_count: 3,
    has_more: false,
    next_cursor: null,
  };

  const merged = mergeCandidateSection(current, page);

  assert.deepEqual(
    merged.items.map((item) => item.external_id),
    ['place-1', 'place-2', 'place-3', 'place-4', 'place-5', 'place-6', 'place-7'],
  );
  assert.equal(merged.shown_count, 7);
  assert.equal(hasFinishedCandidateSection(merged), true);
});

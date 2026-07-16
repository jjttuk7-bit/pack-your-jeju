import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const loadingSource = readFileSync(
  new URL('../src/components/HarubanResearchLoading.tsx', import.meta.url),
  'utf8',
);
const chatSource = readFileSync(
  new URL('../src/components/HarubanChat.tsx', import.meta.url),
  'utf8',
);

test('Haruban loading expands after eight seconds and shows honest elapsed time', () => {
  assert.match(loadingSource, /EXPAND_AFTER_SECONDS\s*=\s*8/);
  assert.match(loadingSource, /elapsedSeconds/);
  assert.match(loadingSource, /초째 제주 곳곳의 근거를 살펴보고 있어요/);
  assert.doesNotMatch(loadingSource, /남은 시간|진행률|% 완료/);
});

test('Haruban loading alternates research guidance and Jeju tips', () => {
  assert.match(loadingSource, /공식·플랫폼·경험 출처를 폭넓게 살펴보고 있어요/);
  assert.match(loadingSource, /서로 다른 정보를 나란히 비교하고 있어요/);
  assert.match(loadingSource, /기다리는 동안 제주 한 조각/);
  assert.match(loadingSource, /해안과 중산간의 날씨가 다를 수 있어요/);
});

test('Haruban loading is accessible and does not offer a premature cancel action', () => {
  assert.match(loadingSource, /role="status"/);
  assert.match(loadingSource, /aria-live="polite"/);
  assert.match(loadingSource, /useReducedMotion/);
  assert.doesNotMatch(loadingSource, /조사 그만하기/);
});

test('Haruban chat preserves a request start timestamp and renders the research card', () => {
  assert.match(chatSource, /const \[loadingStartedAt, setLoadingStartedAt\]/);
  assert.match(chatSource, /setLoadingStartedAt\(Date\.now\(\)\)/);
  assert.match(chatSource, /<HarubanResearchLoading startedAt=\{loadingStartedAt\}/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/components/TrustMapDashboard.tsx', import.meta.url),
  'utf8',
);

function classesFor(testId) {
  const element = source.match(
    new RegExp(
      `<[^>]+data-testid=["']${testId}["'][^>]+className=["']([^"']+)["'][^>]*>`,
    ),
  );

  assert.ok(element, `${testId} element should exist`);
  return element[1].split(/\s+/);
}

test('mobile map instruction stays below the map instead of overlaying its touch area', () => {
  const classes = classesFor('mobile-map-instruction');

  assert.ok(classes.includes('sm:hidden'));
  assert.ok(!classes.includes('absolute'));
});

test('desktop map instruction preserves the existing overlay from the sm breakpoint', () => {
  const classes = classesFor('desktop-map-instruction');

  assert.ok(classes.includes('absolute'));
  assert.ok(classes.includes('hidden'));
  assert.ok(classes.includes('sm:block'));
});

test('terrain decoration never intercepts input and region motion respects user preference', () => {
  assert.match(source, /data-testid="jeju-sea-layer"/);
  assert.match(source, /pointerEvents="none"/);
  assert.match(source, /motion-reduce:transition-none/);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';


const appSource = fs.readFileSync(
  new URL('../src/App.tsx', import.meta.url),
  'utf8',
);
const dashboardSource = fs.readFileSync(
  new URL('../src/components/PackingDashboard.tsx', import.meta.url),
  'utf8',
);


test('secondary application screens are loaded on demand', () => {
  assert.match(appSource, /lazy\(\(\) => import\('\.\/components\/PackingDashboard'\)\)/);
  assert.match(appSource, /lazy\(\(\) => import\('\.\/components\/HarubanChat'\)\)/);
  assert.match(appSource, /lazy\(\(\) => import\('\.\/components\/TrustMapDashboard'\)\)/);
  assert.match(appSource, /<Suspense/);
});


test('the PDF editor chunk is requested only when the editor opens', () => {
  assert.match(
    dashboardSource,
    /lazy\(\(\) => import\('\.\/PlanPdfEditor'\)\)/,
  );
  assert.match(dashboardSource, /planPdfEditorOpen && \(/);
  assert.match(dashboardSource, /<Suspense/);
});

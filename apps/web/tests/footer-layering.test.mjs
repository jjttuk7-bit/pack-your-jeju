import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('dashboard content layer stays above the fixed sea footer image', () => {
  assert.match(app, /className="[^"]*relative[^"]*z-10[^"]*" id="app-container"/);
  assert.match(app, /jeju-badang-footer\.png/);
});

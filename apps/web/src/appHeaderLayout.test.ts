import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

describe('dashboard app header responsive layout', () => {
  it('keeps the mobile brand on one line and provides 44px icon controls', () => {
    expect(appSource).toContain('id="brand-name"');
    expect(appSource).toContain('whitespace-nowrap');
    expect(appSource).toContain('h-11 w-11');
    expect(appSource).toContain('hidden sm:inline');
  });

  it('uses a dedicated second-row mobile welcome message', () => {
    expect(appSource).toContain('data-mobile-header-support');
    expect(appSource).toContain('짐 싸기 전에, 제주를 먼저 확인해요.');
    expect(appSource).toContain('sm:hidden');
  });
});

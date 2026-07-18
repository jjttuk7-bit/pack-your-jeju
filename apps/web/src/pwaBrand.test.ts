import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

import {describe, expect, it} from 'vitest';

const projectRoot = process.cwd();
const viteConfig = readFileSync(resolve(projectRoot, 'vite.config.ts'), 'utf8');
const html = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');

const iconFiles = [
  ['jeju-damda-icon-180.png', 180],
  ['jeju-damda-icon-192.png', 192],
  ['jeju-damda-icon-512.png', 512],
  ['jeju-damda-icon-maskable-512.png', 512],
] as const;

function readPngSize(path: string) {
  if (!existsSync(path)) return null;
  const png = readFileSync(path);
  if (png.toString('ascii', 1, 4) !== 'PNG') return null;
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

describe('PWA 제주를 담다 branding', () => {
  it('uses the Korean app name in browser and iOS install metadata', () => {
    expect(html).toContain('<title>제주를 담다</title>');
    expect(html).toContain(
      '<meta name="apple-mobile-web-app-title" content="제주를 담다" />',
    );
    expect(html).not.toContain('Pack Your Jeju');
  });

  it('references only the new citrus icon filenames in PWA metadata', () => {
    expect(viteConfig).toContain("name: '제주를 담다'");
    expect(viteConfig).toContain("short_name: '제주를 담다'");
    expect(viteConfig).toContain('/icons/jeju-damda-icon-192.png');
    expect(viteConfig).toContain('/icons/jeju-damda-icon-512.png');
    expect(viteConfig).toContain('/icons/jeju-damda-icon-maskable-512.png');
    expect(html).toContain('/icons/jeju-damda-icon-180.png');
    expect(html).toContain('/icons/jeju-damda-icon-192.png');
  });

  it.each(iconFiles)('provides %s at %ix%i', (filename, size) => {
    const path = resolve(projectRoot, 'public/icons', filename);
    expect(readPngSize(path)).toEqual({width: size, height: size});
  });
});

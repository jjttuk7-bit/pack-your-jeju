import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

// PWA 설정:
//  - autoUpdate: 새 배포가 뜨면 서비스 워커가 자동 교체 (사용자 프롬프트 없이).
//  - navigateFallback: SPA 라우팅 오프라인 캐시 (Vercel SPA rewrite와 정합).
//  - runtime caching: API 응답은 캐시하지 않는다 — 데이터 최신성이 서비스 정체성.
//    아이콘·정적 자산·폰트만 프리캐시.
export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.svg',
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/icon-180.png',
        ],
        manifest: {
          id: '/',
          name: 'Pack Your Jeju',
          short_name: 'PYJ',
          description:
            '제주 특화 · 근거로 검증된 여행 준비. 짐 싸기 전에, 그 순간이 진짜인지부터 확인합니다.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#E67A34',
          background_color: '#FDF6EA',
          lang: 'ko-KR',
          categories: ['travel', 'lifestyle', 'utilities'],
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/pack/,
            /^\/verify/,
            /^\/agent/,
            /^\/admin/,
            /^\/health/,
          ],
          runtimeCaching: [],
          cleanupOutdatedCaches: true,
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

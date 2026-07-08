import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const APP_CACHE_VERSION = '2026-07-09-jeju-date-fix-v1';
const APP_CACHE_VERSION_KEY = 'pyj-app-cache-version';

async function refreshStalePwaCache() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const previousVersion = window.localStorage.getItem(APP_CACHE_VERSION_KEY);
    if (previousVersion === APP_CACHE_VERSION) return;
    window.localStorage.setItem(APP_CACHE_VERSION_KEY, APP_CACHE_VERSION);

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.update()));

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    if (previousVersion && navigator.serviceWorker.controller) {
      window.location.reload();
    }
  } catch {
    // 캐시 정리는 발표 안정성 보조 장치다. 실패해도 앱 렌더링은 계속한다.
  }
}

void refreshStalePwaCache();

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    window.setInterval(() => {
      void registration.update();
    }, 60 * 1000);
  },
  onNeedRefresh() {
    void updateSW(true);
  },
});

if ('serviceWorker' in navigator) {
  let reloadedForNewController = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForNewController) return;
    reloadedForNewController = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

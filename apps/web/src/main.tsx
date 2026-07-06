import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

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

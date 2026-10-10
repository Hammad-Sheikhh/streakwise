// PWA-1/2: the worker is built only for production (build/service-worker.ts), so the dev server
// never registers one and never serves stale files.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Without a worker the app still works online; nothing to tell the user.
    });
  });
}

import { useSyncExternalStore } from 'react';

// PWA-3: the cached app shell still opens without a connection; this says why data won't load.

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="bg-slate-800 px-4 py-2 text-center text-sm text-white dark:bg-slate-200 dark:text-slate-950 print:hidden"
    >
      You’re offline. Your data will load when you’re back online.
    </div>
  );
}

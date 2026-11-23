import { useSyncExternalStore } from 'react';

// PWA-1: Chrome fires `beforeinstallprompt` once it will install the app properly (a WebAPK on
// Android, with the manifest icon and no browser UI). "Add to home screen" only makes a shortcut,
// and Android marks those with a small Chrome badge. The event is captured here as early as
// possible, because it fires once and only while the page is open.

export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallState = 'available' | 'installed' | 'unavailable';

let deferred: InstallPromptEvent | null = null;
let installed = false;
let watching = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true;
}

/** Called once from `main.tsx`, before the first render. Safe to call twice. */
export function watchInstallPrompt(): void {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  installed = isStandalone();
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep Chrome's own mini-infobar away; the Settings button asks when the visitor is ready.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): InstallState {
  if (deferred) return 'available';
  return installed ? 'installed' : 'unavailable';
}

export function useInstallPrompt(): {
  state: InstallState;
  install: () => Promise<void>;
} {
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    state,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') {
        installed = true;
        deferred = null;
        notify();
      }
    },
  };
}

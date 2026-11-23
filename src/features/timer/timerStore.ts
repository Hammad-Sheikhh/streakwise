import { useMemo, useSyncExternalStore } from 'react';

import type { DataSourceMode } from '@/data/DataSource';
import { useDataSource } from '@/data/useDataSource';

// TIMER-1, TIMER-3: one running timer per device, kept in localStorage (start time and node) so
// it survives reloads and closing the app. Nothing is sent to the server while it runs. Demo
// timers are kept apart from the real app's.

export interface RunningTimer {
  nodeId: string;
  startedAt: string;
}

const keyFor = (mode: DataSourceMode) => `streakwise.timer.${mode}`;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab started or stopped a timer.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readRaw(mode: DataSourceMode): string | null {
  try {
    return localStorage.getItem(keyFor(mode));
  } catch {
    return null;
  }
}

function parse(raw: string | null): RunningTimer | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      'nodeId' in value &&
      'startedAt' in value &&
      typeof value.nodeId === 'string' &&
      typeof value.startedAt === 'string' &&
      !Number.isNaN(Date.parse(value.startedAt))
    ) {
      return { nodeId: value.nodeId, startedAt: value.startedAt };
    }
  } catch {
    // A damaged entry is treated as no timer.
  }
  return null;
}

export function startTimer(mode: DataSourceMode, nodeId: string, now: Date): void {
  localStorage.setItem(keyFor(mode), JSON.stringify({ nodeId, startedAt: now.toISOString() }));
  emit();
}

export function clearTimer(mode: DataSourceMode): void {
  localStorage.removeItem(keyFor(mode));
  emit();
}

/** The running timer for this data source, or null. */
export function useRunningTimer(): RunningTimer | null {
  const { mode } = useDataSource();
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(mode),
    () => null,
  );
  return useMemo(() => parse(raw), [raw]);
}

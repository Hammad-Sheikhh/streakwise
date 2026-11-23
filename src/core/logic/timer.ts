import { MAX_SESSION_MINUTES } from '../schemas/inputs.js';
import { studyDate } from './dates.js';

// TIMER-2: what a stopped timer puts in the Log form. Pure.

export interface TimedSession {
  /** Rounded to the nearest minute, at least 1, at most 24 hours. */
  minutes: number;
  /** The whole run in minutes, so a run over 24 hours can be shown. */
  elapsedMinutes: number;
  /** True when the run was longer than one session may be. */
  overLimit: boolean;
  /** The study day of the start time (DAY-2). */
  studiedOn: string;
}

export function timedSession(startedAt: string, now: Date, dayEndsAtMinutes: number): TimedSession {
  const start = new Date(startedAt);
  const elapsedMinutes = Math.max(1, Math.round((now.getTime() - start.getTime()) / 60_000));
  return {
    minutes: Math.min(elapsedMinutes, MAX_SESSION_MINUTES),
    elapsedMinutes,
    overLimit: elapsedMinutes > MAX_SESSION_MINUTES,
    studiedOn: studyDate(start, dayEndsAtMinutes),
  };
}

/** "0:05", "1:02:09": the elapsed time shown on the running timer. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return `${hours > 0 ? `${hours}:` : ''}${mm}:${String(seconds).padStart(2, '0')}`;
}

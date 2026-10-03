import { tz } from '@date-fns/tz';
import { format } from 'date-fns';

/** Every "day" in the app is a calendar date in this zone (SPEC §B9.1). UTC+5, no daylight saving. */
export const APP_TIME_ZONE = 'Asia/Karachi';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** The local calendar date (`YYYY-MM-DD`) of an instant (SPEC §B9.1). */
export function localDate(now: Date): string {
  return format(now, 'yyyy-MM-dd', { in: tz(APP_TIME_ZONE) });
}

// Plain dates are handled as UTC midnights, so date arithmetic never depends on the machine's zone.
function toUtcMidnight(date: string): number {
  const match = DATE_PATTERN.exec(date);
  const time = match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : NaN;
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Expected a valid YYYY-MM-DD date, got "${date}"`);
  }
  return time;
}

function fromUtcMidnight(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** Adds (or with a negative number, subtracts) whole days. */
export function addDays(date: string, days: number): string {
  return fromUtcMidnight(toUtcMidnight(date) + days * DAY_MS);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / DAY_MS);
}

/** The Monday on or before `date`; weeks run Monday to Sunday (SPEC §B9.2). */
export function weekStart(date: string): string {
  const time = toUtcMidnight(date);
  const daysSinceMonday = (new Date(time).getUTCDay() + 6) % 7;
  return fromUtcMidnight(time - daysSinceMonday * DAY_MS);
}

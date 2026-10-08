import { tz } from '@date-fns/tz';
import { format } from 'date-fns';

import type { ScoreKind } from '../domain/types';
import { APP_TIME_ZONE } from './dates';

// Display labels for local dates (`YYYY-MM-DD`), shared by the UI and report text. They never use
// the device's time zone.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parts = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  return {
    weekday: WEEKDAYS[d.getUTCDay()],
    day: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
    year: d.getUTCFullYear(),
  };
};

/** e.g. "Sat 3 Oct 2026". */
export function formatDay(date: string): string {
  const { weekday, day, month, year } = parts(date);
  return `${weekday} ${day} ${month} ${year}`;
}

/** e.g. "29 Sep – 5 Oct 2026"; one day is shown as formatDay. */
export function formatRange(from: string, to: string): string {
  if (from === to) return formatDay(from);
  const a = parts(from);
  const b = parts(to);
  const start = a.year === b.year ? `${a.day} ${a.month}` : `${a.day} ${a.month} ${a.year}`;
  return `${start} – ${b.day} ${b.month} ${b.year}`;
}

/** An instant in the app's time zone, e.g. "Thu 9 Oct 2026, 14:05". */
export function formatTimestamp(iso: string): string {
  return format(new Date(iso), 'EEE d MMM yyyy, HH:mm', { in: tz(APP_TIME_ZONE) });
}

/** "today", "tomorrow", "in N days", or "N days ago". */
export function formatDaysLeft(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 0) return `${-days} ${days === -1 ? 'day' : 'days'} ago`;
  return `in ${days} days`;
}

/** "1 day", "4 days". */
export function pluralDays(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** SCORE-1: how each score kind is named in the app. */
export const SCORE_KIND_LABELS: Record<ScoreKind, string> = {
  past_paper: 'Past paper',
  quiz: 'Quiz',
  mock_test: 'Mock test',
  revision: 'Revision test',
  other: 'Other',
};

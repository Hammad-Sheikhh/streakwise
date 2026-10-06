import type { ScoreKind } from '@/core/domain/types';
import { addDays } from '@/core/logic/dates';
import { formatDuration } from '@/core/logic/duration';

// Display helpers for local dates (`YYYY-MM-DD`). They never use the device's time zone.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** e.g. "Sat 3 Oct 2026". */
export function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** HEAT-2: e.g. "Mon 6 Oct 2026: 1h 30m". */
export function dayLabel(date: string, minutes: number): string {
  return `${formatDay(date)}: ${minutes > 0 ? formatDuration(minutes) : 'no study'}`;
}

/** "today", "tomorrow", or "in N days". */
export function formatDaysLeft(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** Weekly targets are shown in hours, e.g. 480 → "8h", 90 → "1.5h". */
export function formatTargetHours(minutes: number): string {
  return `${minutes / 60}h`;
}

/** "Today", "Yesterday", or the full date. */
export function formatRelativeDay(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return formatDay(date);
}

/** SCORE-1: how each score kind is named in the app. */
export const SCORE_KIND_LABELS: Record<ScoreKind, string> = {
  past_paper: 'Past paper',
  quiz: 'Quiz',
  mock_test: 'Mock test',
  revision: 'Revision test',
  other: 'Other',
};

/** "Week of Mon 5 Oct 2026", for a weekly task's completion history (TASK-5). */
export function formatWeek(monday: string): string {
  return `Week of ${formatDay(monday)}`;
}

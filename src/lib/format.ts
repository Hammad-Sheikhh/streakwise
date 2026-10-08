import type { TopicStatus } from '@/core/domain/types';
import { addDays } from '@/core/logic/dates';
import { formatDuration } from '@/core/logic/duration';
import { formatDay } from '@/core/logic/labels';

// Display helpers for local dates (`YYYY-MM-DD`). They never use the device's time zone.

export { formatDay, formatDaysLeft, SCORE_KIND_LABELS } from '@/core/logic/labels';

/** HEAT-2: e.g. "Mon 6 Oct 2026: 1h 30m". */
export function dayLabel(date: string, minutes: number): string {
  return `${formatDay(date)}: ${minutes > 0 ? formatDuration(minutes) : 'no study'}`;
}

/** TGT-1: weekly targets from 0.5h to 40h, in half-hour steps (minutes). */
export const TARGET_OPTIONS = Array.from({ length: 80 }, (_, i) => (i + 1) * 30);

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

/** "Week of Mon 5 Oct 2026", for a weekly task's completion history (TASK-5). */
export function formatWeek(monday: string): string {
  return `Week of ${formatDay(monday)}`;
}

/** TOP-1. */
export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
};

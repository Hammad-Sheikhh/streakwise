import { addDays, daysBetween, weekStart } from './dates';

// SPEC HEAT-1 and §B9.8.

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/** 0 → L0 · 1–30 → L1 · 31–90 → L2 · 91–180 → L3 · 181+ → L4. */
export function heatLevel(minutes: number): HeatLevel {
  if (minutes <= 0) return 0;
  if (minutes <= 30) return 1;
  if (minutes <= 90) return 2;
  if (minutes <= 180) return 3;
  return 4;
}

/** The heatmap covers the last 12 months, starting on a Monday so columns are whole weeks. */
export function heatmapRange(today: string): { start: string; end: string } {
  return { start: weekStart(addDays(today, -364)), end: today };
}

/**
 * Columns of 7 dates (Monday to Sunday) from `start` to `end`; days after `end` are null,
 * so the current week's column is only partly filled.
 */
export function heatmapWeeks(start: string, end: string): (string | null)[][] {
  const weeks: (string | null)[][] = [];
  const totalDays = daysBetween(start, end) + 1;
  for (let offset = 0; offset < totalDays; offset += 7) {
    const week: (string | null)[] = [];
    for (let day = 0; day < 7; day++) {
      const date = addDays(start, offset + day);
      week.push(date <= end ? date : null);
    }
    weeks.push(week);
  }
  return weeks;
}

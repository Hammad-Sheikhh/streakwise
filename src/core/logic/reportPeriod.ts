import { invalid } from '../domain/errors';
import { MAX_REPORT_DAYS } from '../domain/types';
import type { Report, ReportPeriodKind } from '../domain/types';
import { addDays, daysBetween, weekStart } from './dates';

// REP-1–3: the dates a report covers. Weeks run Monday to Sunday (SPEC §B9.2).

const LABELS: Record<ReportPeriodKind, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  last_week: 'Last week',
  custom: 'Custom period',
};

export function resolvePeriod(
  query: { period: ReportPeriodKind; from?: string; to?: string },
  today: string,
): Report['period'] {
  const make = (from: string, to: string, isWeek = false): Report['period'] => ({
    kind: query.period,
    label: LABELS[query.period],
    from,
    to,
    isWeek,
  });
  switch (query.period) {
    case 'today':
      return make(today, today);
    case 'yesterday': {
      const yesterday = addDays(today, -1);
      return make(yesterday, yesterday);
    }
    case 'this_week': {
      const monday = weekStart(today);
      return make(monday, addDays(monday, 6), true);
    }
    case 'last_week': {
      const monday = addDays(weekStart(today), -7);
      return make(monday, addDays(monday, 6), true);
    }
    case 'custom': {
      const { from, to } = query;
      if (from === undefined || to === undefined) {
        throw invalid('invalid_range', 'Choose a start and an end date.');
      }
      if (from > to) throw invalid('invalid_range', 'The start date must be before the end date.');
      if (from > today) throw invalid('invalid_range', 'The period can’t start in the future.');
      if (daysBetween(from, to) + 1 > MAX_REPORT_DAYS) {
        throw invalid('invalid_range', `A report can cover at most ${MAX_REPORT_DAYS} days.`);
      }
      return make(from, to);
    }
  }
}

/** The day the period is judged at: its last day, or today if it hasn't ended yet (SPEC §B9.10). */
export function periodAsOf(period: Pick<Report['period'], 'to'>, today: string): string {
  return period.to < today ? period.to : today;
}

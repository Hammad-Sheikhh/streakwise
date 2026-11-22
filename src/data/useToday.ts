import { localDate, studyDate } from '@/core/logic/dates';

import { useSettings } from './queries.js';
import { useDataSource } from './useDataSource.js';

export interface StudyDay {
  /** DAY-2: today's study day under "My day ends at". */
  today: string;
  /** The calendar date in Karachi, which differs from `today` between midnight and the cutoff. */
  calendarDate: string;
  dayEndsAtMinutes: number;
  /** False until the setting has loaded (forms that default to today wait for it). */
  ready: boolean;
}

/** DAY-2: "today" from the data source's clock and the user's "My day ends at" setting. */
export function useStudyDay(): StudyDay {
  const ds = useDataSource();
  const settings = useSettings();
  const now = ds.now();
  // Until the setting loads (or if it can't), the default 00:00 applies.
  const dayEndsAtMinutes = settings.data?.dayEndsAtMinutes ?? 0;
  return {
    today: studyDate(now, dayEndsAtMinutes),
    calendarDate: localDate(now),
    dayEndsAtMinutes,
    ready: settings.data !== undefined || settings.isError,
  };
}

/** Today's study day (DAY-2). */
export function useToday(): string {
  return useStudyDay().today;
}

import { localDate } from '@/core/logic/dates';

import { useDataSource } from './useDataSource.js';

/** Today's local date (Asia/Karachi), from the data source's clock. */
export function useToday(): string {
  return localDate(useDataSource().now());
}

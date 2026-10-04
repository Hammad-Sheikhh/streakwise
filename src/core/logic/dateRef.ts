import { invalid } from '../domain/errors';
import { addDays } from './dates';

// MCP-6: dates from Claude may be "today", "yesterday", or YYYY-MM-DD, all in Asia/Karachi.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Turns a date reference into a local `YYYY-MM-DD` date, given today's local date. */
export function resolveDateRef(ref: string, today: string): string {
  const value = ref.trim().toLowerCase();
  if (value === 'today') return today;
  if (value === 'yesterday') return addDays(today, -1);
  if (DATE_PATTERN.test(value)) {
    try {
      // addDays rejects impossible dates such as 2026-02-30.
      return addDays(value, 0);
    } catch {
      // fall through to the error below
    }
  }
  throw invalid('invalid_date', `"${ref}" isn’t a date. Use "today", "yesterday", or YYYY-MM-DD.`);
}

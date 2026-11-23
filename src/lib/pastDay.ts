/** The message for a "Done on" day that's empty or after today, or null when it's fine. */
export function pastDayError(value: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Choose a day.';
  return value > today ? 'Choose today or an earlier day.' : null;
}

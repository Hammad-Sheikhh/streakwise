/**
 * Formats a duration in whole minutes as `Xh Ym`, leaving out zero parts (SPEC §B9.12).
 * Examples: 45 → "45m", 120 → "2h", 90 → "1h 30m", 0 → "0m".
 */
export function formatDuration(totalMinutes: number): string {
  if (!Number.isInteger(totalMinutes) || totalMinutes < 0) {
    throw new RangeError(`Duration must be a non-negative integer of minutes, got ${totalMinutes}`);
  }
  if (totalMinutes === 0) return '0m';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

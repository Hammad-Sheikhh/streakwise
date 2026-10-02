import { describe, expect, it } from 'vitest';

import { formatDuration } from './duration';

describe('formatDuration', () => {
  it.each([
    [0, '0m'],
    [1, '1m'],
    [45, '45m'],
    [60, '1h'],
    [90, '1h 30m'],
    [120, '2h'],
    [1440, '24h'],
    [1441, '24h 1m'],
  ])('formats %i minutes as "%s"', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN])('rejects invalid input %s', (minutes) => {
    expect(() => formatDuration(minutes)).toThrow(RangeError);
  });
});

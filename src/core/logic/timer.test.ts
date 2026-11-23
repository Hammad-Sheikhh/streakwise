import { describe, expect, it } from 'vitest';

import { formatElapsed, timedSession } from './timer.js';

// TIMER-2: a stopped timer becomes the Log form's minutes and day.

describe('timedSession', () => {
  const start = '2026-11-22T20:00:00.000Z'; // 01:00 on the 23rd in Karachi

  it('rounds to the nearest minute, at least 1', () => {
    expect(timedSession(start, new Date('2026-11-22T20:44:29Z'), 0).minutes).toBe(44);
    expect(timedSession(start, new Date('2026-11-22T20:44:30Z'), 0).minutes).toBe(45);
    expect(timedSession(start, new Date('2026-11-22T20:00:10Z'), 0).minutes).toBe(1);
  });

  it('caps at 24 hours and says the run was longer', () => {
    const long = timedSession(start, new Date('2026-11-24T00:00:00Z'), 0);
    expect(long).toMatchObject({ minutes: 1440, overLimit: true, elapsedMinutes: 1680 });
    expect(timedSession(start, new Date('2026-11-23T20:00:00Z'), 0).overLimit).toBe(false);
  });

  it('dates the session by the study day of the start time', () => {
    expect(timedSession(start, new Date('2026-11-22T23:30:00Z'), 0).studiedOn).toBe('2026-11-23');
    expect(timedSession(start, new Date('2026-11-22T23:30:00Z'), 240).studiedOn).toBe('2026-11-22');
  });
});

describe('formatElapsed', () => {
  it('shows minutes and seconds, and hours once there are any', () => {
    expect(formatElapsed(5_000)).toBe('0:05');
    expect(formatElapsed(125_000)).toBe('2:05');
    expect(formatElapsed(3_729_000)).toBe('1:02:09');
    expect(formatElapsed(-1)).toBe('0:00');
  });
});

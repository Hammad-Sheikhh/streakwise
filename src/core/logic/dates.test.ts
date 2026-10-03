import { describe, expect, it } from 'vitest';

import { addDays, daysBetween, localDate, weekStart } from './dates';

describe('localDate', () => {
  it('uses Karachi time (UTC+5), not UTC', () => {
    // 19:30 UTC on Sunday is 00:30 on Monday in Karachi.
    expect(localDate(new Date('2026-10-04T19:30:00Z'))).toBe('2026-10-05');
    expect(localDate(new Date('2026-10-04T18:59:59Z'))).toBe('2026-10-04');
  });
});

describe('weekStart', () => {
  it('returns the Monday on or before the date', () => {
    expect(weekStart('2026-09-28')).toBe('2026-09-28'); // Monday
    expect(weekStart('2026-10-01')).toBe('2026-09-28'); // Thursday
    expect(weekStart('2026-10-04')).toBe('2026-09-28'); // Sunday
  });

  it('puts Sunday 23:30 and Monday 00:30 Karachi time in different weeks', () => {
    const sundayLate = localDate(new Date('2026-10-04T18:30:00Z')); // Sun 23:30 PKT
    const mondayEarly = localDate(new Date('2026-10-04T19:30:00Z')); // Mon 00:30 PKT
    expect(weekStart(sundayLate)).toBe('2026-09-28');
    expect(weekStart(mondayEarly)).toBe('2026-10-05');
  });

  it('crosses month and year boundaries', () => {
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
  });

  it.each(['2026-02-30', '2026-1-01', 'yesterday', ''])('rejects invalid date "%s"', (date) => {
    expect(() => weekStart(date)).toThrow(RangeError);
  });
});

describe('addDays and daysBetween', () => {
  it('adds and subtracts days across boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('counts whole days', () => {
    expect(daysBetween('2026-10-01', '2026-10-04')).toBe(3);
    expect(daysBetween('2026-10-04', '2026-10-01')).toBe(-3);
  });
});

import { describe, expect, it } from 'vitest';

import { lockedUntil } from './lockout';

const base = new Date('2026-10-03T10:00:00Z').getTime();
const at = (minutes: number) => new Date(base + minutes * 60_000);

describe('lockedUntil', () => {
  it('allows login with fewer than 5 failures', () => {
    expect(lockedUntil([at(0), at(1), at(2), at(3)], at(4))).toBeNull();
  });

  it('locks for 15 minutes from the 5th failure within 15 minutes', () => {
    const failures = [at(0), at(1), at(2), at(3), at(10)];
    expect(lockedUntil(failures, at(10))).toEqual(at(25));
    expect(lockedUntil(failures, at(24))).toEqual(at(25));
    expect(lockedUntil(failures, at(25))).toBeNull();
  });

  it('does not lock when the 5 failures are spread over more than 15 minutes', () => {
    expect(lockedUntil([at(0), at(4), at(8), at(12), at(16)], at(16))).toBeNull();
  });

  it('ignores order and uses the latest qualifying run', () => {
    const failures = [at(30), at(0), at(31), at(1), at(32), at(2), at(33), at(3), at(34), at(4)];
    expect(lockedUntil(failures, at(35))).toEqual(at(49));
  });
});

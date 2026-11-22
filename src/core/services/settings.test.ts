import { describe, expect, it } from 'vitest';

import { InMemoryRepository } from '../repo/InMemoryRepository.js';
import { updateSettings } from './settings.js';

const clock = () => new Date('2026-10-03T10:00:00Z');

describe('updateSettings (SET-1)', () => {
  it('saves the trimmed student name and the neglect threshold', async () => {
    const repo = new InMemoryRepository(clock);
    expect(await updateSettings(repo, { studentName: '  Demo Student ', neglectDays: 5 })).toEqual({
      studentName: 'Demo Student',
      neglectDays: 5,
      dayEndsAtMinutes: 0,
      lastExportAt: null,
      lastMcpCallAt: null,
    });
  });

  it.each([0, 15, 2.5])('rejects a neglect threshold of %s', async (neglectDays) => {
    const repo = new InMemoryRepository(clock);
    await expect(updateSettings(repo, { neglectDays })).rejects.toMatchObject({
      kind: 'validation',
    });
  });
});

describe('"My day ends at" (DAY-1)', () => {
  it('saves 00:00 to 06:00 in half-hour steps', async () => {
    const repo = new InMemoryRepository(clock);
    for (const minutes of [0, 30, 240, 360]) {
      expect(await updateSettings(repo, { dayEndsAtMinutes: minutes })).toMatchObject({
        dayEndsAtMinutes: minutes,
      });
    }
  });

  it.each([-30, 390, 45, 2.5])('rejects %s minutes', async (dayEndsAtMinutes) => {
    const repo = new InMemoryRepository(clock);
    await expect(updateSettings(repo, { dayEndsAtMinutes })).rejects.toMatchObject({
      kind: 'validation',
    });
  });
});

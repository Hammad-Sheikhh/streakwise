import { describe, expect, it } from 'vitest';

import { InMemoryRepository } from '../repo/InMemoryRepository';
import { updateSettings } from './settings';

const clock = () => new Date('2026-10-03T10:00:00Z');

describe('updateSettings (SET-1)', () => {
  it('saves the trimmed student name and the neglect threshold', async () => {
    const repo = new InMemoryRepository(clock);
    expect(await updateSettings(repo, { studentName: '  Demo Student ', neglectDays: 5 })).toEqual({
      studentName: 'Demo Student',
      neglectDays: 5,
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

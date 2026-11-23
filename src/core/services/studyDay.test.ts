import { beforeEach, describe, expect, it } from 'vitest';

import type { TreeNode } from '../domain/types.js';
import { InMemoryRepository } from '../repo/InMemoryRepository.js';
import { getDashboard } from './dashboard.js';
import { buildReport } from './reports.js';
import { seedIfEmpty } from './seed.js';
import { getHistory, logSession } from './sessions.js';

// DAY-4: with "My day ends at" 04:00, study at 01:50 on 23 Nov (Karachi) counts for 22 Nov.

let now: Date;
const clock = () => now;
let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
let repo: InMemoryRepository;
let maths: TreeNode;

beforeEach(async () => {
  now = new Date('2026-11-22T20:50:00Z'); // 01:50 on Monday 23 Nov in Karachi
  repo = new InMemoryRepository(clock);
  await seedIfEmpty(repo, newId);
  const node = (await repo.listNodes()).find((x) => x.name === 'Maths');
  if (!node) throw new Error('seed has no Maths');
  maths = node;
  await repo.updateSettings({ dayEndsAtMinutes: 240 });
});

describe('the study day (DAY-2, DAY-4)', () => {
  it('dates 01:50 as the day before, and the streak counts it there', async () => {
    const dashboard = await getDashboard(repo, clock);
    expect(dashboard.today).toBe('2026-11-22');
    await expect(
      logSession(repo, clock, newId, { nodeId: maths.id, studiedOn: '2026-11-23', minutes: 30 }),
    ).rejects.toMatchObject({ code: 'future_date' });

    await logSession(repo, clock, newId, {
      nodeId: maths.id,
      studiedOn: '2026-11-22',
      minutes: 45,
    });
    const after = await getDashboard(repo, clock);
    expect(after.todayMinutes).toBe(45);
    expect(after.streak.current).toBe(1);
    // Sunday's session stays in the week of Monday 16 Nov.
    expect(after.targets.find((t) => t.trackId === maths.parentId)?.minutes).toBe(45);
    expect((await getHistory(repo, clock)).days[0]?.date).toBe('2026-11-22');
  });

  it('moves to the next day at the cutoff', async () => {
    now = new Date('2026-11-22T23:00:00Z'); // 04:00 on 23 Nov
    expect((await getDashboard(repo, clock)).today).toBe('2026-11-23');
  });

  it('builds "today" reports for the study day', async () => {
    const report = await buildReport(repo, clock, { period: 'today' });
    expect(report.period).toMatchObject({ from: '2026-11-22', to: '2026-11-22' });
  });

  it('changes nothing with the default cutoff', async () => {
    await repo.updateSettings({ dayEndsAtMinutes: 0 });
    expect((await getDashboard(repo, clock)).today).toBe('2026-11-23');
  });
});

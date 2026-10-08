import { beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../domain/errors';
import type { TreeNode } from '../domain/types';
import { InMemoryRepository } from '../repo/InMemoryRepository';
import { seedIfEmpty } from './seed';
import { logSession } from './sessions';
import { addNode } from './structure';
import { getTrackOverview, TRACK_RECENT_SESSIONS } from './tracks';

// Saturday 2026-10-03, 15:00 in Karachi; the week started on Monday 2026-09-28.
const now = new Date('2026-10-03T10:00:00Z');
const clock = () => now;
let repo: InMemoryRepository;
let newId: () => string;

async function byName(name: string): Promise<TreeNode> {
  const node = (await repo.listNodes()).find((n) => n.name === name);
  if (!node) throw new Error(`no node ${name}`);
  return node;
}

beforeEach(async () => {
  repo = new InMemoryRepository(clock);
  let n = 0;
  newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  await seedIfEmpty(repo, newId);
});

describe('getTrackOverview (TRACK-1)', () => {
  it('rolls up time this week and all time, and lists the latest sessions', async () => {
    const exams = await byName('School Subjects');
    const maths = await byName('Maths');
    const chapter = await addNode(repo, newId, { parentId: maths.id, name: 'Chapter 3' });
    const log = (nodeId: string, studiedOn: string, minutes: number) =>
      logSession(repo, clock, newId, { nodeId, studiedOn, minutes });
    await log(chapter.id, '2026-10-02', 45);
    await log(maths.id, '2026-09-20', 60);
    await log((await byName('Practice')).id, '2026-10-02', 30); // another track

    const overview = await getTrackOverview(repo, clock, exams.id);
    const time = new Map(overview.nodes.map((n) => [n.nodeId, n]));
    expect(time.get(exams.id)).toMatchObject({ weekMinutes: 45, totalMinutes: 105 });
    expect(time.get(maths.id)).toMatchObject({ weekMinutes: 45, totalMinutes: 105 });
    expect(time.get(chapter.id)).toMatchObject({ weekMinutes: 45, totalMinutes: 45 });
    expect(overview.recentSessions.map((s) => s.minutes)).toEqual([45, 60]);
    expect(overview.today).toBe('2026-10-03');
  });

  it('caps recent sessions and rejects anything that isn’t a track', async () => {
    const maths = await byName('Maths');
    for (let day = 1; day <= TRACK_RECENT_SESSIONS + 2; day += 1) {
      const studiedOn = `2026-09-${String(day).padStart(2, '0')}`;
      await logSession(repo, clock, newId, { nodeId: maths.id, studiedOn, minutes: 10 });
    }
    const exams = await byName('School Subjects');
    const overview = await getTrackOverview(repo, clock, exams.id);
    expect(overview.recentSessions).toHaveLength(TRACK_RECENT_SESSIONS);
    expect(overview.recentSessions[0]?.studiedOn).toBe('2026-09-12');

    await expect(getTrackOverview(repo, clock, maths.id)).rejects.toBeInstanceOf(DomainError);
  });
});

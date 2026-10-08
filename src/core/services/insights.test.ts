import { beforeEach, describe, expect, it } from 'vitest';

import type { TreeNode } from '../domain/types';
import { InMemoryRepository } from '../repo/InMemoryRepository';
import { addDeadline } from './deadlines';
import { findGaps, getProgress } from './insights';
import { seedIfEmpty } from './seed';
import { listSessions, logSession } from './sessions';
import { addNode, updateNode } from './structure';

// The seed is created on 2026-09-20; then "now" is Wednesday 2026-09-30, 15:00 in Karachi.
let now = new Date('2026-09-20T06:00:00Z');
const clock = () => now;
let repo: InMemoryRepository;
let newId: () => string;

function sequentialIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

async function byName(name: string): Promise<TreeNode> {
  const node = (await repo.listNodes()).find((n) => n.name === name);
  if (!node) throw new Error(`no node ${name}`);
  return node;
}

const log = async (
  name: string,
  studiedOn: string,
  minutes = 30,
  source: 'app' | 'claude' = 'app',
) =>
  logSession(repo, clock, newId, { nodeId: (await byName(name)).id, studiedOn, minutes }, source);

beforeEach(async () => {
  now = new Date('2026-09-20T06:00:00Z');
  repo = new InMemoryRepository(clock);
  newId = sequentialIds();
  await seedIfEmpty(repo, newId);
  now = new Date('2026-09-30T10:00:00Z');
});

describe('getProgress', () => {
  it('reports weekly targets, pace, streaks, syllabus, and upcoming deadlines', async () => {
    const german = await byName('Exam Prep');
    const maths = await byName('Maths');
    await updateNode(repo, clock, german.id, { weeklyTargetMinutes: 420 });
    const topic = await addNode(repo, newId, { parentId: maths.id, name: 'Chapter 1' });
    await addNode(repo, newId, { parentId: maths.id, name: 'Chapter 2' });
    await log('Flashcards', '2026-09-29', 60);
    await log('Practice', '2026-09-30', 90);
    await log('Chapter 1', '2026-09-27', 45); // last week (Sunday)
    await addDeadline(repo, newId, { nodeId: maths.id, title: 'Maths exam', dueOn: '2026-10-10' });
    await addDeadline(repo, newId, { nodeId: maths.id, title: 'Past', dueOn: '2026-09-01' });

    const progress = await getProgress(repo, clock);
    expect(progress).toMatchObject({
      today: '2026-09-30',
      weekStart: '2026-09-28',
      todayMinutes: 90,
      streak: { current: 2, longest: 2 },
    });
    expect(progress.tracks[0]).toEqual({
      id: german.id,
      name: 'Exam Prep',
      weekMinutes: 150,
      weeklyTargetMinutes: 420,
      targetPercent: 36,
      // Expected by Wednesday: 420 × 3 ÷ 7 = 180; 150 ≥ 0.75 × 180.
      behindPace: false,
      syllabusPercent: null,
      subtasks: [
        {
          id: (await byName('Flashcards')).id,
          name: 'Flashcards',
          weekMinutes: 60,
          syllabusPercent: null,
        },
        {
          id: (await byName('Practice')).id,
          name: 'Practice',
          weekMinutes: 90,
          syllabusPercent: null,
        },
      ],
    });
    expect(progress.tracks[1]?.subtasks[0]).toMatchObject({
      name: 'Maths',
      weekMinutes: 0,
      syllabusPercent: 0,
    });
    expect(topic.topicStatus).toBe('not_started');
    expect(progress.upcomingDeadlines).toHaveLength(1);
    expect(progress.upcomingDeadlines[0]).toMatchObject({
      title: 'Maths exam',
      path: 'School Subjects > Maths',
      daysLeft: 10,
      syllabusLeftPercent: 100,
    });
  });

  it('leaves out archived tracks', async () => {
    await updateNode(repo, clock, (await byName('Online Course')).id, { archived: true });
    const progress = await getProgress(repo, clock);
    expect(progress.tracks.map((t) => t.name)).toEqual(['Exam Prep', 'School Subjects']);
  });
});

describe('findGaps', () => {
  it('lists neglected nodes, tracks behind pace, and topics not started', async () => {
    const german = await byName('Exam Prep');
    const english = await byName('English');
    await updateNode(repo, clock, german.id, { weeklyTargetMinutes: 420 });
    await addNode(repo, newId, { parentId: english.id, name: 'Essay writing' });
    await log('Flashcards', '2026-09-30', 60);
    await log('Practice', '2026-09-30', 30);
    await log('Maths', '2026-09-29', 30);

    const gaps = await findGaps(repo, clock);
    expect(gaps.today).toBe('2026-09-30');
    expect(gaps.neglectDays).toBe(3);
    // Seeded 10 days ago and never logged; Maths and Exam Prep were studied recently.
    expect(gaps.neglected).toEqual([
      { id: english.id, path: 'School Subjects > English', days: 10, neverLogged: true },
      {
        id: (await byName('Online Course')).id,
        path: 'Online Course',
        days: 10,
        neverLogged: true,
      },
    ]);
    // 90 minutes is below 0.75 × 180.
    expect(gaps.behindPace).toEqual([
      {
        id: german.id,
        name: 'Exam Prep',
        weekMinutes: 90,
        weeklyTargetMinutes: 420,
        expectedByNowMinutes: 180,
      },
    ]);
    expect(gaps.topicsNotStarted).toEqual([
      {
        id: (await byName('Essay writing')).id,
        path: 'School Subjects > English > Essay writing',
      },
    ]);
  });
});

describe('listSessions', () => {
  it('filters by node subtree, dates, and source, newest first', async () => {
    await log('Flashcards', '2026-09-25', 10);
    await log('Practice', '2026-09-28', 20, 'claude');
    await log('Maths', '2026-09-29', 30);
    await log('Practice', '2026-09-30', 40);

    const german = await byName('Exam Prep');
    const all = await listSessions(repo, { nodeId: german.id });
    expect(all.sessions.map((s) => s.minutes)).toEqual([40, 20, 10]);
    expect(all.truncated).toBe(false);

    const ranged = await listSessions(repo, { from: '2026-09-28', to: '2026-09-29' });
    expect(ranged.sessions.map((s) => s.minutes)).toEqual([30, 20]);

    const claude = await listSessions(repo, { source: 'claude' });
    expect(claude.sessions.map((s) => s.minutes)).toEqual([20]);
  });

  it('caps the list and says when it was truncated', async () => {
    for (let i = 0; i < 3; i++) await log('Maths', '2026-09-29', 10 + i);
    const page = await listSessions(repo, { limit: 2 });
    expect(page.sessions).toHaveLength(2);
    expect(page.truncated).toBe(true);
    await expect(listSessions(repo, { limit: 201 })).rejects.toThrow('at most 200');
    await expect(listSessions(repo, { from: '2026-09-30', to: '2026-09-01' })).rejects.toThrow(
      '"from" must not be after "to"',
    );
  });
});

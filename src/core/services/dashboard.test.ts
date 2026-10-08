import { beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../domain/errors';
import type { TreeNode } from '../domain/types';
import { InMemoryRepository } from '../repo/InMemoryRepository';
import { getDashboard } from './dashboard';
import { addDeadline, deleteDeadline, listDeadlines, updateDeadline } from './deadlines';
import { seedIfEmpty } from './seed';
import { logSession } from './sessions';
import { addNode, updateNode } from './structure';
import { completeTask, createTask } from './tasks';

// The seed is created on 2026-09-20; "now" moves per test.
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

const log = async (name: string, studiedOn: string, minutes = 30) =>
  logSession(repo, clock, newId, { nodeId: (await byName(name)).id, studiedOn, minutes });

beforeEach(async () => {
  now = new Date('2026-09-20T06:00:00Z');
  repo = new InMemoryRepository(clock);
  newId = sequentialIds();
  await seedIfEmpty(repo, newId);
  // Saturday 2026-10-03, 15:00 in Karachi.
  now = new Date('2026-10-03T10:00:00Z');
});

describe('getDashboard (DASH-1)', () => {
  it('totals today, this week per track, and streaks', async () => {
    const examPrep = await byName('Exam Prep');
    await updateNode(repo, clock, examPrep.id, { weeklyTargetMinutes: 480 });
    await log('Flashcards', '2026-10-03', 45);
    await log('Practice', '2026-10-02', 60);
    await log('Maths', '2026-10-01', 30);
    await log('Maths', '2026-09-27', 120); // last week: not in this week's total

    const dashboard = await getDashboard(repo, clock);
    expect(dashboard.today).toBe('2026-10-03');
    expect(dashboard.todayMinutes).toBe(45);
    expect(dashboard.streak).toEqual({ current: 3, longest: 3 });
    expect(dashboard.targets).toEqual([
      { trackId: examPrep.id, minutes: 105, targetMinutes: 480 },
      { trackId: (await byName('School Subjects')).id, minutes: 30, targetMinutes: null },
      { trackId: (await byName('Online Course')).id, minutes: 0, targetMinutes: null },
    ]);
  });

  it('resets the week on Monday, Karachi time (TGT-2)', async () => {
    now = new Date('2026-10-04T18:30:00Z'); // Sunday 23:30 in Karachi
    await log('Maths', '2026-10-04', 60);
    const sunday = await getDashboard(repo, clock);
    expect(sunday.targets.find((t) => t.minutes > 0)?.minutes).toBe(60);

    now = new Date('2026-10-04T19:30:00Z'); // Monday 00:30 in Karachi
    const monday = await getDashboard(repo, clock);
    expect(monday.targets.every((t) => t.minutes === 0)).toBe(true);
  });

  it('lists neglected tracks and subtasks with the configured threshold (NEG-1)', async () => {
    await log('Flashcards', '2026-10-03');
    await log('Practice', '2026-10-03');
    await log('Maths', '2026-09-29');
    await log('Online Course', '2026-10-02');

    const dashboard = await getDashboard(repo, clock);
    const names = await Promise.all(
      dashboard.neglect.map(async (w) => {
        const node = (await repo.listNodes()).find((n) => n.id === w.nodeId);
        return [node?.name, w.days, w.neverLogged];
      }),
    );
    expect(names).toEqual([
      ['English', 13, true],
      ['School Subjects', 4, false],
      ['Maths', 4, false],
    ]);

    await repo.updateSettings({ neglectDays: 5 });
    expect((await getDashboard(repo, clock)).neglect).toHaveLength(1);
  });

  it('shows the next 3 upcoming deadlines with days left and syllabus left (DEAD-2/3)', async () => {
    const maths = await byName('Maths');
    const algebra = await addNode(repo, newId, { parentId: maths.id, name: 'Algebra' });
    await addNode(repo, newId, { parentId: maths.id, name: 'Geometry' });
    await repo.updateNode(algebra.id, { topicStatus: 'done', topicDoneAt: now.toISOString() });

    const add = (title: string, dueOn: string, nodeId = maths.id) =>
      addDeadline(repo, newId, { nodeId, title, dueOn });
    await add('Past exam', '2026-10-02');
    await add('Maths exam', '2026-11-13');
    await add('Mock', '2026-10-03');
    const examPrep = await byName('Exam Prep');
    await add('A1 test', '2026-10-20', examPrep.id);
    await add('Far away', '2027-01-01');

    const { deadlines } = await getDashboard(repo, clock);
    expect(deadlines.map((d) => [d.title, d.daysLeft, d.syllabusLeftPercent])).toEqual([
      ['Mock', 0, 50],
      ['A1 test', 17, null],
      ['Maths exam', 41, 50],
    ]);
  });

  it('returns the heatmap range and only days that have sessions (HEAT-1)', async () => {
    await log('Maths', '2026-10-03', 20);
    await log('English', '2026-10-03', 15);
    await log('Maths', '2025-01-01', 60); // older than 12 months
    const { heatmap } = await getDashboard(repo, clock);
    expect(heatmap.start).toBe('2025-09-29');
    expect(heatmap.end).toBe('2026-10-03');
    expect(heatmap.days).toEqual([{ date: '2026-10-03', minutes: 35 }]);
  });

  it('lists tasks due this week, overdue first and weekly ones last (TASK-7)', async () => {
    const maths = await byName('Maths');
    await createTask(repo, newId, { nodeId: maths.id, title: 'Sunday', dueOn: '2026-10-04' });
    await createTask(repo, newId, { nodeId: maths.id, title: 'Late', dueOn: '2026-10-01' });
    await createTask(repo, newId, { nodeId: maths.id, title: 'Next week', dueOn: '2026-10-05' });
    const done = await createTask(repo, newId, {
      nodeId: maths.id,
      title: 'Done',
      dueOn: '2026-10-02',
    });
    await completeTask(repo, clock, newId, done.id, {});

    const { tasksDue } = await getDashboard(repo, clock);
    expect(tasksDue.map((i) => [i.task.title, i.overdue])).toEqual([
      ['Late', true],
      ['Sunday', false],
      ['Weekly self-test', false],
    ]);
  });

  it('leaves archived tracks out of targets and warnings', async () => {
    const exams = await byName('School Subjects');
    await updateNode(repo, clock, exams.id, { archived: true });
    const dashboard = await getDashboard(repo, clock);
    expect(dashboard.targets.map((t) => t.trackId)).not.toContain(exams.id);
    expect(dashboard.neglect.map((w) => w.nodeId)).not.toContain(exams.id);
  });
});

describe('weekly targets (TGT-1)', () => {
  it('accepts half-hour steps on tracks only; 0 clears the target', async () => {
    const examPrep = await byName('Exam Prep');
    expect(
      (await updateNode(repo, clock, examPrep.id, { weeklyTargetMinutes: 90 })).weeklyTargetMinutes,
    ).toBe(90);
    expect(
      (await updateNode(repo, clock, examPrep.id, { weeklyTargetMinutes: 0 })).weeklyTargetMinutes,
    ).toBeNull();
    await expect(
      updateNode(repo, clock, examPrep.id, { weeklyTargetMinutes: 45 }),
    ).rejects.toMatchObject({ kind: 'validation' });
    const maths = await byName('Maths');
    await expect(
      updateNode(repo, clock, maths.id, { weeklyTargetMinutes: 60 }),
    ).rejects.toMatchObject({ code: 'target_tracks_only' });
  });
});

describe('deadlines (DEAD-1)', () => {
  it('adds, edits, lists by date, and deletes', async () => {
    const maths = await byName('Maths');
    const english = await byName('English');
    const late = await addDeadline(repo, newId, {
      nodeId: maths.id,
      title: '  Final  ',
      dueOn: '2026-12-01',
    });
    await addDeadline(repo, newId, { nodeId: english.id, title: 'Essay', dueOn: '2026-11-01' });
    expect(late.title).toBe('Final');
    expect((await listDeadlines(repo)).map((d) => d.title)).toEqual(['Essay', 'Final']);

    await updateDeadline(repo, late.id, { dueOn: '2026-10-15', nodeId: english.id });
    expect((await listDeadlines(repo)).map((d) => d.title)).toEqual(['Final', 'Essay']);

    await deleteDeadline(repo, late.id);
    expect(await listDeadlines(repo)).toHaveLength(1);
    await expect(deleteDeadline(repo, late.id)).rejects.toBeInstanceOf(DomainError);
  });

  it('validates the title and the node, and blocks deleting the node', async () => {
    const maths = await byName('Maths');
    await expect(
      addDeadline(repo, newId, { nodeId: maths.id, title: '', dueOn: '2026-11-01' }),
    ).rejects.toMatchObject({ kind: 'validation' });
    await updateNode(repo, clock, maths.id, { archived: true });
    await expect(
      addDeadline(repo, newId, { nodeId: maths.id, title: 'X', dueOn: '2026-11-01' }),
    ).rejects.toMatchObject({ code: 'node_archived' });

    const english = await byName('English');
    await addDeadline(repo, newId, { nodeId: english.id, title: 'Essay', dueOn: '2026-11-01' });
    await expect(repo.deleteNodeTree(english.id)).rejects.toMatchObject({ code: 'node_in_use' });
  });
});

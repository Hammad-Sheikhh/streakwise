import { beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../domain/errors';
import type { TreeNode } from '../domain/types';
import { periodAsOf, resolvePeriod } from '../logic/reportPeriod';
import { InMemoryRepository } from '../repo/InMemoryRepository';
import { addDeadline } from './deadlines';
import { buildReport } from './reports';
import { addScore } from './scores';
import { seedIfEmpty } from './seed';
import { logSession } from './sessions';
import { addNode, setTopicStatus, updateNode } from './structure';
import { completeTask } from './tasks';
import { updateSettings } from './settings';

// The seed is created on 2026-09-20; "now" is Saturday 2026-10-03, 15:00 in Karachi, so this
// week is Mon 28 Sep – Sun 4 Oct and last week is Mon 21 – Sun 27 Sep.
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

const log = async (name: string, studiedOn: string, minutes = 30, note?: string) =>
  logSession(repo, clock, newId, { nodeId: (await byName(name)).id, studiedOn, minutes, note });

beforeEach(async () => {
  now = new Date('2026-09-20T06:00:00Z');
  repo = new InMemoryRepository(clock);
  newId = sequentialIds();
  await seedIfEmpty(repo, newId);
  now = new Date('2026-10-03T10:00:00Z');
});

describe('resolvePeriod (REP-1–3)', () => {
  const today = '2026-10-03';

  it('covers today, yesterday, this week, and last week', () => {
    expect(resolvePeriod({ period: 'today' }, today)).toMatchObject({
      from: today,
      to: today,
      isWeek: false,
      label: 'Today',
    });
    expect(resolvePeriod({ period: 'yesterday' }, today)).toMatchObject({
      from: '2026-10-02',
      to: '2026-10-02',
    });
    expect(resolvePeriod({ period: 'this_week' }, today)).toMatchObject({
      from: '2026-09-28',
      to: '2026-10-04',
      isWeek: true,
    });
    expect(resolvePeriod({ period: 'last_week' }, today)).toMatchObject({
      from: '2026-09-21',
      to: '2026-09-27',
      isWeek: true,
    });
  });

  it('treats Monday as the first day of the week', () => {
    expect(resolvePeriod({ period: 'this_week' }, '2026-09-28').from).toBe('2026-09-28');
    expect(resolvePeriod({ period: 'last_week' }, '2026-10-04').from).toBe('2026-09-21');
  });

  it('checks custom ranges: order, future start, and at most 92 days', () => {
    expect(
      resolvePeriod({ period: 'custom', from: '2026-07-04', to: '2026-10-03' }, today),
    ).toMatchObject({ from: '2026-07-04', to: '2026-10-03', isWeek: false });
    expect(() =>
      resolvePeriod({ period: 'custom', from: '2026-07-03', to: '2026-10-03' }, today),
    ).toThrow(/at most 92 days/);
    expect(() =>
      resolvePeriod({ period: 'custom', from: '2026-10-03', to: '2026-10-01' }, today),
    ).toThrow(DomainError);
    expect(() =>
      resolvePeriod({ period: 'custom', from: '2026-10-05', to: '2026-10-06' }, today),
    ).toThrow(/future/);
  });

  it('judges an unfinished period as of today', () => {
    expect(periodAsOf({ to: '2026-10-04' }, '2026-10-03')).toBe('2026-10-03');
    expect(periodAsOf({ to: '2026-09-27' }, '2026-10-03')).toBe('2026-09-27');
  });
});

describe('buildReport (REP-4, REP-9)', () => {
  it('totals the week with time per track and subtask and % of target', async () => {
    await updateNode(repo, clock, (await byName('Exam Prep')).id, {
      weeklyTargetMinutes: 480,
    });
    await updateSettings(repo, { studentName: 'Demo Student' });
    await log('Flashcards', '2026-09-28', 60);
    await log('Practice', '2026-09-29', 90);
    await log('Flashcards', '2026-10-03', 30);
    await log('Maths', '2026-10-02', 45);
    await log('Maths', '2026-09-27', 120); // last week

    const report = await buildReport(repo, clock, { period: 'this_week' });
    expect(report.studentName).toBe('Demo Student');
    expect(report.period).toMatchObject({ label: 'This week', from: '2026-09-28', isWeek: true });
    expect(report.generatedAt).toBe(now.toISOString());
    expect(report.totals).toEqual({
      minutes: 225,
      sessions: 4,
      activeDays: 4,
      days: 6, // Monday to Saturday so far
      streak: 2, // Fri, Sat (Thu has nothing)
    });
    expect(report.tracks[0]).toEqual({
      name: 'Exam Prep',
      color: 'amber',
      minutes: 180,
      targetMinutes: 480,
      targetPercent: 38,
      subtasks: [
        { name: 'Flashcards', minutes: 90 },
        { name: 'Practice', minutes: 90 },
      ],
    });
    expect(report.tracks[1]).toMatchObject({
      name: 'School Subjects',
      minutes: 45,
      targetMinutes: null,
      subtasks: [{ name: 'Maths', minutes: 45 }],
    });
    expect(report.tracks[2]).toMatchObject({ name: 'Online Course', minutes: 0 });
  });

  it('leaves out targets for periods that are not weeks', async () => {
    await updateNode(repo, clock, (await byName('Exam Prep')).id, {
      weeklyTargetMinutes: 480,
    });
    await log('Flashcards', '2026-10-03', 60);
    const report = await buildReport(repo, clock, { period: 'today' });
    expect(report.tracks[0]).toMatchObject({
      minutes: 60,
      targetMinutes: null,
      targetPercent: null,
    });
    expect(report.totals).toMatchObject({ days: 1, activeDays: 1, streak: 1 });
  });

  it('lists topics studied and marked done in the period', async () => {
    const maths = await byName('Maths');
    const ch1 = await addNode(repo, newId, { parentId: maths.id, name: 'Chapter 1' });
    await addNode(repo, newId, { parentId: maths.id, name: 'Chapter 2' });
    now = new Date('2026-09-25T10:00:00Z'); // last week
    await setTopicStatus(repo, clock, ch1.id, { status: 'done' });
    now = new Date('2026-10-03T10:00:00Z');
    await log('Chapter 2', '2026-10-01', 40);
    await setTopicStatus(repo, clock, (await byName('Chapter 2')).id, { status: 'done' });

    const thisWeek = await buildReport(repo, clock, { period: 'this_week' });
    expect(thisWeek.topicsStudied).toEqual([
      { path: 'School Subjects > Maths > Chapter 2', minutes: 40 },
    ]);
    expect(thisWeek.topicsDone).toEqual([
      { path: 'School Subjects > Maths > Chapter 2', doneOn: '2026-10-03' },
    ]);
    const lastWeek = await buildReport(repo, clock, { period: 'last_week' });
    expect(lastWeek.topicsDone).toEqual([
      { path: 'School Subjects > Maths > Chapter 1', doneOn: '2026-09-25' },
    ]);
  });

  it('lists completed tasks with their scores, and scores recorded', async () => {
    const weekly = (await repo.listTasks())[0];
    if (!weekly) throw new Error('seed task missing');
    await completeTask(repo, clock, newId, weekly.id, {
      score: 18,
      maxScore: 20,
      kind: 'revision',
    });
    await addScore(repo, clock, newId, {
      nodeId: (await byName('Maths')).id,
      kind: 'past_paper',
      title: '2023 Paper 1',
      takenOn: '2026-09-30',
      score: 62,
      maxScore: 80,
    });
    await addScore(repo, clock, newId, {
      nodeId: (await byName('Maths')).id,
      kind: 'quiz',
      title: 'Old quiz',
      takenOn: '2026-09-20',
      score: 5,
      maxScore: 10,
    });

    const report = await buildReport(repo, clock, { period: 'this_week' });
    expect(report.tasksCompleted).toEqual([
      {
        title: 'Weekly self-test',
        path: 'Exam Prep',
        completedOn: '2026-10-03',
        score: { score: 18, maxScore: 20, percent: 90 },
      },
    ]);
    expect(report.scores.map((s) => [s.date, s.title, s.percent])).toEqual([
      ['2026-09-30', '2023 Paper 1', 77.5],
      ['2026-10-03', 'Weekly self-test', 90],
    ]);
  });

  it('judges neglect and the streak at the end of a past period', async () => {
    await log('Flashcards', '2026-09-24');
    await log('Flashcards', '2026-09-25');
    await log('Practice', '2026-09-26');
    await log('Maths', '2026-10-03'); // after last week: must not count

    const report = await buildReport(repo, clock, { period: 'last_week' });
    expect(report.totals).toMatchObject({ days: 7, activeDays: 3, streak: 3 });
    // As of Sun 27 Sep: Maths and English were never studied (created 20 Sep: 7 days).
    expect(report.neglected).toEqual([
      { path: 'School Subjects', days: 7, neverLogged: true },
      { path: 'School Subjects > Maths', days: 7, neverLogged: true },
      { path: 'School Subjects > English', days: 7, neverLogged: true },
      { path: 'Online Course', days: 7, neverLogged: true },
    ]);
  });

  it('includes notes only when asked (REP-5)', async () => {
    await log('Flashcards', '2026-10-01', 30, 'Dative case');
    await log('Practice', '2026-10-02', 30);
    const without = await buildReport(repo, clock, { period: 'this_week' });
    expect(without.includesNotes).toBe(false);
    expect(without.notes).toEqual([]);

    const withNotes = await buildReport(repo, clock, { period: 'this_week', includeNotes: true });
    expect(withNotes.includesNotes).toBe(true);
    expect(withNotes.notes).toEqual([
      {
        date: '2026-10-01',
        path: 'Exam Prep > Flashcards',
        minutes: 30,
        note: 'Dative case',
      },
    ]);
  });

  it('shows the next 3 deadlines from today', async () => {
    const maths = await byName('Maths');
    for (const [title, dueOn] of [
      ['Past', '2026-10-01'],
      ['A', '2026-10-10'],
      ['B', '2026-11-01'],
      ['C', '2026-12-01'],
      ['D', '2027-01-01'],
    ]) {
      await addDeadline(repo, newId, { nodeId: maths.id, title: title ?? '', dueOn: dueOn ?? '' });
    }
    const report = await buildReport(repo, clock, { period: 'last_week' });
    expect(report.deadlines.map((d) => [d.title, d.daysLeft, d.path])).toEqual([
      ['A', 7, 'School Subjects > Maths'],
      ['B', 29, 'School Subjects > Maths'],
      ['C', 59, 'School Subjects > Maths'],
    ]);
  });

  it('keeps archived tracks only when they have time in the period', async () => {
    const claude = await byName('Online Course');
    await log('Online Course', '2026-10-01', 20);
    await updateNode(repo, clock, claude.id, { archived: true });
    expect((await buildReport(repo, clock, { period: 'this_week' })).tracks).toHaveLength(3);
    expect((await buildReport(repo, clock, { period: 'last_week' })).tracks).toHaveLength(2);
  });

  it('rejects invalid queries', async () => {
    await expect(buildReport(repo, clock, { period: 'custom' })).rejects.toThrow(DomainError);
    await expect(buildReport(repo, clock, { period: 'month' as 'today' })).rejects.toThrow(
      DomainError,
    );
  });
});

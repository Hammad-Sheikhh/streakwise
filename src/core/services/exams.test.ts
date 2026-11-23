import { beforeEach, describe, expect, it } from 'vitest';

import type { TreeNode } from '../domain/types.js';
import { InMemoryRepository } from '../repo/InMemoryRepository.js';
import { dailyPrune, recordChanges } from '../repo/RecordingRepository.js';
import type { Repository } from '../repo/Repository.js';
import { listRecentChanges, undoChange } from './changes.js';
import { getDashboard } from './dashboard.js';
import { addDeadline, deleteDeadline } from './deadlines.js';
import { addExamTarget, deleteExamTarget, getExamView, updateExamTarget } from './exams.js';
import { addMistake, getMistakesOverview } from './mistakes.js';
import { addScore } from './scores.js';
import { seedIfEmpty } from './seed.js';
import { logSession } from './sessions.js';
import { updateNode } from './structure.js';
import { createTask } from './tasks.js';

// EXAM-1–6, TODAY-1–4, ERR-3/4/6 on the in-memory store. Now: Wed 25 Nov 2026, 15:00 Karachi.

let now: Date;
const clock = () => now;
let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
let store: InMemoryRepository;
let repo: Repository;
let subjects: TreeNode;
let maths: TreeNode;
let english: TreeNode;

beforeEach(async () => {
  now = new Date('2026-11-25T10:00:00Z');
  store = new InMemoryRepository(clock);
  await seedIfEmpty(store, newId);
  repo = recordChanges(store, { source: 'app', newId });
  const nodes = await store.listNodes();
  const find = (name: string) => {
    const node = nodes.find((x) => x.name === name);
    if (!node) throw new Error(`seed has no ${name}`);
    return node;
  };
  subjects = find('School Subjects');
  maths = find('Maths');
  english = find('English');
});

const exam = (title: string, dueOn: string) =>
  addDeadline(repo, newId, { nodeId: subjects.id, title, dueOn, isExam: true });

describe('the exam view (EXAM-2–6)', () => {
  it('is empty without exams', async () => {
    await addDeadline(repo, newId, { nodeId: subjects.id, title: 'Essay', dueOn: '2026-12-01' });
    expect(await getExamView(repo, clock)).toEqual({ today: '2026-11-25', exams: [], exam: null });
  });

  it('opens on the next upcoming exam and lists past ones after it', async () => {
    const past = await exam('Mocks round 1', '2026-11-01');
    const later = await exam('Finals', '2027-01-15');
    const next = await exam('Prelims', '2026-12-18');
    const view = await getExamView(repo, clock);
    expect(view.exams.map((e) => [e.deadlineId, e.daysLeft])).toEqual([
      [next.id, 23],
      [later.id, 51],
      [past.id, -24],
    ]);
    expect(view.exam?.summary.deadlineId).toBe(next.id);
    expect((await getExamView(repo, clock, past.id)).exam?.summary.title).toBe('Mocks round 1');
    await expect(getExamView(repo, clock, maths.id)).rejects.toMatchObject({
      code: 'exam_not_found',
    });
  });

  it('shows modules, mock rows, and their targets from the subtree’s scores', async () => {
    const finals = await exam('Finals', '2026-12-18');
    await addExamTarget(repo, newId, finals.id, {
      label: 'Mock 1',
      targetOn: '2026-11-20',
      minPercent: 70,
    });
    for (const [nodeId, value] of [
      [maths.id, 12],
      [english.id, 16],
    ] as const) {
      await addScore(repo, clock, newId, {
        nodeId,
        kind: 'mock_test',
        title: 'Mock 1',
        takenOn: '2026-11-20',
        score: value,
        maxScore: 20,
      });
    }
    const view = await getExamView(repo, clock);
    expect(view.exam?.modules.map((m) => m.name)).toEqual(['Maths', 'English']);
    expect(view.exam?.mocks).toEqual([
      expect.objectContaining({
        title: 'Mock 1',
        average: 70,
        target: { label: 'Mock 1', minPercent: 70 },
        cells: {
          [maths.id]: expect.objectContaining({ percent: 60 }),
          [english.id]: expect.objectContaining({ percent: 80 }),
        },
      }),
    ]);
  });

  it('hides exams on archived parts of the tree', async () => {
    await exam('Finals', '2026-12-18');
    await updateNode(repo, clock, subjects.id, { archived: true });
    expect((await getExamView(repo, clock)).exams).toEqual([]);
  });
});

describe('exam targets (EXAM-3)', () => {
  it('adds, edits, and deletes targets, only on exams', async () => {
    const finals = await exam('Finals', '2026-12-18');
    const target = await addExamTarget(repo, newId, finals.id, {
      label: ' Mock 1 ',
      targetOn: '2026-12-01',
      minPercent: 60,
    });
    expect(target).toMatchObject({ label: 'Mock 1', minPercent: 60 });
    expect(await updateExamTarget(repo, target.id, { minPercent: 65 })).toMatchObject({
      minPercent: 65,
    });
    await expect(
      addExamTarget(repo, newId, finals.id, {
        label: 'X',
        targetOn: '2026-12-01',
        minPercent: 101,
      }),
    ).rejects.toMatchObject({ kind: 'validation' });
    const essay = await addDeadline(repo, newId, {
      nodeId: maths.id,
      title: 'Essay',
      dueOn: '2026-12-01',
    });
    await expect(
      addExamTarget(repo, newId, essay.id, { label: 'X', targetOn: '2026-12-01', minPercent: 50 }),
    ).rejects.toMatchObject({ code: 'not_an_exam' });
    await deleteExamTarget(repo, target.id);
    expect(await store.listExamTargets()).toEqual([]);
  });

  it('records target changes and brings targets back with an undone deadline delete', async () => {
    const finals = await exam('Finals', '2026-12-18');
    const target = await addExamTarget(repo, newId, finals.id, {
      label: 'Mock 1',
      targetOn: '2026-12-01',
      minPercent: 60,
    });
    await updateExamTarget(repo, target.id, { minPercent: 80 });
    const [edit] = await listRecentChanges(repo, clock);
    expect(edit?.summary).toBe('Edited target · Mock 1 · 80% by Tue 1 Dec 2026');
    await undoChange(repo, clock, edit?.id ?? '');
    expect((await store.listExamTargets())[0]?.minPercent).toBe(60);

    await deleteDeadline(repo, finals.id);
    expect(await store.listExamTargets()).toEqual([]);
    const [deleted] = await listRecentChanges(repo, clock);
    await undoChange(repo, clock, deleted?.id ?? '');
    expect(await store.listExamTargets()).toEqual([expect.objectContaining({ id: target.id })]);
  });
});

describe('the Today card on Home (TODAY-1–4)', () => {
  it("shows today's task with sub-tasks, today's minutes, and the pace", async () => {
    await updateNode(repo, clock, subjects.id, { weeklyTargetMinutes: 600 });
    const day = await createTask(repo, newId, {
      nodeId: maths.id,
      title: 'Day 3',
      description: 'Reading part 1',
      dueOn: '2026-11-25',
    });
    await createTask(repo, newId, { nodeId: maths.id, parentTaskId: day.id, title: 'Part A' });
    await logSession(repo, clock, newId, {
      nodeId: maths.id,
      studiedOn: '2026-11-25',
      minutes: 50,
    });
    await logSession(repo, clock, newId, {
      nodeId: english.id,
      studiedOn: '2026-11-23',
      minutes: 50,
    });

    const { todayCard } = await getDashboard(repo, clock);
    expect(todayCard.task?.task.title).toBe('Day 3');
    expect(todayCard.subtasks.map((i) => i.task.title)).toEqual(['Part A']);
    expect(todayCard.minutes).toEqual([{ nodeId: maths.id, minutes: 50 }]);
    // 600 - 100 = 500 over Wed–Sun (5 days).
    expect(todayCard.pace).toEqual([
      { trackId: subjects.id, minutes: 100, targetMinutes: 600, neededPerDay: 100, met: false },
    ]);
  });

  it('counts mistakes due today (ERR-6)', async () => {
    await addMistake(repo, clock, newId, { nodeId: maths.id, text: 'a', createdOn: '2026-11-20' });
    await addMistake(repo, clock, newId, { nodeId: maths.id, text: 'b' });
    expect((await getDashboard(repo, clock)).mistakesDue).toBe(1);
  });
});

describe('the Mistakes screen (ERR-3, ERR-4)', () => {
  it('splits due mistakes from all of them and counts per module', async () => {
    const topic = await store.insertNode({
      id: newId(),
      parentId: maths.id,
      name: 'Algebra',
      color: null,
      sortOrder: 0,
      topicStatus: 'not_started',
    });
    await addMistake(repo, clock, newId, { nodeId: topic.id, text: 'a', createdOn: '2026-11-20' });
    await addMistake(repo, clock, newId, { nodeId: maths.id, text: 'b' });
    const overview = await getMistakesOverview(repo, clock);
    expect(overview.due.map((m) => m.text)).toEqual(['a']);
    expect(overview.all).toHaveLength(2);
    expect(overview.modules).toEqual([{ moduleId: maths.id, open: 2, learned: 0 }]);
  });
});

describe('history clean-up (UNDO-7)', () => {
  it('removes entries older than 30 days, at most once a day', async () => {
    const state = new Map<string, string>();
    const pruning = recordChanges(store, {
      source: 'app',
      newId,
      pruneBefore: dailyPrune(clock, 'u', state),
    });
    await logSession(pruning, clock, newId, {
      nodeId: maths.id,
      studiedOn: '2026-11-25',
      minutes: 5,
    });
    now = new Date('2026-12-26T10:00:00Z');
    await logSession(pruning, clock, newId, {
      nodeId: maths.id,
      studiedOn: '2026-12-26',
      minutes: 5,
    });
    const kept = await store.listChanges({ since: '2000-01-01T00:00:00.000Z', limit: 10 });
    expect(kept.map((c) => c.summary)).toEqual(['Logged 5m · School Subjects > Maths']);
    expect(state.get('u')).toBe('2026-12-26');
  });
});

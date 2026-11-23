import { beforeEach, describe, expect, it } from 'vitest';

import type { DataExport, TreeNode } from '../domain/types.js';
import { InMemoryRepository } from '../repo/InMemoryRepository.js';
import { recordChanges } from '../repo/RecordingRepository.js';
import type { Repository } from '../repo/Repository.js';
import { parseBackup, restoreFromBackup, summarizeBackup } from './backup.js';
import { listRecentChanges } from './changes.js';
import { addDeadline } from './deadlines.js';
import { addExamTarget } from './exams.js';
import { exportData } from './exports.js';
import { addMistake } from './mistakes.js';
import { seedIfEmpty } from './seed.js';
import { logSession } from './sessions.js';
import { createShare } from './shares.js';
import { completeTask, createTask } from './tasks.js';

// DATA-2–4: export format 2, and restore from format 1 or 2 (validate, replace, new ids).

let now: Date;
const clock = () => now;
let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
let store: InMemoryRepository;
let repo: Repository;
let maths: TreeNode;

beforeEach(async () => {
  now = new Date('2026-11-25T10:00:00Z');
  store = new InMemoryRepository(clock);
  await seedIfEmpty(store, newId);
  repo = recordChanges(store, { source: 'app', newId });
  const node = (await store.listNodes()).find((x) => x.name === 'Maths');
  if (!node) throw new Error('seed has no Maths');
  maths = node;
});

/** A small but complete set of study data, then its export. */
async function fullExport(): Promise<DataExport> {
  await repo.updateSettings({ studentName: 'Demo Student', neglectDays: 5, dayEndsAtMinutes: 240 });
  await logSession(repo, clock, newId, {
    nodeId: maths.id,
    studiedOn: '2026-11-20',
    minutes: 30,
    note: 'Day 1',
  });
  await logSession(repo, clock, newId, { nodeId: maths.id, studiedOn: '2026-11-24', minutes: 45 });
  const parent = await createTask(repo, newId, { nodeId: maths.id, title: 'Plan' });
  const child = await createTask(repo, newId, {
    nodeId: maths.id,
    parentTaskId: parent.id,
    title: 'Mock 1',
    isScored: true,
    defaultMaxScore: 20,
  });
  await completeTask(repo, clock, newId, child.id, { score: 14, completedOn: '2026-11-23' });
  const exam = await addDeadline(repo, newId, {
    nodeId: maths.id,
    title: 'Finals',
    dueOn: '2026-12-20',
    isExam: true,
  });
  await addExamTarget(repo, newId, exam.id, {
    label: 'Mock 1',
    targetOn: '2026-12-01',
    minPercent: 60,
  });
  await addMistake(repo, clock, newId, { nodeId: maths.id, text: 'sign error' });
  return exportData(repo, clock);
}

describe('export format 2 (DATA-2)', () => {
  it('adds mistakes, exam targets, exam flags, completion dates, and "day ends at"', async () => {
    const data = await fullExport();
    expect(data.formatVersion).toBe(2);
    expect(data.settings).toEqual({
      studentName: 'Demo Student',
      neglectDays: 5,
      dayEndsAtMinutes: 240,
    });
    expect(data.mistakes).toHaveLength(1);
    expect(data.examTargets).toHaveLength(1);
    expect(data.deadlines[0]?.isExam).toBe(true);
    expect(data.taskCompletions[0]?.completedOn).toBe('2026-11-23');
  });
});

describe('restore (DATA-3, DATA-4)', () => {
  it('round-trips an export: same data, new ids, links kept, history cleared', async () => {
    const backup = JSON.parse(JSON.stringify(await fullExport())) as DataExport;
    await createShare(
      repo,
      clock,
      { newId, newSlug: () => 'kept-share-slug-0123456789' },
      {
        report: { period: 'this_week' },
      },
    );
    await store.recordMcpCall('2026-11-25T09:00:00.000Z');
    await logSession(repo, clock, newId, {
      nodeId: maths.id,
      studiedOn: '2026-11-25',
      minutes: 99,
    });
    expect((await listRecentChanges(repo, clock)).length).toBeGreaterThan(0);

    const summary = await restoreFromBackup(repo, newId, backup);
    expect(summary).toMatchObject({
      formatVersion: 2,
      counts: {
        nodes: 7,
        sessions: 2,
        tasks: 3,
        taskCompletions: 1,
        scores: 1,
        deadlines: 1,
        examTargets: 1,
        mistakes: 1,
      },
      sessionRange: { from: '2026-11-20', to: '2026-11-24' },
    });

    const after = await exportData(repo, clock);
    // Same content (names, dates, minutes, settings)...
    expect(after.sessions.map((s) => [s.studiedOn, s.minutes, s.note])).toEqual([
      ['2026-11-20', 30, 'Day 1'],
      ['2026-11-24', 45, null],
    ]);
    expect(after.settings).toEqual(backup.settings);
    expect(after.nodes.map((x) => x.name)).toEqual(backup.nodes.map((x) => x.name));
    // ...with new ids everywhere, and the links between rows pointing at the new ones.
    const oldIds = new Set([...backup.nodes, ...backup.tasks, ...backup.sessions].map((x) => x.id));
    expect([...after.nodes, ...after.tasks, ...after.sessions].some((x) => oldIds.has(x.id))).toBe(
      false,
    );
    const child = after.tasks.find((t) => t.title === 'Mock 1');
    const parent = after.tasks.find((t) => t.title === 'Plan');
    expect(child?.parentTaskId).toBe(parent?.id);
    expect(after.scores[0]?.taskCompletionId).toBe(after.taskCompletions[0]?.id);
    expect(after.taskCompletions[0]?.taskId).toBe(child?.id);
    expect(after.examTargets[0]?.deadlineId).toBe(after.deadlines[0]?.id);
    const newMaths = after.nodes.find((x) => x.name === 'Maths');
    expect(after.mistakes[0]?.nodeId).toBe(newMaths?.id);
    expect(after.nodes.find((x) => x.id === newMaths?.parentId)?.name).toBe('School Subjects');
    // The account's things stay; the history is cleared and the restore isn't recorded.
    expect(after.sharedReports).toHaveLength(1);
    expect((await store.getSettings()).lastMcpCallAt).toBe('2026-11-25T09:00:00.000Z');
    expect(await listRecentChanges(repo, clock)).toEqual([]);
  });

  it('reads a v1.0 backup (format 1): no completion dates, exam flags, mistakes, or targets', async () => {
    const v2 = JSON.parse(JSON.stringify(await fullExport())) as Record<string, unknown> &
      DataExport;
    const v1 = {
      ...v2,
      formatVersion: 1,
      settings: { studentName: 'Demo Student', neglectDays: 5 },
      // Format 1 files simply didn't have these fields.
      taskCompletions: v2.taskCompletions.map((c) => ({ ...c, completedOn: undefined })),
      deadlines: v2.deadlines.map((d) => ({ ...d, isExam: undefined })),
      mistakes: undefined,
      examTargets: undefined,
    };
    const backup = parseBackup(v1);
    expect(backup.settings.dayEndsAtMinutes).toBe(0);
    expect(backup.deadlines[0]?.isExam).toBe(false);
    // 10:00 UTC on the 25th is the 25th in Karachi.
    expect(backup.taskCompletions[0]?.completedOn).toBe('2026-11-25');
    expect(summarizeBackup(backup).counts).toMatchObject({ mistakes: 0, examTargets: 0 });
    await restoreFromBackup(repo, newId, v1);
    expect(await store.listMistakes()).toEqual([]);
  });

  it.each([
    ['not a backup', { hello: 1 }, /isn’t a Streakwise backup file/],
    [
      'a session on a missing node',
      (b: DataExport) => ({ ...b, sessions: [{ ...b.sessions[0], nodeId: newId() }] }),
      /a session belongs to an item that isn’t in the file/,
    ],
    [
      'a node at the wrong level',
      (b: DataExport) => ({
        ...b,
        nodes: b.nodes.map((x) => (x.name === 'Maths' ? { ...x, depth: 1 } : x)),
      }),
      /“Maths” is at the wrong level/,
    ],
    [
      'a duplicate sibling name',
      (b: DataExport) => ({
        ...b,
        nodes: b.nodes.map((x) => (x.name === 'English' ? { ...x, name: 'maths' } : x)),
      }),
      /both called/,
    ],
    [
      'a sub-task whose parent is missing',
      (b: DataExport) => ({
        ...b,
        tasks: b.tasks.map((t) => (t.title === 'Mock 1' ? { ...t, parentTaskId: newId() } : t)),
      }),
      /inside a task that isn’t in the file/,
    ],
    [
      'a score linked to a missing completion',
      (b: DataExport) => ({ ...b, taskCompletions: [], scores: b.scores }),
      /linked to a completion that isn’t in the file/,
    ],
    [
      'an exam target without its deadline',
      (b: DataExport) => ({ ...b, deadlines: [] }),
      /an exam target belongs to a deadline/,
    ],
    [
      'two rows with one id',
      (b: DataExport) => ({ ...b, sessions: [b.sessions[0], b.sessions[0]] }),
      /two sessions share the id/,
    ],
  ])('refuses %s and changes nothing', async (_name, change, message) => {
    const backup = JSON.parse(JSON.stringify(await fullExport())) as DataExport;
    const before = await exportData(repo, clock);
    const broken = typeof change === 'function' ? change(backup) : change;
    await expect(restoreFromBackup(repo, newId, broken)).rejects.toMatchObject({
      code: 'backup_invalid',
      message,
    });
    const after = await exportData(repo, clock);
    expect(after.sessions).toEqual(before.sessions);
    expect(after.nodes).toEqual(before.nodes);
  });
});

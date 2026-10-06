import { beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../domain/errors';
import type { TreeNode } from '../domain/types';
import { InMemoryRepository } from '../repo/InMemoryRepository';
import { seedIfEmpty } from './seed';
import {
  completeTask,
  createTask,
  deleteTask,
  listTaskItems,
  uncompleteTask,
  updateTask,
} from './tasks';

// Wednesday 2026-10-07, 15:00 in Karachi; the week runs Mon 10-05 to Sun 10-11.
let now = new Date('2026-10-07T10:00:00Z');
const clock = () => now;
function sequentialIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

let repo: InMemoryRepository;
let newId: () => string;
let maths: TreeNode;

async function errorOf(promise: Promise<unknown>): Promise<DomainError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error('expected a DomainError');
}

beforeEach(async () => {
  now = new Date('2026-10-07T10:00:00Z');
  repo = new InMemoryRepository(clock);
  newId = sequentialIds();
  await seedIfEmpty(repo, newId);
  const node = (await repo.listNodes()).find((n) => n.name === 'Maths');
  if (!node) throw new Error('seed has no Maths');
  maths = node;
});

describe('createTask (TASK-2, TASK-3)', () => {
  it('creates "Other" tasks with no node, which can’t be scored', async () => {
    const other = await createTask(repo, newId, { nodeId: null, title: 'Renew library card' });
    expect(other.nodeId).toBeNull();
    const scored = await errorOf(
      createTask(repo, newId, { nodeId: null, title: 'Quiz', isScored: true, defaultMaxScore: 10 }),
    );
    expect(scored.kind).toBe('validation');
    const scoredTask = await createTask(repo, newId, {
      nodeId: maths.id,
      title: 'Quiz',
      isScored: true,
      defaultMaxScore: 10,
    });
    const moved = await errorOf(updateTask(repo, clock, scoredTask.id, { nodeId: null }));
    expect(moved.code).toBe('scored_needs_node');
  });

  it('creates one-off tasks and nested sub-tasks with defaults', async () => {
    const parent = await createTask(repo, newId, { nodeId: maths.id, title: '  Chapter 3  ' });
    expect(parent).toMatchObject({
      title: 'Chapter 3',
      recurrence: 'none',
      dueOn: null,
      isScored: false,
      parentTaskId: null,
    });
    const child = await createTask(repo, newId, {
      nodeId: maths.id,
      parentTaskId: parent.id,
      title: 'Exercises',
    });
    const grandchild = await createTask(repo, newId, {
      nodeId: maths.id,
      parentTaskId: child.id,
      title: 'Q1–10',
    });
    expect(grandchild.parentTaskId).toBe(child.id);
  });

  it('rejects a due date on a weekly task and a scored task without a max', async () => {
    const weekly = await errorOf(
      createTask(repo, newId, {
        nodeId: maths.id,
        title: 'x',
        recurrence: 'weekly',
        dueOn: '2026-10-09',
      }),
    );
    expect(weekly.kind).toBe('validation');
    const scored = await errorOf(
      createTask(repo, newId, { nodeId: maths.id, title: 'x', isScored: true }),
    );
    expect(scored.kind).toBe('validation');
  });

  it('rejects titles over 120 characters', async () => {
    const error = await errorOf(
      createTask(repo, newId, { nodeId: maths.id, title: 'a'.repeat(121) }),
    );
    expect(error.kind).toBe('validation');
  });
});

describe('completeTask / uncompleteTask (TASK-4, TASK-6)', () => {
  it('completes and uncompletes a one-off task', async () => {
    const task = await createTask(repo, newId, {
      nodeId: maths.id,
      title: 'Read',
      dueOn: '2026-10-08',
    });
    const completion = await completeTask(repo, clock, newId, task.id, {});
    expect(completion.periodStart).toBeNull();

    let [item] = (await listTaskItems(repo, clock)).filter((i) => i.task.id === task.id);
    expect(item).toMatchObject({ dueThisWeek: false, completion: { id: completion.id } });

    const again = await errorOf(completeTask(repo, clock, newId, task.id, {}));
    expect(again).toMatchObject({ kind: 'conflict', code: 'already_completed' });

    await uncompleteTask(repo, completion.id);
    [item] = (await listTaskItems(repo, clock)).filter((i) => i.task.id === task.id);
    expect(item).toMatchObject({ dueThisWeek: true, completion: null });
  });

  it('records a linked score for a scored task and removes it on uncomplete', async () => {
    const [weekly] = await repo.listTasks(); // the seeded "Weekly recall / revision", max 20
    if (!weekly) throw new Error('seed has no task');

    const missing = await errorOf(completeTask(repo, clock, newId, weekly.id, {}));
    expect(missing.code).toBe('score_required');
    const tooHigh = await errorOf(completeTask(repo, clock, newId, weekly.id, { score: 21 }));
    expect(tooHigh.code).toBe('score_above_max');

    const completion = await completeTask(repo, clock, newId, weekly.id, {
      score: 18,
      kind: 'revision',
      note: 'good',
    });
    expect(completion.periodStart).toBe('2026-10-05');
    expect(await repo.listScores()).toEqual([
      expect.objectContaining({
        taskCompletionId: completion.id,
        nodeId: weekly.nodeId,
        title: weekly.title,
        kind: 'revision',
        takenOn: '2026-10-07',
        score: 18,
        maxScore: 20,
      }),
    ]);

    await uncompleteTask(repo, completion.id);
    expect(await repo.listScores()).toEqual([]);
  });

  it('makes a weekly task due again the next Monday and keeps its history (TASK-5)', async () => {
    const [weekly] = await repo.listTasks();
    if (!weekly) throw new Error('seed has no task');
    await completeTask(repo, clock, newId, weekly.id, { score: 15 });

    now = new Date('2026-10-12T05:00:00Z'); // Monday 10:00 in Karachi
    const [item] = await listTaskItems(repo, clock);
    expect(item).toMatchObject({
      dueThisWeek: true,
      completion: null,
      completedWeeks: ['2026-10-05'],
    });

    await completeTask(repo, clock, newId, weekly.id, { score: 17 });
    const [after] = await listTaskItems(repo, clock);
    expect(after?.completedWeeks).toEqual(['2026-10-12', '2026-10-05']);
  });

  it('rejects a score for an unscored task', async () => {
    const task = await createTask(repo, newId, { nodeId: maths.id, title: 'Read' });
    const error = await errorOf(completeTask(repo, clock, newId, task.id, { score: 3 }));
    expect(error.code).toBe('not_scored');
  });
});

describe('updateTask and deleteTask (TASK-8)', () => {
  it('switching to weekly clears the due date; archiving hides the subtree', async () => {
    const task = await createTask(repo, newId, {
      nodeId: maths.id,
      title: 'Read',
      dueOn: '2026-10-08',
    });
    const child = await createTask(repo, newId, {
      nodeId: maths.id,
      parentTaskId: task.id,
      title: 'Part 1',
    });

    const weekly = await updateTask(repo, clock, task.id, { recurrence: 'weekly' });
    expect(weekly).toMatchObject({ recurrence: 'weekly', dueOn: null });

    await updateTask(repo, clock, task.id, { archived: true });
    const visible = (await listTaskItems(repo, clock)).map((i) => i.task.id);
    expect(visible).not.toContain(task.id);
    expect(visible).not.toContain(child.id);

    const restored = await updateTask(repo, clock, task.id, { archived: false });
    expect(restored.archivedAt).toBeNull();
  });

  it('rejects turning on scoring without a max', async () => {
    const task = await createTask(repo, newId, { nodeId: maths.id, title: 'Quiz' });
    const error = await errorOf(updateTask(repo, clock, task.id, { isScored: true }));
    expect(error.code).toBe('max_required');
    const scored = await updateTask(repo, clock, task.id, { isScored: true, defaultMaxScore: 10 });
    expect(scored).toMatchObject({ isScored: true, defaultMaxScore: 10 });
  });

  it('deletes sub-tasks and completions but keeps linked scores, unlinked', async () => {
    const parent = await createTask(repo, newId, { nodeId: maths.id, title: 'Unit' });
    const quiz = await createTask(repo, newId, {
      nodeId: maths.id,
      parentTaskId: parent.id,
      title: 'Quiz',
      isScored: true,
      defaultMaxScore: 10,
    });
    await completeTask(repo, clock, newId, quiz.id, { score: 8 });

    const [progress] = (await listTaskItems(repo, clock)).filter((i) => i.task.id === parent.id);
    expect(progress?.subtasks).toEqual({ done: 1, total: 1 });

    await deleteTask(repo, parent.id);
    const ids = (await repo.listTasks()).map((t) => t.id);
    expect(ids).not.toContain(quiz.id);
    expect(await repo.listTaskCompletions()).toEqual([]);
    expect(await repo.listScores()).toEqual([
      expect.objectContaining({ score: 8, taskCompletionId: null }),
    ]);
  });
});

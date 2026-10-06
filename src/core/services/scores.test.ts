import { beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../domain/errors';
import type { TreeNode } from '../domain/types';
import { InMemoryRepository } from '../repo/InMemoryRepository';
import { addScore, deleteScore, listScores, updateScore } from './scores';
import { seedIfEmpty } from './seed';
import { updateNode } from './structure';
import { completeTask, listTaskItems } from './tasks';

// Saturday 2026-10-03, 15:00 in Karachi.
const now = new Date('2026-10-03T10:00:00Z');
const clock = () => now;
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
  repo = new InMemoryRepository(clock);
  let n = 0;
  newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  await seedIfEmpty(repo, newId);
  const node = (await repo.listNodes()).find((x) => x.name === 'Maths');
  if (!node) throw new Error('seed has no Maths');
  maths = node;
});

const paper = () => ({
  nodeId: maths.id,
  kind: 'past_paper' as const,
  title: '  2023 Paper 1 ',
  takenOn: '2026-10-01',
  score: 62,
  maxScore: 80,
});

describe('scores (SCORE-1, SCORE-3)', () => {
  it('adds, edits, lists newest first, and deletes', async () => {
    const first = await addScore(repo, clock, newId, paper());
    expect(first).toMatchObject({ title: '2023 Paper 1', note: null, taskCompletionId: null });
    const second = await addScore(repo, clock, newId, { ...paper(), takenOn: '2026-10-03' });
    expect((await listScores(repo)).map((s) => s.id)).toEqual([second.id, first.id]);

    const edited = await updateScore(repo, clock, first.id, { score: 70, note: 'Better' });
    expect(edited).toMatchObject({ score: 70, maxScore: 80, note: 'Better' });

    await deleteScore(repo, first.id);
    expect(await listScores(repo)).toHaveLength(1);
  });

  it('rejects future dates, scores above the max, and archived nodes', async () => {
    const future = await errorOf(
      addScore(repo, clock, newId, { ...paper(), takenOn: '2026-10-04' }),
    );
    expect(future.code).toBe('future_date');
    const above = await errorOf(addScore(repo, clock, newId, { ...paper(), score: 81 }));
    expect(above.kind).toBe('validation');
    const zeroMax = await errorOf(addScore(repo, clock, newId, { ...paper(), maxScore: 0 }));
    expect(zeroMax.kind).toBe('validation');

    const saved = await addScore(repo, clock, newId, paper());
    const lowered = await errorOf(updateScore(repo, clock, saved.id, { maxScore: 50 }));
    expect(lowered.code).toBe('score_above_max');

    await updateNode(repo, clock, maths.id, { archived: true });
    expect((await errorOf(addScore(repo, clock, newId, paper()))).code).toBe('node_archived');
  });

  it('keeps the task completed when its linked score is deleted', async () => {
    const [weekly] = await listTaskItems(repo, clock);
    if (!weekly) throw new Error('seed has no task');
    await completeTask(repo, clock, newId, weekly.task.id, { score: 15 });
    const [linked] = await listScores(repo);
    if (!linked) throw new Error('no linked score');
    expect(linked.taskCompletionId).not.toBeNull();
    await deleteScore(repo, linked.id);
    expect((await listTaskItems(repo, clock))[0]?.completion).not.toBeNull();
  });
});

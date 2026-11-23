import { beforeEach, describe, expect, it } from 'vitest';

import type { TreeNode } from '../domain/types.js';
import { InMemoryRepository } from '../repo/InMemoryRepository.js';
import {
  addMistake,
  deleteMistake,
  listDueMistakes,
  listMistakes,
  reviewMistake,
  updateMistake,
} from './mistakes.js';
import { seedIfEmpty } from './seed.js';
import { deleteNode, updateNode } from './structure.js';

let now: Date;
const clock = () => now;
let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
let repo: InMemoryRepository;
let maths: TreeNode;
let english: TreeNode;

beforeEach(async () => {
  now = new Date('2026-11-10T10:00:00Z');
  repo = new InMemoryRepository(clock);
  await seedIfEmpty(repo, newId);
  const nodes = await repo.listNodes();
  const find = (name: string) => {
    const node = nodes.find((x) => x.name === name);
    if (!node) throw new Error(`seed has no ${name}`);
    return node;
  };
  maths = find('Maths');
  english = find('English');
});

describe('mistakes (ERR-1)', () => {
  it('adds a mistake dated today by default, with its first review tomorrow', async () => {
    const mistake = await addMistake(repo, clock, newId, {
      nodeId: maths.id,
      text: ' sign error ',
    });
    expect(mistake).toMatchObject({
      text: 'sign error',
      createdOn: '2026-11-10',
      source: 'app',
      status: 'open',
      step: 1,
      nextDueOn: '2026-11-11',
    });
    const fromClaude = await addMistake(
      repo,
      clock,
      newId,
      { nodeId: maths.id, text: 'x', createdOn: '2026-11-08' },
      'claude',
    );
    expect(fromClaude).toMatchObject({ source: 'claude', nextDueOn: '2026-11-09' });
  });

  it('refuses a future date, an archived node, and empty text', async () => {
    await expect(
      addMistake(repo, clock, newId, { nodeId: maths.id, text: 'x', createdOn: '2026-11-11' }),
    ).rejects.toMatchObject({ code: 'future_date' });
    await expect(
      addMistake(repo, clock, newId, { nodeId: maths.id, text: '  ' }),
    ).rejects.toMatchObject({ kind: 'validation' });
    await updateNode(repo, clock, maths.id, { archived: true });
    await expect(
      addMistake(repo, clock, newId, { nodeId: maths.id, text: 'x' }),
    ).rejects.toMatchObject({ code: 'node_archived' });
  });

  it('edits the text and node, and deletes', async () => {
    const mistake = await addMistake(repo, clock, newId, { nodeId: maths.id, text: 'a' });
    const edited = await updateMistake(repo, mistake.id, { text: 'b', nodeId: english.id });
    expect(edited).toMatchObject({ text: 'b', nodeId: english.id, step: 1 });
    await deleteMistake(repo, mistake.id);
    expect(await repo.listMistakes()).toEqual([]);
  });

  it('keeps a node with mistakes from being deleted (TREE-3)', async () => {
    await addMistake(repo, clock, newId, { nodeId: maths.id, text: 'a' });
    await expect(deleteNode(repo, maths.id)).rejects.toMatchObject({ code: 'node_in_use' });
  });
});

describe('reviews (ERR-2, MCP-21)', () => {
  it('lists open mistakes due by today, oldest due first, and hides archived nodes', async () => {
    const older = await addMistake(repo, clock, newId, {
      nodeId: maths.id,
      text: 'older',
      createdOn: '2026-11-01',
    });
    const newer = await addMistake(repo, clock, newId, {
      nodeId: english.id,
      text: 'newer',
      createdOn: '2026-11-05',
    });
    await addMistake(repo, clock, newId, { nodeId: maths.id, text: 'not due yet' });
    expect((await listDueMistakes(repo, clock)).map((m) => m.id)).toEqual([older.id, newer.id]);
    expect((await listDueMistakes(repo, clock, { nodeId: english.id })).map((m) => m.id)).toEqual([
      newer.id,
    ]);
    await updateNode(repo, clock, english.id, { archived: true });
    expect((await listDueMistakes(repo, clock)).map((m) => m.id)).toEqual([older.id]);
  });

  it('reviews today by default and refuses a learned mistake', async () => {
    const mistake = await addMistake(repo, clock, newId, {
      nodeId: maths.id,
      text: 'a',
      createdOn: '2026-11-09',
    });
    const reviewed = await reviewMistake(repo, clock, mistake.id, { result: 'right' });
    expect(reviewed).toMatchObject({
      step: 2,
      lastReviewedOn: '2026-11-10',
      nextDueOn: '2026-11-12',
    });
    await reviewMistake(repo, clock, mistake.id, { result: 'right' });
    const learned = await reviewMistake(repo, clock, mistake.id, { result: 'right' });
    expect(learned.status).toBe('learned');
    await expect(reviewMistake(repo, clock, mistake.id, { result: 'right' })).rejects.toMatchObject(
      { code: 'mistake_learned' },
    );
    expect(await listMistakes(repo, { status: 'learned' })).toHaveLength(1);
  });

  it('refuses a review in the future or before the mistake', async () => {
    const mistake = await addMistake(repo, clock, newId, { nodeId: maths.id, text: 'a' });
    await expect(
      reviewMistake(repo, clock, mistake.id, { result: 'right', reviewedOn: '2026-11-11' }),
    ).rejects.toMatchObject({ code: 'future_date' });
    await expect(
      reviewMistake(repo, clock, mistake.id, { result: 'right', reviewedOn: '2026-11-09' }),
    ).rejects.toMatchObject({ code: 'before_created' });
  });
});

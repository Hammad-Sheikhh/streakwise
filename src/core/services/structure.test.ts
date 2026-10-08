import { beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../domain/errors';
import type { TreeNode } from '../domain/types';
import { InMemoryRepository } from '../repo/InMemoryRepository';
import { seedIfEmpty } from './seed';
import { logSession } from './sessions';
import { addNode, deleteNode, listTree, moveNode, setTopicStatus, updateNode } from './structure';

const clock = () => new Date('2026-10-03T10:00:00Z');
function sequentialIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

let repo: InMemoryRepository;
let newId: () => string;

async function byName(name: string): Promise<TreeNode> {
  const node = (await repo.listNodes()).find((n) => n.name === name);
  if (!node) throw new Error(`no node ${name}`);
  return node;
}

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
  newId = sequentialIds();
  await seedIfEmpty(repo, newId);
});

describe('addNode (TREE-1)', () => {
  it('adds tracks, subtasks, and topics with the right depth and defaults', async () => {
    const track = await addNode(repo, newId, { parentId: null, name: '  Piano  ' });
    expect(track).toMatchObject({ depth: 1, name: 'Piano', color: 'emerald', sortOrder: 3 });

    const subtask = await addNode(repo, newId, { parentId: track.id, name: 'Scales' });
    expect(subtask).toMatchObject({ depth: 2, color: null, topicStatus: null, sortOrder: 0 });

    const topic = await addNode(repo, newId, { parentId: subtask.id, name: 'C major' });
    expect(topic).toMatchObject({ depth: 3, topicStatus: 'not_started' });
  });

  it('rejects a fourth level (max_depth)', async () => {
    const maths = await byName('Maths');
    const topic = await addNode(repo, newId, { parentId: maths.id, name: 'Algebra' });
    const error = await errorOf(addNode(repo, newId, { parentId: topic.id, name: 'Too deep' }));
    expect(error).toMatchObject({ kind: 'conflict', code: 'max_depth' });
  });

  it('rejects a sibling with the same name, ignoring case', async () => {
    const examPrep = await byName('Exam Prep');
    const error = await errorOf(addNode(repo, newId, { parentId: examPrep.id, name: 'PRACTICE' }));
    expect(error).toMatchObject({ kind: 'conflict', code: 'duplicate' });
    // The same name under a different parent is fine.
    const exams = await byName('School Subjects');
    await expect(
      addNode(repo, newId, { parentId: exams.id, name: 'Practice' }),
    ).resolves.toBeTruthy();
  });

  it('validates the name and only gives tracks a color', async () => {
    expect(await errorOf(addNode(repo, newId, { parentId: null, name: ' ' }))).toMatchObject({
      kind: 'validation',
      message: 'Enter a name.',
    });
    const examPrep = await byName('Exam Prep');
    expect(
      await errorOf(addNode(repo, newId, { parentId: examPrep.id, name: 'X', color: 'rose' })),
    ).toMatchObject({ code: 'color_tracks_only' });
  });

  it('refuses to add under an archived node', async () => {
    const examPrep = await byName('Exam Prep');
    await updateNode(repo, clock, examPrep.id, { archived: true });
    const flashcards = await byName('Flashcards');
    expect(
      await errorOf(addNode(repo, newId, { parentId: flashcards.id, name: 'Verbs' })),
    ).toMatchObject({ code: 'parent_archived' });
  });
});

describe('updateNode (TREE-1, TREE-2, TREE-5)', () => {
  it('renames and recolors', async () => {
    const examPrep = await byName('Exam Prep');
    const updated = await updateNode(repo, clock, examPrep.id, { name: 'Exams', color: 'rose' });
    expect(updated).toMatchObject({ name: 'Exams', color: 'rose' });
  });

  it('keeps sibling names unique on rename', async () => {
    const flashcards = await byName('Flashcards');
    expect(
      await errorOf(updateNode(repo, clock, flashcards.id, { name: 'practice' })),
    ).toMatchObject({
      code: 'duplicate',
    });
  });

  it('archives and restores', async () => {
    const maths = await byName('Maths');
    expect(await updateNode(repo, clock, maths.id, { archived: true })).toMatchObject({
      archivedAt: '2026-10-03T10:00:00.000Z',
    });
    expect(await updateNode(repo, clock, maths.id, { archived: false })).toMatchObject({
      archivedAt: null,
    });
  });
});

describe('deleteNode (TREE-3)', () => {
  it('deletes a node and its descendants when nothing has history', async () => {
    const maths = await byName('Maths');
    await addNode(repo, newId, { parentId: maths.id, name: 'Algebra' });
    await deleteNode(repo, maths.id);
    const names = (await repo.listNodes()).map((n) => n.name);
    expect(names).not.toContain('Maths');
    expect(names).not.toContain('Algebra');
  });

  it('refuses when a descendant has sessions', async () => {
    const exams = await byName('School Subjects');
    const maths = await byName('Maths');
    await logSession(repo, clock, newId, {
      nodeId: maths.id,
      studiedOn: '2026-10-03',
      minutes: 30,
    });
    expect(await errorOf(deleteNode(repo, exams.id))).toMatchObject({ code: 'node_in_use' });
    expect(await repo.listNodes()).toHaveLength(7);
  });

  it('refuses when the node has tasks', async () => {
    const examPrep = await byName('Exam Prep');
    expect(await errorOf(deleteNode(repo, examPrep.id))).toMatchObject({ code: 'node_in_use' });
  });
});

describe('moveNode (TREE-6)', () => {
  const trackNames = async () =>
    (await listTree(repo)).filter((n) => n.depth === 1).map((n) => n.name);

  it('swaps a node with its neighbour', async () => {
    const exams = await byName('School Subjects');
    await moveNode(repo, exams.id, { direction: 'up' });
    expect(await trackNames()).toEqual(['School Subjects', 'Exam Prep', 'Online Course']);
    await moveNode(repo, exams.id, { direction: 'down' });
    await moveNode(repo, exams.id, { direction: 'down' });
    expect(await trackNames()).toEqual(['Exam Prep', 'Online Course', 'School Subjects']);
  });

  it('does nothing at the ends', async () => {
    const examPrep = await byName('Exam Prep');
    await moveNode(repo, examPrep.id, { direction: 'up' });
    expect((await trackNames())[0]).toBe('Exam Prep');
  });

  it('skips archived siblings', async () => {
    const exams = await byName('School Subjects');
    const claude = await byName('Online Course');
    await updateNode(repo, clock, exams.id, { archived: true });
    await moveNode(repo, claude.id, { direction: 'up' });
    expect(await trackNames()).toEqual(['Online Course', 'School Subjects', 'Exam Prep']);
  });
});

describe('setTopicStatus (TOP-1)', () => {
  it('marks a topic done with a timestamp, and reopening clears it', async () => {
    const topic = await addNode(repo, newId, {
      parentId: (await byName('Maths')).id,
      name: 'Ch 1',
    });

    const done = await setTopicStatus(repo, clock, topic.id, { status: 'done' });
    expect(done).toMatchObject({ topicStatus: 'done', topicDoneAt: clock().toISOString() });

    const reopened = await setTopicStatus(repo, clock, topic.id, { status: 'in_progress' });
    expect(reopened).toMatchObject({ topicStatus: 'in_progress', topicDoneAt: null });
  });

  it('only applies to topics', async () => {
    const error = await errorOf(
      setTopicStatus(repo, clock, (await byName('Maths')).id, { status: 'done' }),
    );
    expect(error).toMatchObject({ kind: 'validation', code: 'topics_only' });
  });

  it('rejects an unknown status', async () => {
    const topic = await addNode(repo, newId, {
      parentId: (await byName('Maths')).id,
      name: 'Ch 2',
    });
    const error = await errorOf(
      setTopicStatus(repo, clock, topic.id, { status: 'finished' as 'done' }),
    );
    expect(error.kind).toBe('validation');
  });
});

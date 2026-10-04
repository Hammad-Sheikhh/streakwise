import { describe, expect, it } from 'vitest';

import { InMemoryRepository } from '../repo/InMemoryRepository';
import { buildSeed, seedIfEmpty } from './seed';
import { listTree } from './structure';

const clock = () => new Date('2026-10-03T10:00:00Z');
function sequentialIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

describe('seedIfEmpty', () => {
  it('creates the starting tree and the weekly scored task (SPEC Â§B4)', async () => {
    const repo = new InMemoryRepository(clock);
    expect(await seedIfEmpty(repo, sequentialIds())).toBe(true);

    const tree = await listTree(repo);
    expect(tree.map((n) => `${'  '.repeat(n.depth - 1)}${n.name}`)).toEqual([
      'German Language',
      '  Self-study',
      '  Class',
      'Improvement Exams',
      '  Maths',
      '  English',
      'Claude Certification',
    ]);
    expect(tree.filter((n) => n.depth === 1).map((n) => n.color)).toEqual([
      'amber',
      'blue',
      'violet',
    ]);

    const [task] = await repo.listTasks();
    expect(task).toMatchObject({
      title: 'Weekly recall / revision',
      nodeId: tree[0]?.id,
      recurrence: 'weekly',
      isScored: true,
      defaultMaxScore: 20,
    });
  });

  it('is idempotent', async () => {
    const repo = new InMemoryRepository(clock);
    await seedIfEmpty(repo, sequentialIds());
    expect(await seedIfEmpty(repo, sequentialIds())).toBe(false);
    expect(await repo.listNodes()).toHaveLength(7);
  });

  it('leaves the default settings alone', async () => {
    const repo = new InMemoryRepository(clock);
    await seedIfEmpty(repo, sequentialIds());
    expect(await repo.getSettings()).toMatchObject({ studentName: '', neglectDays: 3 });
  });

  it('lists parents before children, as the database function requires', () => {
    const seed = buildSeed(sequentialIds());
    const seen = new Set<string>();
    for (const node of seed.nodes) {
      if (node.parentId !== null) expect(seen.has(node.parentId)).toBe(true);
      seen.add(node.id);
    }
  });
});

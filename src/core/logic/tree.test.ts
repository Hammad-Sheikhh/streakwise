import { describe, expect, it } from 'vitest';

import type { TreeNode } from '../domain/types';
import { hiddenIds, nodePath, sortSiblings, subtreeIds, trackOf, visibleNodes } from './tree';

function node(id: string, parentId: string | null, extra: Partial<TreeNode> = {}): TreeNode {
  const depth = (parentId === null ? 1 : parentId.length + 1) as TreeNode['depth'];
  return {
    id,
    parentId,
    depth,
    name: id.toUpperCase(),
    color: depth === 1 ? 'amber' : null,
    sortOrder: 0,
    weeklyTargetMinutes: null,
    topicStatus: depth === 3 ? 'not_started' : null,
    topicDoneAt: null,
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...extra,
  };
}

// Ids double as paths: "a" is a track, "ab" its subtask, "abc" a topic under "ab".
const nodes = [
  node('a', null),
  node('ab', 'a'),
  node('abc', 'ab'),
  node('ad', 'a'),
  node('e', null),
];

describe('subtreeIds', () => {
  it('includes the node and every descendant', () => {
    expect(subtreeIds(nodes, 'a').sort()).toEqual(['a', 'ab', 'abc', 'ad']);
    expect(subtreeIds(nodes, 'abc')).toEqual(['abc']);
  });

  it('is empty for an unknown node', () => {
    expect(subtreeIds(nodes, 'zz')).toEqual([]);
  });
});

describe('hiddenIds (TREE-2)', () => {
  it('hides archived nodes and everything under them', () => {
    const archived = nodes.map((n) => (n.id === 'ab' ? { ...n, archivedAt: 'x' } : n));
    expect([...hiddenIds(archived)].sort()).toEqual(['ab', 'abc']);
    expect(visibleNodes(archived).map((n) => n.id)).toEqual(['a', 'ad', 'e']);
  });

  it('hides nothing when nothing is archived', () => {
    expect(hiddenIds(nodes).size).toBe(0);
  });
});

describe('nodePath and trackOf', () => {
  it('lists names from the track down', () => {
    expect(nodePath(nodes, 'abc')).toEqual(['A', 'AB', 'ABC']);
    expect(trackOf(nodes, 'abc')?.id).toBe('a');
    expect(trackOf(nodes, 'e')?.id).toBe('e');
  });
});

describe('sortSiblings', () => {
  it('orders by sort order, then name', () => {
    const sorted = sortSiblings([
      { sortOrder: 1, name: 'b' },
      { sortOrder: 0, name: 'z' },
      { sortOrder: 1, name: 'a' },
    ]);
    expect(sorted.map((s) => s.name)).toEqual(['z', 'a', 'b']);
  });
});

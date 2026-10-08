import { describe, expect, it } from 'vitest';

import type { TaskItem, TreeNode } from '@/core/domain/types';

import { buildTaskTree, groupTasks } from './grouping';

const T = '2026-10-01T00:00:00.000Z';

function node(id: string, parentId: string | null, depth: 1 | 2 | 3): TreeNode {
  return {
    id,
    parentId,
    depth,
    name: id,
    color: depth === 1 ? 'blue' : null,
    sortOrder: 0,
    weeklyTargetMinutes: null,
    topicStatus: depth === 3 ? 'not_started' : null,
    topicDoneAt: null,
    archivedAt: null,
    createdAt: T,
    updatedAt: T,
  };
}

function item(id: string, nodeId: string, parentTaskId: string | null = null): TaskItem {
  return {
    task: {
      id,
      nodeId,
      parentTaskId,
      title: id,
      description: null,
      dueOn: null,
      recurrence: 'none',
      isScored: false,
      defaultMaxScore: null,
      sortOrder: 0,
      archivedAt: null,
      createdAt: T,
      updatedAt: T,
    },
    completion: null,
    dueThisWeek: false,
    overdue: false,
    subtasks: null,
    completedWeeks: [],
  };
}

// Display (depth-first) order, as the tree is listed.
const nodes = [
  node('examPrep', null, 1),
  node('class', 'examPrep', 2),
  node('exams', null, 1),
  node('maths', 'exams', 2),
  node('ch3', 'maths', 3),
];

describe('buildTaskTree (TASK-3)', () => {
  it('nests sub-tasks at any depth and makes orphans roots', () => {
    const roots = buildTaskTree([
      item('a', 'maths'),
      item('b', 'maths', 'a'),
      item('c', 'maths', 'b'),
      item('d', 'maths', 'hidden-parent'),
    ]);
    expect(roots.map((r) => r.item.task.id)).toEqual(['a', 'd']);
    const c = roots[0]?.children[0]?.children[0];
    expect(c?.item.task.id).toBe('c');
    expect(c?.depth).toBe(3);
  });
});

describe('groupTasks (TASK-1)', () => {
  it('groups by track, then by node, in the structure’s order', () => {
    const roots = buildTaskTree([
      item('t1', 'ch3'),
      item('t2', 'exams'),
      item('t3', 'class'),
      item('t4', 'maths'),
    ]);
    const groups = groupTasks(nodes, roots);
    expect(groups.map((g) => g.track?.id)).toEqual(['examPrep', 'exams']);
    expect(groups[1]?.nodes.map((n) => n.nodeId)).toEqual(['exams', 'maths', 'ch3']);
  });
});

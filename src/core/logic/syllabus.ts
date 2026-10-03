import type { TreeNode } from '../domain/types';
import { hiddenIds, subtreeIds } from './tree';

// SPEC §B9.7: done topics ÷ non-archived topics in the subtree.

export interface Syllabus {
  done: number;
  total: number;
}

export function syllabus(nodes: readonly TreeNode[], nodeId: string): Syllabus {
  const hidden = hiddenIds(nodes);
  const inSubtree = new Set(subtreeIds(nodes, nodeId));
  const topics = nodes.filter((n) => n.depth === 3 && inSubtree.has(n.id) && !hidden.has(n.id));
  return { done: topics.filter((t) => t.topicStatus === 'done').length, total: topics.length };
}

/** Whole-number percentage done, or null when there are no topics (shown as "—"). */
export function syllabusPercent(nodes: readonly TreeNode[], nodeId: string): number | null {
  const { done, total } = syllabus(nodes, nodeId);
  return total === 0 ? null : Math.round((done / total) * 100);
}

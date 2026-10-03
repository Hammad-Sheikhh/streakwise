import type { TreeNode } from '../domain/types';
import { daysBetween, localDate } from './dates';
import { hiddenIds } from './tree';

// SPEC §B9.5.

export interface NeglectWarning {
  nodeId: string;
  /** Days since the last session (or since the node was created, if never logged). */
  days: number;
  neverLogged: boolean;
}

/**
 * Visible tracks and subtasks untouched for at least `neglectDays`, most neglected first.
 * Topics are never warned about individually.
 */
export function neglectWarnings(
  nodes: readonly TreeNode[],
  latestByNode: ReadonlyMap<string, string>,
  today: string,
  neglectDays: number,
): NeglectWarning[] {
  const hidden = hiddenIds(nodes);
  const warnings: NeglectWarning[] = [];
  for (const node of nodes) {
    if (node.depth > 2 || hidden.has(node.id)) continue;
    const last = latestByNode.get(node.id);
    const since = last ?? localDate(new Date(node.createdAt));
    const days = Math.max(0, daysBetween(since, today));
    if (days >= neglectDays) warnings.push({ nodeId: node.id, days, neverLogged: !last });
  }
  // Stable sort keeps tree order among equal days.
  return warnings.sort((a, b) => b.days - a.days);
}

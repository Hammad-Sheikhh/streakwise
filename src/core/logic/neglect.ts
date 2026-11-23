import type { TreeNode } from '../domain/types.js';
import { daysBetween, studyDate } from './dates.js';
import { hiddenIds } from './tree.js';

// SPEC §B9.5.

export interface NeglectWarning {
  nodeId: string;
  /** Days since the last session (or since the node was created, if never logged). */
  days: number;
  neverLogged: boolean;
}

/**
 * Visible tracks and subtasks untouched for at least `neglectDays`, most neglected first.
 * Topics are never warned about individually. A node's creation time becomes a day with the
 * current "My day ends at" setting (DAY-3).
 */
export function neglectWarnings(
  nodes: readonly TreeNode[],
  latestByNode: ReadonlyMap<string, string>,
  today: string,
  neglectDays: number,
  dayEndsAtMinutes = 0,
): NeglectWarning[] {
  const hidden = hiddenIds(nodes);
  const warnings: NeglectWarning[] = [];
  for (const node of nodes) {
    if (node.depth > 2 || hidden.has(node.id)) continue;
    const last = latestByNode.get(node.id);
    const since = last ?? studyDate(new Date(node.createdAt), dayEndsAtMinutes);
    const days = Math.max(0, daysBetween(since, today));
    if (days >= neglectDays) warnings.push({ nodeId: node.id, days, neverLogged: !last });
  }
  // Stable sort keeps tree order among equal days.
  return warnings.sort((a, b) => b.days - a.days);
}

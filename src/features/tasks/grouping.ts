import type { TaskItem, TreeNode } from '@/core/domain/types';
import { trackOf } from '@/core/logic/tree';

// TASK-1: tasks grouped by track, then by node, each group holding a nested task tree.

/** The node-group key for tasks with no node. */
export const OTHER_ID = 'other';

export interface TaskTreeItem {
  item: TaskItem;
  /** 1 for a top-level task. */
  depth: number;
  children: TaskTreeItem[];
}

export interface TaskNodeGroup {
  nodeId: string;
  tasks: TaskTreeItem[];
}

export interface TaskTrackGroup {
  /** null = "Other": tasks not tied to any track. */
  track: TreeNode | null;
  nodes: TaskNodeGroup[];
}

/** Nests items under their parents, keeping list order; orphans (parent not shown) are roots. */
export function buildTaskTree(items: readonly TaskItem[]): TaskTreeItem[] {
  const shown = new Set(items.map((i) => i.task.id));
  const byParent = new Map<string | null, TaskItem[]>();
  for (const item of items) {
    const parent = item.task.parentTaskId;
    const key = parent !== null && shown.has(parent) ? parent : null;
    byParent.set(key, [...(byParent.get(key) ?? []), item]);
  }
  // `seen` guards against a corrupt cycle.
  const seen = new Set<string>();
  const build = (item: TaskItem, depth: number): TaskTreeItem => {
    seen.add(item.task.id);
    const children = (byParent.get(item.task.id) ?? []).filter((c) => !seen.has(c.task.id));
    return { item, depth, children: children.map((c) => build(c, depth + 1)) };
  };
  return (byParent.get(null) ?? []).map((item) => build(item, 1));
}

/** Top-level tasks grouped by track and node, in the structure's order; "Other" comes last. */
export function groupTasks(
  nodes: readonly TreeNode[],
  roots: readonly TaskTreeItem[],
): TaskTrackGroup[] {
  const position = new Map(nodes.map((n, index) => [n.id, index]));
  const byNode = new Map<string, TaskTreeItem[]>();
  const other: TaskTreeItem[] = [];
  for (const root of roots) {
    const nodeId = root.item.task.nodeId;
    if (nodeId === null) other.push(root);
    else byNode.set(nodeId, [...(byNode.get(nodeId) ?? []), root]);
  }

  const tracks = new Map<string, TaskTrackGroup>();
  const nodeIds = [...byNode.keys()].sort(
    (a, b) => (position.get(a) ?? Infinity) - (position.get(b) ?? Infinity),
  );
  for (const nodeId of nodeIds) {
    const track = trackOf(nodes, nodeId);
    if (!track) continue;
    const group = tracks.get(track.id) ?? { track, nodes: [] };
    group.nodes.push({ nodeId, tasks: byNode.get(nodeId) ?? [] });
    tracks.set(track.id, group);
  }
  const groups = [...tracks.values()];
  if (other.length > 0) groups.push({ track: null, nodes: [{ nodeId: OTHER_ID, tasks: other }] });
  return groups;
}

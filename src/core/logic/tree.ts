import type { TreeNode } from '../domain/types';

// Pure helpers over the flat node list.

function childrenByParent(nodes: readonly TreeNode[]): Map<string | null, TreeNode[]> {
  const children = new Map<string | null, TreeNode[]>();
  for (const node of nodes) {
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node);
    children.set(node.parentId, siblings);
  }
  return children;
}

/** The node's id plus the ids of all its descendants (roll-up, SPEC §B9.3). */
export function subtreeIds(nodes: readonly TreeNode[], rootId: string): string[] {
  const children = childrenByParent(nodes);
  const ids: string[] = [];
  const visit = (id: string) => {
    ids.push(id);
    for (const child of children.get(id) ?? []) visit(child.id);
  };
  if (nodes.some((n) => n.id === rootId)) visit(rootId);
  return ids;
}

/**
 * Ids of nodes that are hidden: archived themselves, or under an archived ancestor (TREE-2).
 * Archiving only marks the node itself, so restoring it brings its whole subtree back.
 */
export function hiddenIds(nodes: readonly TreeNode[]): Set<string> {
  const hidden = new Set<string>();
  const children = childrenByParent(nodes);
  const visit = (node: TreeNode, parentHidden: boolean) => {
    const isHidden = parentHidden || node.archivedAt !== null;
    if (isHidden) hidden.add(node.id);
    for (const child of children.get(node.id) ?? []) visit(child, isHidden);
  };
  for (const root of children.get(null) ?? []) visit(root, false);
  return hidden;
}

/** Nodes that appear in pickers, lists, and warnings. */
export function visibleNodes(nodes: readonly TreeNode[]): TreeNode[] {
  const hidden = hiddenIds(nodes);
  return nodes.filter((n) => !hidden.has(n.id));
}

/** Names from the track down to the node, e.g. ["Improvement Exams", "Maths"]. */
export function nodePath(nodes: readonly TreeNode[], id: string): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const names: string[] = [];
  for (let node = byId.get(id); node; node = node.parentId ? byId.get(node.parentId) : undefined) {
    names.unshift(node.name);
  }
  return names;
}

/** The track (depth 1) a node belongs to. */
export function trackOf(nodes: readonly TreeNode[], id: string): TreeNode | undefined {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let node = byId.get(id);
  while (node && node.parentId) node = byId.get(node.parentId);
  return node;
}

/** Siblings in display order: by sort order, then name. */
export function sortSiblings<T extends Pick<TreeNode, 'sortOrder' | 'name'>>(siblings: T[]): T[] {
  return [...siblings].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

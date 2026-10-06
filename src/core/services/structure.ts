import { conflict, invalid, notFound } from '../domain/errors';
import { MAX_DEPTH, TRACK_COLORS } from '../domain/types';
import type { Clock, IdGenerator, TrackColor, TreeNode } from '../domain/types';
import { hiddenIds, sortSiblings } from '../logic/tree';
import type { NodePatch, Repository } from '../repo/Repository';
import {
  createNodeInputSchema,
  moveNodeInputSchema,
  setTopicStatusInputSchema,
  updateNodeInputSchema,
} from '../schemas/inputs';
import type {
  CreateNodeInput,
  MoveNodeInput,
  SetTopicStatusInput,
  UpdateNodeInput,
} from '../schemas/inputs';
import { parseInput } from '../schemas/parse';

// TREE-1–6: the structure tree (tracks, subtasks, topics).

/** All nodes in display order: depth-first, siblings by sort order, then name. */
export async function listTree(repo: Repository): Promise<TreeNode[]> {
  const nodes = await repo.listNodes();
  const childrenOf = new Map<string | null, TreeNode[]>();
  for (const node of nodes) {
    const siblings = childrenOf.get(node.parentId) ?? [];
    siblings.push(node);
    childrenOf.set(node.parentId, siblings);
  }

  const ordered: TreeNode[] = [];
  const visit = (parentId: string | null) => {
    for (const node of sortSiblings(childrenOf.get(parentId) ?? [])) {
      ordered.push(node);
      visit(node.id);
    }
  };
  visit(null);
  return ordered;
}

function findNode(nodes: readonly TreeNode[], id: string): TreeNode {
  const node = nodes.find((n) => n.id === id);
  if (!node) throw notFound('node_not_found');
  return node;
}

function assertUniqueName(
  nodes: readonly TreeNode[],
  parentId: string | null,
  name: string,
  exceptId?: string,
): void {
  const lower = name.toLowerCase();
  if (
    nodes.some(
      (n) => n.parentId === parentId && n.id !== exceptId && n.name.toLowerCase() === lower,
    )
  ) {
    throw conflict('duplicate');
  }
}

/** New tracks get the first palette color no visible track uses yet (TREE-4). */
function nextTrackColor(nodes: readonly TreeNode[]): TrackColor {
  const hidden = hiddenIds(nodes);
  const used = new Set(nodes.filter((n) => n.depth === 1 && !hidden.has(n.id)).map((n) => n.color));
  const tracks = nodes.filter((n) => n.depth === 1).length;
  return (
    TRACK_COLORS.find((c) => !used.has(c)) ?? TRACK_COLORS[tracks % TRACK_COLORS.length] ?? 'slate'
  );
}

export async function addNode(
  repo: Repository,
  newId: IdGenerator,
  rawInput: CreateNodeInput,
): Promise<TreeNode> {
  const input = parseInput(createNodeInputSchema, rawInput);
  const nodes = await repo.listNodes();

  let depth = 1;
  if (input.parentId !== null) {
    const parent = findNode(nodes, input.parentId);
    if (parent.depth >= MAX_DEPTH) throw conflict('max_depth');
    if (hiddenIds(nodes).has(parent.id)) {
      throw invalid('parent_archived', 'Restore the archived item before adding to it.');
    }
    depth = parent.depth + 1;
  }
  if (depth > 1 && input.color !== undefined) {
    throw invalid('color_tracks_only', 'Only tracks have a color.');
  }
  assertUniqueName(nodes, input.parentId, input.name);

  const siblings = nodes.filter((n) => n.parentId === input.parentId);
  return repo.insertNode({
    id: newId(),
    parentId: input.parentId,
    name: input.name,
    color: depth === 1 ? (input.color ?? nextTrackColor(nodes)) : null,
    sortOrder: Math.max(-1, ...siblings.map((n) => n.sortOrder)) + 1,
    topicStatus: depth === 3 ? 'not_started' : null,
  });
}

/** Rename, recolor (tracks), archive, or restore (TREE-1, TREE-2, TREE-5). */
export async function updateNode(
  repo: Repository,
  clock: Clock,
  id: string,
  rawInput: UpdateNodeInput,
): Promise<TreeNode> {
  const input = parseInput(updateNodeInputSchema, rawInput);
  const nodes = await repo.listNodes();
  const node = findNode(nodes, id);

  const patch: NodePatch = {};
  if (input.name !== undefined && input.name !== node.name) {
    assertUniqueName(nodes, node.parentId, input.name, id);
    patch.name = input.name;
  }
  if (input.color !== undefined) {
    if (node.depth !== 1) throw invalid('color_tracks_only', 'Only tracks have a color.');
    patch.color = input.color;
  }
  if (input.weeklyTargetMinutes !== undefined) {
    if (node.depth !== 1) {
      throw invalid('target_tracks_only', 'Only tracks have a weekly target.');
    }
    patch.weeklyTargetMinutes = input.weeklyTargetMinutes || null;
  }
  if (input.archived !== undefined) {
    patch.archivedAt = input.archived ? (node.archivedAt ?? clock().toISOString()) : null;
  }
  return Object.keys(patch).length === 0 ? node : repo.updateNode(id, patch);
}

/** TOP-1: sets a topic's status; marking it done stamps the time (reports count it by that). */
export async function setTopicStatus(
  repo: Repository,
  clock: Clock,
  id: string,
  rawInput: SetTopicStatusInput,
): Promise<TreeNode> {
  const { status } = parseInput(setTopicStatusInputSchema, rawInput);
  const node = findNode(await repo.listNodes(), id);
  if (node.depth !== 3) throw invalid('topics_only', 'Only topics have a status.');
  if (node.topicStatus === status) return node;
  return repo.updateNode(id, {
    topicStatus: status,
    topicDoneAt: status === 'done' ? clock().toISOString() : null,
  });
}

/** TREE-3: only allowed when nothing in the subtree has history; otherwise archive instead. */
export async function deleteNode(repo: Repository, id: string): Promise<void> {
  await repo.deleteNodeTree(id);
}

/** TREE-6: swaps the node with its previous or next visible sibling. */
export async function moveNode(
  repo: Repository,
  id: string,
  rawInput: MoveNodeInput,
): Promise<void> {
  const { direction } = parseInput(moveNodeInputSchema, rawInput);
  const nodes = await repo.listNodes();
  const node = findNode(nodes, id);
  const hidden = hiddenIds(nodes);

  const siblings = sortSiblings(nodes.filter((n) => n.parentId === node.parentId));
  const visible = siblings.filter((n) => !hidden.has(n.id));
  const index = visible.findIndex((n) => n.id === id);
  const neighbour = visible[direction === 'up' ? index - 1 : index + 1];
  if (index === -1 || !neighbour) return;

  // Swap the two in the full sibling list, then renumber, so archived siblings keep their place.
  const order = siblings.map((n) => n.id);
  const a = order.indexOf(id);
  const b = order.indexOf(neighbour.id);
  order[a] = neighbour.id;
  order[b] = id;

  const sortOrderById = new Map(siblings.map((n) => [n.id, n.sortOrder]));
  for (const [sortOrder, siblingId] of order.entries()) {
    if (sortOrderById.get(siblingId) !== sortOrder) {
      await repo.updateNode(siblingId, { sortOrder });
    }
  }
}

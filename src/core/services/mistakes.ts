import { invalid, notFound } from '../domain/errors.js';
import type { Clock, IdGenerator, Mistake, SessionSource } from '../domain/types.js';
import { applyReview, isDue, newSchedule } from '../logic/mistakes.js';
import { hiddenIds, subtreeIds } from '../logic/tree.js';
import type { MistakePatch, Repository } from '../repo/Repository.js';
import {
  createMistakeInputSchema,
  listMistakesQuerySchema,
  reviewMistakeInputSchema,
  updateMistakeInputSchema,
} from '../schemas/inputs.js';
import type {
  CreateMistakeInput,
  ListMistakesQuery,
  ReviewMistakeInput,
  UpdateMistakeInput,
} from '../schemas/inputs.js';
import { parseInput } from '../schemas/parse.js';
import { studyToday } from './today.js';

// ERR-1, ERR-2: the mistake tracker. Dates are study days (DAY-2).

async function checkNode(repo: Repository, nodeId: string): Promise<void> {
  const nodes = await repo.listNodes();
  if (!nodes.some((n) => n.id === nodeId)) throw notFound('node_not_found');
  if (hiddenIds(nodes).has(nodeId)) {
    throw invalid('node_archived', 'That item is archived. Restore it first.');
  }
}

async function findMistake(repo: Repository, id: string): Promise<Mistake> {
  const mistake = (await repo.listMistakes()).find((m) => m.id === id);
  if (!mistake) throw notFound('mistake_not_found');
  return mistake;
}

/** Due ones first (oldest due first), then learned ones, newest first. */
function compareMistakes(a: Mistake, b: Mistake): number {
  if (a.nextDueOn !== null && b.nextDueOn !== null) {
    return a.nextDueOn.localeCompare(b.nextDueOn) || a.createdAt.localeCompare(b.createdAt);
  }
  if (a.nextDueOn !== null) return -1;
  if (b.nextDueOn !== null) return 1;
  return (
    (b.learnedOn ?? '').localeCompare(a.learnedOn ?? '') || b.createdAt.localeCompare(a.createdAt)
  );
}

export async function addMistake(
  repo: Repository,
  clock: Clock,
  newId: IdGenerator,
  rawInput: CreateMistakeInput,
  source: SessionSource = 'app',
): Promise<Mistake> {
  const input = parseInput(createMistakeInputSchema, rawInput);
  const today = await studyToday(repo, clock);
  const createdOn = input.createdOn ?? today;
  if (createdOn > today) {
    throw invalid('future_date', 'A mistake can’t be dated in the future.');
  }
  await checkNode(repo, input.nodeId);
  return repo.insertMistake({
    id: newId(),
    nodeId: input.nodeId,
    text: input.text,
    createdOn,
    source,
    ...newSchedule(createdOn),
  });
}

/** ERR-1: the text and the node can change; the schedule stays. */
export async function updateMistake(
  repo: Repository,
  id: string,
  rawInput: UpdateMistakeInput,
): Promise<Mistake> {
  const input = parseInput(updateMistakeInputSchema, rawInput);
  const mistake = await findMistake(repo, id);
  const patch: MistakePatch = {};
  if (input.text !== undefined) patch.text = input.text;
  if (input.nodeId !== undefined && input.nodeId !== mistake.nodeId) {
    await checkNode(repo, input.nodeId);
    patch.nodeId = input.nodeId;
  }
  return Object.keys(patch).length === 0 ? mistake : repo.updateMistake(id, patch);
}

export async function deleteMistake(repo: Repository, id: string): Promise<void> {
  await repo.deleteMistake(id);
}

/**
 * ERR-3: mistakes on visible nodes (TREE-2), filtered by status, by "due on or before", and by a
 * node's subtree. Due ones come first, oldest due first.
 */
export async function listMistakes(
  repo: Repository,
  rawQuery: ListMistakesQuery = {},
): Promise<Mistake[]> {
  const query = parseInput(listMistakesQuerySchema, rawQuery);
  const [mistakes, nodes] = await Promise.all([repo.listMistakes(), repo.listNodes()]);
  const hidden = hiddenIds(nodes);
  const inNode = query.nodeId === undefined ? null : new Set(subtreeIds(nodes, query.nodeId));
  return mistakes
    .filter(
      (m) =>
        !hidden.has(m.nodeId) &&
        (inNode === null || inNode.has(m.nodeId)) &&
        (query.status === 'all' || m.status === query.status) &&
        (query.dueBy === undefined || isDue(m, query.dueBy)),
    )
    .sort(compareMistakes);
}

/** MCP-21, ERR-3: open mistakes due on or before `date` (default today), oldest due first. */
export async function listDueMistakes(
  repo: Repository,
  clock: Clock,
  options: { nodeId?: string; date?: string } = {},
): Promise<Mistake[]> {
  const dueBy = options.date ?? (await studyToday(repo, clock));
  return listMistakes(repo, { status: 'open', dueBy, nodeId: options.nodeId });
}

/** ERR-2: a review on `reviewedOn` (default today; not in the future or before the mistake). */
export async function reviewMistake(
  repo: Repository,
  clock: Clock,
  id: string,
  rawInput: ReviewMistakeInput,
): Promise<Mistake> {
  const input = parseInput(reviewMistakeInputSchema, rawInput);
  const [mistake, today] = await Promise.all([findMistake(repo, id), studyToday(repo, clock)]);
  const on = input.reviewedOn ?? today;
  if (on > today) throw invalid('future_date', 'A review can’t be dated in the future.');
  if (on < mistake.createdOn) {
    throw invalid('before_created', 'A review can’t be dated before the mistake was noted.');
  }
  return repo.updateMistake(id, applyReview(mistake, input.result, on));
}

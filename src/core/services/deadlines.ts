import { invalid, notFound } from '../domain/errors';
import type { Deadline, IdGenerator } from '../domain/types';
import { hiddenIds } from '../logic/tree';
import type { DeadlinePatch, Repository } from '../repo/Repository';
import { createDeadlineInputSchema, updateDeadlineInputSchema } from '../schemas/inputs';
import type { CreateDeadlineInput, UpdateDeadlineInput } from '../schemas/inputs';
import { parseInput } from '../schemas/parse';

// DEAD-1: deadlines (title, date, node).

async function checkNode(repo: Repository, nodeId: string): Promise<void> {
  const nodes = await repo.listNodes();
  if (!nodes.some((n) => n.id === nodeId)) throw notFound('node_not_found');
  if (hiddenIds(nodes).has(nodeId)) {
    throw invalid('node_archived', 'That item is archived. Restore it first.');
  }
}

export async function listDeadlines(repo: Repository): Promise<Deadline[]> {
  return repo.listDeadlines();
}

export async function addDeadline(
  repo: Repository,
  newId: IdGenerator,
  rawInput: CreateDeadlineInput,
): Promise<Deadline> {
  const input = parseInput(createDeadlineInputSchema, rawInput);
  await checkNode(repo, input.nodeId);
  return repo.insertDeadline({ id: newId(), ...input });
}

export async function updateDeadline(
  repo: Repository,
  id: string,
  rawInput: UpdateDeadlineInput,
): Promise<Deadline> {
  const input = parseInput(updateDeadlineInputSchema, rawInput);
  if (input.nodeId !== undefined) await checkNode(repo, input.nodeId);
  const patch: DeadlinePatch = {};
  if (input.nodeId !== undefined) patch.nodeId = input.nodeId;
  if (input.title !== undefined) patch.title = input.title;
  if (input.dueOn !== undefined) patch.dueOn = input.dueOn;
  return repo.updateDeadline(id, patch);
}

export async function deleteDeadline(repo: Repository, id: string): Promise<void> {
  await repo.deleteDeadline(id);
}

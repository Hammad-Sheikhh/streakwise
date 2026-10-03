import { invalid, notFound } from '../domain/errors';
import type { Clock, Deadline, IdGenerator, TreeNode, UpcomingDeadline } from '../domain/types';
import { daysBetween, localDate } from '../logic/dates';
import { syllabusPercent } from '../logic/syllabus';
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

/** DEAD-2/3: deadlines from today on, for visible nodes, with days and syllabus left. */
export function selectUpcoming(
  nodes: readonly TreeNode[],
  deadlines: readonly Deadline[],
  today: string,
): UpcomingDeadline[] {
  const hidden = hiddenIds(nodes);
  return deadlines
    .filter((d) => d.dueOn >= today && !hidden.has(d.nodeId))
    .map((d) => {
      const done = syllabusPercent(nodes, d.nodeId);
      return {
        ...d,
        daysLeft: daysBetween(today, d.dueOn),
        syllabusLeftPercent: done === null ? null : 100 - done,
      };
    });
}

export async function upcomingDeadlines(
  repo: Repository,
  clock: Clock,
): Promise<UpcomingDeadline[]> {
  const [nodes, deadlines] = await Promise.all([repo.listNodes(), repo.listDeadlines()]);
  return selectUpcoming(nodes, deadlines, localDate(clock()));
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

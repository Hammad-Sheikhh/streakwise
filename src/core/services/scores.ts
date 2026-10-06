import { invalid, notFound } from '../domain/errors';
import type { Clock, IdGenerator, Score } from '../domain/types';
import { localDate } from '../logic/dates';
import { hiddenIds } from '../logic/tree';
import type { Repository } from '../repo/Repository';
import { createScoreInputSchema, updateScoreInputSchema } from '../schemas/inputs';
import type { CreateScoreInput, UpdateScoreInput } from '../schemas/inputs';
import { parseInput } from '../schemas/parse';

// SCORE-1: scores (past papers, quizzes, revision tests) on any node.

async function checkNode(repo: Repository, nodeId: string): Promise<void> {
  const nodes = await repo.listNodes();
  if (!nodes.some((n) => n.id === nodeId)) throw notFound('node_not_found');
  if (hiddenIds(nodes).has(nodeId)) {
    throw invalid('node_archived', 'That item is archived. Restore it first.');
  }
}

function checkDate(clock: Clock, takenOn: string): void {
  if (takenOn > localDate(clock())) {
    throw invalid('future_date', 'A score can’t be dated in the future.');
  }
}

/** Newest first. */
export async function listScores(repo: Repository): Promise<Score[]> {
  return repo.listScores();
}

export async function addScore(
  repo: Repository,
  clock: Clock,
  newId: IdGenerator,
  rawInput: CreateScoreInput,
): Promise<Score> {
  const input = parseInput(createScoreInputSchema, rawInput);
  checkDate(clock, input.takenOn);
  await checkNode(repo, input.nodeId);
  return repo.insertScore({ id: newId(), ...input });
}

export async function updateScore(
  repo: Repository,
  clock: Clock,
  id: string,
  rawInput: UpdateScoreInput,
): Promise<Score> {
  const input = parseInput(updateScoreInputSchema, rawInput);
  const score = (await repo.listScores()).find((s) => s.id === id);
  if (!score) throw notFound('score_not_found');
  if (input.takenOn !== undefined) checkDate(clock, input.takenOn);
  if (input.nodeId !== undefined && input.nodeId !== score.nodeId) {
    await checkNode(repo, input.nodeId);
  }
  if ((input.score ?? score.score) > (input.maxScore ?? score.maxScore)) {
    throw invalid('score_above_max', 'The score can’t be more than the maximum.');
  }
  return repo.updateScore(id, input);
}

/** A score recorded by completing a task can be deleted; the task stays completed. */
export async function deleteScore(repo: Repository, id: string): Promise<void> {
  await repo.deleteScore(id);
}

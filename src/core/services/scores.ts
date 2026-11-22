import { invalid, notFound } from '../domain/errors.js';
import type { Clock, IdGenerator, Score, ScoreKind } from '../domain/types.js';
import { hiddenIds } from '../logic/tree.js';
import type { Repository } from '../repo/Repository.js';
import { createScoreInputSchema, updateScoreInputSchema } from '../schemas/inputs.js';
import type { CreateScoreInput, UpdateScoreInput } from '../schemas/inputs.js';
import { parseInput } from '../schemas/parse.js';
import { studyToday } from './today.js';

// SCORE-1: scores (past papers, quizzes, revision tests) on any node.

async function checkNode(repo: Repository, nodeId: string): Promise<void> {
  const nodes = await repo.listNodes();
  if (!nodes.some((n) => n.id === nodeId)) throw notFound('node_not_found');
  if (hiddenIds(nodes).has(nodeId)) {
    throw invalid('node_archived', 'That item is archived. Restore it first.');
  }
}

async function checkDate(repo: Repository, clock: Clock, takenOn: string): Promise<void> {
  if (takenOn > (await studyToday(repo, clock))) {
    throw invalid('future_date', 'A score can’t be dated in the future.');
  }
}

/** Newest first. */
export async function listScores(repo: Repository): Promise<Score[]> {
  return repo.listScores();
}

/** MCP-18 `list_scores`: every filter is optional; dates are inclusive. */
export interface ScoreQuery {
  /** A node and everything under it. */
  nodeIds?: readonly string[];
  from?: string;
  to?: string;
  kind?: ScoreKind;
  /** Case-insensitive part of the title. */
  titleContains?: string;
  limit: number;
}

/** Newest first, capped at `limit`; `truncated` says whether more matched. */
export async function findScores(
  repo: Repository,
  query: ScoreQuery,
): Promise<{ scores: Score[]; truncated: boolean }> {
  const nodeIds = query.nodeIds && new Set(query.nodeIds);
  const title = query.titleContains?.trim().toLowerCase();
  const matching = (await repo.listScores()).filter(
    (s) =>
      (nodeIds === undefined || nodeIds.has(s.nodeId)) &&
      (query.from === undefined || s.takenOn >= query.from) &&
      (query.to === undefined || s.takenOn <= query.to) &&
      (query.kind === undefined || s.kind === query.kind) &&
      (!title || s.title.toLowerCase().includes(title)),
  );
  return { scores: matching.slice(0, query.limit), truncated: matching.length > query.limit };
}

export async function addScore(
  repo: Repository,
  clock: Clock,
  newId: IdGenerator,
  rawInput: CreateScoreInput,
): Promise<Score> {
  const input = parseInput(createScoreInputSchema, rawInput);
  await checkDate(repo, clock, input.takenOn);
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
  if (input.takenOn !== undefined) await checkDate(repo, clock, input.takenOn);
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

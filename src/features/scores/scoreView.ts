import type { Score, ScoreKind, TreeNode } from '@/core/domain/types';
import { scoreLines } from '@/core/logic/scores';
import { nodePath, subtreeIds } from '@/core/logic/tree';

import type { ChartLine } from './ScoreChart';

/** Scores in a track's subtree (all scores when trackId is empty) and of one kind (or all). */
export function filterScores(
  nodes: readonly TreeNode[],
  scores: readonly Score[],
  trackId: string,
  kind: ScoreKind | '',
): Score[] {
  const inTrack = trackId ? new Set(subtreeIds(nodes, trackId)) : null;
  return scores.filter((s) => (!inTrack || inTrack.has(s.nodeId)) && (!kind || s.kind === kind));
}

/** SCORE-2, SCORE-4: chart lines, colored by each node's place among all scored nodes. */
export function chartLines(
  nodes: readonly TreeNode[],
  allScores: readonly Score[],
  shown: readonly Score[],
): ChartLine[] {
  const colorIndex = new Map(scoreLines(nodes, allScores).map((line, i) => [line.nodeId, i]));
  return scoreLines(nodes, shown).map((line) => ({
    ...line,
    label: nodePath(nodes, line.nodeId).slice(-1)[0] ?? 'Deleted item',
    colorIndex: colorIndex.get(line.nodeId) ?? 0,
  }));
}

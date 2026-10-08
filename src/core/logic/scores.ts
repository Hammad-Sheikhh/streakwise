import type { Score, ScoreKind, TreeNode } from '../domain/types';

// SCORE-2, SCORE-4, SCORE-5 and SPEC §B9.11: score percentages, chart lines, and trends. Pure.

/** score ÷ max × 100, rounded to 1 decimal place. */
export function scorePercent(score: number, maxScore: number): number {
  return Math.round((score / maxScore) * 1000) / 10;
}

/**
 * The node a score's chart line belongs to: its subtask, or its track when it was recorded at
 * track level. Topic scores join their subtask's line.
 */
export function lineNodeId(nodes: readonly TreeNode[], nodeId: string): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let node = byId.get(nodeId);
  while (node && node.depth > 2 && node.parentId) node = byId.get(node.parentId);
  return node?.id ?? nodeId;
}

export interface ScorePoint {
  scoreId: string;
  date: string;
  percent: number;
}

export interface Trend {
  direction: 'up' | 'down' | 'flat';
  /** Difference in percentage points, 1 decimal place; never negative. */
  points: number;
}

export interface ScoreLine {
  nodeId: string;
  /** Oldest first. */
  points: ScorePoint[];
  /** null until the line has at least 2 results. */
  trend: Trend | null;
}

const average = (values: readonly number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * SCORE-4: the average of the last 3 results vs the 3 before them. With fewer than 4 results,
 * the oldest one is "before" and the rest are "last".
 */
export function trendOf(percents: readonly number[]): Trend | null {
  const n = percents.length;
  if (n < 2) return null;
  const recentCount = Math.min(3, n - 1);
  const recent = percents.slice(n - recentCount);
  const previous = percents.slice(Math.max(0, n - recentCount - 3), n - recentCount);
  const diff = Math.round((average(recent) - average(previous)) * 10) / 10;
  return { direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat', points: Math.abs(diff) };
}

/** SCORE-2: one line per subtask (or track), oldest result first, in the structure's order. */
export function scoreLines(nodes: readonly TreeNode[], scores: readonly Score[]): ScoreLine[] {
  const position = new Map(nodes.map((n, index) => [n.id, index]));
  const byLine = new Map<string, Score[]>();
  for (const score of scores) {
    const id = lineNodeId(nodes, score.nodeId);
    byLine.set(id, [...(byLine.get(id) ?? []), score]);
  }
  return [...byLine]
    .sort(([a], [b]) => (position.get(a) ?? Infinity) - (position.get(b) ?? Infinity))
    .map(([nodeId, lineScores]) => {
      const points = [...lineScores]
        .sort(
          (a, b) => a.takenOn.localeCompare(b.takenOn) || a.createdAt.localeCompare(b.createdAt),
        )
        .map((s) => ({
          scoreId: s.id,
          date: s.takenOn,
          percent: scorePercent(s.score, s.maxScore),
        }));
      return { nodeId, points, trend: trendOf(points.map((p) => p.percent)) };
    });
}

/**
 * SCORE-5: the kind a track's chart opens on, which is the kind it records most (the latest one
 * wins a tie). For example, a track used for past papers opens on past papers, one used for
 * quizzes on quizzes. null (all kinds) when it has no scores.
 */
export function defaultKind(scores: readonly Score[]): ScoreKind | null {
  const counts = new Map<ScoreKind, number>();
  // Newest first, so the first kind to reach the top count is the most recent one.
  const newestFirst = [...scores].sort(
    (a, b) => b.takenOn.localeCompare(a.takenOn) || b.createdAt.localeCompare(a.createdAt),
  );
  for (const score of newestFirst) counts.set(score.kind, (counts.get(score.kind) ?? 0) + 1);
  let best: ScoreKind | null = null;
  for (const score of newestFirst) {
    if (best === null || (counts.get(score.kind) ?? 0) > (counts.get(best) ?? 0)) best = score.kind;
  }
  return best;
}

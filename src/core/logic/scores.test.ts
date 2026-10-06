import { describe, expect, it } from 'vitest';

import type { Score, ScoreKind, TreeNode } from '../domain/types';
import { defaultKind, lineNodeId, scoreLines, scorePercent, trendOf } from './scores';

const T = '2026-10-01T00:00:00.000Z';

function node(id: string, parentId: string | null, depth: 1 | 2 | 3): TreeNode {
  return {
    id,
    parentId,
    depth,
    name: id,
    color: null,
    sortOrder: 0,
    weeklyTargetMinutes: null,
    topicStatus: null,
    topicDoneAt: null,
    archivedAt: null,
    createdAt: T,
    updatedAt: T,
  };
}

let n = 0;
function score(nodeId: string, takenOn: string, value: number, kind: ScoreKind = 'quiz'): Score {
  n += 1;
  return {
    id: `s${n}`,
    nodeId,
    taskCompletionId: null,
    kind,
    title: 'Test',
    takenOn,
    score: value,
    maxScore: 100,
    note: null,
    createdAt: `${takenOn}T00:00:00.000Z`,
  };
}

const nodes = [
  node('exams', null, 1),
  node('maths', 'exams', 2),
  node('ch3', 'maths', 3),
  node('english', 'exams', 2),
];

describe('scorePercent (§B9.11)', () => {
  it('rounds to 1 decimal place', () => {
    expect(scorePercent(17, 20)).toBe(85);
    expect(scorePercent(2, 3)).toBe(66.7);
    expect(scorePercent(0, 50)).toBe(0);
  });
});

describe('scoreLines (SCORE-2)', () => {
  it('puts topic scores on their subtask line and track scores on the track line', () => {
    expect(lineNodeId(nodes, 'ch3')).toBe('maths');
    expect(lineNodeId(nodes, 'exams')).toBe('exams');
    const lines = scoreLines(nodes, [
      score('english', '2026-09-02', 50),
      score('ch3', '2026-09-03', 70),
      score('maths', '2026-09-01', 60),
      score('exams', '2026-09-04', 80),
    ]);
    expect(lines.map((l) => l.nodeId)).toEqual(['exams', 'maths', 'english']);
    expect(lines[1]?.points.map((p) => p.percent)).toEqual([60, 70]);
  });
});

describe('trendOf (SCORE-4)', () => {
  it('compares the last 3 results with the 3 before them', () => {
    expect(trendOf([10, 20, 30, 70, 80, 90])).toEqual({ direction: 'up', points: 60 });
    expect(trendOf([0, 90, 80, 70])).toEqual({ direction: 'up', points: 80 });
    expect(trendOf([80, 60])).toEqual({ direction: 'down', points: 20 });
    expect(trendOf([50, 50])).toEqual({ direction: 'flat', points: 0 });
  });

  it('needs at least two results', () => {
    expect(trendOf([])).toBeNull();
    expect(trendOf([70])).toBeNull();
  });
});

describe('defaultKind (SCORE-5)', () => {
  it('picks the kind recorded most, the latest one on a tie', () => {
    expect(defaultKind([])).toBeNull();
    expect(
      defaultKind([
        score('maths', '2026-09-01', 1, 'past_paper'),
        score('maths', '2026-09-02', 1, 'past_paper'),
        score('maths', '2026-09-03', 1, 'quiz'),
      ]),
    ).toBe('past_paper');
    expect(
      defaultKind([
        score('maths', '2026-09-01', 1, 'quiz'),
        score('maths', '2026-09-05', 1, 'revision'),
      ]),
    ).toBe('revision');
  });
});

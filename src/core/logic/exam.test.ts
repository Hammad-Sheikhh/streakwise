import { describe, expect, it } from 'vitest';

import type { ExamTarget, Score, TreeNode } from '../domain/types.js';
import { examDetail, examModules, OVERALL_MODULE, rowTarget, targetSteps } from './exam.js';

// SPEC §B9.16: modules are the exam node's visible children; mock rows by title.

const node = (
  id: string,
  parentId: string | null,
  depth: 1 | 2 | 3,
  extra: Partial<TreeNode> = {},
) => ({ id, parentId, depth, name: id, sortOrder: 0, archivedAt: null, ...extra }) as TreeNode;

const nodes = [
  node('exam', null, 1),
  node('reading', 'exam', 2, { name: 'Reading', sortOrder: 0 }),
  node('listening', 'exam', 2, { name: 'Listening', sortOrder: 1 }),
  node('reading-1', 'reading', 3),
  node('old', 'exam', 2, { name: 'Old', sortOrder: 2, archivedAt: '2026-11-01T00:00:00.000Z' }),
];

let count = 0;
function score(
  nodeId: string,
  title: string,
  takenOn: string,
  value: number,
  extra: Partial<Score> = {},
): Score {
  count += 1;
  return {
    id: `00000000-0000-4000-8000-${String(count).padStart(12, '0')}`,
    nodeId,
    taskCompletionId: null,
    kind: 'mock_test',
    title,
    takenOn,
    score: value,
    maxScore: 20,
    note: null,
    createdAt: `${takenOn}T10:00:${String(count).padStart(2, '0')}.000Z`,
    ...extra,
  };
}

const target = (label: string, targetOn: string, minPercent: number): ExamTarget => ({
  id: `t-${label}`,
  deadlineId: 'd',
  label,
  targetOn,
  minPercent,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
});

describe('modules', () => {
  it('are the visible children in order, or the node itself without children', () => {
    expect(examModules(nodes, 'exam')).toEqual([
      { id: 'reading', name: 'Reading' },
      { id: 'listening', name: 'Listening' },
    ]);
    expect(examModules(nodes, 'reading-1')).toEqual([{ id: 'reading-1', name: 'reading-1' }]);
  });

  it('put scores in the module whose subtree holds them, and on the exam node in Overall', () => {
    const detail = examDetail(
      nodes,
      'exam',
      [
        score('reading-1', 'Mock 1', '2026-11-05', 12),
        score('listening', 'Quiz', '2026-11-06', 15, { kind: 'quiz' }),
        score('exam', 'Mock 1', '2026-11-05', 14),
        score('old', 'Mock 1', '2026-11-05', 1),
      ],
      [],
    );
    expect(detail.modules.map((m) => m.id)).toEqual(['reading', 'listening', OVERALL_MODULE]);
    expect(detail.series.find((s) => s.moduleId === 'reading')?.points).toEqual([
      { date: '2026-11-05', percent: 60, title: 'Mock 1' },
    ]);
    // The quiz is in the series but not in the mock grid.
    expect(detail.series.find((s) => s.moduleId === 'listening')?.points).toHaveLength(1);
    expect(detail.mocks).toHaveLength(1);
    expect(detail.mocks[0]?.cells.listening).toBeNull();
  });
});

describe('mock rows (EXAM-5, EXAM-6)', () => {
  it('group titles case-insensitively, order by first date, and keep the latest score', () => {
    const detail = examDetail(
      nodes,
      'exam',
      [
        score('reading', 'Mock 2', '2026-11-12', 10),
        score('reading', ' mock 1 ', '2026-11-05', 8),
        score('listening', 'Mock 1', '2026-11-06', 16),
        score('reading', 'MOCK 1', '2026-11-08', 12), // a retake: the latest wins
      ],
      [],
    );
    expect(detail.mocks.map((m) => [m.title, m.firstDate])).toEqual([
      ['mock 1', '2026-11-05'],
      ['Mock 2', '2026-11-12'],
    ]);
    const first = detail.mocks[0];
    expect(first?.cells.reading).toMatchObject({ score: 12, percent: 60 });
    expect(first?.cells.listening).toMatchObject({ score: 16, percent: 80 });
    expect(first?.average).toBe(70);
    expect(detail.mocks[1]?.average).toBe(50);
  });

  it('take the target named like the row, else the latest one dated by its first date', () => {
    const targets = [
      target('Mock 1', '2026-11-30', 60),
      target('Stage 2', '2026-11-10', 75),
      target('Stage 3', '2026-11-20', 85),
    ];
    expect(rowTarget(targets, 'mock 1', '2026-11-05')).toEqual({ label: 'Mock 1', minPercent: 60 });
    expect(rowTarget(targets, 'Mock 4', '2026-11-25')).toEqual({
      label: 'Stage 3',
      minPercent: 85,
    });
    expect(rowTarget(targets, 'Mock 0', '2026-11-01')).toBeNull();
    expect(targetSteps(targets).map((t) => t.minPercent)).toEqual([75, 85, 60]);
  });
});

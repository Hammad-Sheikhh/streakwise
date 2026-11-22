import { describe, expect, it } from 'vitest';

import type { TreeNode } from '../domain/types.js';
import { applyReview, countsByModule, isDue, moduleOf, newSchedule } from './mistakes.js';

// SPEC §B9.13: reviews +1, +3, and +7 days after the anchor date.

describe('the mistake schedule (ERR-2)', () => {
  const created = newSchedule('2026-11-01');

  it('starts at step 1, due the next day', () => {
    expect(created).toMatchObject({
      status: 'open',
      step: 1,
      anchorOn: '2026-11-01',
      nextDueOn: '2026-11-02',
      reviewCount: 0,
    });
    expect(isDue(created, '2026-11-01')).toBe(false);
    expect(isDue(created, '2026-11-02')).toBe(true);
    expect(isDue(created, '2026-11-05')).toBe(true);
  });

  it('moves right answers through +3 and +7 days to learned', () => {
    const second = applyReview(created, 'right', '2026-11-02');
    expect(second).toMatchObject({ step: 2, nextDueOn: '2026-11-04', reviewCount: 1 });
    const third = applyReview(second, 'right', '2026-11-04');
    expect(third).toMatchObject({ step: 3, nextDueOn: '2026-11-08', lastResult: 'right' });
    const learned = applyReview(third, 'right', '2026-11-08');
    expect(learned).toMatchObject({
      status: 'learned',
      nextDueOn: null,
      learnedOn: '2026-11-08',
      reviewCount: 3,
    });
    expect(isDue(learned, '2026-12-01')).toBe(false);
  });

  it('schedules the day after a late review when the next date has passed', () => {
    const second = applyReview(created, 'right', '2026-11-06');
    // anchor + 3 = 11-04 is not after the review day, so it's the day after the review.
    expect(second).toMatchObject({ step: 2, nextDueOn: '2026-11-07' });
  });

  it('starts again from the review day after a wrong answer', () => {
    const third = applyReview(applyReview(created, 'right', '2026-11-02'), 'right', '2026-11-04');
    const reset = applyReview(third, 'wrong', '2026-11-08');
    expect(reset).toMatchObject({
      status: 'open',
      step: 1,
      anchorOn: '2026-11-08',
      nextDueOn: '2026-11-09',
      lastResult: 'wrong',
      lastReviewedOn: '2026-11-08',
      reviewCount: 3,
    });
  });

  it("can't review a learned mistake", () => {
    const learned = { ...created, status: 'learned' as const, nextDueOn: null };
    expect(() => applyReview(learned, 'right', '2026-11-09')).toThrow(/already learned/);
  });
});

describe('modules (ERR-4)', () => {
  const node = (id: string, parentId: string | null, depth: 1 | 2 | 3) =>
    ({ id, parentId, depth }) as TreeNode;
  const nodes = [node('track', null, 1), node('sub', 'track', 2), node('topic', 'sub', 3)];

  it('counts a topic for its subtask and a track for itself', () => {
    expect(moduleOf(nodes, 'topic')).toBe('sub');
    expect(moduleOf(nodes, 'sub')).toBe('sub');
    expect(moduleOf(nodes, 'track')).toBe('track');
    expect(
      countsByModule(nodes, [
        { nodeId: 'topic', status: 'open' },
        { nodeId: 'sub', status: 'learned' },
        { nodeId: 'track', status: 'open' },
      ]),
    ).toEqual([
      { moduleId: 'sub', open: 1, learned: 1 },
      { moduleId: 'track', open: 1, learned: 0 },
    ]);
  });
});

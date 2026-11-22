import { conflict } from '../domain/errors.js';
import type { Mistake, ReviewResult, TreeNode } from '../domain/types.js';
import { addDays } from './dates.js';

// ERR-2, SPEC §B9.13: the mistake review schedule. Pure; dates are study days.

/** Days from the anchor date to the review at each step. */
export const REVIEW_INTERVAL_DAYS = { 1: 1, 2: 3, 3: 7 } as const;

/** The schedule fields a review changes. */
export type ScheduleFields = Pick<
  Mistake,
  | 'status'
  | 'step'
  | 'anchorOn'
  | 'nextDueOn'
  | 'reviewCount'
  | 'lastReviewedOn'
  | 'lastResult'
  | 'learnedOn'
>;

/** A new mistake: step 1, due the day after it was noted. */
export function newSchedule(createdOn: string): ScheduleFields {
  return {
    status: 'open',
    step: 1,
    anchorOn: createdOn,
    nextDueOn: addDays(createdOn, REVIEW_INTERVAL_DAYS[1]),
    reviewCount: 0,
    lastReviewedOn: null,
    lastResult: null,
    learnedOn: null,
  };
}

/** Open and due on or before `day`. */
export function isDue(mistake: Pick<Mistake, 'status' | 'nextDueOn'>, day: string): boolean {
  return mistake.status === 'open' && mistake.nextDueOn !== null && mistake.nextDueOn <= day;
}

/**
 * Applies one review on day `on`. Right moves to the next step, dated from the anchor (or the day
 * after the review, when the review was late); right at step 3 marks it learned. Wrong starts
 * again at step 1 from the review day. A learned mistake can't be reviewed.
 */
export function applyReview(
  mistake: ScheduleFields,
  result: ReviewResult,
  on: string,
): ScheduleFields {
  if (mistake.status === 'learned') throw conflict('mistake_learned');
  const reviewed = {
    reviewCount: mistake.reviewCount + 1,
    lastReviewedOn: on,
    lastResult: result,
  };
  if (result === 'wrong') {
    return {
      ...reviewed,
      status: 'open',
      step: 1,
      anchorOn: on,
      nextDueOn: addDays(on, REVIEW_INTERVAL_DAYS[1]),
      learnedOn: null,
    };
  }
  if (mistake.step === 3) {
    return {
      ...reviewed,
      status: 'learned',
      step: 3,
      anchorOn: mistake.anchorOn,
      nextDueOn: null,
      learnedOn: on,
    };
  }
  const step = mistake.step === 1 ? 2 : 3;
  const scheduled = addDays(mistake.anchorOn, REVIEW_INTERVAL_DAYS[step]);
  return {
    ...reviewed,
    status: 'open',
    step,
    anchorOn: mistake.anchorOn,
    nextDueOn: scheduled > on ? scheduled : addDays(on, 1),
    learnedOn: null,
  };
}

/**
 * ERR-4: the module a mistake counts for: its subtask, or its track when it's on the track
 * itself (a topic counts for the subtask above it).
 */
export function moduleOf(nodes: readonly TreeNode[], nodeId: string): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let node = byId.get(nodeId);
  while (node && node.depth > 2 && node.parentId) node = byId.get(node.parentId);
  return node?.id ?? nodeId;
}

/** ERR-4: open and learned counts per module, in no particular order. */
export function countsByModule(
  nodes: readonly TreeNode[],
  mistakes: readonly Pick<Mistake, 'nodeId' | 'status'>[],
): { moduleId: string; open: number; learned: number }[] {
  const counts = new Map<string, { moduleId: string; open: number; learned: number }>();
  for (const mistake of mistakes) {
    const moduleId = moduleOf(nodes, mistake.nodeId);
    const entry = counts.get(moduleId) ?? { moduleId, open: 0, learned: 0 };
    entry[mistake.status === 'open' ? 'open' : 'learned'] += 1;
    counts.set(moduleId, entry);
  }
  return [...counts.values()];
}

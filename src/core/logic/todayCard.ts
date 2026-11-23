import type { SessionFact, TaskItem, TreeNode } from '../domain/types.js';
import { addDays, daysBetween, weekStart } from './dates.js';
import { moduleOf } from './mistakes.js';

// TODAY-1–3 (SPEC §B9.14, §B9.15). Pure; dates are study days.

/** Days from today to Sunday, both included (1–7). */
export function daysLeftInWeek(today: string): number {
  return daysBetween(today, addDays(weekStart(today), 6)) + 1;
}

/** §B9.14: the whole minutes a day still needed to reach the weekly target by Sunday. */
export function neededPerDay(
  targetMinutes: number,
  minutesThisWeek: number,
  today: string,
): number {
  return Math.ceil(Math.max(0, targetMinutes - minutesThisWeek) / daysLeftInWeek(today));
}

/**
 * §B9.15: among open one-off tasks, those due today, else the overdue ones. Top-level tasks come
 * first, then the earliest due date (so the oldest overdue), then sort order.
 */
export function todaysTask(items: readonly TaskItem[], today: string): TaskItem | null {
  const open = items.filter(
    ({ task, completion }) =>
      task.recurrence === 'none' &&
      task.dueOn !== null &&
      task.archivedAt === null &&
      completion === null,
  );
  const dueToday = open.filter(({ task }) => task.dueOn === today);
  const candidates =
    dueToday.length > 0 ? dueToday : open.filter(({ task }) => (task.dueOn ?? '') < today);
  const [first] = [...candidates].sort(
    (a, b) =>
      Number(a.task.parentTaskId !== null) - Number(b.task.parentTaskId !== null) ||
      (a.task.dueOn ?? '').localeCompare(b.task.dueOn ?? '') ||
      a.task.sortOrder - b.task.sortOrder,
  );
  return first ?? null;
}

/**
 * TODAY-2: today's minutes per subtask, in tree order. A topic counts for the subtask above it;
 * time logged on a track itself counts for the track.
 */
export function minutesTodayByModule(
  nodes: readonly TreeNode[],
  facts: readonly SessionFact[],
  today: string,
): { nodeId: string; minutes: number }[] {
  const totals = new Map<string, number>();
  for (const fact of facts) {
    if (fact.studiedOn !== today) continue;
    const moduleId = moduleOf(nodes, fact.nodeId);
    totals.set(moduleId, (totals.get(moduleId) ?? 0) + fact.minutes);
  }
  const order = new Map(nodes.map((n, index) => [n.id, index]));
  return [...totals]
    .map(([nodeId, minutes]) => ({ nodeId, minutes }))
    .sort((a, b) => (order.get(a.nodeId) ?? 0) - (order.get(b.nodeId) ?? 0));
}

import type { Task, TaskCompletion } from '../domain/types';
import { addDays, weekStart } from './dates';

// TASK-5, TASK-7, TASK-9 (SPEC §B9.9): when tasks count as done, due, or overdue. Pure; `today`
// is a local date.

const NO_DUE_DATE = '9999-12-31';

/** The period a completion made today belongs to: this week's Monday for weekly tasks. */
export function periodStartFor(task: Pick<Task, 'recurrence'>, today: string): string | null {
  return task.recurrence === 'weekly' ? weekStart(today) : null;
}

/** The completion that makes the task count as done today, if any. */
export function currentCompletion(
  task: Pick<Task, 'id' | 'recurrence'>,
  completions: readonly TaskCompletion[],
  today: string,
): TaskCompletion | undefined {
  const period = periodStartFor(task, today);
  return completions.find((c) => c.taskId === task.id && c.periodStart === period);
}

/** Ids of archived tasks and everything nested under them. */
export function hiddenTaskIds(tasks: readonly Task[]): Set<string> {
  const parentOf = new Map(tasks.map((t) => [t.id, t.parentTaskId]));
  const archived = new Set(tasks.filter((t) => t.archivedAt !== null).map((t) => t.id));
  const hidden = new Set<string>();
  for (const task of tasks) {
    // Walk up the parents; `seen` guards against a corrupt cycle.
    const seen = new Set<string>();
    let id: string | null = task.id;
    while (id !== null && !seen.has(id)) {
      if (archived.has(id)) {
        hidden.add(task.id);
        break;
      }
      seen.add(id);
      id = parentOf.get(id) ?? null;
    }
  }
  return hidden;
}

export interface DueTask {
  task: Task;
  /** One-off tasks whose due date has passed. */
  overdue: boolean;
}

/**
 * TASK-7: weekly tasks not yet completed this week, plus one-off tasks due on or before this
 * Sunday that aren't completed. Overdue first, then by due date (weekly tasks last).
 */
export function tasksDueThisWeek(
  tasks: readonly Task[],
  completions: readonly TaskCompletion[],
  today: string,
): DueTask[] {
  const sunday = addDays(weekStart(today), 6);
  const hidden = hiddenTaskIds(tasks);
  const due: DueTask[] = [];
  for (const task of tasks) {
    if (hidden.has(task.id) || currentCompletion(task, completions, today)) continue;
    if (task.recurrence === 'weekly') {
      due.push({ task, overdue: false });
    } else if (task.dueOn !== null && task.dueOn <= sunday) {
      due.push({ task, overdue: task.dueOn < today });
    }
  }
  return due.sort(compareDue);
}

/** Display order for due tasks: overdue first, then by due date, weekly ones (no date) last. */
export function compareDue(
  a: { task: Pick<Task, 'dueOn' | 'sortOrder'>; overdue: boolean },
  b: { task: Pick<Task, 'dueOn' | 'sortOrder'>; overdue: boolean },
): number {
  return (
    Number(b.overdue) - Number(a.overdue) ||
    (a.task.dueOn ?? NO_DUE_DATE).localeCompare(b.task.dueOn ?? NO_DUE_DATE) ||
    a.task.sortOrder - b.task.sortOrder
  );
}

/** TASK-9: direct, visible sub-tasks done vs total; weekly ones count if done this week. */
export function subtaskProgress(
  parentId: string,
  tasks: readonly Task[],
  completions: readonly TaskCompletion[],
  today: string,
): { done: number; total: number } {
  const hidden = hiddenTaskIds(tasks);
  const children = tasks.filter((t) => t.parentTaskId === parentId && !hidden.has(t.id));
  const done = children.filter((t) => currentCompletion(t, completions, today)).length;
  return { done, total: children.length };
}

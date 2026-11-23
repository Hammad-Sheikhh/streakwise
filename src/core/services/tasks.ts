import { conflict, invalid, notFound } from '../domain/errors.js';
import type {
  Clock,
  IdGenerator,
  Score,
  Task,
  TaskCompletion,
  TaskItem,
  TreeNode,
} from '../domain/types.js';
import {
  currentCompletion,
  hiddenTaskIds,
  periodStartFor,
  subtaskProgress,
  tasksDueThisWeek,
} from '../logic/tasks.js';
import { hiddenIds } from '../logic/tree.js';
import type { Repository, TaskPatch } from '../repo/Repository.js';
import {
  completeTaskInputSchema,
  createTaskInputSchema,
  localDateSchema,
  updateTaskInputSchema,
} from '../schemas/inputs.js';
import type { CompleteTaskInput, CreateTaskInput, UpdateTaskInput } from '../schemas/inputs.js';
import { parseInput } from '../schemas/parse.js';
import { studyToday } from './today.js';

// TASK-1–11: tasks and sub-tasks, one-off or weekly, optionally scored.

function findTask(tasks: readonly Task[], id: string): Task {
  const task = tasks.find((t) => t.id === id);
  if (!task) throw notFound('task_not_found');
  return task;
}

/** "Other" (no node) is always allowed; a node must exist and not be archived. */
async function assertVisibleNode(repo: Repository, nodeId: string | null): Promise<void> {
  if (nodeId === null) return;
  const nodes = await repo.listNodes();
  if (!nodes.some((n) => n.id === nodeId)) throw notFound('node_not_found');
  if (hiddenIds(nodes).has(nodeId)) {
    throw invalid('node_archived', 'That item is archived. Restore it first.');
  }
}

/**
 * Every task (archived ones only when asked) with its state as of `today`, in display order.
 * Pure, so the dashboard and MCP can build it from rows they already read.
 */
export function buildTaskItems(
  tasks: readonly Task[],
  completions: readonly TaskCompletion[],
  nodes: readonly TreeNode[],
  today: string,
  options: { includeArchived?: boolean } = {},
): TaskItem[] {
  const hidden = hiddenTaskIds(tasks);
  // TREE-2: archiving a node hides its tasks too, even while "Show archived" lists archived tasks.
  const hiddenNodes = hiddenIds(nodes);
  const due = new Map(tasksDueThisWeek(tasks, completions, today).map((d) => [d.task.id, d]));
  const hasChildren = new Set(tasks.map((t) => t.parentTaskId));

  return tasks
    .filter(
      (t) =>
        (options.includeArchived || !hidden.has(t.id)) &&
        (t.nodeId === null || !hiddenNodes.has(t.nodeId)),
    )
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    )
    .map((task) => ({
      task,
      completion: currentCompletion(task, completions, today) ?? null,
      dueThisWeek: due.has(task.id),
      overdue: due.get(task.id)?.overdue ?? false,
      subtasks: hasChildren.has(task.id)
        ? subtaskProgress(task.id, tasks, completions, today)
        : null,
      completedWeeks:
        task.recurrence === 'weekly'
          ? completions
              .filter((c) => c.taskId === task.id && c.periodStart !== null)
              .map((c) => c.periodStart ?? '')
              .sort()
              .reverse()
          : [],
    }));
}

/** Every task with its state as of today (the study day, DAY-2), in display order. */
export async function listTaskItems(
  repo: Repository,
  clock: Clock,
  options: { includeArchived?: boolean } = {},
): Promise<TaskItem[]> {
  const [tasks, completions, nodes, today] = await Promise.all([
    repo.listTasks(),
    repo.listTaskCompletions(),
    repo.listNodes(),
    studyToday(repo, clock),
  ]);
  return buildTaskItems(tasks, completions, nodes, today, options);
}

export async function createTask(
  repo: Repository,
  newId: IdGenerator,
  rawInput: CreateTaskInput,
): Promise<Task> {
  const input = parseInput(createTaskInputSchema, rawInput);
  await assertVisibleNode(repo, input.nodeId);
  const tasks = await repo.listTasks();
  if (input.parentTaskId !== null) {
    findTask(tasks, input.parentTaskId);
    if (hiddenTaskIds(tasks).has(input.parentTaskId)) {
      throw invalid('parent_archived', 'Restore the archived task before adding to it.');
    }
  }
  const siblings = tasks.filter((t) => t.parentTaskId === input.parentTaskId);
  return repo.insertTask({
    id: newId(),
    ...input,
    defaultMaxScore: input.isScored ? input.defaultMaxScore : null,
    sortOrder: Math.max(-1, ...siblings.map((t) => t.sortOrder)) + 1,
  });
}

/** TASK-8: edit, archive, or restore. */
export async function updateTask(
  repo: Repository,
  clock: Clock,
  id: string,
  rawInput: UpdateTaskInput,
): Promise<Task> {
  const input = parseInput(updateTaskInputSchema, rawInput);
  const task = findTask(await repo.listTasks(), id);
  if (input.nodeId !== undefined && input.nodeId !== task.nodeId) {
    await assertVisibleNode(repo, input.nodeId);
  }

  const { archived, ...fields } = input;
  const patch: TaskPatch = { ...fields };
  // Switching to weekly drops the due date, so the owner doesn't have to clear it first.
  if (patch.recurrence === 'weekly') patch.dueOn = null;
  if (archived !== undefined) {
    patch.archivedAt = archived ? (task.archivedAt ?? clock().toISOString()) : null;
  }

  const result = { ...task, ...patch };
  if (result.recurrence === 'weekly' && result.dueOn !== null) {
    throw invalid('weekly_due_date', 'Weekly tasks don’t have a due date.');
  }
  if (result.isScored && result.nodeId === null) {
    throw invalid(
      'scored_needs_node',
      'Scored tasks need a track or subject, so the score has somewhere to go.',
    );
  }
  if (result.isScored && result.defaultMaxScore === null) {
    throw invalid('max_required', 'Enter the usual maximum score.');
  }
  if (!result.isScored) patch.defaultMaxScore = null;
  return repo.updateTask(id, patch);
}

/** The ids of a task's sub-tasks at every depth (not the task itself). */
export function descendantTaskIds(tasks: readonly Task[], id: string): string[] {
  const ids: string[] = [];
  const visit = (parentId: string) => {
    for (const task of tasks) {
      if (task.parentTaskId === parentId) {
        ids.push(task.id);
        visit(task.id);
      }
    }
  };
  visit(id);
  return ids;
}

/** TASK-8: removes sub-tasks and completions too; linked scores are kept, unlinked. */
export async function deleteTask(repo: Repository, id: string): Promise<void> {
  await repo.deleteTask(id);
}

/**
 * TASK-4–6, TASK-11: completes the task for the period of `completedOn` (default today; never in
 * the future, no lower limit), recording a score dated that day if it's scored.
 */
export async function completeTask(
  repo: Repository,
  clock: Clock,
  newId: IdGenerator,
  id: string,
  rawInput: CompleteTaskInput,
): Promise<TaskCompletion> {
  const input = parseInput(completeTaskInputSchema, rawInput);
  const [tasks, today] = await Promise.all([repo.listTasks(), studyToday(repo, clock)]);
  const task = findTask(tasks, id);
  if (hiddenTaskIds(tasks).has(id)) {
    throw invalid('task_archived', 'Restore the archived task before completing it.');
  }
  const completedOn = input.completedOn ?? today;
  if (completedOn > today) {
    throw invalid('future_date', 'A task can’t be completed in the future.');
  }

  let score = null;
  if (task.isScored) {
    const maxScore = input.maxScore ?? task.defaultMaxScore;
    if (input.score === undefined) throw invalid('score_required', 'Enter the score.');
    if (maxScore === null) throw invalid('max_required', 'Enter the maximum score.');
    if (task.nodeId === null) {
      throw invalid('scored_needs_node', 'Give this task a track or subject before scoring it.');
    }
    if (input.score > maxScore) {
      throw invalid('score_above_max', 'The score can’t be more than the maximum.');
    }
    score = {
      id: newId(),
      nodeId: task.nodeId,
      kind: input.kind,
      title: task.title,
      takenOn: completedOn,
      score: input.score,
      maxScore,
      note: input.note,
    };
  } else if (input.score !== undefined) {
    throw invalid('not_scored', 'This task isn’t scored.');
  }

  return repo.completeTask({
    taskId: id,
    periodStart: periodStartFor(task, completedOn),
    completedAt: clock().toISOString(),
    completedOn,
    note: input.note,
    score,
  });
}

/** TASK-6: deletes the completion and its linked score (the UI confirms first). */
export async function uncompleteTask(repo: Repository, completionId: string): Promise<void> {
  await repo.uncompleteTask(completionId);
}

/**
 * TASK-11, MCP-18: unticks the task for the period containing `date` (default today): the
 * week of that date for weekly tasks, the one completion for one-off tasks. Removes the score
 * that completing it created, atomically. Returns what was removed.
 */
export async function uncompleteTaskOn(
  repo: Repository,
  clock: Clock,
  taskId: string,
  date?: string,
): Promise<{ completion: TaskCompletion; score: Score | null }> {
  const day =
    date === undefined ? await studyToday(repo, clock) : parseInput(localDateSchema, date);
  const [tasks, completions] = await Promise.all([repo.listTasks(), repo.listTaskCompletions()]);
  const task = findTask(tasks, taskId);
  const period = periodStartFor(task, day);
  const completion = completions.find((c) => c.taskId === taskId && c.periodStart === period);
  if (!completion) throw conflict('not_completed');
  const score = (await repo.listScores()).find((s) => s.taskCompletionId === completion.id) ?? null;
  await repo.uncompleteTask(completion.id);
  return { completion, score };
}

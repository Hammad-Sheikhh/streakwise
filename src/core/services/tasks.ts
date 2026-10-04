import { invalid, notFound } from '../domain/errors';
import type { Clock, IdGenerator, Task, TaskCompletion, TaskItem } from '../domain/types';
import { localDate } from '../logic/dates';
import {
  currentCompletion,
  hiddenTaskIds,
  periodStartFor,
  subtaskProgress,
  tasksDueThisWeek,
} from '../logic/tasks';
import { hiddenIds } from '../logic/tree';
import type { Repository, TaskPatch } from '../repo/Repository';
import {
  completeTaskInputSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
} from '../schemas/inputs';
import type { CompleteTaskInput, CreateTaskInput, UpdateTaskInput } from '../schemas/inputs';
import { parseInput } from '../schemas/parse';

// TASK-1–9: tasks and sub-tasks, one-off or weekly, optionally scored.

function findTask(tasks: readonly Task[], id: string): Task {
  const task = tasks.find((t) => t.id === id);
  if (!task) throw notFound('task_not_found');
  return task;
}

async function assertVisibleNode(repo: Repository, nodeId: string): Promise<void> {
  const nodes = await repo.listNodes();
  if (!nodes.some((n) => n.id === nodeId)) throw notFound('node_not_found');
  if (hiddenIds(nodes).has(nodeId)) {
    throw invalid('node_archived', 'That item is archived. Restore it first.');
  }
}

/** Every task (archived ones only when asked) with its state as of today, in display order. */
export async function listTaskItems(
  repo: Repository,
  clock: Clock,
  options: { includeArchived?: boolean } = {},
): Promise<TaskItem[]> {
  const [tasks, completions] = await Promise.all([repo.listTasks(), repo.listTaskCompletions()]);
  const today = localDate(clock());
  const hidden = hiddenTaskIds(tasks);
  const due = new Map(tasksDueThisWeek(tasks, completions, today).map((d) => [d.task.id, d]));
  const hasChildren = new Set(tasks.map((t) => t.parentTaskId));

  return tasks
    .filter((t) => options.includeArchived || !hidden.has(t.id))
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
  if (result.isScored && result.defaultMaxScore === null) {
    throw invalid('max_required', 'Enter the usual maximum score.');
  }
  if (!result.isScored) patch.defaultMaxScore = null;
  return repo.updateTask(id, patch);
}

/** TASK-8: removes sub-tasks and completions too; linked scores are kept, unlinked. */
export async function deleteTask(repo: Repository, id: string): Promise<void> {
  await repo.deleteTask(id);
}

/** TASK-4–6: completes the task for today's period, recording a score if it's scored. */
export async function completeTask(
  repo: Repository,
  clock: Clock,
  newId: IdGenerator,
  id: string,
  rawInput: CompleteTaskInput,
): Promise<TaskCompletion> {
  const input = parseInput(completeTaskInputSchema, rawInput);
  const tasks = await repo.listTasks();
  const task = findTask(tasks, id);
  if (hiddenTaskIds(tasks).has(id)) {
    throw invalid('task_archived', 'Restore the archived task before completing it.');
  }

  const now = clock();
  const today = localDate(now);
  let score = null;
  if (task.isScored) {
    const maxScore = input.maxScore ?? task.defaultMaxScore;
    if (input.score === undefined) throw invalid('score_required', 'Enter the score.');
    if (maxScore === null) throw invalid('max_required', 'Enter the maximum score.');
    if (input.score > maxScore) {
      throw invalid('score_above_max', 'The score can’t be more than the maximum.');
    }
    score = {
      id: newId(),
      nodeId: task.nodeId,
      kind: input.kind,
      title: task.title,
      takenOn: today,
      score: input.score,
      maxScore,
      note: input.note,
    };
  } else if (input.score !== undefined) {
    throw invalid('not_scored', 'This task isn’t scored.');
  }

  return repo.completeTask({
    taskId: id,
    periodStart: periodStartFor(task, today),
    completedAt: now.toISOString(),
    note: input.note,
    score,
  });
}

/** TASK-6: deletes the completion and its linked score (the UI confirms first). */
export async function uncompleteTask(repo: Repository, completionId: string): Promise<void> {
  await repo.uncompleteTask(completionId);
}

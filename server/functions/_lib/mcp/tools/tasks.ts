import { DomainError, notFound } from '../../../../../src/core/domain/errors.js';
import { compareDue } from '../../../../../src/core/logic/tasks.js';
import { subtreeIds } from '../../../../../src/core/logic/tree.js';
import type { UpdateTaskInput } from '../../../../../src/core/schemas/inputs.js';
import {
  addTaskToolSchema,
  completeTaskToolSchema,
  deleteTaskToolSchema,
  getTaskToolSchema,
  listTasksToolSchema,
  uncompleteTaskToolSchema,
  updateTaskToolSchema,
} from '../../../../../src/core/schemas/mcp.js';
import {
  buildTaskItems,
  completeTask,
  createTask,
  deleteTask,
  descendantTaskIds,
  listTaskItems,
  uncompleteTaskOn,
  updateTask,
} from '../../../../../src/core/services/tasks.js';
import { cap, DELETE, READ_ONLY, WRITE } from '../tool.js';
import type { ToolContext } from '../tool.js';
import { compactTaskList, fullTaskView, scoreView, taskView } from '../views.js';

// Tasks: list (compact or full, with filters), one in full, add, complete for a date, untick,
// edit, and delete (MCP-9, MCP-13, MCP-15, MCP-18, MCP-19).

export function registerTaskTools(ctx: ToolContext): void {
  const { server, run } = ctx;
  const { repo, clock, newId } = ctx.deps;

  /** Every task (archived ones too) as it is today, to find one by id after a change. */
  const itemById = async (id: string) => {
    const [tasks, completions, nodes] = await Promise.all([
      repo.listTasks(),
      repo.listTaskCompletions(),
      repo.listNodes(),
    ]);
    const items = buildTaskItems(tasks, completions, nodes, ctx.today, { includeArchived: true });
    const item = items.find((i) => i.task.id === id);
    if (!item) throw notFound('task_not_found');
    return { nodes, items, item };
  };

  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks',
      description:
        'Lists tasks with their state today: done (this week, for weekly tasks), due this week, ' +
        'overdue, sub-task progress, and completed weeks for weekly tasks. Filter by node ' +
        '(including everything under it), status, due dates, and title. parentTaskId shows ' +
        'nesting. compact: true gives a much smaller answer without descriptions.',
      inputSchema: listTasksToolSchema,
      annotations: READ_ONLY,
    },
    ({ node, status, include_archived, compact, due_from, due_to, title_contains, limit }) =>
      run('list_tasks', async () => {
        const nodes = await repo.listNodes();
        const inNode =
          node === undefined ? null : new Set(subtreeIds(nodes, ctx.node(nodes, node).id));
        let items = (
          await listTaskItems(repo, clock, { includeArchived: include_archived })
        ).filter((item) => !inNode || (item.task.nodeId !== null && inNode.has(item.task.nodeId)));
        if (status === 'open') items = items.filter((i) => i.completion === null);
        if (status === 'done') items = items.filter((i) => i.completion !== null);
        if (status === 'due_this_week') items = items.filter((i) => i.dueThisWeek).sort(compareDue);

        // MCP-13: a due range keeps only one-off tasks with a due date in it.
        const from = ctx.optionalDate(due_from);
        const to = ctx.optionalDate(due_to);
        if (from !== undefined || to !== undefined) {
          items = items.filter(
            ({ task }) =>
              task.recurrence === 'none' &&
              task.dueOn !== null &&
              (from === undefined || task.dueOn >= from) &&
              (to === undefined || task.dueOn <= to),
          );
        }
        const title = title_contains?.toLowerCase();
        if (title) items = items.filter(({ task }) => task.title.toLowerCase().includes(title));

        const page = cap(items, limit);
        return {
          today: ctx.today,
          tasks: compact
            ? compactTaskList(nodes, page.items)
            : page.items.map((item) => taskView(nodes, item)),
          truncated: page.truncated,
        };
      }),
  );

  server.registerTool(
    'get_task',
    {
      title: 'Get one task in full',
      description:
        'One task with everything: description, state today, its completion (date, note, and ' +
        'score) when done, completed weeks for weekly tasks, and all its sub-tasks nested in ' +
        '"subtasks", each in the same full shape.',
      inputSchema: getTaskToolSchema,
      annotations: READ_ONLY,
    },
    ({ task_id }) =>
      run('get_task', async () => {
        const [{ nodes, items, item }, scores] = await Promise.all([
          itemById(task_id),
          repo.listScores(),
        ]);
        return { today: ctx.today, task: fullTaskView(nodes, items, scores, item) };
      }),
  );

  server.registerTool(
    'add_task',
    {
      title: 'Add a task',
      description:
        'Creates a task (or a sub-task with parent_task_id) on a node. One-off tasks may have a ' +
        'due date; weekly tasks repeat every week and have none. Scored tasks need ' +
        'default_max_score. Returns the new task with its id.',
      inputSchema: addTaskToolSchema,
      annotations: WRITE,
    },
    (input) =>
      run('add_task', async () => {
        const nodes = await repo.listNodes();
        const nodeId = input.node === undefined ? null : ctx.node(nodes, input.node).id;
        const created = await createTask(repo, newId, {
          nodeId,
          parentTaskId: input.parent_task_id ?? null,
          title: input.title,
          description: input.description ?? null,
          recurrence: input.weekly ? 'weekly' : 'none',
          dueOn: input.due_date === undefined ? null : ctx.date(input.due_date),
          isScored: input.scored,
          defaultMaxScore: input.default_max_score ?? null,
        });
        const item = (await listTaskItems(repo, clock)).find((i) => i.task.id === created.id);
        if (!item) throw notFound('task_not_found');
        return { task: taskView(nodes, item) };
      }),
  );

  server.registerTool(
    'complete_task',
    {
      title: 'Complete a task',
      description:
        'Marks a task done for today, or for an earlier day with "date" (for weekly tasks: for ' +
        'that week). Scored tasks need "score" (max_score defaults to the task’s usual maximum) ' +
        'and record a linked score dated that day. Fails if it is already done for that period. ' +
        'Returns the task and any score.',
      inputSchema: completeTaskToolSchema,
      annotations: WRITE,
    },
    ({ task_id, score, max_score, kind, note, date }) =>
      run('complete_task', async () => {
        const completion = await completeTask(repo, clock, newId, task_id, {
          score,
          maxScore: max_score,
          kind,
          note: note ?? null,
          completedOn: ctx.date(date),
        });
        const [nodes, items, scores] = await Promise.all([
          repo.listNodes(),
          listTaskItems(repo, clock),
          repo.listScores(),
        ]);
        const item = items.find((i) => i.task.id === task_id);
        if (!item) throw notFound('task_not_found');
        const linked = scores.find((s) => s.taskCompletionId === completion.id);
        return {
          task: taskView(nodes, item),
          score: linked ? scoreView(nodes, linked) : undefined,
        };
      }),
  );

  server.registerTool(
    'uncomplete_task',
    {
      title: 'Untick a task',
      description:
        'Removes a task’s completion: the one for the week containing "date" for weekly tasks ' +
        '(default this week), the only one for one-off tasks. The score that completing it ' +
        'recorded is removed too. Returns the task and what was removed.',
      inputSchema: uncompleteTaskToolSchema,
      annotations: WRITE,
    },
    ({ task_id, date }) =>
      run('uncomplete_task', async () => {
        const removed = await uncompleteTaskOn(repo, clock, task_id, ctx.date(date));
        const { nodes, item } = await itemById(task_id);
        return {
          task: taskView(nodes, item),
          removed: {
            date: removed.completion.completedOn,
            score: removed.score ? scoreView(nodes, removed.score) : undefined,
          },
        };
      }),
  );

  server.registerTool(
    'update_task',
    {
      title: 'Edit a task',
      description:
        'Changes a task’s title, description (null removes it), due date (null removes it; ' +
        'one-off tasks only), weekly, scored, or default_max_score (scored tasks need one). ' +
        'Returns the task as it is now.',
      inputSchema: updateTaskToolSchema,
      annotations: { ...WRITE, idempotentHint: true },
    },
    (input) =>
      run('update_task', async () => {
        const patch: UpdateTaskInput = {};
        if (input.title !== undefined) patch.title = input.title;
        if (input.description !== undefined) patch.description = input.description;
        if (input.due_date !== undefined) {
          patch.dueOn = input.due_date === null ? null : ctx.date(input.due_date);
        }
        if (input.weekly !== undefined) patch.recurrence = input.weekly ? 'weekly' : 'none';
        if (input.scored !== undefined) patch.isScored = input.scored;
        if (input.default_max_score !== undefined) {
          patch.defaultMaxScore = input.default_max_score;
        }
        await updateTask(repo, clock, input.task_id, patch);
        const { nodes, item } = await itemById(input.task_id);
        return { task: taskView(nodes, item) };
      }),
  );

  server.registerTool(
    'delete_task',
    {
      title: 'Delete a task',
      description:
        'Deletes a task and its completions; scores it recorded are kept. A task with sub-tasks ' +
        'is only deleted with include_subtasks: true (they are deleted too). Confirm with the ' +
        'student first; they can undo it in the app’s Recent changes. Returns the deleted task.',
      inputSchema: deleteTaskToolSchema,
      annotations: DELETE,
    },
    ({ task_id, include_subtasks }) =>
      run('delete_task', async () => {
        const [{ nodes, item }, tasks] = await Promise.all([itemById(task_id), repo.listTasks()]);
        // Counted from every task, archived or on archived nodes too: they all go with it.
        const subtasks = descendantTaskIds(tasks, task_id).length;
        if (subtasks > 0 && !include_subtasks) {
          throw new DomainError(
            'conflict',
            'has_subtasks',
            `This task has ${subtasks} sub-task${subtasks === 1 ? '' : 's'}. Confirm with the ` +
              'student, then call again with include_subtasks: true to delete them too.',
            { subtaskCount: subtasks },
          );
        }
        await deleteTask(repo, task_id);
        return { deleted: taskView(nodes, item), subtasksDeleted: subtasks };
      }),
  );
}

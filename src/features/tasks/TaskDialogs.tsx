import { useState } from 'react';
import { toast } from 'sonner';

import { NodeLabel } from '@/components/NodeLabel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Task, TaskItem, TreeNode } from '@/core/domain/types';
import { localDate } from '@/core/logic/dates';
import { useDataMutation } from '@/data/queries';
import { formatDay, formatWeek } from '@/lib/format';

import { TaskForm } from './TaskForm';
import { EMPTY_TASK, TASK_KEYS, toTaskInput } from './taskValues';
import type { TaskValues } from './taskValues';

/** TASK-2: a new task, or a sub-task of `parent` (which then suggests its node). */
export function NewTaskDialog({
  nodes,
  parent,
  defaultNodeId,
  open,
  onOpenChange,
}: {
  nodes: readonly TreeNode[];
  parent: Task | null;
  defaultNodeId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useDataMutation(
    (ds, values: TaskValues) =>
      ds.createTask({ ...toTaskInput(values), parentTaskId: parent?.id ?? null }),
    TASK_KEYS,
    {
      onSuccess: (task) => {
        onOpenChange(false);
        toast.success(`Added “${task.title}”.`);
      },
    },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{parent ? 'Add a sub-task' : 'Add a task'}</DialogTitle>
          <DialogDescription>
            {parent ? `Inside “${parent.title}”.` : 'A to-do for any track, subtask, or topic.'}
          </DialogDescription>
        </DialogHeader>
        {/* Re-mounted each time it opens, so the fields start fresh. */}
        {open && (
          <TaskForm
            nodes={nodes}
            initial={{ ...EMPTY_TASK, nodeId: parent?.nodeId ?? defaultNodeId ?? '' }}
            submitLabel="Add task"
            pending={create.isPending}
            onSubmit={(values) => create.mutate(values)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** One task's details (TASK-5 history included) with edit, sub-task, archive, and delete. */
export function TaskDetailsDialog({
  item,
  nodes,
  descendantCount,
  open,
  onOpenChange,
  onAddSubtask,
}: {
  item: TaskItem;
  nodes: readonly TreeNode[];
  descendantCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSubtask: (parent: Task) => void;
}) {
  const { task } = item;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const close = (isOpen: boolean) => {
    if (!isOpen) {
      setEditing(false);
      setConfirmDelete(false);
    }
    onOpenChange(isOpen);
  };
  const update = useDataMutation(
    (ds, values: TaskValues) => ds.updateTask(task.id, toTaskInput(values)),
    TASK_KEYS,
    {
      onSuccess: () => {
        setEditing(false);
        toast.success('Task updated.');
      },
    },
  );
  const archive = useDataMutation(
    (ds, archived: boolean) => ds.updateTask(task.id, { archived }),
    TASK_KEYS,
    {
      onSuccess: (_, archived) => {
        toast.success(archived ? `Archived “${task.title}”.` : `Restored “${task.title}”.`);
        if (archived) close(false);
      },
    },
  );
  const remove = useDataMutation((ds) => ds.deleteTask(task.id), TASK_KEYS, {
    onSuccess: () => {
      toast.success(`Deleted “${task.title}”.`);
      close(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit task' : task.title}</DialogTitle>
          <DialogDescription asChild>
            <div>
              <NodeLabel nodes={nodes} nodeId={task.nodeId} />
            </div>
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <TaskForm
            nodes={nodes}
            initial={{
              title: task.title,
              description: task.description ?? '',
              nodeId: task.nodeId,
              recurrence: task.recurrence,
              dueOn: task.dueOn ?? '',
              isScored: task.isScored,
              defaultMaxScore: task.defaultMaxScore === null ? '' : String(task.defaultMaxScore),
            }}
            submitLabel="Save changes"
            pending={update.isPending}
            onSubmit={(values) => update.mutate(values)}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {task.description && <p className="whitespace-pre-wrap">{task.description}</p>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Repeats</dt>
              <dd>{task.recurrence === 'weekly' ? 'Every week (Mon–Sun)' : 'Once'}</dd>
              {task.dueOn && (
                <>
                  <dt className="text-muted-foreground">Due</dt>
                  <dd>{formatDay(task.dueOn)}</dd>
                </>
              )}
              {task.isScored && (
                <>
                  <dt className="text-muted-foreground">Scored</dt>
                  <dd>Usually out of {task.defaultMaxScore}</dd>
                </>
              )}
              {item.subtasks && (
                <>
                  <dt className="text-muted-foreground">Sub-tasks</dt>
                  <dd>
                    {item.subtasks.done} of {item.subtasks.total} done
                  </dd>
                </>
              )}
              {task.recurrence === 'none' && item.completion && (
                <>
                  <dt className="text-muted-foreground">Completed</dt>
                  <dd>{formatDay(localDate(new Date(item.completion.completedAt)))}</dd>
                </>
              )}
            </dl>

            {task.recurrence === 'weekly' && (
              <section aria-labelledby={`${task.id}-history`} className="flex flex-col gap-1">
                <h3 id={`${task.id}-history`} className="text-sm font-medium">
                  Completed weeks
                </h3>
                {item.completedWeeks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Not completed yet.</p>
                ) : (
                  <ul className="text-sm">
                    {item.completedWeeks.map((week) => (
                      <li key={week}>{formatWeek(week)}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" className="h-11" onClick={() => setEditing(true)}>
                Edit
              </Button>
              {!task.archivedAt && (
                <Button variant="outline" className="h-11" onClick={() => onAddSubtask(task)}>
                  Add sub-task
                </Button>
              )}
              <Button
                variant="outline"
                className="h-11"
                disabled={archive.isPending}
                onClick={() => archive.mutate(task.archivedAt === null)}
              >
                {task.archivedAt ? 'Restore' : 'Archive'}
              </Button>
              {!confirmDelete && (
                <Button
                  variant="ghost"
                  className="h-11 text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete…
                </Button>
              )}
            </div>

            {confirmDelete && (
              <div role="group" aria-label="Confirm delete" className="flex flex-col gap-2">
                <p className="text-sm">
                  Delete “{task.title}”
                  {descendantCount > 0 &&
                    ` and its ${descendantCount} sub-task${descendantCount === 1 ? '' : 's'}`}
                  ? Completion history goes too; recorded scores are kept. This can’t be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="h-11"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(undefined)}
                  >
                    Yes, delete
                  </Button>
                  <Button variant="ghost" className="h-11" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

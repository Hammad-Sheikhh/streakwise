import { Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { useSearchParams } from 'react-router';

import { NodeLabel } from '@/components/NodeLabel';
import { QueryError } from '@/components/QueryError';
import { trackSwatchClass } from '@/components/trackColors';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { Task, TaskItem, TreeNode } from '@/core/domain/types';
import { compareDue } from '@/core/logic/tasks';
import { useTasks, useTree } from '@/data/queries';
import { cn } from '@/lib/utils';

import { buildTaskTree, groupTasks } from './grouping';
import type { TaskTreeItem } from './grouping';
import { NewTaskDialog, TaskDetailsDialog } from './TaskDialogs';
import { TaskRow, TaskTreeRows } from './TaskList';

// TASK-1–9: all tasks grouped by track and node, or just the ones due this week (TASK-7).

function countDescendants(entries: readonly TaskTreeItem[], counts = new Map<string, number>()) {
  for (const entry of entries) {
    countDescendants(entry.children, counts);
    const below = entry.children.reduce(
      (sum, child) => sum + 1 + (counts.get(child.item.task.id) ?? 0),
      0,
    );
    counts.set(entry.item.task.id, below);
  }
  return counts;
}

export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const dueOnly = params.get('filter') === 'due';
  const [showArchived, setShowArchived] = useState(false);
  const archivedId = useId();
  const tree = useTree();
  const tasks = useTasks({ includeArchived: showArchived && !dueOnly });

  // Dialogs stay mounted while they close (unmounting an open Radix dialog can leave the page
  // unclickable), so the last opened task is kept.
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [newParent, setNewParent] = useState<Task | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const items = tasks.data ?? [];
  const roots = buildTaskTree(items);
  const descendants = countDescendants(roots);
  const opened = items.find((i) => i.task.id === openedId);

  function openTask(item: TaskItem) {
    setOpenedId(item.task.id);
    setDetailsOpen(true);
  }

  function addTask(parent: Task | null) {
    setDetailsOpen(false);
    setNewParent(parent);
    setNewOpen(true);
  }

  function setFilter(due: boolean) {
    setParams(due ? { filter: 'due' } : {}, { replace: true });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <Button className="h-11" disabled={!tree.data} onClick={() => addTask(null)}>
          <Plus aria-hidden="true" /> Add task
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div role="group" aria-label="Show" className="flex rounded-lg border p-1">
          {[
            { label: 'All', due: false },
            { label: 'Due this week', due: true },
          ].map(({ label, due }) => (
            <button
              key={label}
              type="button"
              aria-pressed={dueOnly === due}
              onClick={() => setFilter(due)}
              className={cn(
                'h-9 rounded-md px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                dueOnly === due ? 'bg-muted font-medium' : 'text-muted-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {!dueOnly && (
          <div className="flex items-center gap-2">
            <input
              id={archivedId}
              type="checkbox"
              className="size-5 accent-primary"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <Label htmlFor={archivedId}>Show archived</Label>
          </div>
        )}
      </div>

      {(tree.isPending || tasks.isPending) && <Skeleton className="h-64 w-full" />}
      {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}
      {tasks.isError && <QueryError error={tasks.error} onRetry={() => void tasks.refetch()} />}

      {tree.data &&
        tasks.data &&
        (dueOnly ? (
          <DueList items={items} nodes={tree.data} onOpen={openTask} />
        ) : (
          <GroupedList roots={roots} nodes={tree.data} onOpen={openTask} />
        ))}

      {tree.data && (
        <NewTaskDialog
          nodes={tree.data}
          parent={newParent}
          open={newOpen}
          onOpenChange={setNewOpen}
        />
      )}
      {tree.data && opened && (
        <TaskDetailsDialog
          key={opened.task.id}
          item={opened}
          nodes={tree.data}
          descendantCount={descendants.get(opened.task.id) ?? 0}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          onAddSubtask={addTask}
        />
      )}
    </>
  );
}

function DueList({
  items,
  nodes,
  onOpen,
}: {
  items: readonly TaskItem[];
  nodes: readonly TreeNode[];
  onOpen: (item: TaskItem) => void;
}) {
  const due = items.filter((i) => i.dueThisWeek).sort(compareDue);
  if (due.length === 0) {
    return <p className="rounded-lg border border-dashed p-6">Nothing due this week.</p>;
  }
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {due.map((item) => (
        <li key={item.task.id}>
          <TaskRow item={item} nodes={nodes} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}

function GroupedList({
  roots,
  nodes,
  onOpen,
}: {
  roots: readonly TaskTreeItem[];
  nodes: readonly TreeNode[];
  onOpen: (item: TaskItem) => void;
}) {
  const groups = groupTasks(nodes, roots);
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6">
        No tasks yet. Use “Add task” for to-dos like past papers or weekly revision.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ track, nodes: nodeGroups }) => (
        <details key={track.id} open className="group rounded-lg border">
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {track.color && (
              <span
                aria-hidden="true"
                className={cn('size-3 shrink-0 rounded-full', trackSwatchClass[track.color])}
              />
            )}
            <h2>{track.name}</h2>
          </summary>
          <div className="flex flex-col gap-3 border-t pb-2">
            {nodeGroups.map((group) => (
              <section key={group.nodeId} className="flex flex-col">
                {group.nodeId !== track.id && (
                  <h3 className="px-4 pt-3 text-sm text-muted-foreground">
                    <NodeLabel nodes={nodes} nodeId={group.nodeId} />
                  </h3>
                )}
                <ul className="flex flex-col">
                  {group.tasks.map((entry) => (
                    <TaskTreeRows key={entry.item.task.id} entry={entry} onOpen={onOpen} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

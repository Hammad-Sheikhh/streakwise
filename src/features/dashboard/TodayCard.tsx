import { useState } from 'react';
import { Link } from 'react-router';

import { NodeLabel } from '@/components/NodeLabel';
import type { Task, TaskItem, TodayCard as TodayCardData, TreeNode } from '@/core/domain/types';
import { formatDuration } from '@/core/logic/duration';
import { nodePath } from '@/core/logic/tree';
import { descendantTaskIds } from '@/core/services/tasks';
import { useTasks } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { TaskCheckbox } from '@/features/tasks/TaskCheckbox';
import { NewTaskDialog, TaskDetailsDialog } from '@/features/tasks/TaskDialogs';
import { formatDay, formatTargetHours } from '@/lib/format';

// TODAY-1–3: today's task with its sub-tasks, today's minutes per subtask, and the pace towards
// each weekly target. Everything comes from the dashboard request (TODAY-4).

export function TodayCard({
  card,
  nodes,
  today,
}: {
  card: TodayCardData;
  nodes: readonly TreeNode[];
  today: string;
}) {
  const { basePath } = useDataSource();
  const [opened, setOpened] = useState<TaskItem | null>(null);
  const [newParent, setNewParent] = useState<Task | null>(null);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <section
      aria-labelledby="today-card-heading"
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      <h2 id="today-card-heading" className="text-lg font-medium">
        Today · {formatDay(today)}
      </h2>

      {card.task ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <TaskCheckbox item={card.task} />
            <div className="flex min-w-0 flex-col gap-1">
              {/* TODAY-1: tapping the task opens its details and edit sheet. */}
              <button
                type="button"
                className="self-start rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => setOpened(card.task)}
              >
                {card.task.task.title}
              </button>
              <p className="text-sm text-muted-foreground">
                {card.task.overdue && card.task.task.dueOn
                  ? `Overdue since ${formatDay(card.task.task.dueOn)}`
                  : 'Due today'}
                {card.task.task.nodeId && ' · '}
                {card.task.task.nodeId && (
                  <NodeLabel nodes={nodes} nodeId={card.task.task.nodeId} />
                )}
              </p>
              {card.task.task.description && (
                <p className="text-sm break-words whitespace-pre-wrap">
                  {card.task.task.description}
                </p>
              )}
            </div>
          </div>
          {card.subtasks.length > 0 && (
            <ul aria-label="Sub-tasks" className="ml-8 flex flex-col gap-1">
              {card.subtasks.map((sub) => (
                <li key={sub.task.id} className="flex min-h-11 items-center gap-3">
                  <TaskCheckbox item={sub} />
                  <button
                    type="button"
                    className="min-w-0 rounded-sm text-left underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    onClick={() => setOpened(sub)}
                  >
                    {sub.task.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">
          No task due today.{' '}
          <Link to={`${basePath}/tasks`} className="text-foreground underline underline-offset-4">
            See all tasks
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">Studied today</h3>
        {card.minutes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing logged yet today.</p>
        ) : (
          <ul className="flex flex-col gap-0.5 text-sm">
            {card.minutes.map((m) => (
              <li key={m.nodeId} className="flex justify-between gap-3">
                <span className="truncate">{nodePath(nodes, m.nodeId).join(' > ')}</span>
                <span className="shrink-0 tabular-nums">{formatDuration(m.minutes)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {card.pace.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Pace this week</h3>
          <ul className="flex flex-col gap-3">
            {card.pace.map((p) => {
              const name = byId.get(p.trackId)?.name ?? 'Track';
              const percent = Math.min(100, Math.round((p.minutes / p.targetMinutes) * 100));
              const label = p.met
                ? 'Target met'
                : `${formatDuration(p.neededPerDay)} needed per day`;
              return (
                <li key={p.trackId} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate">{name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatDuration(p.minutes)} / {formatTargetHours(p.targetMinutes)} · {label}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${name} pace`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    aria-valuetext={`${formatDuration(p.minutes)} of ${formatTargetHours(p.targetMinutes)}. ${label}`}
                    className="h-2 overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {opened && (
        <TodayTaskDialog
          item={opened}
          nodes={nodes}
          onClose={() => setOpened(null)}
          onAddSubtask={(parent) => {
            setOpened(null);
            setNewParent(parent);
          }}
        />
      )}
      <NewTaskDialog
        nodes={nodes}
        parent={newParent}
        open={newParent !== null}
        onOpenChange={(open) => !open && setNewParent(null)}
      />
    </section>
  );
}

/** Mounted only while open, so Home doesn't load the full task list unless it's needed. */
function TodayTaskDialog({
  item,
  nodes,
  onClose,
  onAddSubtask,
}: {
  item: TaskItem;
  nodes: readonly TreeNode[];
  onClose: () => void;
  onAddSubtask: (parent: Task) => void;
}) {
  const tasks = useTasks();
  const current = tasks.data?.find((i) => i.task.id === item.task.id) ?? item;
  const descendants = descendantTaskIds(
    (tasks.data ?? []).map((i) => i.task),
    item.task.id,
  ).length;
  return (
    <TaskDetailsDialog
      item={current}
      nodes={nodes}
      descendantCount={descendants}
      open
      onOpenChange={(open) => !open && onClose()}
      onAddSubtask={onAddSubtask}
    />
  );
}

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { NodeLabel } from '@/components/NodeLabel';
import { Badge } from '@/components/ui/badge';
import type { TaskItem, TreeNode } from '@/core/domain/types';
import { formatDay } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { TaskTreeItem } from './grouping';
import { TaskCheckbox } from './TaskCheckbox';

// TASK-3: rows indent up to 4 levels; deeper ones stay at level 4 with a small depth marker.
const MAX_INDENT = 4;

/** Due date, weekly, scored, and sub-task progress (TASK-9), as small labels. */
export function TaskMeta({ item }: { item: TaskItem }) {
  const { task } = item;
  const done = item.completion !== null;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      {item.overdue && !done && <Badge variant="destructive">Overdue</Badge>}
      {task.dueOn && <span>Due {formatDay(task.dueOn)}</span>}
      {task.recurrence === 'weekly' && <Badge variant="secondary">Weekly</Badge>}
      {task.isScored && <Badge variant="outline">Scored /{task.defaultMaxScore}</Badge>}
      {item.subtasks && (
        <span aria-label={`${item.subtasks.done} of ${item.subtasks.total} sub-tasks done`}>
          {item.subtasks.done}/{item.subtasks.total}
        </span>
      )}
      {task.archivedAt && <Badge variant="outline">Archived</Badge>}
    </span>
  );
}

/** One task: tick box, title (opens its details), labels, and an expander for sub-tasks. */
export function TaskRow({
  item,
  depth = 1,
  expander,
  nodes,
  onOpen,
}: {
  item: TaskItem;
  depth?: number;
  expander?: React.ReactNode;
  /** Shows the task's node under the title (in flat lists). */
  nodes?: readonly TreeNode[];
  onOpen: (item: TaskItem) => void;
}) {
  const { task } = item;
  const done = item.completion !== null;
  return (
    <div
      className={cn(
        'flex min-h-14 items-center gap-2 py-1 pr-2',
        item.overdue && !done && 'bg-destructive/5',
      )}
      style={{ paddingInlineStart: `${0.5 + (Math.min(depth, MAX_INDENT) - 1) * 1.25}rem` }}
    >
      <span className="flex size-6 shrink-0 items-center justify-center">{expander}</span>
      <TaskCheckbox item={item} />
      <button
        type="button"
        className="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center gap-0.5 rounded-md px-1 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => onOpen(item)}
      >
        <span className="flex max-w-full items-center gap-1.5">
          {depth > MAX_INDENT && (
            <span
              className="rounded bg-muted px-1 text-[10px] text-muted-foreground"
              aria-label={`level ${depth}`}
            >
              L{depth}
            </span>
          )}
          <span className={cn('break-words', done && 'text-muted-foreground line-through')}>
            {task.title}
          </span>
        </span>
        {nodes && (
          <NodeLabel nodes={nodes} nodeId={task.nodeId} className="text-xs text-muted-foreground" />
        )}
        <TaskMeta item={item} />
      </button>
    </div>
  );
}

/** TASK-1, TASK-3: a task and its sub-tasks, collapsible. */
export function TaskTreeRows({
  entry,
  onOpen,
}: {
  entry: TaskTreeItem;
  onOpen: (item: TaskItem) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const { item, children, depth } = entry;
  const hasChildren = children.length > 0;
  const Icon = expanded ? ChevronDown : ChevronRight;

  return (
    <li>
      <TaskRow
        item={item}
        depth={depth}
        onOpen={onOpen}
        expander={
          hasChildren && (
            <button
              type="button"
              className="flex size-6 items-center justify-center rounded outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.task.title}`}
              onClick={() => setExpanded(!expanded)}
            >
              <Icon aria-hidden="true" className="size-4" />
            </button>
          )
        }
      />
      {hasChildren && expanded && (
        <ul>
          {children.map((child) => (
            <TaskTreeRows key={child.item.task.id} entry={child} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </li>
  );
}

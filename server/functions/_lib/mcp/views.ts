import type {
  Mistake,
  Score,
  Session,
  Task,
  TaskCompletion,
  TaskItem,
  TreeNode,
} from '../../../../src/core/domain/types.js';
import { scorePercent } from '../../../../src/core/logic/scores.js';
import { hiddenIds, nodePath } from '../../../../src/core/logic/tree.js';

// The JSON shapes the Claude tools return. Existing shapes stay exactly as in v1.0.1 (MCP-10);
// write tools return the same shape as the matching list tool (MCP-11).

export const KIND = { 1: 'track', 2: 'subtask', 3: 'topic' } as const;

export const pathOf = (nodes: readonly TreeNode[], id: string) => nodePath(nodes, id).join(' > ');

/** Tasks with no node ("Other") show this as their path. */
export const taskPath = (nodes: readonly TreeNode[], task: Pick<Task, 'nodeId'>) =>
  task.nodeId === null ? 'Other' : pathOf(nodes, task.nodeId);

export function sessionView(nodes: readonly TreeNode[], session: Session) {
  return {
    id: session.id,
    date: session.studiedOn,
    minutes: session.minutes,
    nodeId: session.nodeId,
    path: pathOf(nodes, session.nodeId),
    note: session.note,
    source: session.source,
  };
}

/** MCP-16: compact sessions keep their id; notes are cut to 80 characters. */
export const COMPACT_NOTE_LENGTH = 80;

export function compactSessionView(nodes: readonly TreeNode[], session: Session) {
  const note = session.note;
  return {
    id: session.id,
    date: session.studiedOn,
    minutes: session.minutes,
    path: pathOf(nodes, session.nodeId),
    note:
      note === null
        ? undefined
        : note.length > COMPACT_NOTE_LENGTH
          ? `${note.slice(0, COMPACT_NOTE_LENGTH)}…`
          : note,
  };
}

interface StructureItem {
  id: string;
  name: string;
  kind: (typeof KIND)[keyof typeof KIND];
  archived?: true;
  weeklyTargetMinutes?: number;
  status?: string;
  children?: StructureItem[];
}

export function structure(nodes: readonly TreeNode[], includeArchived: boolean): StructureItem[] {
  const hidden = hiddenIds(nodes);
  const build = (parentId: string | null): StructureItem[] =>
    nodes
      .filter((n) => n.parentId === parentId && (includeArchived || !hidden.has(n.id)))
      .map((n) => {
        const item: StructureItem = { id: n.id, name: n.name, kind: KIND[n.depth] };
        if (n.archivedAt) item.archived = true;
        if (n.weeklyTargetMinutes) item.weeklyTargetMinutes = n.weeklyTargetMinutes;
        if (n.topicStatus) item.status = n.topicStatus;
        const children = build(n.id);
        if (children.length > 0) item.children = children;
        return item;
      });
  return build(null);
}

/** A node after a change (update_node, archive_node, unarchive_node). */
export function nodeView(nodes: readonly TreeNode[], node: TreeNode) {
  return {
    id: node.id,
    name: node.name,
    kind: KIND[node.depth],
    path: pathOf(nodes, node.id),
    weeklyTargetMinutes: node.weeklyTargetMinutes ?? undefined,
    status: node.topicStatus ?? undefined,
    archived: hiddenIds(nodes).has(node.id) ? true : undefined,
  };
}

export function taskView(nodes: readonly TreeNode[], item: TaskItem) {
  const { task } = item;
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    nodeId: task.nodeId,
    path: taskPath(nodes, task),
    parentTaskId: task.parentTaskId,
    weekly: task.recurrence === 'weekly',
    dueOn: task.dueOn,
    scored: task.isScored,
    defaultMaxScore: task.defaultMaxScore,
    done: item.completion !== null,
    dueThisWeek: item.dueThisWeek,
    overdue: item.overdue,
    subtasks: item.subtasks ?? undefined,
    completedWeeks: task.recurrence === 'weekly' ? item.completedWeeks : undefined,
    archived: task.archivedAt !== null ? true : undefined,
  };
}

/**
 * MCP-13 (with D29): only the facts that carry information. Flags appear only when true, and a
 * sub-task leaves out its path when it's the same as its parent task's.
 */
export function compactTaskView(
  nodes: readonly TreeNode[],
  item: TaskItem,
  parentPath: string | undefined,
) {
  const { task } = item;
  const path = taskPath(nodes, task);
  return {
    id: task.id,
    title: task.title,
    path: parentPath === path ? undefined : path,
    parentTaskId: task.parentTaskId ?? undefined,
    dueOn: task.dueOn ?? undefined,
    done: item.completion !== null ? true : undefined,
    scored: task.isScored ? true : undefined,
    weekly: task.recurrence === 'weekly' ? true : undefined,
    overdue: item.overdue ? true : undefined,
    subtasks: item.subtasks ?? undefined,
  };
}

/** The compact list, with each sub-task's path left out when its parent has the same one. */
export function compactTaskList(nodes: readonly TreeNode[], items: readonly TaskItem[]) {
  const pathById = new Map(items.map((i) => [i.task.id, taskPath(nodes, i.task)]));
  return items.map((item) =>
    compactTaskView(
      nodes,
      item,
      item.task.parentTaskId === null ? undefined : pathById.get(item.task.parentTaskId),
    ),
  );
}

type TaskViewShape = ReturnType<typeof taskView>;

/** MCP-15: a task in full, with its completion and every sub-task nested below it. */
export interface FullTaskView extends Omit<TaskViewShape, 'subtasks'> {
  /** Direct sub-tasks done vs total, as in list_tasks. */
  subtaskProgress?: { done: number; total: number };
  completion?: {
    date: string;
    note: string | null;
    score?: { id: string; score: number; maxScore: number; percent: number };
  };
  subtasks: FullTaskView[];
}

export function fullTaskView(
  nodes: readonly TreeNode[],
  items: readonly TaskItem[],
  scores: readonly Score[],
  item: TaskItem,
): FullTaskView {
  const { subtasks: progress, ...fields } = taskView(nodes, item);
  const completion: TaskCompletion | null = item.completion;
  const linked = completion ? scores.find((s) => s.taskCompletionId === completion.id) : undefined;
  return {
    ...fields,
    subtaskProgress: progress,
    completion: completion
      ? {
          date: completion.completedOn,
          note: completion.note,
          score: linked && {
            id: linked.id,
            score: linked.score,
            maxScore: linked.maxScore,
            percent: scorePercent(linked.score, linked.maxScore),
          },
        }
      : undefined,
    subtasks: items
      .filter((child) => child.task.parentTaskId === item.task.id)
      .map((child) => fullTaskView(nodes, items, scores, child)),
  };
}

export function scoreView(nodes: readonly TreeNode[], score: Score) {
  return {
    id: score.id,
    kind: score.kind,
    title: score.title,
    date: score.takenOn,
    score: score.score,
    maxScore: score.maxScore,
    percent: scorePercent(score.score, score.maxScore),
    nodeId: score.nodeId,
    path: pathOf(nodes, score.nodeId),
    note: score.note,
  };
}

/** MCP-21. */
export function mistakeView(nodes: readonly TreeNode[], mistake: Mistake) {
  return {
    id: mistake.id,
    path: pathOf(nodes, mistake.nodeId),
    text: mistake.text,
    date: mistake.createdOn,
    status: mistake.status,
    step: mistake.step,
    nextDueOn: mistake.nextDueOn,
    reviewCount: mistake.reviewCount,
    lastReviewedOn: mistake.lastReviewedOn ?? undefined,
    lastResult: mistake.lastResult ?? undefined,
    learnedOn: mistake.learnedOn ?? undefined,
  };
}

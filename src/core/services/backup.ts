import { z } from 'zod';

import { invalid } from '../domain/errors.js';
import type {
  BackupSummary,
  DataExport,
  IdGenerator,
  NodeDepth,
  RestoreData,
  Task,
  TreeNode,
} from '../domain/types.js';
import { localDate } from '../logic/dates.js';
import { withoutRecording } from '../repo/RecordingRepository.js';
import type { Repository } from '../repo/Repository.js';
import {
  deadlineSchema,
  examTargetSchema,
  mistakeSchema,
  scoreSchema,
  sessionSchema,
  taskCompletionSchema,
  taskSchema,
  treeNodeSchema,
} from '../schemas/domain.js';

// DATA-3, DATA-4: restore from a Streakwise JSON backup (format 1 from v1.0, or 2). The whole file
// is read and checked before anything changes; a restore replaces all study data (never merges),
// gives every row a new id with the links between rows kept, and clears the change history.

/** DATA-3: the largest backup file accepted. */
export const MAX_BACKUP_BYTES = 4 * 1024 * 1024;

const timestamp = z.iso.datetime({ offset: true });

/** Format 1 had no completion dates, exam flags, "day ends at", mistakes, or exam targets. */
const backupSchema = z.object({
  app: z.literal('Streakwise'),
  formatVersion: z.union([z.literal(1), z.literal(2)]),
  exportedAt: timestamp,
  settings: z.object({
    studentName: z.string().max(80),
    neglectDays: z.number().int().min(1).max(14),
    dayEndsAtMinutes: z.number().int().min(0).max(360).multipleOf(30).default(0),
  }),
  nodes: z.array(treeNodeSchema),
  sessions: z.array(sessionSchema),
  tasks: z.array(taskSchema),
  taskCompletions: z.array(taskCompletionSchema.extend({ completedOn: z.iso.date().optional() })),
  scores: z.array(scoreSchema),
  deadlines: z.array(deadlineSchema.extend({ isExam: z.boolean().default(false) })),
  examTargets: z.array(examTargetSchema).default([]),
  mistakes: z.array(mistakeSchema).default([]),
});

/** A backup in the current shape, whatever format it came in. */
export type Backup = Omit<DataExport, 'formatVersion' | 'sharedReports'> & {
  formatVersion: 1 | 2;
};

function broken(detail: string): never {
  throw invalid('backup_invalid', `This backup can’t be restored: ${detail}`);
}

/** Reads and checks a backup; throws a readable `backup_invalid` error for any problem. */
export function parseBackup(raw: unknown): Backup {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join('.') || 'the file';
    if (where === 'app' || where === 'formatVersion' || where === 'the file') {
      broken('it isn’t a Streakwise backup file.');
    }
    broken(`it’s damaged or was changed by hand (${where}: ${issue?.message ?? 'invalid'}).`);
  }
  const data = parsed.data;
  const backup: Backup = {
    ...data,
    taskCompletions: data.taskCompletions.map((c) => ({
      ...c,
      // Format 1: the Karachi date of the tick, which is what v1.0 showed.
      completedOn: c.completedOn ?? localDate(new Date(c.completedAt)),
    })),
  };
  checkBackup(backup);
  return backup;
}

function uniqueIds(rows: readonly { id: string }[], what: string): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.id)) broken(`two ${what} share the id ${row.id}.`);
    ids.add(row.id);
  }
  return ids;
}

/** The depth each node really has, from its chain of parents. */
function nodeDepths(nodes: readonly TreeNode[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depths = new Map<string, number>();
  for (const node of nodes) {
    let depth = 1;
    const seen = new Set<string>([node.id]);
    for (let parent = node.parentId; parent !== null; depth += 1) {
      const next = byId.get(parent);
      if (!next) broken(`“${node.name}” belongs to an item that isn’t in the file.`);
      if (seen.has(parent)) broken('the structure loops back on itself.');
      seen.add(parent);
      parent = next.parentId;
    }
    depths.set(node.id, depth);
  }
  return depths;
}

/** The rules the database enforces, checked up front so a restore never fails halfway. */
function checkBackup(backup: Backup): void {
  const nodeIds = uniqueIds(backup.nodes, 'items in the structure');
  const depths = nodeDepths(backup.nodes);
  const siblings = new Set<string>();
  for (const node of backup.nodes) {
    const depth = depths.get(node.id) ?? 0;
    if (depth > 3 || depth !== node.depth) broken(`“${node.name}” is at the wrong level.`);
    const key = `${node.parentId ?? ''}/${node.name.toLowerCase()}`;
    if (siblings.has(key)) broken(`two items next to each other are both called “${node.name}”.`);
    siblings.add(key);
    if ((depth === 1) !== (node.color !== null))
      broken(`“${node.name}” has a colour at the wrong level.`);
    if (depth !== 1 && node.weeklyTargetMinutes !== null) {
      broken(`“${node.name}” has a weekly target but isn’t a track.`);
    }
    if ((depth === 3) !== (node.topicStatus !== null)) {
      broken(`“${node.name}” has a topic status at the wrong level.`);
    }
  }
  const needsNode = (nodeId: string, what: string) => {
    if (!nodeIds.has(nodeId)) broken(`a ${what} belongs to an item that isn’t in the file.`);
  };

  uniqueIds(backup.sessions, 'sessions');
  for (const s of backup.sessions) needsNode(s.nodeId, 'session');

  const taskIds = uniqueIds(backup.tasks, 'tasks');
  const parentOf = new Map(backup.tasks.map((t) => [t.id, t.parentTaskId]));
  for (const task of backup.tasks) {
    if (task.nodeId !== null) needsNode(task.nodeId, 'task');
    if (task.parentTaskId !== null && !taskIds.has(task.parentTaskId)) {
      broken(`the task “${task.title}” is inside a task that isn’t in the file.`);
    }
    if (task.isScored && task.nodeId === null)
      broken(`the scored task “${task.title}” has no track.`);
    if (task.recurrence === 'weekly' && task.dueOn !== null) {
      broken(`the weekly task “${task.title}” has a due date.`);
    }
    const seen = new Set<string>();
    for (let id: string | null = task.id; id !== null; id = parentOf.get(id) ?? null) {
      if (seen.has(id)) broken('the tasks loop back on themselves.');
      seen.add(id);
    }
  }

  const completionIds = uniqueIds(backup.taskCompletions, 'task completions');
  const periods = new Set<string>();
  for (const c of backup.taskCompletions) {
    if (!taskIds.has(c.taskId)) broken('a completion belongs to a task that isn’t in the file.');
    const key = `${c.taskId}/${c.periodStart ?? 'once'}`;
    if (periods.has(key)) broken('a task is completed twice for the same period.');
    periods.add(key);
  }

  uniqueIds(backup.scores, 'scores');
  for (const s of backup.scores) {
    needsNode(s.nodeId, 'score');
    if (s.taskCompletionId !== null && !completionIds.has(s.taskCompletionId)) {
      broken(`the score “${s.title}” is linked to a completion that isn’t in the file.`);
    }
    if (s.score > s.maxScore) broken(`the score “${s.title}” is above its maximum.`);
  }

  const deadlineIds = uniqueIds(backup.deadlines, 'deadlines');
  for (const d of backup.deadlines) needsNode(d.nodeId, 'deadline');
  uniqueIds(backup.examTargets, 'exam targets');
  for (const t of backup.examTargets) {
    if (!deadlineIds.has(t.deadlineId))
      broken('an exam target belongs to a deadline that isn’t in the file.');
  }
  uniqueIds(backup.mistakes, 'mistakes');
  for (const m of backup.mistakes) needsNode(m.nodeId, 'mistake');
}

/** DATA-3: what the file holds, shown before the owner confirms. */
export function summarizeBackup(backup: Backup): BackupSummary {
  const dates = backup.sessions.map((s) => s.studiedOn).sort();
  const first = dates[0];
  const last = dates.at(-1);
  return {
    formatVersion: backup.formatVersion,
    exportedAt: backup.exportedAt,
    counts: {
      nodes: backup.nodes.length,
      sessions: backup.sessions.length,
      tasks: backup.tasks.length,
      taskCompletions: backup.taskCompletions.length,
      scores: backup.scores.length,
      deadlines: backup.deadlines.length,
      examTargets: backup.examTargets.length,
      mistakes: backup.mistakes.length,
    },
    sessionRange: first && last ? { from: first, to: last } : null,
  };
}

/** Tasks with every parent before its sub-tasks. */
function parentsFirst(tasks: readonly Task[]): Task[] {
  const ordered: Task[] = [];
  const visit = (parentId: string | null) => {
    for (const task of tasks) {
      if (task.parentTaskId === parentId) {
        ordered.push(task);
        visit(task.id);
      }
    }
  };
  visit(null);
  return ordered;
}

/** DATA-4: the rows to write, each with a new id, and every link pointing at the new ids. */
export function buildRestoreData(backup: Backup, newId: IdGenerator): RestoreData {
  const ids = new Map<string, string>();
  const remap = (id: string): string => {
    let fresh = ids.get(id);
    if (!fresh) {
      fresh = newId();
      ids.set(id, fresh);
    }
    return fresh;
  };
  const linked = (id: string | null) => (id === null ? null : remap(id));

  return {
    settings: backup.settings,
    nodes: [...backup.nodes]
      .sort((a, b) => a.depth - b.depth)
      .map((n) => ({
        ...n,
        id: remap(n.id),
        parentId: linked(n.parentId),
        depth: n.depth as NodeDepth,
      })),
    sessions: backup.sessions.map((s) => ({ ...s, id: newId(), nodeId: remap(s.nodeId) })),
    tasks: parentsFirst(backup.tasks).map((t) => ({
      ...t,
      id: remap(t.id),
      nodeId: linked(t.nodeId),
      parentTaskId: linked(t.parentTaskId),
    })),
    taskCompletions: backup.taskCompletions.map((c) => ({
      ...c,
      id: remap(c.id),
      taskId: remap(c.taskId),
    })),
    scores: backup.scores.map((s) => ({
      ...s,
      id: newId(),
      nodeId: remap(s.nodeId),
      taskCompletionId: linked(s.taskCompletionId),
    })),
    deadlines: backup.deadlines.map((d) => ({ ...d, id: remap(d.id), nodeId: remap(d.nodeId) })),
    examTargets: backup.examTargets.map((t) => ({
      ...t,
      id: newId(),
      deadlineId: remap(t.deadlineId),
    })),
    mistakes: backup.mistakes.map((m) => ({ ...m, id: newId(), nodeId: remap(m.nodeId) })),
  };
}

/** DATA-3/4: checks the file, then replaces all study data with it. Returns what it restored. */
export async function restoreFromBackup(
  repo: Repository,
  newId: IdGenerator,
  raw: unknown,
): Promise<BackupSummary> {
  const backup = parseBackup(raw);
  // Not recorded: a restore clears the change history instead (DATA-4).
  await withoutRecording(repo).restoreBackup(buildRestoreData(backup, newId));
  return summarizeBackup(backup);
}

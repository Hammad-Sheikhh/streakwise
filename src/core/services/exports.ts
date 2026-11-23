import type {
  Clock,
  DataExport,
  Mistake,
  Score,
  Session,
  Task,
  TaskCompletion,
  TreeNode,
} from '../domain/types.js';
import { periodStartFor } from '../logic/tasks.js';
import { nodePath } from '../logic/tree.js';
import type { Repository } from '../repo/Repository.js';
import { listTree } from './structure.js';

// SET-2: all data as JSON, and sessions as CSV. Every export stamps its time for SET-3.

/** SET-3: remind about backups when the last export is older than this (or there's none). */
export const BACKUP_REMINDER_DAYS = 30;

export function isBackupDue(lastExportAt: string | null, now: Date): boolean {
  if (lastExportAt === null) return true;
  return now.getTime() - new Date(lastExportAt).getTime() > BACKUP_REMINDER_DAYS * 86_400_000;
}

export async function exportData(repo: Repository, clock: Clock): Promise<DataExport> {
  const exportedAt = clock().toISOString();
  const [
    settings,
    nodes,
    sessions,
    tasks,
    taskCompletions,
    scores,
    deadlines,
    examTargets,
    mistakes,
    sharedReports,
  ] = await Promise.all([
    repo.getSettings(),
    listTree(repo),
    repo.listAllSessions(),
    repo.listTasks(),
    repo.listTaskCompletions(),
    repo.listScores(),
    repo.listDeadlines(),
    repo.listExamTargets(),
    repo.listMistakes(),
    repo.listSharedReports(),
  ]);
  await repo.recordExport(exportedAt);
  return {
    app: 'Streakwise',
    formatVersion: 2,
    exportedAt,
    settings: {
      studentName: settings.studentName,
      neglectDays: settings.neglectDays,
      dayEndsAtMinutes: settings.dayEndsAtMinutes,
    },
    nodes,
    sessions,
    tasks,
    taskCompletions,
    scores,
    deadlines,
    examTargets,
    mistakes,
    sharedReports,
  };
}

/** A UTF-8 byte-order mark, so Excel reads accents and symbols correctly. */
const BOM = String.fromCharCode(0xfeff);

const CSV_HEADER = ['date', 'track', 'subtask', 'topic', 'minutes', 'note', 'source', 'created_at'];

/**
 * One CSV cell. Text that a spreadsheet would run as a formula (=, +, -, @, tab, CR) gets a
 * leading apostrophe, because notes are free text.
 */
function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** SET-2: sessions as CSV (oldest first), with the track, subtask, and topic in their own columns. */
export function sessionsCsv(nodes: readonly TreeNode[], sessions: readonly Session[]): string {
  const rows = sessions.map((s) => {
    const [track = '', subtask = '', topic = ''] = nodePath(nodes, s.nodeId);
    return [s.studiedOn, track, subtask, topic, s.minutes, s.note ?? '', s.source, s.createdAt]
      .map(csvCell)
      .join(',');
  });
  // CRLF and a byte-order mark so Excel opens it as UTF-8 with the right columns.
  return `${BOM}${[CSV_HEADER.join(','), ...rows].join('\r\n')}\r\n`;
}

function csv(header: readonly string[], rows: readonly (string | number)[][]): string {
  const lines = rows.map((row) => row.map(csvCell).join(','));
  // CRLF and a byte-order mark so Excel opens it as UTF-8 with the right columns.
  return `${BOM}${[header.join(','), ...lines].join('\r\n')}\r\n`;
}

/** The track, subtask, and topic of a node, in three columns. */
function pathColumns(nodes: readonly TreeNode[], nodeId: string | null): string[] {
  if (nodeId === null) return ['Other', '', ''];
  const [track = '', subtask = '', topic = ''] = nodePath(nodes, nodeId);
  return [track, subtask, topic];
}

/** DATA-2: scores as CSV, oldest first. */
export function scoresCsv(nodes: readonly TreeNode[], scores: readonly Score[]): string {
  const rows = [...scores]
    .sort((a, b) => a.takenOn.localeCompare(b.takenOn) || a.createdAt.localeCompare(b.createdAt))
    .map((s) => [
      s.takenOn,
      ...pathColumns(nodes, s.nodeId),
      s.kind,
      s.title,
      s.score,
      s.maxScore,
      Math.round((s.score / s.maxScore) * 1000) / 10,
      s.note ?? '',
      s.taskCompletionId === null ? 'no' : 'yes',
    ]);
  return csv(
    [
      'date',
      'track',
      'subtask',
      'topic',
      'kind',
      'title',
      'score',
      'max_score',
      'percent',
      'note',
      'from_task',
    ],
    rows,
  );
}

/**
 * DATA-2: tasks as CSV, with their path, due date, and whether they're done (for weekly tasks:
 * done for the week of `today`), plus the latest completion date.
 */
export function tasksCsv(
  nodes: readonly TreeNode[],
  tasks: readonly Task[],
  completions: readonly TaskCompletion[],
  today: string,
): string {
  const titles = new Map(tasks.map((t) => [t.id, t.title]));
  const rows = tasks.map((t) => {
    const own = completions.filter((c) => c.taskId === t.id);
    const period = periodStartFor(t, today);
    const done = own.some((c) => c.periodStart === period);
    const latest =
      own
        .map((c) => c.completedOn)
        .sort()
        .at(-1) ?? '';
    return [
      t.title,
      ...pathColumns(nodes, t.nodeId),
      t.parentTaskId === null ? '' : (titles.get(t.parentTaskId) ?? ''),
      t.recurrence,
      t.dueOn ?? '',
      done ? 'yes' : 'no',
      latest,
      t.isScored ? 'yes' : 'no',
      t.archivedAt === null ? 'no' : 'yes',
      t.description ?? '',
    ];
  });
  return csv(
    [
      'title',
      'track',
      'subtask',
      'topic',
      'parent_task',
      'repeats',
      'due_on',
      'done',
      'last_completed_on',
      'scored',
      'archived',
      'description',
    ],
    rows,
  );
}

/** DATA-2: mistakes as CSV, oldest first. */
export function mistakesCsv(nodes: readonly TreeNode[], mistakes: readonly Mistake[]): string {
  const rows = [...mistakes]
    .sort(
      (a, b) => a.createdOn.localeCompare(b.createdOn) || a.createdAt.localeCompare(b.createdAt),
    )
    .map((m) => [
      m.createdOn,
      ...pathColumns(nodes, m.nodeId),
      m.text,
      m.status,
      m.step,
      m.nextDueOn ?? '',
      m.reviewCount,
      m.lastResult ?? '',
      m.learnedOn ?? '',
      m.source,
    ]);
  return csv(
    [
      'created_on',
      'track',
      'subtask',
      'topic',
      'text',
      'status',
      'step',
      'next_review',
      'reviews',
      'last_result',
      'learned_on',
      'source',
    ],
    rows,
  );
}

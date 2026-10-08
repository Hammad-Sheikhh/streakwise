import type { Clock, DataExport, Session, TreeNode } from '../domain/types';
import { nodePath } from '../logic/tree';
import type { Repository } from '../repo/Repository';
import { listTree } from './structure';

// SET-2: all data as JSON, and sessions as CSV. Every export stamps its time for SET-3.

/** SET-3: remind about backups when the last export is older than this (or there's none). */
export const BACKUP_REMINDER_DAYS = 30;

export function isBackupDue(lastExportAt: string | null, now: Date): boolean {
  if (lastExportAt === null) return true;
  return now.getTime() - new Date(lastExportAt).getTime() > BACKUP_REMINDER_DAYS * 86_400_000;
}

export async function exportData(repo: Repository, clock: Clock): Promise<DataExport> {
  const exportedAt = clock().toISOString();
  const [settings, nodes, sessions, tasks, taskCompletions, scores, deadlines, sharedReports] =
    await Promise.all([
      repo.getSettings(),
      listTree(repo),
      repo.listAllSessions(),
      repo.listTasks(),
      repo.listTaskCompletions(),
      repo.listScores(),
      repo.listDeadlines(),
      repo.listSharedReports(),
    ]);
  await repo.recordExport(exportedAt);
  return {
    app: 'Streakwise',
    formatVersion: 1,
    exportedAt,
    settings: { studentName: settings.studentName, neglectDays: settings.neglectDays },
    nodes,
    sessions,
    tasks,
    taskCompletions,
    scores,
    deadlines,
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

import type { DataExport } from '@/core/domain/types';
import { mistakesCsv, scoresCsv, sessionsCsv, tasksCsv } from '@/core/services/exports';

import { downloadText } from './download.js';

// SET-2, DATA-2: one export, saved as the JSON backup or one of the CSV tables.

export type ExportFormat = 'json' | 'sessions' | 'scores' | 'tasks' | 'mistakes';

const CSV = 'text/csv;charset=utf-8';

/** Saves one file from an export; every download comes from the same full export. */
export function saveExport(data: DataExport, format: ExportFormat, today: string): void {
  const day = data.exportedAt.slice(0, 10);
  const name = (what: string, ext: string) => `streakwise-${what}${day}.${ext}`;
  switch (format) {
    case 'json':
      downloadText(name('', 'json'), JSON.stringify(data, null, 2), 'application/json');
      return;
    case 'sessions':
      downloadText(name('sessions-', 'csv'), sessionsCsv(data.nodes, data.sessions), CSV);
      return;
    case 'scores':
      downloadText(name('scores-', 'csv'), scoresCsv(data.nodes, data.scores), CSV);
      return;
    case 'tasks':
      downloadText(
        name('tasks-', 'csv'),
        tasksCsv(data.nodes, data.tasks, data.taskCompletions, today),
        CSV,
      );
      return;
    case 'mistakes':
      downloadText(name('mistakes-', 'csv'), mistakesCsv(data.nodes, data.mistakes), CSV);
  }
}

import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { DataExport } from '@/core/domain/types';
import { formatTimestamp } from '@/core/logic/labels';
import { isBackupDue, sessionsCsv } from '@/core/services/exports';
import { useDataMutation, useSettings } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { downloadText } from '@/lib/download';

type Format = 'json' | 'csv';

function save(data: DataExport, format: Format): void {
  const day = data.exportedAt.slice(0, 10);
  if (format === 'json') {
    downloadText(`streakwise-${day}.json`, JSON.stringify(data, null, 2), 'application/json');
  } else {
    downloadText(
      `streakwise-sessions-${day}.csv`,
      sessionsCsv(data.nodes, data.sessions),
      'text/csv;charset=utf-8',
    );
  }
}

// SET-2: download everything as JSON, or sessions as CSV. SET-3: remind when a backup is due.
export function ExportSection() {
  const ds = useDataSource();
  const settings = useSettings();
  // The format only decides which file is saved afterwards.
  const exportData = useDataMutation<Format, DataExport>((d) => d.exportData(), ['settings'], {
    onSuccess: (data, format) => {
      save(data, format);
      toast.success('Download started.');
    },
  });
  const lastExportAt = settings.data?.lastExportAt ?? null;
  const due = settings.data !== undefined && isBackupDue(lastExportAt, ds.now());

  return (
    <section aria-labelledby="export-heading" className="flex flex-col items-start gap-3">
      <h2 id="export-heading" className="text-lg font-medium">
        Your data
      </h2>
      {due && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          {lastExportAt === null
            ? 'You haven’t downloaded a backup yet.'
            : 'Your last backup is more than 30 days old.'}{' '}
          Download one now and keep it somewhere safe.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {lastExportAt
          ? `Last downloaded ${formatTimestamp(lastExportAt)}.`
          : 'Download a copy of everything you’ve entered.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="h-11"
          disabled={exportData.isPending}
          onClick={() => exportData.mutate('json')}
        >
          <Download aria-hidden="true" /> All data (JSON)
        </Button>
        <Button
          variant="outline"
          className="h-11"
          disabled={exportData.isPending}
          onClick={() => exportData.mutate('csv')}
        >
          <Download aria-hidden="true" /> Sessions (CSV)
        </Button>
      </div>
    </section>
  );
}

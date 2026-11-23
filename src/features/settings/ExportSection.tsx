import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { DataExport } from '@/core/domain/types';
import { formatTimestamp } from '@/core/logic/labels';
import { isBackupDue } from '@/core/services/exports';
import { useDataMutation, useSettings } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { useToday } from '@/data/useToday';
import { saveExport } from '@/lib/saveExport';
import type { ExportFormat as Format } from '@/lib/saveExport';

import { RestoreSection } from './RestoreSection.js';

const DOWNLOADS: { format: Format; label: string }[] = [
  { format: 'json', label: 'All data (JSON)' },
  { format: 'sessions', label: 'Sessions (CSV)' },
  { format: 'scores', label: 'Scores (CSV)' },
  { format: 'tasks', label: 'Tasks (CSV)' },
  { format: 'mistakes', label: 'Mistakes (CSV)' },
];

// SET-2, DATA-2: download everything as JSON, or a table as CSV. SET-3: remind when a backup is
// due. DATA-3: restore from a backup.
export function ExportSection() {
  const ds = useDataSource();
  const today = useToday();
  const settings = useSettings();
  // The format only decides which file is saved afterwards.
  const exportData = useDataMutation<Format, DataExport>((d) => d.exportData(), ['settings'], {
    onSuccess: (data, format) => {
      saveExport(data, format, today);
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
        {DOWNLOADS.map(({ format, label }) => (
          <Button
            key={format}
            variant="outline"
            className="h-11"
            disabled={exportData.isPending}
            onClick={() => exportData.mutate(format)}
          >
            <Download aria-hidden="true" /> {label}
          </Button>
        ))}
      </div>
      <RestoreSection />
    </section>
  );
}

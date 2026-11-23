import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import type { ChangeEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BackupSummary } from '@/core/domain/types';
import { DomainError } from '@/core/domain/errors';
import { formatRange, formatTimestamp } from '@/core/logic/labels';
import { MAX_BACKUP_BYTES, parseBackup, summarizeBackup } from '@/core/services/backup';
import { useDataSource } from '@/data/useDataSource';
import { useToday } from '@/data/useToday';
import { saveExport } from '@/lib/saveExport';

// DATA-3: restore from a Streakwise JSON backup. The whole file is checked and summarised first;
// nothing changes until the owner types RESTORE, and a fresh backup of the current data downloads
// before the restore runs (DATA-4 replaces, never merges).

const CONFIRM_WORD = 'RESTORE';

interface Chosen {
  name: string;
  data: unknown;
  summary: BackupSummary;
}

function describe(summary: BackupSummary): string[] {
  const c = summary.counts;
  const range = summary.sessionRange
    ? ` (${formatRange(summary.sessionRange.from, summary.sessionRange.to)})`
    : '';
  return [
    `${c.nodes} tracks, subtasks, and topics`,
    `${c.sessions} sessions${range}`,
    `${c.tasks} tasks with ${c.taskCompletions} completions`,
    `${c.scores} scores`,
    `${c.deadlines} deadlines with ${c.examTargets} exam targets`,
    `${c.mistakes} mistakes`,
  ];
}

export function RestoreSection() {
  const id = useId();
  const ds = useDataSource();
  const today = useToday();
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  const restore = useMutation({
    mutationFn: async (backup: Chosen) => {
      // DATA-3: a safety copy of what's there now, before anything is replaced.
      saveExport(await ds.exportData(), 'json', today);
      return ds.restoreBackup(backup.data);
    },
    onSuccess: () => {
      setChosen(null);
      setTyped('');
      toast.success('Restored. A backup of your data from before downloaded first.');
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [ds.mode] }),
  });

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setChosen(null);
    setProblem(null);
    setTyped('');
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setProblem('This file is larger than 4 MB, so it can’t be a Streakwise backup.');
      return;
    }
    try {
      const data: unknown = JSON.parse(await file.text());
      setChosen({ name: file.name, data, summary: summarizeBackup(parseBackup(data)) });
    } catch (error) {
      setProblem(
        error instanceof DomainError
          ? error.message
          : 'This file isn’t a Streakwise backup (it isn’t JSON).',
      );
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 border-t pt-4">
      <h3 className="font-medium">Restore from a backup</h3>
      <p className="text-sm text-muted-foreground">
        Replaces all your study data with a backup file you downloaded before. Your account, the
        Claude link, and shared links stay.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-file`}>Backup file (.json)</Label>
        <Input
          id={`${id}-file`}
          type="file"
          accept="application/json,.json"
          className="h-11 py-2"
          onChange={(event) => void choose(event)}
          aria-describedby={problem ? `${id}-problem` : undefined}
        />
      </div>
      {problem && (
        <p id={`${id}-problem`} role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      {chosen && (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="font-medium">
            {chosen.name}: exported {formatTimestamp(chosen.summary.exportedAt)}
          </p>
          <ul className="list-disc pl-5 text-sm">
            {describe(chosen.summary).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-sm">
            <strong>Everything you have now will be replaced</strong> by this file. A backup of your
            current data downloads first, so you can go back.
          </p>
          <div className="flex flex-col gap-2 sm:w-64">
            <Label htmlFor={`${id}-confirm`}>Type {CONFIRM_WORD} to confirm</Label>
            <Input
              id={`${id}-confirm`}
              className="h-11"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          <Button
            variant="destructive"
            className="h-11 self-start"
            disabled={typed !== CONFIRM_WORD || restore.isPending}
            onClick={() => restore.mutate(chosen)}
          >
            {restore.isPending ? 'Restoring…' : 'Restore this backup'}
          </Button>
        </div>
      )}
    </div>
  );
}

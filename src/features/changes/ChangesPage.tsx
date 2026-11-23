import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { QueryError } from '@/components/QueryError';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChangeEntry } from '@/core/domain/types';
import { localDate } from '@/core/logic/dates';
import { formatDay } from '@/lib/format';
import { useChanges } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';

// UNDO-4: everything the owner or Claude changed in the last 7 days, newest first, grouped by day,
// each with Undo (UNDO-5).

const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Karachi',
});

function groupByDay(changes: readonly ChangeEntry[]): { day: string; changes: ChangeEntry[] }[] {
  const days: { day: string; changes: ChangeEntry[] }[] = [];
  for (const change of changes) {
    const day = localDate(new Date(change.at));
    let group = days.at(-1);
    if (group?.day !== day) {
      group = { day, changes: [] };
      days.push(group);
    }
    group.changes.push(change);
  }
  return days;
}

export function ChangesPage() {
  const changes = useChanges();

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Recent changes</h1>
        <p className="text-muted-foreground">
          Everything you or Claude changed in the last 7 days. Undo puts it back as it was.
        </p>
      </div>
      {changes.isPending && <Skeleton className="h-64 w-full" />}
      {changes.isError && (
        <QueryError error={changes.error} onRetry={() => void changes.refetch()} />
      )}
      {changes.data && changes.data.length === 0 && (
        <p className="rounded-lg border border-dashed p-6">
          No changes in the last 7 days. When you or Claude log, tick, score, or edit something, it
          shows up here.
        </p>
      )}
      {changes.data &&
        groupByDay(changes.data).map(({ day, changes: entries }) => (
          <section key={day} aria-labelledby={`changes-${day}`} className="flex flex-col gap-2">
            <h2 id={`changes-${day}`} className="text-lg font-medium">
              {formatDay(day)}
            </h2>
            <ul className="flex flex-col divide-y rounded-lg border">
              {entries.map((entry) => (
                <ChangeRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </section>
        ))}
    </>
  );
}

function ChangeRow({ entry }: { entry: ChangeEntry }) {
  const ds = useDataSource();
  const queryClient = useQueryClient();
  const undo = useMutation({
    mutationFn: () => ds.undoChange(entry.id),
    onSuccess: () => toast.success('Undone.'),
    onError: (error) => toast.error(error.message),
    // An undo can change anything, so every screen refreshes.
    onSettled: () => queryClient.invalidateQueries({ queryKey: [ds.mode] }),
  });
  const time = TIME.format(new Date(entry.at));

  return (
    <li className="flex items-center gap-3 p-3">
      <span className="w-12 shrink-0 text-sm text-muted-foreground tabular-nums">{time}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p
          className={
            entry.undoneAt ? 'break-words text-muted-foreground line-through' : 'break-words'
          }
        >
          {entry.summary}
        </p>
        {entry.source === 'claude' && (
          <Badge variant="secondary" className="self-start">
            via Claude
          </Badge>
        )}
      </div>
      {entry.undoneAt ? (
        <span className="shrink-0 text-sm text-muted-foreground">Undone</span>
      ) : (
        <Button
          variant="outline"
          className="h-11 shrink-0"
          aria-label={`Undo: ${entry.summary}`}
          disabled={undo.isPending}
          onClick={() => undo.mutate()}
        >
          Undo
        </Button>
      )}
    </li>
  );
}

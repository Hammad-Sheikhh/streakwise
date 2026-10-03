import { Plus } from 'lucide-react';
import { Link } from 'react-router';

import { QueryError } from '@/components/QueryError';
import { trackSwatchClass } from '@/components/trackColors';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/core/logic/duration';
import { visibleNodes } from '@/core/logic/tree';
import { useDay, useTree } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { useToday } from '@/data/useToday';

// A temporary Home: today's total and the tracks, each with a shortcut to log time on it.
// The real dashboard arrives in M3.
export function HomePage() {
  const { basePath } = useDataSource();
  const today = useToday();
  const tree = useTree();
  const day = useDay(today, true);
  const tracks = visibleNodes(tree.data ?? []).filter((n) => n.depth === 1);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Streakwise</h1>

      <section
        aria-labelledby="today-heading"
        className="flex flex-col gap-1 rounded-lg border p-4"
      >
        <h2 id="today-heading" className="text-sm text-muted-foreground">
          Today
        </h2>
        {day.data ? (
          <p className="text-3xl font-semibold">
            {formatDuration(day.data.days[0]?.totalMinutes ?? 0)}
          </p>
        ) : (
          <Skeleton className="h-9 w-24" />
        )}
      </section>

      <section aria-labelledby="tracks-heading" className="flex flex-col gap-3">
        <h2 id="tracks-heading" className="text-lg font-medium">
          Your tracks
        </h2>
        {tree.isPending && <Skeleton className="h-32 w-full" />}
        {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}
        {tree.data && tracks.length === 0 && (
          <p className="rounded-lg border border-dashed p-6">
            No tracks yet.{' '}
            <Link to={`${basePath}/settings/structure`} className="underline">
              Add one in Settings → Structure
            </Link>
            .
          </p>
        )}
        {tracks.length > 0 && (
          <ul className="flex flex-col divide-y rounded-lg border">
            {tracks.map((track) => (
              <li key={track.id} className="flex items-center gap-3 py-1 pr-1 pl-4">
                {track.color && (
                  <span
                    aria-hidden="true"
                    className={`size-3 shrink-0 rounded-full ${trackSwatchClass[track.color]}`}
                  />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">{track.name}</span>
                <Button asChild variant="ghost" className="h-11">
                  <Link
                    to={`${basePath}/log?node=${track.id}`}
                    aria-label={`Log time on ${track.name}`}
                  >
                    <Plus aria-hidden="true" /> Log
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

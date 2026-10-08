import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import { AddTrackForm } from '@/components/AddTrackForm';
import { QueryError } from '@/components/QueryError';
import { trackSwatchClass } from '@/components/trackColors';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/core/logic/duration';
import { syllabusPercent } from '@/core/logic/syllabus';
import { hiddenIds } from '@/core/logic/tree';
import { useDashboard, useTree } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { formatTargetHours } from '@/lib/format';
import { cn } from '@/lib/utils';

// The list of tracks, each linking to its page (TRACK-1), with syllabus % (TOP-2).
export function TracksPage() {
  const { basePath } = useDataSource();
  const tree = useTree();
  const dashboard = useDashboard();
  const nodes = tree.data ?? [];
  const hidden = hiddenIds(nodes);
  const tracks = nodes.filter((n) => n.depth === 1 && !hidden.has(n.id));
  const week = new Map((dashboard.data?.targets ?? []).map((t) => [t.trackId, t]));

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Tracks</h1>
      <div className="rounded-lg border p-4">
        <AddTrackForm />
      </div>
      {tree.isPending && <Skeleton className="h-40 w-full" />}
      {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}
      {tree.data && tracks.length === 0 && (
        <p className="rounded-lg border border-dashed p-6">No tracks yet. Add one above.</p>
      )}
      {tracks.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {tracks.map((track) => {
            const syllabus = syllabusPercent(nodes, track.id);
            const target = week.get(track.id);
            return (
              <li key={track.id}>
                <Link
                  to={`${basePath}/tracks/${track.id}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {track.color && (
                    <span
                      aria-hidden="true"
                      className={cn('size-3 shrink-0 rounded-full', trackSwatchClass[track.color])}
                    />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{track.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {target &&
                        `${formatDuration(target.minutes)}${
                          target.targetMinutes
                            ? ` / ${formatTargetHours(target.targetMinutes)}`
                            : ''
                        } this week`}
                      {syllabus !== null && ` · ${syllabus}% of syllabus done`}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

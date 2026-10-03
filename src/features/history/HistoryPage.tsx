import { Link, useSearchParams } from 'react-router';

import { QueryError } from '@/components/QueryError';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SESSION_SOURCES } from '@/core/domain/types';
import type { SessionSource } from '@/core/domain/types';
import { formatDuration } from '@/core/logic/duration';
import type { HistoryQuery } from '@/core/schemas/inputs';
import { useHistory, useTree } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { useToday } from '@/data/useToday';
import { formatRelativeDay } from '@/lib/format';

import { HistoryFilters } from './HistoryFilters';
import { SessionRow } from './SessionRow';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Filters live in the URL, so a day or a node can be linked to directly (e.g. from the heatmap). */
function readFilters(params: URLSearchParams): HistoryQuery {
  const filters: HistoryQuery = {};
  const from = params.get('from');
  const to = params.get('to');
  const nodeId = params.get('node');
  const source = params.get('source');
  if (from && DATE.test(from)) filters.from = from;
  if (to && DATE.test(to)) filters.to = to;
  if (nodeId) filters.nodeId = nodeId;
  if (SESSION_SOURCES.includes(source as SessionSource)) filters.source = source as SessionSource;
  return filters;
}

// HIST-1–4.
export function HistoryPage() {
  const { basePath } = useDataSource();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const filtered = Object.keys(filters).length > 0;
  const tree = useTree();
  const history = useHistory(filters);

  const days = history.data?.pages.flatMap((page) => page.days) ?? [];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>
      {tree.data && (
        <HistoryFilters
          nodes={tree.data}
          filters={filters}
          today={today}
          onChange={(next) => {
            const search = new URLSearchParams();
            if (next.nodeId) search.set('node', next.nodeId);
            if (next.source) search.set('source', next.source);
            if (next.from) search.set('from', next.from);
            if (next.to) search.set('to', next.to);
            setParams(search, { replace: true });
          }}
        />
      )}

      {(history.isPending || tree.isPending) && (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {history.isError && (
        <QueryError error={history.error} onRetry={() => void history.refetch()} />
      )}
      {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}

      {history.data && tree.data && days.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
          {filtered ? (
            <p>No sessions match these filters.</p>
          ) : (
            <>
              <p>No sessions yet. Log your first one and it shows up here.</p>
              <Button asChild className="h-11">
                <Link to={`${basePath}/log`}>Log a session</Link>
              </Button>
            </>
          )}
        </div>
      )}

      {tree.data &&
        days.map((day) => (
          <section
            key={day.date}
            aria-labelledby={`day-${day.date}`}
            className="flex flex-col gap-2"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 id={`day-${day.date}`} className="font-medium">
                {formatRelativeDay(day.date, today)}
              </h2>
              <p className="text-sm text-muted-foreground">
                <span className="sr-only">Total: </span>
                {formatDuration(day.totalMinutes)}
              </p>
            </div>
            <ul className="flex flex-col divide-y rounded-lg border">
              {day.sessions.map((session) => (
                <SessionRow key={session.id} session={session} nodes={tree.data} today={today} />
              ))}
            </ul>
          </section>
        ))}

      {history.hasNextPage && (
        <Button
          variant="outline"
          className="h-11 self-center"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          {history.isFetchingNextPage ? 'Loading…' : 'Load older sessions'}
        </Button>
      )}
    </>
  );
}

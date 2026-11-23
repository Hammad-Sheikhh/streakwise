import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { QueryError } from '@/components/QueryError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { SESSION_SOURCES } from '@/core/domain/types';
import type { SessionSource } from '@/core/domain/types';
import { formatDuration } from '@/core/logic/duration';
import type { HistoryQuery } from '@/core/schemas/inputs';
import { useHistory, useTree } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { useToday } from '@/data/useToday';
import { formatRelativeDay } from '@/lib/format';

import { HistoryFilters } from './HistoryFilters.js';
import { SessionRow } from './SessionRow.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Filters live in the URL, so a day or a node can be linked to directly (e.g. from the heatmap). */
function readFilters(params: URLSearchParams): HistoryQuery {
  const filters: HistoryQuery = {};
  const from = params.get('from');
  const to = params.get('to');
  const nodeId = params.get('node');
  const source = params.get('source');
  const query = params.get('q')?.trim();
  if (query) filters.noteContains = query.slice(0, 200);
  if (from && DATE.test(from)) filters.from = from;
  if (to && DATE.test(to)) filters.to = to;
  if (nodeId) filters.nodeId = nodeId;
  if (SESSION_SOURCES.includes(source as SessionSource)) filters.source = source as SessionSource;
  return filters;
}

/** Writes the filters (and the note search) back to the URL. */
function toParams(filters: HistoryQuery): URLSearchParams {
  const search = new URLSearchParams();
  if (filters.noteContains) search.set('q', filters.noteContains);
  if (filters.nodeId) search.set('node', filters.nodeId);
  if (filters.source) search.set('source', filters.source);
  if (filters.from) search.set('from', filters.from);
  if (filters.to) search.set('to', filters.to);
  return search;
}

// HIST-1–4, DATA-1 (search every note).
export function HistoryPage() {
  const { basePath } = useDataSource();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const filtered = Object.keys(filters).length > 0;
  const tree = useTree();
  const history = useHistory(filters);
  const { noteContains, ...otherFilters } = filters;

  const days = history.data?.pages.flatMap((page) => page.days) ?? [];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>
      <NoteSearch
        key={noteContains ?? ''}
        value={noteContains ?? ''}
        onSearch={(text) =>
          setParams(toParams({ ...filters, noteContains: text || undefined }), { replace: true })
        }
      />
      {tree.data && (
        <HistoryFilters
          nodes={tree.data}
          filters={otherFilters}
          today={today}
          onChange={(next) => setParams(toParams({ ...next, noteContains }), { replace: true })}
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
            <p>
              {noteContains
                ? `No notes contain “${noteContains}”${Object.keys(otherFilters).length > 0 ? ' with these filters' : ''}.`
                : 'No sessions match these filters.'}
            </p>
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
                <SessionRow
                  key={session.id}
                  session={session}
                  nodes={tree.data}
                  today={today}
                  highlight={noteContains}
                />
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

/** DATA-1: searches the notes of all sessions, combined with the filters. */
function NoteSearch({ value, onSearch }: { value: string; onSearch: (text: string) => void }) {
  const id = useId();
  const [text, setText] = useState(value);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(text.trim());
  }

  return (
    <form role="search" className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <Label htmlFor={`${id}-q`}>Search notes</Label>
      <div className="flex gap-2">
        <Input
          id={`${id}-q`}
          type="search"
          className="h-11"
          maxLength={200}
          placeholder="e.g. Day 3"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // Clearing the box (or its ✕) clears the search.
            if (e.target.value === '' && value) onSearch('');
          }}
        />
        <Button type="submit" variant="outline" className="h-11">
          <Search aria-hidden="true" /> Search
        </Button>
      </div>
    </form>
  );
}

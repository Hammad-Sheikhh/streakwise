import { useLocation, useNavigate, useSearchParams } from 'react-router';

import { QueryError } from '@/components/QueryError';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/core/logic/duration';
import { formatDay } from '@/core/logic/labels';
import { nodePath } from '@/core/logic/tree';
import { SESSION_KEYS, useDataMutation, useRecentNodeIds, useTree } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { useStudyDay } from '@/data/useToday';
import { useUndoToast } from '@/features/changes/useUndo';

import { LogForm } from './LogForm.js';
import type { LogFormValues } from './LogForm.js';

// LOG-1: "+ Log", optionally with ?node=<id> preselected; LOG-9, UNDO-1: Undo for 10 seconds
// after saving.
export function LogPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const study = useStudyDay();
  const { today } = study;
  const tree = useTree();
  const recent = useRecentNodeIds();

  const dataSource = useDataSource();
  // The page closes right after saving; the toast's Undo doesn't depend on this page staying open.
  const undoToast = useUndoToast();

  const log = useDataMutation((ds, values: LogFormValues) => ds.logSession(values), SESSION_KEYS, {
    onSuccess: (session) => {
      const name = nodePath(tree.data ?? [], session.nodeId).at(-1) ?? 'session';
      undoToast(`Logged ${formatDuration(session.minutes)} · ${name}`, 'session', session.id);
      // Back to where "+ Log" was opened from; Home if the page was opened directly.
      if (location.key !== 'default') void navigate(-1);
      else void navigate(dataSource.basePath || '/', { replace: true });
    },
  });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Log a session</h1>
      {(tree.isPending || !study.ready) && <Skeleton className="h-96 w-full" />}
      {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}
      {/* The date defaults to today, so the form waits for the "My day ends at" setting. */}
      {tree.data && study.ready && (
        <LogForm
          nodes={tree.data}
          today={today}
          dayHint={dayHint(study)}
          initial={{ nodeId: params.get('node') ?? undefined }}
          recentNodeIds={recent.data}
          submitLabel="Save session"
          pending={log.isPending}
          onSubmit={(values) => log.mutate(values)}
        />
      )}
    </>
  );
}

/** DAY-5: between midnight and the cutoff, say which day "today" is. */
function dayHint(study: ReturnType<typeof useStudyDay>): string | undefined {
  if (study.calendarDate === study.today) return undefined;
  const hours = String(Math.floor(study.dayEndsAtMinutes / 60)).padStart(2, '0');
  const time = `${hours}:${String(study.dayEndsAtMinutes % 60).padStart(2, '0')}`;
  return `Counts for ${formatDay(study.today)} (your day ends at ${time}).`;
}

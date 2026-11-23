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
import { useStartTimer } from '@/features/timer/useStartTimer';

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
  const startTimer = useStartTimer();
  // TIMER-2: a stopped timer opens this page with the node, minutes, and day filled in.
  const fromTimer = params.get('timer') === '1';
  const timedMinutes = Number(params.get('minutes'));
  const timedDate = params.get('date') ?? '';
  const ranMinutes = Number(params.get('ran'));
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
      {fromTimer && ranMinutes > 0 && (
        <p
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40"
        >
          The timer ran for {formatDuration(ranMinutes)}. A session can be at most 24 hours, so
          enter the time you actually studied.
        </p>
      )}
      {tree.data && study.ready && (
        <LogForm
          // A new /log address (e.g. a stopped timer while this page is open) starts a fresh form.
          key={location.key}
          nodes={tree.data}
          today={today}
          dayHint={dayHint(study)}
          initial={{
            nodeId: params.get('node') ?? undefined,
            ...(fromTimer && Number.isInteger(timedMinutes) && timedMinutes > 0
              ? { minutes: timedMinutes }
              : {}),
            ...(fromTimer && /^\d{4}-\d{2}-\d{2}$/.test(timedDate) ? { studiedOn: timedDate } : {}),
          }}
          focusNote={fromTimer}
          onStartTimer={(nodeId) => {
            if (!startTimer(nodeId)) return;
            if (location.key !== 'default') void navigate(-1);
            else void navigate(dataSource.basePath || '/', { replace: true });
          }}
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

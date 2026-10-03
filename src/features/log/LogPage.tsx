import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { QueryError } from '@/components/QueryError';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/core/logic/duration';
import { nodePath } from '@/core/logic/tree';
import { SESSION_KEYS, useDataMutation, useRecentNodeIds, useTree } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { useToday } from '@/data/useToday';

import { LogForm } from './LogForm';
import type { LogFormValues } from './LogForm';

// LOG-1: "+ Log", optionally with ?node=<id> preselected; LOG-9: Undo for 10 seconds after saving.
export function LogPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const today = useToday();
  const tree = useTree();
  const recent = useRecentNodeIds();

  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  // The page closes right after saving, so Undo can't rely on this component's hooks.
  async function undo(id: string) {
    try {
      await dataSource.deleteSession(id);
      toast.success('Session removed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Couldn’t undo. Delete it in History.');
    }
    await Promise.all(
      SESSION_KEYS.map((key) =>
        queryClient.invalidateQueries({ queryKey: [dataSource.mode, key] }),
      ),
    );
  }

  const log = useDataMutation((ds, values: LogFormValues) => ds.logSession(values), SESSION_KEYS, {
    onSuccess: (session) => {
      const name = nodePath(tree.data ?? [], session.nodeId).at(-1) ?? 'session';
      toast.success(`Logged ${formatDuration(session.minutes)} · ${name}`, {
        duration: 10_000,
        action: { label: 'Undo', onClick: () => void undo(session.id) },
      });
      // Back to where "+ Log" was opened from; Home if the page was opened directly.
      if (location.key !== 'default') void navigate(-1);
      else void navigate(dataSource.basePath || '/', { replace: true });
    },
  });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Log a session</h1>
      {tree.isPending && <Skeleton className="h-96 w-full" />}
      {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}
      {tree.data && (
        <LogForm
          nodes={tree.data}
          today={today}
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

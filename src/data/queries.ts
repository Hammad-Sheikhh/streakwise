import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { HistoryQuery } from '@/core/schemas/inputs';

import type { DataSource } from './DataSource';
import { useDataSource } from './useDataSource';

// Query and mutation hooks shared by the screens. Keys start with the data source's mode, so demo
// data and real data never share a cache entry.

export function useTree() {
  const ds = useDataSource();
  return useQuery({ queryKey: [ds.mode, 'tree'], queryFn: () => ds.listTree() });
}

export function useSettings() {
  const ds = useDataSource();
  return useQuery({ queryKey: [ds.mode, 'settings'], queryFn: () => ds.getSettings() });
}

/** SET-4: never requested in demo mode. */
export function useClaudeConnection() {
  const ds = useDataSource();
  return useQuery({
    queryKey: [ds.mode, 'claude-connection'],
    queryFn: () => ds.getClaudeConnection(),
    enabled: ds.mode === 'api',
  });
}

/** SHARE-3: never requested in demo mode (DEMO-5). */
export function useShares() {
  const ds = useDataSource();
  return useQuery({
    queryKey: [ds.mode, 'shares'],
    queryFn: () => ds.listShares(),
    enabled: ds.mode === 'api',
  });
}

export function useDashboard() {
  const ds = useDataSource();
  return useQuery({ queryKey: [ds.mode, 'dashboard'], queryFn: () => ds.getDashboard() });
}

/** TRACK-1. */
export function useTrackOverview(trackId: string) {
  const ds = useDataSource();
  return useQuery({
    queryKey: [ds.mode, 'track', trackId],
    queryFn: () => ds.getTrackOverview(trackId),
  });
}

export function useDeadlines() {
  const ds = useDataSource();
  return useQuery({ queryKey: [ds.mode, 'deadlines'], queryFn: () => ds.listDeadlines() });
}

/** TASK-1: archived tasks are fetched only when asked for. */
export function useTasks(options: { includeArchived?: boolean } = {}) {
  const ds = useDataSource();
  const includeArchived = options.includeArchived ?? false;
  return useQuery({
    queryKey: [ds.mode, 'tasks', { includeArchived }],
    queryFn: () => ds.listTasks({ includeArchived }),
  });
}

export function useScores() {
  const ds = useDataSource();
  return useQuery({ queryKey: [ds.mode, 'scores'], queryFn: () => ds.listScores() });
}

export function useRecentNodeIds() {
  const ds = useDataSource();
  return useQuery({ queryKey: [ds.mode, 'recent'], queryFn: () => ds.recentNodeIds() });
}

/** HIST-1: pages of 30 days; each page says where the next (older) one starts. */
export function useHistory(filters: HistoryQuery) {
  const ds = useDataSource();
  return useInfiniteQuery({
    queryKey: [ds.mode, 'sessions', 'history', filters],
    queryFn: ({ pageParam }) => ds.getHistory({ ...filters, to: pageParam }),
    initialPageParam: filters.to,
    getNextPageParam: (page) => page.nextTo ?? undefined,
  });
}

/** One day's sessions, for the 16-hour warning (LOG-10). */
export function useDay(date: string, enabled: boolean) {
  const ds = useDataSource();
  return useQuery({
    queryKey: [ds.mode, 'sessions', 'day', date],
    queryFn: () => ds.getHistory({ from: date, to: date }),
    enabled,
  });
}

/**
 * A mutation that refreshes the given cached data afterwards and shows failures as a toast with
 * a Retry button (SPEC §B11: no silent failures).
 */
export function useDataMutation<TInput, TResult>(
  action: (ds: DataSource, input: TInput) => Promise<TResult>,
  refresh: string[],
  options: { onSuccess?: (result: TResult, input: TInput) => void; toastErrors?: boolean } = {},
) {
  const ds = useDataSource();
  const queryClient = useQueryClient();
  const retry = { mutate: (input: TInput): void => void input };
  const mutation = useMutation({
    mutationFn: (input: TInput) => action(ds, input),
    onSuccess: options.onSuccess,
    onError: (error, input) => {
      if (options.toastErrors === false) return;
      toast.error(error.message, {
        action: { label: 'Retry', onClick: () => retry.mutate(input) },
      });
    },
    // Home summarises everything, so every change refreshes it too.
    onSettled: () =>
      Promise.all(
        [...new Set([...refresh, 'dashboard'])].map((key) =>
          queryClient.invalidateQueries({ queryKey: [ds.mode, key] }),
        ),
      ),
  });
  retry.mutate = mutation.mutate;
  return mutation;
}

/** Everything a session change can affect: lists, recent shortcuts, and topic statuses. */
export const SESSION_KEYS = ['sessions', 'recent', 'tree', 'dashboard', 'track'];

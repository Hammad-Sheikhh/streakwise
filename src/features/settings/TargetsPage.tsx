import { toast } from 'sonner';

import { NativeSelect } from '@/components/NativeSelect';
import { QueryError } from '@/components/QueryError';
import { trackSwatchClass } from '@/components/trackColors';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { visibleNodes } from '@/core/logic/tree';
import { useDataMutation, useTree } from '@/data/queries';
import { formatTargetHours } from '@/lib/format';
import { cn } from '@/lib/utils';

import { BackToSettings } from './BackToSettings';

/** 0.5 h to 40 h in half-hour steps (TGT-1). */
const TARGET_OPTIONS = Array.from({ length: 80 }, (_, i) => (i + 1) * 30);

// TGT-1: a weekly target in hours for each track; "No target" shows time only on Home.
export function TargetsPage() {
  const tree = useTree();
  const save = useDataMutation(
    (ds, input: { id: string; weeklyTargetMinutes: number | null }) =>
      ds.updateNode(input.id, { weeklyTargetMinutes: input.weeklyTargetMinutes }),
    ['tree'],
    { onSuccess: (track) => toast.success(`Target for ${track.name} saved.`) },
  );
  const tracks = visibleNodes(tree.data ?? []).filter((n) => n.depth === 1);

  return (
    <>
      <div className="flex flex-col gap-2">
        <BackToSettings />
        <h1 className="text-2xl font-semibold tracking-tight">Weekly targets</h1>
        <p className="text-sm text-muted-foreground">
          How many hours a week you aim for on each track. Weeks run Monday to Sunday.
        </p>
      </div>
      {tree.isPending && <Skeleton className="h-48 w-full" />}
      {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}
      {tree.data && tracks.length === 0 && (
        <p className="rounded-lg border border-dashed p-6">Add a track first, in Structure.</p>
      )}
      {tracks.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {tracks.map((track) => (
            <li key={track.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Label htmlFor={`target-${track.id}`} className="flex items-center gap-2 text-base">
                {track.color && (
                  <span
                    aria-hidden="true"
                    className={cn('size-3 rounded-full', trackSwatchClass[track.color])}
                  />
                )}
                {track.name}
              </Label>
              <NativeSelect
                id={`target-${track.id}`}
                className="w-40"
                value={track.weeklyTargetMinutes ?? ''}
                disabled={save.isPending}
                onChange={(e) =>
                  save.mutate({
                    id: track.id,
                    weeklyTargetMinutes: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">No target</option>
                {TARGET_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatTargetHours(minutes)} a week
                  </option>
                ))}
              </NativeSelect>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

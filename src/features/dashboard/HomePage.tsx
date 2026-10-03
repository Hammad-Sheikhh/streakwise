import { AlertTriangle, CalendarClock, Flame, Plus } from 'lucide-react';
import { Link } from 'react-router';

import { NodeLabel } from '@/components/NodeLabel';
import { QueryError } from '@/components/QueryError';
import { trackSwatchClass } from '@/components/trackColors';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Dashboard, TreeNode } from '@/core/domain/types';
import { formatDuration } from '@/core/logic/duration';
import { targetProgress } from '@/core/logic/targets';
import { useDashboard, useTree } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { formatDay, formatDaysLeft, formatTargetHours } from '@/lib/format';
import { cn } from '@/lib/utils';

import { Heatmap } from './Heatmap';

// DASH-1: Home answers "How am I doing this week, and what am I neglecting?" (G2).
// Order on mobile: neglect → today and streak → targets → (tasks, M5) → deadlines → heatmap →
// (this week's report, M6).
export function HomePage() {
  const dashboard = useDashboard();
  const tree = useTree();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Streakwise</h1>
      {(dashboard.isPending || tree.isPending) && <HomeSkeleton />}
      {dashboard.isError && (
        <QueryError error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      )}
      {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}
      {dashboard.data && tree.data && <HomeContent data={dashboard.data} nodes={tree.data} />}
    </>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="text-lg font-medium">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function HomeContent({ data, nodes }: { data: Dashboard; nodes: readonly TreeNode[] }) {
  const { basePath } = useDataSource();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const settingsLink = (path: string, label: string) => (
    <Link to={`${basePath}/settings/${path}`} className="text-sm underline underline-offset-4">
      {label}
    </Link>
  );

  return (
    <div className="flex flex-col gap-8">
      {data.neglect.length > 0 && (
        <section
          aria-labelledby="neglect-heading"
          className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40"
        >
          <h2 id="neglect-heading" className="flex items-center gap-2 font-medium">
            <AlertTriangle
              aria-hidden="true"
              className="size-4 text-amber-700 dark:text-amber-400"
            />
            Needs attention
          </h2>
          <ul className="flex flex-col">
            {data.neglect.map((warning) => {
              const name = byId.get(warning.nodeId)?.name ?? 'Something';
              const text = warning.neverLogged
                ? `${name} — never logged`
                : `${name} — ${warning.days} days untouched`;
              return (
                <li key={warning.nodeId}>
                  {/* NEG-1: tapping a warning opens Log with that node preselected. */}
                  <Link
                    to={`${basePath}/log?node=${warning.nodeId}`}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-md px-1 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                    aria-label={`${text}. Log time on it`}
                  >
                    <span>{text}</span>
                    <Plus aria-hidden="true" className="size-4 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <section
          aria-labelledby="today-heading"
          className="flex flex-col gap-1 rounded-lg border p-4"
        >
          <h2 id="today-heading" className="text-sm text-muted-foreground">
            Today
          </h2>
          <p className="text-3xl font-semibold">{formatDuration(data.todayMinutes)}</p>
        </section>
        <section
          aria-labelledby="streak-heading"
          className="flex flex-col gap-1 rounded-lg border p-4"
        >
          <h2 id="streak-heading" className="flex items-center gap-1 text-sm text-muted-foreground">
            <Flame aria-hidden="true" className="size-4" /> Streak
          </h2>
          <p className="text-3xl font-semibold">
            {data.streak.current} {data.streak.current === 1 ? 'day' : 'days'}
          </p>
          <p className="text-sm text-muted-foreground">Longest: {data.streak.longest}</p>
        </section>
      </div>

      <Section
        id="targets-heading"
        title="This week"
        action={settingsLink('targets', 'Set targets')}
      >
        {data.targets.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6">
            No tracks yet. Add one in{' '}
            <Link to={`${basePath}/settings/structure`} className="underline">
              Settings → Structure
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-4 rounded-lg border p-4">
            {data.targets.map((target) => {
              const track = byId.get(target.trackId);
              const progress = targetProgress(target.minutes, target.targetMinutes);
              const percent = progress === null ? null : Math.round(progress * 100);
              const label =
                target.targetMinutes === null
                  ? `${formatDuration(target.minutes)} this week`
                  : `${formatDuration(target.minutes)} / ${formatTargetHours(target.targetMinutes)}`;
              return (
                <li key={target.trackId} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      {track?.color && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'size-3 shrink-0 rounded-full',
                            trackSwatchClass[track.color],
                          )}
                        />
                      )}
                      <span className="truncate">{track?.name}</span>
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {label}
                      {percent !== null && ` · ${percent}%`}
                    </span>
                  </div>
                  {percent !== null && track && (
                    <div
                      role="progressbar"
                      aria-label={`${track.name} weekly target`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(percent, 100)}
                      aria-valuetext={`${label} (${percent}%)`}
                      className="h-2.5 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className={cn(
                          'h-full rounded-full motion-safe:transition-[width]',
                          track.color ? trackSwatchClass[track.color] : 'bg-primary',
                        )}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section
        id="deadlines-heading"
        title="Coming up"
        action={settingsLink('deadlines', 'Manage')}
      >
        {data.deadlines.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6">
            No upcoming deadlines.{' '}
            <Link to={`${basePath}/settings/deadlines`} className="underline">
              Add an exam or due date
            </Link>{' '}
            to see a countdown here.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {data.deadlines.map((deadline) => (
              <li key={deadline.id} className="flex items-start gap-3 p-4">
                <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="font-medium">
                    {deadline.title}{' '}
                    <span className="font-normal text-muted-foreground">
                      {formatDaysLeft(deadline.daysLeft)}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDay(deadline.dueOn)} ·{' '}
                    <NodeLabel nodes={nodes} nodeId={deadline.nodeId} />
                  </p>
                  {deadline.syllabusLeftPercent !== null && (
                    <p className="text-sm">{deadline.syllabusLeftPercent}% of syllabus left</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="heatmap-heading" title="Last 12 months">
        <Heatmap
          start={data.heatmap.start}
          end={data.heatmap.end}
          days={data.heatmap.days}
          historyPath={`${basePath}/history`}
        />
      </Section>

      {data.targets.length > 0 && data.heatmap.days.length === 0 && (
        <Button asChild className="h-11 self-start">
          <Link to={`${basePath}/log`}>
            <Plus aria-hidden="true" /> Log your first session
          </Link>
        </Button>
      )}
    </div>
  );
}

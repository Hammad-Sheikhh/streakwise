import { ArrowLeft, CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { NodeLabel } from '@/components/NodeLabel';
import { QueryError } from '@/components/QueryError';
import { trackSwatchClass } from '@/components/trackColors';
import { Skeleton } from '@/components/ui/skeleton';
import type { ScoreKind, TrackOverview, TreeNode } from '@/core/domain/types';
import { daysBetween } from '@/core/logic/dates';
import { formatDuration } from '@/core/logic/duration';
import { defaultKind } from '@/core/logic/scores';
import { syllabusPercent } from '@/core/logic/syllabus';
import { targetProgress } from '@/core/logic/targets';
import { hiddenIds, sortSiblings, subtreeIds } from '@/core/logic/tree';
import { useDeadlines, useScores, useTasks, useTrackOverview, useTree } from '@/data/queries';
import { useDataSource } from '@/data/useDataSource';
import { SessionRow } from '@/features/history/SessionRow';
import { ScoreChartSection } from '@/features/scores/ScoresPage';
import { filterScores } from '@/features/scores/scoreView';
import { buildTaskTree } from '@/features/tasks/grouping';
import { TaskTreeRows } from '@/features/tasks/TaskList';
import { formatDay, formatDaysLeft, formatTargetHours } from '@/lib/format';
import { cn } from '@/lib/utils';

import { TopicStatusSelect } from './TopicStatusSelect';

// TRACK-1: everything about one track on one page; topics get status controls (TOP-1) and every
// subtask with topics shows its syllabus % (TOP-2).

export function TrackPage() {
  const { id = '' } = useParams();
  const { basePath } = useDataSource();
  const tree = useTree();
  const overview = useTrackOverview(id);
  const track = tree.data?.find((n) => n.id === id && n.depth === 1);

  return (
    <>
      <Link
        to={`${basePath}/tracks`}
        className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Tracks
      </Link>
      {(tree.isPending || overview.isPending) && <Skeleton className="h-64 w-full" />}
      {tree.isError && <QueryError error={tree.error} onRetry={() => void tree.refetch()} />}
      {overview.isError && (
        <QueryError error={overview.error} onRetry={() => void overview.refetch()} />
      )}
      {tree.data && !track && !tree.isPending && (
        <p className="rounded-lg border border-dashed p-6">This track doesn’t exist any more.</p>
      )}
      {tree.data && track && overview.data && (
        <TrackContent track={track} nodes={tree.data} overview={overview.data} />
      )}
    </>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-lg font-medium">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TrackContent({
  track,
  nodes,
  overview,
}: {
  track: TreeNode;
  nodes: readonly TreeNode[];
  overview: TrackOverview;
}) {
  const { basePath } = useDataSource();
  const navigate = useNavigate();
  const tasks = useTasks();
  const scores = useScores();
  const deadlines = useDeadlines();
  const [chosenKind, setChosenKind] = useState<ScoreKind | '' | null>(null);

  const hidden = hiddenIds(nodes);
  const inTrack = new Set(subtreeIds(nodes, track.id));
  const time = new Map(overview.nodes.map((n) => [n.nodeId, n]));
  const own = time.get(track.id);
  const progress = targetProgress(own?.weekMinutes ?? 0, track.weeklyTargetMinutes);
  const percent = progress === null ? null : Math.round(progress * 100);
  const syllabus = syllabusPercent(nodes, track.id);
  const visibleChildren = (parentId: string) =>
    sortSiblings(nodes.filter((n) => n.parentId === parentId && !hidden.has(n.id)));
  const subtasks = visibleChildren(track.id);

  const trackScores = filterScores(nodes, scores.data ?? [], track.id, '');
  // SCORE-5: the chart opens on the kind this track records most.
  const kind = chosenKind ?? defaultKind(trackScores) ?? '';
  const taskRoots = buildTaskTree(
    (tasks.data ?? []).filter((item) => item.task.nodeId !== null && inTrack.has(item.task.nodeId)),
  );
  const upcoming = (deadlines.data ?? []).filter(
    (d) => inTrack.has(d.nodeId) && d.dueOn >= overview.today,
  );

  return (
    <div className="flex flex-col gap-8">
      <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
        {track.color && (
          <span
            aria-hidden="true"
            className={cn('size-4 shrink-0 rounded-full', trackSwatchClass[track.color])}
          />
        )}
        {track.name}
      </h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">This week</p>
          <p className="text-2xl font-semibold">{formatDuration(own?.weekMinutes ?? 0)}</p>
          {track.weeklyTargetMinutes ? (
            <p className="text-sm text-muted-foreground">
              of {formatTargetHours(track.weeklyTargetMinutes)}
              {percent !== null && ` · ${percent}%`}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No target</p>
          )}
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">All time</p>
          <p className="text-2xl font-semibold">{formatDuration(own?.totalMinutes ?? 0)}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Syllabus done</p>
          <p className="text-2xl font-semibold">{syllabus === null ? '—' : `${syllabus}%`}</p>
        </div>
      </div>

      <Section id="track-subtasks" title="Subtasks and topics">
        {subtasks.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6">
            No subtasks yet. Add them in{' '}
            <Link to={`${basePath}/settings/structure`} className="underline">
              Settings → Structure
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {subtasks.map((subtask) => {
              const subtaskTime = time.get(subtask.id);
              const subtaskSyllabus = syllabusPercent(nodes, subtask.id);
              const topics = visibleChildren(subtask.id);
              return (
                <li key={subtask.id} className="flex flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <h3 className="font-medium">{subtask.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDuration(subtaskTime?.weekMinutes ?? 0)} this week ·{' '}
                      {formatDuration(subtaskTime?.totalMinutes ?? 0)} total
                      {subtaskSyllabus !== null && ` · ${subtaskSyllabus}% done`}
                    </p>
                  </div>
                  {topics.length > 0 && (
                    <ul aria-label={`${subtask.name} topics`} className="flex flex-col gap-1">
                      {topics.map((topic) => (
                        <li key={topic.id} className="flex items-center justify-between gap-3">
                          <span
                            className={cn(
                              'min-w-0 break-words',
                              topic.topicStatus === 'done' && 'text-muted-foreground',
                            )}
                          >
                            {topic.name}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {formatDuration(time.get(topic.id)?.totalMinutes ?? 0)}
                            </span>
                          </span>
                          <TopicStatusSelect topic={topic} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section id="track-tasks" title="Tasks">
        {tasks.isError && <QueryError error={tasks.error} onRetry={() => void tasks.refetch()} />}
        {tasks.data &&
          (taskRoots.length === 0 ? (
            <p className="text-muted-foreground">No tasks for this track.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border">
              {taskRoots.map((entry) => (
                <TaskTreeRows
                  key={entry.item.task.id}
                  entry={entry}
                  onOpen={() => void navigate(`${basePath}/tasks`)}
                />
              ))}
            </ul>
          ))}
      </Section>

      <Section id="track-scores" title="Scores">
        {scores.isError && (
          <QueryError error={scores.error} onRetry={() => void scores.refetch()} />
        )}
        {scores.data &&
          (trackScores.length === 0 ? (
            <p className="text-muted-foreground">
              No scores yet.{' '}
              <Link to={`${basePath}/scores`} className="underline">
                Add one on Scores
              </Link>
              .
            </p>
          ) : (
            <ScoreChartSection
              nodes={nodes}
              scores={scores.data}
              trackId={track.id}
              kind={kind}
              onKindChange={setChosenKind}
            />
          ))}
      </Section>

      <Section id="track-deadlines" title="Deadlines">
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground">No upcoming deadlines.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {upcoming.map((d) => (
              <li key={d.id} className="flex items-start gap-3 p-4">
                <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="font-medium">
                    {d.title}{' '}
                    <span className="font-normal text-muted-foreground">
                      {formatDaysLeft(daysBetween(overview.today, d.dueOn))}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">{formatDay(d.dueOn)}</p>
                  <NodeLabel nodes={nodes} nodeId={d.nodeId} className="text-sm" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="track-sessions" title="Recent sessions">
        {overview.recentSessions.length === 0 ? (
          <p className="text-muted-foreground">
            Nothing logged yet.{' '}
            <Link to={`${basePath}/log?node=${track.id}`} className="underline">
              Log a session
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {overview.recentSessions.map((session) => (
              <SessionRow key={session.id} session={session} nodes={nodes} today={overview.today} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

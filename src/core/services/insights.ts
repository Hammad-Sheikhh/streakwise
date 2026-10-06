import type { Clock, TreeNode, UpcomingDeadline } from '../domain/types';
import { daysBetween, localDate, weekStart } from '../logic/dates';
import { neglectWarnings } from '../logic/neglect';
import { dailyTotals, latestDateByNode, minutesByNode } from '../logic/rollup';
import { currentStreak, longestStreak } from '../logic/streak';
import { compareDue } from '../logic/tasks';
import { syllabusPercent } from '../logic/syllabus';
import { isBehindPace, targetProgress } from '../logic/targets';
import { hiddenIds, nodePath } from '../logic/tree';
import type { Repository } from '../repo/Repository';
import { selectUpcoming } from './deadlines';
import { listTree } from './structure';
import { listTaskItems } from './tasks';

// Summaries for Claude (MCP-9 `get_progress` and `find_gaps`). Names and paths are included so the
// results read well without a second lookup.

export interface SubtaskProgress {
  id: string;
  name: string;
  weekMinutes: number;
  syllabusPercent: number | null;
}

export interface TrackProgress {
  id: string;
  name: string;
  weekMinutes: number;
  weeklyTargetMinutes: number | null;
  /** Whole-number share of the weekly target, or null without a target. */
  targetPercent: number | null;
  behindPace: boolean;
  syllabusPercent: number | null;
  subtasks: SubtaskProgress[];
}

export interface Progress {
  today: string;
  weekStart: string;
  todayMinutes: number;
  streak: { current: number; longest: number };
  tracks: TrackProgress[];
  upcomingDeadlines: (UpcomingDeadline & { path: string })[];
}

export interface Gaps {
  today: string;
  neglectDays: number;
  /** NEG-1 / §B9.5, most neglected first. */
  neglected: { id: string; path: string; days: number; neverLogged: boolean }[];
  /** §B9.4. */
  behindPace: {
    id: string;
    name: string;
    weekMinutes: number;
    weeklyTargetMinutes: number;
    expectedByNowMinutes: number;
  }[];
  /** Visible topics with status not_started, in tree order. */
  topicsNotStarted: { id: string; path: string }[];
  /** TASK-7: tasks due this week, overdue first. */
  tasksDue: {
    id: string;
    title: string;
    path: string;
    weekly: boolean;
    dueOn: string | null;
    overdue: boolean;
  }[];
}

/** Tasks with no node show this as their path. */
const OTHER = 'Other';

const pathOf = (nodes: readonly TreeNode[], id: string) => nodePath(nodes, id).join(' > ');

export async function getProgress(repo: Repository, clock: Clock): Promise<Progress> {
  const today = localDate(clock());
  const monday = weekStart(today);
  const [nodes, facts, deadlines] = await Promise.all([
    listTree(repo),
    repo.listSessionFacts(),
    repo.listDeadlines(),
  ]);
  const hidden = hiddenIds(nodes);
  const visible = nodes.filter((n) => !hidden.has(n.id));
  const totals = dailyTotals(facts);
  const activeDates = new Set(totals.keys());
  const thisWeek = minutesByNode(nodes, facts, { from: monday, to: today });

  const tracks = visible
    .filter((n) => n.depth === 1)
    .map((track): TrackProgress => {
      const weekMinutes = thisWeek.get(track.id) ?? 0;
      const share = targetProgress(weekMinutes, track.weeklyTargetMinutes);
      return {
        id: track.id,
        name: track.name,
        weekMinutes,
        weeklyTargetMinutes: track.weeklyTargetMinutes,
        targetPercent: share === null ? null : Math.round(share * 100),
        behindPace: isBehindPace(weekMinutes, track.weeklyTargetMinutes, today),
        syllabusPercent: syllabusPercent(nodes, track.id),
        subtasks: visible
          .filter((n) => n.parentId === track.id)
          .map((subtask) => ({
            id: subtask.id,
            name: subtask.name,
            weekMinutes: thisWeek.get(subtask.id) ?? 0,
            syllabusPercent: syllabusPercent(nodes, subtask.id),
          })),
      };
    });

  return {
    today,
    weekStart: monday,
    todayMinutes: totals.get(today) ?? 0,
    streak: { current: currentStreak(activeDates, today), longest: longestStreak(activeDates) },
    tracks,
    upcomingDeadlines: selectUpcoming(nodes, deadlines, today).map((d) => ({
      ...d,
      path: pathOf(nodes, d.nodeId),
    })),
  };
}

export async function findGaps(repo: Repository, clock: Clock): Promise<Gaps> {
  const today = localDate(clock());
  const [nodes, facts, settings, tasks] = await Promise.all([
    listTree(repo),
    repo.listSessionFacts(),
    repo.getSettings(),
    listTaskItems(repo, clock),
  ]);
  const hidden = hiddenIds(nodes);
  const visible = nodes.filter((n) => !hidden.has(n.id));
  const thisWeek = minutesByNode(nodes, facts, { from: weekStart(today), to: today });
  const daysElapsed = daysBetween(weekStart(today), today) + 1;

  const behindPace: Gaps['behindPace'] = [];
  for (const track of visible) {
    const target = track.weeklyTargetMinutes;
    const weekMinutes = thisWeek.get(track.id) ?? 0;
    if (track.depth !== 1 || target === null || !isBehindPace(weekMinutes, target, today)) {
      continue;
    }
    behindPace.push({
      id: track.id,
      name: track.name,
      weekMinutes,
      weeklyTargetMinutes: target,
      expectedByNowMinutes: Math.round((target * daysElapsed) / 7),
    });
  }

  return {
    today,
    neglectDays: settings.neglectDays,
    neglected: neglectWarnings(
      nodes,
      latestDateByNode(nodes, facts),
      today,
      settings.neglectDays,
    ).map((w) => ({
      id: w.nodeId,
      path: pathOf(nodes, w.nodeId),
      days: w.days,
      neverLogged: w.neverLogged,
    })),
    behindPace,
    topicsNotStarted: visible
      .filter((n) => n.depth === 3 && n.topicStatus === 'not_started')
      .map((n) => ({ id: n.id, path: pathOf(nodes, n.id) })),
    tasksDue: tasks
      .filter((item) => item.dueThisWeek)
      .sort(compareDue)
      .map(({ task, overdue }) => ({
        id: task.id,
        title: task.title,
        path: task.nodeId === null ? OTHER : pathOf(nodes, task.nodeId),
        weekly: task.recurrence === 'weekly',
        dueOn: task.dueOn,
        overdue,
      })),
  };
}

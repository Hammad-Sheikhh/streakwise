import type { Clock, Dashboard } from '../domain/types';
import { daysBetween, localDate, weekStart } from '../logic/dates';
import { heatmapRange } from '../logic/heatmap';
import { neglectWarnings } from '../logic/neglect';
import { dailyTotals, latestDateByNode, minutesByNode } from '../logic/rollup';
import { currentStreak, longestStreak } from '../logic/streak';
import { syllabusPercent } from '../logic/syllabus';
import { hiddenIds } from '../logic/tree';
import type { Repository } from '../repo/Repository';
import { listTree } from './structure';

/** Home shows the next few deadlines (DEAD-2). */
export const DASHBOARD_DEADLINES = 3;

/** DASH-1: everything Home needs, computed from one read of each table. */
export async function getDashboard(repo: Repository, clock: Clock): Promise<Dashboard> {
  const today = localDate(clock());
  const [nodes, facts, settings, deadlines] = await Promise.all([
    listTree(repo),
    repo.listSessionFacts(),
    repo.getSettings(),
    repo.listDeadlines(),
  ]);
  const hidden = hiddenIds(nodes);
  const totals = dailyTotals(facts);
  const activeDates = new Set(totals.keys());

  const thisWeek = minutesByNode(nodes, facts, { from: weekStart(today), to: today });
  const targets = nodes
    .filter((n) => n.depth === 1 && !hidden.has(n.id))
    .map((track) => ({
      trackId: track.id,
      minutes: thisWeek.get(track.id) ?? 0,
      targetMinutes: track.weeklyTargetMinutes,
    }));

  const upcoming = deadlines
    .filter((d) => d.dueOn >= today && !hidden.has(d.nodeId))
    .slice(0, DASHBOARD_DEADLINES)
    .map((d) => {
      const done = syllabusPercent(nodes, d.nodeId);
      return {
        ...d,
        daysLeft: daysBetween(today, d.dueOn),
        syllabusLeftPercent: done === null ? null : 100 - done,
      };
    });

  const { start, end } = heatmapRange(today);
  const heatmapDays = [...totals]
    .filter(([date]) => date >= start && date <= end)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, minutes]) => ({ date, minutes }));

  return {
    today,
    todayMinutes: totals.get(today) ?? 0,
    streak: { current: currentStreak(activeDates, today), longest: longestStreak(activeDates) },
    targets,
    neglect: neglectWarnings(nodes, latestDateByNode(nodes, facts), today, settings.neglectDays),
    deadlines: upcoming,
    heatmap: { start, end, days: heatmapDays },
  };
}

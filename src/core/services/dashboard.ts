import type { Clock, Dashboard, TodayCard } from '../domain/types.js';
import { studyDate, weekStart } from '../logic/dates.js';
import { heatmapRange } from '../logic/heatmap.js';
import { isDue } from '../logic/mistakes.js';
import { neglectWarnings } from '../logic/neglect.js';
import { dailyTotals, latestDateByNode, minutesByNode } from '../logic/rollup.js';
import { compareDue } from '../logic/tasks.js';
import { currentStreak, longestStreak } from '../logic/streak.js';
import { minutesTodayByModule, neededPerDay, todaysTask } from '../logic/todayCard.js';
import { hiddenIds } from '../logic/tree.js';
import type { Repository } from '../repo/Repository.js';
import { selectUpcoming } from './deadlines.js';
import { isBackupDue } from './exports.js';
import { listTree } from './structure.js';
import { buildTaskItems } from './tasks.js';

/** Home shows the next few deadlines (DEAD-2). */
export const DASHBOARD_DEADLINES = 3;

/** DASH-1: everything Home needs, computed from one read of each table. */
export async function getDashboard(repo: Repository, clock: Clock): Promise<Dashboard> {
  const [nodes, facts, settings, deadlines, taskRows, completions, mistakes] = await Promise.all([
    listTree(repo),
    repo.listSessionFacts(),
    repo.getSettings(),
    repo.listDeadlines(),
    repo.listTasks(),
    repo.listTaskCompletions(),
    repo.listMistakes(),
  ]);
  const today = studyDate(clock(), settings.dayEndsAtMinutes);
  const tasks = buildTaskItems(taskRows, completions, nodes, today);
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

  // TODAY-1–3.
  const task = todaysTask(tasks, today);
  const todayCard: TodayCard = {
    task,
    subtasks: task ? tasks.filter((item) => item.task.parentTaskId === task.task.id) : [],
    minutes: minutesTodayByModule(nodes, facts, today),
    pace: targets.flatMap((target) =>
      target.targetMinutes
        ? [
            {
              trackId: target.trackId,
              minutes: target.minutes,
              targetMinutes: target.targetMinutes,
              neededPerDay: neededPerDay(target.targetMinutes, target.minutes, today),
              met: target.minutes >= target.targetMinutes,
            },
          ]
        : [],
    ),
  };

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
    neglect: neglectWarnings(
      nodes,
      latestDateByNode(nodes, facts),
      today,
      settings.neglectDays,
      settings.dayEndsAtMinutes,
    ),
    tasksDue: tasks.filter((item) => item.dueThisWeek).sort(compareDue),
    deadlines: selectUpcoming(nodes, deadlines, today).slice(0, DASHBOARD_DEADLINES),
    heatmap: { start, end, days: heatmapDays },
    backupDue: isBackupDue(settings.lastExportAt, clock()),
    todayCard,
    // ERR-6: only mistakes on visible nodes (TREE-2).
    mistakesDue: mistakes.filter((m) => !hidden.has(m.nodeId) && isDue(m, today)).length,
  };
}

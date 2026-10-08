import type { Clock, Report, Score, Session, TreeNode } from '../domain/types';
import { daysBetween, localDate } from '../logic/dates';
import { neglectWarnings } from '../logic/neglect';
import { periodAsOf, resolvePeriod } from '../logic/reportPeriod';
import { dailyTotals, latestDateByNode, minutesByNode } from '../logic/rollup';
import { scorePercent } from '../logic/scores';
import { currentStreak } from '../logic/streak';
import { hiddenIds, nodePath } from '../logic/tree';
import type { Repository } from '../repo/Repository';
import { reportQuerySchema } from '../schemas/inputs';
import type { ReportQuery } from '../schemas/inputs';
import { parseInput } from '../schemas/parse';
import { selectUpcoming } from './deadlines';
import { listTree } from './structure';

// REP-9: the one function that builds every report: in the app, share links, demo mode, and MCP.

/** Reports list the next few deadlines (REP-4). */
export const REPORT_DEADLINES = 3;

const pathOf = (nodes: readonly TreeNode[], id: string) => nodePath(nodes, id).join(' > ');

const oldestFirst = (a: Session, b: Session) =>
  a.studiedOn.localeCompare(b.studiedOn) || a.createdAt.localeCompare(b.createdAt);

export async function buildReport(
  repo: Repository,
  clock: Clock,
  rawQuery: ReportQuery,
): Promise<Report> {
  const query = parseInput(reportQuerySchema, rawQuery);
  const now = clock();
  const today = localDate(now);
  const period = resolvePeriod(query, today);
  const { from, to } = period;
  const asOf = periodAsOf(period, today);
  const inPeriod = (date: string) => date >= from && date <= to;

  const [nodes, facts, settings, tasks, completions, scores, deadlines, sessions] =
    await Promise.all([
      listTree(repo),
      repo.listSessionFacts(),
      repo.getSettings(),
      repo.listTasks(),
      repo.listTaskCompletions(),
      repo.listScores(),
      repo.listDeadlines(),
      // Only notes need whole sessions; everything else comes from the light facts.
      query.includeNotes ? repo.listSessions({ from, to }) : Promise.resolve([]),
    ]);

  const hidden = hiddenIds(nodes);
  const periodFacts = facts.filter((f) => inPeriod(f.studiedOn));
  const minutes = minutesByNode(nodes, periodFacts);
  const minutesOf = (id: string) => minutes.get(id) ?? 0;

  const tracks = nodes
    .filter((n) => n.depth === 1 && (!hidden.has(n.id) || minutesOf(n.id) > 0))
    .map((track) => {
      const targetMinutes =
        period.isWeek && track.weeklyTargetMinutes ? track.weeklyTargetMinutes : null;
      return {
        name: track.name,
        color: track.color,
        minutes: minutesOf(track.id),
        targetMinutes,
        targetPercent:
          targetMinutes === null ? null : Math.round((minutesOf(track.id) / targetMinutes) * 100),
        subtasks: nodes
          .filter((n) => n.parentId === track.id && minutesOf(n.id) > 0)
          .map((n) => ({ name: n.name, minutes: minutesOf(n.id) })),
      };
    });

  const topicsStudied = nodes
    .filter((n) => n.depth === 3 && minutesOf(n.id) > 0)
    .map((n) => ({ path: pathOf(nodes, n.id), minutes: minutesOf(n.id) }));

  const topicsDone = nodes
    .flatMap((n) =>
      n.depth === 3 && n.topicStatus === 'done' && n.topicDoneAt !== null
        ? [{ path: pathOf(nodes, n.id), doneOn: localDate(new Date(n.topicDoneAt)) }]
        : [],
    )
    .filter((t) => inPeriod(t.doneOn))
    .sort((a, b) => a.doneOn.localeCompare(b.doneOn));

  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const scoreByCompletion = new Map<string, Score>();
  for (const s of scores) if (s.taskCompletionId) scoreByCompletion.set(s.taskCompletionId, s);
  const tasksCompleted = completions
    .map((c) => ({ completion: c, completedOn: localDate(new Date(c.completedAt)) }))
    .filter(({ completedOn }) => inPeriod(completedOn))
    .sort((a, b) => a.completion.completedAt.localeCompare(b.completion.completedAt))
    .flatMap(({ completion, completedOn }) => {
      const task = tasksById.get(completion.taskId);
      if (!task) return [];
      const score = scoreByCompletion.get(completion.id);
      return [
        {
          title: task.title,
          path: task.nodeId === null ? null : pathOf(nodes, task.nodeId),
          completedOn,
          score: score
            ? {
                score: score.score,
                maxScore: score.maxScore,
                percent: scorePercent(score.score, score.maxScore),
              }
            : null,
        },
      ];
    });

  const reportScores = scores
    .filter((s) => inPeriod(s.takenOn))
    .sort((a, b) => a.takenOn.localeCompare(b.takenOn) || a.createdAt.localeCompare(b.createdAt))
    .map((s) => ({
      date: s.takenOn,
      path: pathOf(nodes, s.nodeId),
      kind: s.kind,
      title: s.title,
      score: s.score,
      maxScore: s.maxScore,
      percent: scorePercent(s.score, s.maxScore),
    }));

  // Neglect and the streak are judged at the end of the period (SPEC §B9.10).
  const factsSoFar = facts.filter((f) => f.studiedOn <= asOf);
  const neglected = neglectWarnings(
    nodes,
    latestDateByNode(nodes, factsSoFar),
    asOf,
    settings.neglectDays,
  ).map((w) => ({ path: pathOf(nodes, w.nodeId), days: w.days, neverLogged: w.neverLogged }));
  const activeDates = new Set(dailyTotals(factsSoFar).keys());

  return {
    studentName: settings.studentName,
    period,
    generatedAt: now.toISOString(),
    includesNotes: query.includeNotes,
    totals: {
      minutes: periodFacts.reduce((sum, f) => sum + f.minutes, 0),
      sessions: periodFacts.length,
      activeDays: new Set(periodFacts.map((f) => f.studiedOn)).size,
      days: from > asOf ? 0 : daysBetween(from, asOf) + 1,
      streak: currentStreak(activeDates, asOf),
    },
    tracks,
    topicsStudied,
    topicsDone,
    tasksCompleted,
    scores: reportScores,
    neglected,
    deadlines: selectUpcoming(nodes, deadlines, today)
      .slice(0, REPORT_DEADLINES)
      .map((d) => ({
        title: d.title,
        path: pathOf(nodes, d.nodeId),
        dueOn: d.dueOn,
        daysLeft: d.daysLeft,
        syllabusLeftPercent: d.syllabusLeftPercent,
      })),
    notes: sessions
      .filter((s): s is Session & { note: string } => s.note !== null && s.note.trim() !== '')
      .sort(oldestFirst)
      .map((s) => ({
        date: s.studiedOn,
        path: pathOf(nodes, s.nodeId),
        minutes: s.minutes,
        note: s.note,
      })),
  };
}

import { describe, expect, it } from 'vitest';

import { addDays, localDate } from '../logic/dates';
import { InMemoryRepository } from '../repo/InMemoryRepository';
import { getDashboard } from '../services/dashboard';
import { listTaskItems } from '../services/tasks';
import { DEMO_STUDENT_NAME, loadSampleData } from './sampleData';
import { seededRandom } from './random';

const NOW = new Date('2026-10-08T07:00:00Z'); // a Thursday in Karachi
const clock = () => NOW;

async function loaded() {
  let count = 0;
  const newId = () => `00000000-0000-4000-8000-${String(++count).padStart(12, '0')}`;
  const repo = new InMemoryRepository(clock);
  await loadSampleData(repo, clock, newId);
  return repo;
}

describe('seededRandom', () => {
  it('repeats the same numbers for the same seed', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const first = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(first);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it('keeps int() within its bounds', () => {
    const random = seededRandom(1);
    const values = Array.from({ length: 200 }, () => random.int(2, 4));
    expect(new Set(values)).toEqual(new Set([2, 3, 4]));
  });
});

describe('loadSampleData (DEMO-3)', () => {
  it('is the same on every load', async () => {
    const [a, b] = await Promise.all([loaded(), loaded()]);
    expect(await b.listAllSessions()).toEqual(await a.listAllSessions());
  });

  it('spans about 12 weeks of sessions up to yesterday, with today left empty', async () => {
    const repo = await loaded();
    const today = localDate(NOW);
    const dates = (await repo.listAllSessions()).map((s) => s.studiedOn).sort();
    const first = dates[0] ?? '';
    expect(first >= addDays(today, -84)).toBe(true);
    expect(first <= addDays(today, -77)).toBe(true);
    expect(dates.at(-1)).toBe(addDays(today, -1));
    expect(dates.length).toBeGreaterThan(100);
  });

  it('has topics in every status, all tracks, and the demo student', async () => {
    const repo = await loaded();
    const nodes = await repo.listNodes();
    const statuses = new Set(nodes.map((n) => n.topicStatus).filter(Boolean));
    expect(statuses).toEqual(new Set(['not_started', 'in_progress', 'done']));
    expect(nodes.filter((n) => n.depth === 1).map((n) => n.name)).toEqual([
      'Exam Prep',
      'School Subjects',
      'Online Course',
    ]);
    expect((await repo.getSettings()).studentName).toBe(DEMO_STUDENT_NAME);
  });

  it('never logs on a topic that is still "not started"', async () => {
    const repo = await loaded();
    const notStarted = new Set(
      (await repo.listNodes()).filter((n) => n.topicStatus === 'not_started').map((n) => n.id),
    );
    expect((await repo.listAllSessions()).some((s) => notStarted.has(s.nodeId))).toBe(false);
  });

  it('shows a streak, 3 deadlines, and only Science as neglected on Home', async () => {
    const repo = await loaded();
    const dashboard = await getDashboard(repo, clock);
    const names = new Map((await repo.listNodes()).map((n) => [n.id, n.name]));

    expect(dashboard.todayMinutes).toBe(0);
    expect(dashboard.streak.current).toBeGreaterThanOrEqual(9);
    expect(dashboard.deadlines).toHaveLength(3);
    expect(dashboard.neglect.map((w) => names.get(w.nodeId))).toEqual(['Science']);
    expect(dashboard.backupDue).toBe(false);
  });

  it('has nested, weekly, overdue, and "Other" tasks, with this week’s self-test still open', async () => {
    const repo = await loaded();
    const items = await listTaskItems(repo, clock);
    const byTitle = new Map(items.map((item) => [item.task.title, item]));

    const selfTest = byTitle.get('Weekly self-test');
    expect(selfTest?.completion).toBeNull();
    expect(selfTest?.completedWeeks.length).toBe(9);
    expect(byTitle.get('Review the whole flashcard deck')?.completion).not.toBeNull();
    expect(byTitle.get('Finish the Maths revision pack')?.subtasks).toEqual({ done: 1, total: 3 });
    expect(byTitle.get('Hand in the essay draft')?.overdue).toBe(true);
    expect(byTitle.get('Tidy the study desk')?.task.nodeId).toBeNull();
  });

  it('has past paper, quiz, revision, and mock scores', async () => {
    const repo = await loaded();
    const kinds = new Set((await repo.listScores()).map((s) => s.kind));
    expect(kinds).toEqual(new Set(['past_paper', 'quiz', 'revision', 'mock_test']));
  });
});

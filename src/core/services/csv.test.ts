import { beforeEach, describe, expect, it } from 'vitest';

import type { TreeNode } from '../domain/types.js';
import { InMemoryRepository } from '../repo/InMemoryRepository.js';
import { mistakesCsv, scoresCsv, tasksCsv } from './exports.js';
import { addMistake, reviewMistake } from './mistakes.js';
import { addScore } from './scores.js';
import { seedIfEmpty } from './seed.js';
import { getHistory, logSession } from './sessions.js';
import { completeTask, createTask } from './tasks.js';

// DATA-2: scores, tasks, and mistakes as CSV. DATA-1: searching every note in History.

const clock = () => new Date('2026-11-25T10:00:00Z');
let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
let repo: InMemoryRepository;
let maths: TreeNode;

beforeEach(async () => {
  repo = new InMemoryRepository(clock);
  await seedIfEmpty(repo, newId);
  const node = (await repo.listNodes()).find((x) => x.name === 'Maths');
  if (!node) throw new Error('seed has no Maths');
  maths = node;
});

const lines = (csv: string) => csv.slice(1).trimEnd().split('\r\n');

describe('CSV downloads (DATA-2)', () => {
  it('writes scores with their path, percent, and whether a task made them', async () => {
    await addScore(repo, clock, newId, {
      nodeId: maths.id,
      kind: 'quiz',
      title: '+Quiz 1',
      takenOn: '2026-11-20',
      score: 7,
      maxScore: 8,
    });
    const csv = scoresCsv(await repo.listNodes(), await repo.listScores());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines(csv)).toEqual([
      'date,track,subtask,topic,kind,title,score,max_score,percent,note,from_task',
      // A title that looks like a formula is neutralised.
      "2026-11-20,School Subjects,Maths,,quiz,'+Quiz 1,7,8,87.5,,no",
    ]);
  });

  it('writes tasks with their path, due date, and done state (this week for weekly ones)', async () => {
    const parent = await createTask(repo, newId, {
      nodeId: maths.id,
      title: 'Plan',
      dueOn: '2026-11-30',
    });
    const child = await createTask(repo, newId, {
      nodeId: null,
      parentTaskId: parent.id,
      title: 'Buy, a notebook',
    });
    await completeTask(repo, clock, newId, child.id, { completedOn: '2026-11-24' });
    const csv = tasksCsv(
      await repo.listNodes(),
      await repo.listTasks(),
      await repo.listTaskCompletions(),
      '2026-11-25',
    );
    const rows = lines(csv);
    expect(rows[0]).toBe(
      'title,track,subtask,topic,parent_task,repeats,due_on,done,last_completed_on,scored,archived,description',
    );
    expect(rows).toContain('Plan,School Subjects,Maths,,,none,2026-11-30,no,,no,no,');
    expect(rows).toContain('"Buy, a notebook",Other,,,Plan,none,,yes,2026-11-24,no,no,');
    expect(rows).toContain('Weekly self-test,Exam Prep,,,,weekly,,no,,yes,no,');
  });

  it('writes mistakes with their schedule', async () => {
    const mistake = await addMistake(repo, clock, newId, {
      nodeId: maths.id,
      text: 'sign error',
      createdOn: '2026-11-23',
    });
    await reviewMistake(repo, clock, mistake.id, { result: 'right' });
    expect(lines(mistakesCsv(await repo.listNodes(), await repo.listMistakes()))).toEqual([
      'created_on,track,subtask,topic,text,status,step,next_review,reviews,last_result,learned_on,source',
      '2026-11-23,School Subjects,Maths,,sign error,open,2,2026-11-26,1,right,,app',
    ]);
  });
});

describe('searching notes (DATA-1)', () => {
  it('finds matching notes in all history, case-insensitively, jumping over empty months', async () => {
    for (const [studiedOn, note] of [
      ['2026-11-24', 'Day 3: reading'],
      ['2026-11-23', 'nothing here'],
      ['2026-06-01', 'day 3 again'],
    ] as const) {
      await logSession(repo, clock, newId, { nodeId: maths.id, studiedOn, minutes: 30, note });
    }
    const first = await getHistory(repo, clock, { noteContains: 'DAY 3' });
    expect(first.days.map((d) => d.date)).toEqual(['2026-11-24']);
    expect(first.nextTo).toBe('2026-06-01');
    const older = await getHistory(repo, clock, { noteContains: 'DAY 3', to: first.nextTo ?? '' });
    expect(older.days.map((d) => d.sessions[0]?.note)).toEqual(['day 3 again']);
  });
});

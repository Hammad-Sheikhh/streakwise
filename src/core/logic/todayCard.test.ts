import { describe, expect, it } from 'vitest';

import type { Task, TaskItem, TreeNode } from '../domain/types.js';
import { daysLeftInWeek, minutesTodayByModule, neededPerDay, todaysTask } from './todayCard.js';

// SPEC §B9.14, §B9.15. 2026-11-25 is a Wednesday; the week runs Mon 23 to Sun 29 Nov.

describe('needed per day (TODAY-3, §B9.14)', () => {
  it('counts the days left including today and Sunday', () => {
    expect(daysLeftInWeek('2026-11-23')).toBe(7);
    expect(daysLeftInWeek('2026-11-25')).toBe(5);
    expect(daysLeftInWeek('2026-11-29')).toBe(1);
  });

  it('spreads what is left over those days, rounded up, and is 0 once met', () => {
    expect(neededPerDay(600, 100, '2026-11-25')).toBe(100);
    expect(neededPerDay(600, 101, '2026-11-25')).toBe(100); // 499 / 5 = 99.8
    expect(neededPerDay(600, 650, '2026-11-25')).toBe(0);
    expect(neededPerDay(120, 0, '2026-11-29')).toBe(120);
  });
});

function item(id: string, fields: Partial<Task> = {}, done = false): TaskItem {
  const task: Task = {
    id,
    nodeId: null,
    parentTaskId: null,
    title: id,
    description: null,
    dueOn: null,
    recurrence: 'none',
    isScored: false,
    defaultMaxScore: null,
    sortOrder: 0,
    archivedAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...fields,
  };
  const completion = done
    ? {
        id: `c-${id}`,
        taskId: id,
        periodStart: null,
        completedAt: '2026-11-24T10:00:00.000Z',
        completedOn: '2026-11-24',
        note: null,
      }
    : null;
  return {
    task,
    completion,
    dueThisWeek: false,
    overdue: false,
    subtasks: null,
    completedWeeks: [],
  };
}

describe("today's task (TODAY-1, §B9.15)", () => {
  const today = '2026-11-25';

  it('picks a task due today, preferring top-level ones, then sort order', () => {
    const items = [
      item('child', { dueOn: today, parentTaskId: 'parent' }),
      item('second', { dueOn: today, sortOrder: 2 }),
      item('first', { dueOn: today, sortOrder: 1 }),
      item('overdue', { dueOn: '2026-11-20' }),
    ];
    expect(todaysTask(items, today)?.task.id).toBe('first');
  });

  it('falls back to the oldest overdue one, skipping done, weekly, and undated tasks', () => {
    const items = [
      item('done', { dueOn: '2026-11-10' }, true),
      item('weekly', { recurrence: 'weekly' }),
      item('undated'),
      item('newer', { dueOn: '2026-11-22' }),
      item('older', { dueOn: '2026-11-18' }),
      item('later', { dueOn: '2026-11-30' }),
    ];
    expect(todaysTask(items, today)?.task.id).toBe('older');
  });

  it('is null when nothing is due today or overdue', () => {
    expect(todaysTask([item('later', { dueOn: '2026-11-30' })], today)).toBeNull();
  });
});

describe("today's minutes (TODAY-2)", () => {
  const node = (id: string, parentId: string | null, depth: 1 | 2 | 3) =>
    ({ id, parentId, depth }) as TreeNode;
  const nodes = [
    node('track', null, 1),
    node('sub', 'track', 2),
    node('topic', 'sub', 3),
    node('other', 'track', 2),
  ];

  it('rolls topics into their subtask and keeps track time on the track, in tree order', () => {
    const facts = [
      { nodeId: 'topic', studiedOn: '2026-11-25', minutes: 20 },
      { nodeId: 'sub', studiedOn: '2026-11-25', minutes: 10 },
      { nodeId: 'other', studiedOn: '2026-11-25', minutes: 5 },
      { nodeId: 'track', studiedOn: '2026-11-25', minutes: 15 },
      { nodeId: 'sub', studiedOn: '2026-11-24', minutes: 99 },
    ];
    expect(minutesTodayByModule(nodes, facts, '2026-11-25')).toEqual([
      { nodeId: 'track', minutes: 15 },
      { nodeId: 'sub', minutes: 30 },
      { nodeId: 'other', minutes: 5 },
    ]);
  });
});

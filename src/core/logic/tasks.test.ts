import { describe, expect, it } from 'vitest';

import type { Task, TaskCompletion } from '../domain/types';
import { currentCompletion, hiddenTaskIds, subtaskProgress, tasksDueThisWeek } from './tasks';

// 2026-10-07 is a Wednesday; its week runs Mon 2026-10-05 to Sun 2026-10-11.
const today = '2026-10-07';

function task(id: string, fields: Partial<Task> = {}): Task {
  return {
    id,
    nodeId: 'node',
    parentTaskId: null,
    title: id,
    description: null,
    dueOn: null,
    recurrence: 'none',
    isScored: false,
    defaultMaxScore: null,
    sortOrder: 0,
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...fields,
  };
}

function done(taskId: string, periodStart: string | null = null): TaskCompletion {
  return { id: `c-${taskId}`, taskId, periodStart, completedAt: '', note: null };
}

const archivedAt = '2026-10-02T00:00:00.000Z';

describe('currentCompletion (TASK-5)', () => {
  it('counts a weekly completion only for its own week', () => {
    const weekly = task('w', { recurrence: 'weekly' });
    expect(currentCompletion(weekly, [done('w', '2026-09-28')], today)).toBeUndefined();
    expect(currentCompletion(weekly, [done('w', '2026-10-05')], today)).toBeDefined();
  });

  it('counts a one-off completion forever', () => {
    expect(currentCompletion(task('a'), [done('a')], '2027-01-01')).toBeDefined();
  });
});

describe('tasksDueThisWeek (TASK-7)', () => {
  it('includes open weekly tasks and one-off tasks due by Sunday, overdue first', () => {
    const tasks = [
      task('weekly', { recurrence: 'weekly' }),
      task('sunday', { dueOn: '2026-10-11' }),
      task('nextMonday', { dueOn: '2026-10-12' }),
      task('overdue', { dueOn: '2026-10-01' }),
      task('noDate'),
      task('doneAlready', { dueOn: '2026-10-08' }),
      task('weeklyDone', { recurrence: 'weekly' }),
    ];
    const completions = [done('doneAlready'), done('weeklyDone', '2026-10-05')];
    const due = tasksDueThisWeek(tasks, completions, today);
    expect(due.map((d) => [d.task.id, d.overdue])).toEqual([
      ['overdue', true],
      ['sunday', false],
      ['weekly', false],
    ]);
  });

  it('treats Monday as the start of a new week for weekly tasks', () => {
    const weekly = task('w', { recurrence: 'weekly' });
    const lastWeek = [done('w', '2026-09-28')];
    expect(tasksDueThisWeek([weekly], lastWeek, '2026-10-04')).toHaveLength(0); // Sunday
    expect(tasksDueThisWeek([weekly], lastWeek, '2026-10-05')).toHaveLength(1); // Monday
  });

  it('leaves out archived tasks and their sub-tasks', () => {
    const tasks = [
      task('parent', { archivedAt, recurrence: 'weekly' }),
      task('child', { parentTaskId: 'parent', recurrence: 'weekly' }),
    ];
    expect(tasksDueThisWeek(tasks, [], today)).toEqual([]);
  });
});

describe('hiddenTaskIds', () => {
  it('hides descendants at any depth', () => {
    const tasks = [
      task('a', { archivedAt }),
      task('b', { parentTaskId: 'a' }),
      task('c', { parentTaskId: 'b' }),
      task('d'),
    ];
    expect([...hiddenTaskIds(tasks)].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('subtaskProgress (TASK-9)', () => {
  it('counts direct visible children, weekly ones only if done this week', () => {
    const tasks = [
      task('p'),
      task('one', { parentTaskId: 'p' }),
      task('two', { parentTaskId: 'p', recurrence: 'weekly' }),
      task('three', { parentTaskId: 'p', recurrence: 'weekly' }),
      task('archived', { parentTaskId: 'p', archivedAt }),
      task('grandchild', { parentTaskId: 'one' }),
    ];
    const completions = [done('one'), done('two', '2026-10-05'), done('three', '2026-09-28')];
    expect(subtaskProgress('p', tasks, completions, today)).toEqual({ done: 2, total: 3 });
  });
});

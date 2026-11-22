import { beforeEach, describe, expect, it } from 'vitest';

import type { TreeNode } from '../../src/core/domain/types.js';
import { completeTask, createTask } from '../../src/core/services/tasks.js';
import { addScore } from '../../src/core/services/scores.js';
import { seedIfEmpty } from '../../src/core/services/seed.js';
import { logSession } from '../../src/core/services/sessions.js';
import { addNode, updateNode } from '../../src/core/services/structure.js';
import { listRecentChanges } from '../../src/core/services/changes.js';
import { hashMcpToken } from '../functions/_lib/mcpToken.js';
import { createMcpFunction } from '../functions/mcp.js';
import { testDeps } from './fakes.js';

// v1.1 Claude tools and options (MCP-10–24), through the real HTTP handler and SDK.
// The test clock starts on Saturday 3 Oct 2026, 15:00 in Karachi.

const SECRET = 'test-mcp-token-0123456789abcdefghijklmnopqr';
let setup: ReturnType<typeof testDeps>;
let handler: ReturnType<typeof createMcpFunction>;
let rpcId = 0;

async function rpc(method: string, params: unknown = {}) {
  const request = new Request(`http://localhost/mcp/${SECRET}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  const response = await handler(request, { ip: '203.0.113.7', params: { secret: SECRET } });
  expect(response.status).toBe(200);
  const text = await response.text();
  const data = text.startsWith('{')
    ? text
    : text
        .split('\n')
        .find((line) => line.startsWith('data: '))
        ?.slice(6);
  return JSON.parse(data ?? 'null') as Record<string, unknown>;
}

async function call(name: string, args: Record<string, unknown> = {}) {
  const reply = await rpc('tools/call', { name, arguments: args });
  const result = reply.result as { isError?: boolean; content: { text: string }[] };
  const text = result.content[0]?.text ?? '';
  return {
    isError: result.isError ?? false,
    text,
    data: JSON.parse(text.startsWith('{') ? text : 'null'),
  };
}

async function byName(name: string): Promise<TreeNode> {
  const node = (await setup.repo.listNodes()).find((n) => n.name === name);
  if (!node) throw new Error(`no node ${name}`);
  return node;
}

beforeEach(async () => {
  setup = testDeps();
  await setup.accounts.setMcpTokenHash(setup.user.id, hashMcpToken(SECRET));
  handler = createMcpFunction(() => setup.deps);
  await seedIfEmpty(setup.repo, setup.deps.newId);
});

async function instructions(): Promise<string> {
  const reply = await rpc('initialize', {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' },
  });
  const result = reply.result as { instructions: string; serverInfo: { version: string } };
  expect(result.serverInfo.version).toBe('1.1.0');
  return result.instructions;
}

describe('instructions and version (MCP-22, MCP-23)', () => {
  it('explains compact mode, editing, mistakes, and the study day in under 3,500 characters', async () => {
    const text = await instructions();
    expect(text.length).toBeLessThan(3500);
    for (const phrase of ['compact: true', 'Recent changes', 'add_mistake', 'midnight']) {
      expect(text).toContain(phrase);
    }
  });

  it('states the current "My day ends at" setting', async () => {
    await setup.repo.updateSettings({ dayEndsAtMinutes: 240 });
    expect(await instructions()).toContain('ends at 04:00');
  });
});

describe('the study day (MCP-22, DAY-4)', () => {
  it('logs 01:50 for the day before when the day ends at 04:00', async () => {
    await setup.repo.updateSettings({ dayEndsAtMinutes: 240 });
    setup.advance((10 * 60 + 50) * 60_000); // 01:50 on Sunday 4 Oct in Karachi
    const logged = await call('log_session', { node: 'maths', minutes: 30 });
    expect(logged.data.session.date).toBe('2026-10-03');
    const future = await call('log_session', { node: 'maths', minutes: 30, date: '2026-10-04' });
    expect(future.data.error.code).toBe('future_date');
    expect((await call('list_tasks')).data.today).toBe('2026-10-03');
    const progress = await call('get_progress');
    expect(progress.data).toMatchObject({ today: '2026-10-03', streak: { current: 1 } });
  });
});

describe('compatibility (MCP-10)', () => {
  it('keeps the v1.0 item shapes when the new options are left out', async () => {
    const maths = await byName('Maths');
    await logSession(setup.repo, setup.deps.clock, setup.deps.newId, {
      nodeId: maths.id,
      studiedOn: '2026-10-03',
      minutes: 30,
      note: 'Day 1',
    });
    const sessions = await call('list_sessions');
    expect(Object.keys(sessions.data.sessions[0])).toEqual([
      'id',
      'date',
      'minutes',
      'nodeId',
      'path',
      'note',
      'source',
    ]);
    const tasks = await call('list_tasks', { status: 'all' });
    expect(Object.keys(tasks.data.tasks[0])).toEqual([
      'id',
      'title',
      'description',
      'nodeId',
      'path',
      'parentTaskId',
      'weekly',
      'dueOn',
      'scored',
      'defaultMaxScore',
      'done',
      'dueThisWeek',
      'overdue',
      'completedWeeks',
    ]);
  });
});

/** MCP-14: 70 tasks like a 30-day exam plan: dated days, each with sub-tasks, some scored. */
async function examPlan(): Promise<void> {
  const practice = await byName('Practice');
  const description = (i: number) =>
    `Read the task card, then work through part ${i} with a timer. `
      .repeat(8)
      .slice(0, 200 + ((i * 37) % 201));
  const { repo, deps } = setup;
  for (let day = 1; day <= 30; day += 1) {
    const parent = await createTask(repo, deps.newId, {
      nodeId: practice.id,
      title: `Day ${day}: reading and listening`,
      description: description(day),
      dueOn: `2026-10-${String(day).padStart(2, '0')}`,
    });
    const children = day <= 10 ? 2 : 1;
    for (let k = 1; k <= children; k += 1) {
      await createTask(repo, deps.newId, {
        nodeId: practice.id,
        parentTaskId: parent.id,
        title: `Part ${k} of day ${day}`,
        description: description(day * 10 + k),
        isScored: k === 1,
        defaultMaxScore: k === 1 ? 20 : null,
      });
    }
  }
}

describe('list_tasks options (MCP-13, MCP-14)', () => {
  it('returns under 25% of the characters in compact mode for a 70-task plan', async () => {
    await examPlan();
    expect(await setup.repo.listTasks()).toHaveLength(71); // the seed's weekly task too
    const full = await call('list_tasks', { status: 'all', limit: 100 });
    const compact = await call('list_tasks', { status: 'all', limit: 100, compact: true });
    expect(compact.data.tasks).toHaveLength(71);
    expect(compact.text.length / full.text.length).toBeLessThan(0.25);
  });

  it('shows only what carries information, never the description', async () => {
    await examPlan();
    const { data } = await call('list_tasks', { title_contains: 'day 3:', compact: true });
    expect(data.tasks).toEqual([
      {
        id: expect.any(String),
        title: 'Day 3: reading and listening',
        path: 'Exam Prep > Practice',
        dueOn: '2026-10-03',
        subtasks: { done: 0, total: 2 },
      },
    ]);
    const parts = await call('list_tasks', { title_contains: 'of day 3', compact: true });
    // Same path as the parent, which isn't in this list, so the path stays.
    expect(parts.data.tasks[0]).toMatchObject({ path: 'Exam Prep > Practice', scored: true });
    const both = await call('list_tasks', { title_contains: 'day 3', compact: true });
    const child = both.data.tasks.find((t: { parentTaskId?: string }) => t.parentTaskId);
    expect(child.path).toBeUndefined();
  });

  it('filters one-off tasks by due date, and by title', async () => {
    await examPlan();
    const { data } = await call('list_tasks', {
      due_from: '2026-10-02',
      due_to: '2026-10-04',
      compact: true,
    });
    expect(data.tasks.map((t: { title: string }) => t.title)).toEqual([
      'Day 2: reading and listening',
      'Day 3: reading and listening',
      'Day 4: reading and listening',
    ]);
    const overdue = await call('list_tasks', { due_to: 'yesterday', status: 'open' });
    expect(overdue.data.tasks).toHaveLength(2);
    expect(overdue.data.tasks[0]).toMatchObject({ overdue: true });
  });
});

describe('get_task (MCP-15)', () => {
  it('returns a task in full with its completion and nested sub-tasks', async () => {
    await examPlan();
    const day = (await setup.repo.listTasks()).find((t) => t.title.startsWith('Day 2:'));
    const part = (await setup.repo.listTasks()).find((t) => t.title === 'Part 1 of day 2');
    if (!day || !part) throw new Error('no plan');
    await createTask(setup.repo, setup.deps.newId, {
      nodeId: part.nodeId,
      parentTaskId: part.id,
      title: 'Deeper',
    });
    await completeTask(setup.repo, setup.deps.clock, setup.deps.newId, part.id, {
      score: 15,
      kind: 'mock_test',
      completedOn: '2026-10-02',
    });
    const { data } = await call('get_task', { task_id: day.id });
    expect(data.task).toMatchObject({
      title: 'Day 2: reading and listening',
      description: expect.stringContaining('task card'),
      subtaskProgress: { done: 1, total: 2 },
    });
    expect(data.task.subtasks).toHaveLength(2);
    expect(data.task.subtasks[0]).toMatchObject({
      title: 'Part 1 of day 2',
      done: true,
      completion: { date: '2026-10-02', score: { score: 15, maxScore: 20, percent: 75 } },
      subtasks: [expect.objectContaining({ title: 'Deeper', subtasks: [] })],
    });
    expect(
      (await call('get_task', { task_id: '00000000-0000-4000-8000-00000000dead' })).data,
    ).toMatchObject({ error: { code: 'task_not_found' } });
  });
});

describe('sessions (MCP-16, MCP-17, MCP-18, MCP-20)', () => {
  const log = async (date: string, note: string | null, minutes = 30) => {
    const maths = await byName('Maths');
    return logSession(setup.repo, setup.deps.clock, setup.deps.newId, {
      nodeId: maths.id,
      studiedOn: date,
      minutes,
      note,
    });
  };

  it('filters by note text and returns compact sessions with their ids', async () => {
    const long = `Day 4: ${'x'.repeat(100)}`;
    await log('2026-10-01', 'Day 3: Lesen');
    const kept = await log('2026-10-02', long);
    await log('2026-10-02', null);
    const { data } = await call('list_sessions', { note_contains: 'DAY', compact: true });
    expect(data.sessions).toEqual([
      {
        id: kept.id,
        date: '2026-10-02',
        minutes: 30,
        path: 'School Subjects > Maths',
        note: `${long.slice(0, 80)}…`,
      },
      expect.objectContaining({ note: 'Day 3: Lesen' }),
    ]);
    const all = await call('list_sessions', { compact: true });
    expect(all.data.sessions.find((s: { note?: string }) => s.note === undefined)).toBeDefined();
  });

  it('finds the newest note starting with a prefix', async () => {
    await log('2026-10-01', 'Day 3: Lesen');
    const newest = await log('2026-10-02', 'day 4: Hören');
    await log('2026-10-03', 'Review day');
    const { data } = await call('get_latest_note', { prefix: 'Day' });
    expect(data.session).toEqual({
      id: newest.id,
      date: '2026-10-02',
      minutes: 30,
      path: 'School Subjects > Maths',
      note: 'day 4: Hören',
    });
    expect((await call('get_latest_note', { prefix: 'Day', node: 'english' })).data).toEqual({
      session: null,
    });
  });

  it('edits a session of any date, clears its note, and refuses a future date', async () => {
    const old = await log('2025-01-15', 'old note');
    const { data } = await call('update_session', {
      session_id: old.id,
      minutes: 50,
      note: null,
      node: 'english',
    });
    expect(data.session).toMatchObject({
      date: '2025-01-15',
      minutes: 50,
      note: null,
      path: 'School Subjects > English',
    });
    const future = await call('update_session', { session_id: old.id, date: '2026-10-04' });
    expect(future.data.error.code).toBe('future_date');
  });

  it('logs a batch all or nothing, naming the failing item', async () => {
    const ok = await call('log_sessions', {
      sessions: [
        { node: 'maths', minutes: 30, note: 'Day 5' },
        { node: 'english', minutes: 45, date: 'yesterday' },
      ],
    });
    expect(ok.data.sessions).toEqual([
      expect.objectContaining({ minutes: 30, source: 'claude', date: '2026-10-03' }),
      expect.objectContaining({ minutes: 45, date: '2026-10-02' }),
    ]);
    const bad = await call('log_sessions', {
      sessions: [
        { node: 'maths', minutes: 30 },
        { node: 'maths', minutes: 30 },
        { node: 'nowhere', minutes: 30 },
      ],
    });
    expect(bad.isError).toBe(true);
    expect(bad.data.error).toMatchObject({ code: 'node_not_found', index: 2 });
    expect(bad.data.error.message).toMatch(/^Session 3 \(index 2\):/);
    const future = await call('log_sessions', {
      sessions: [{ node: 'maths', minutes: 30, date: '2026-10-09' }],
    });
    expect(future.data.error).toMatchObject({ code: 'future_date', index: 0 });
    expect(await setup.repo.listSessions({})).toHaveLength(2);
  });
});

describe('tasks (MCP-18, MCP-19)', () => {
  it('completes a weekly task for an earlier week and unticks it with its score', async () => {
    const weekly = (await setup.repo.listTasks()).find((t) => t.title === 'Weekly self-test');
    if (!weekly) throw new Error('no weekly task');
    const done = await call('complete_task', { task_id: weekly.id, score: 14, date: '2026-09-24' });
    expect(done.data.task).toMatchObject({ done: false, completedWeeks: ['2026-09-21'] });
    expect(done.data.score).toMatchObject({ date: '2026-09-24', score: 14 });
    const future = await call('complete_task', {
      task_id: weekly.id,
      score: 1,
      date: '2026-10-05',
    });
    expect(future.data.error.code).toBe('future_date');

    const undone = await call('uncomplete_task', { task_id: weekly.id, date: '2026-09-22' });
    expect(undone.data.removed).toMatchObject({ date: '2026-09-24', score: { score: 14 } });
    expect(await setup.repo.listScores()).toEqual([]);
    const again = await call('uncomplete_task', { task_id: weekly.id });
    expect(again.data.error.code).toBe('not_completed');
  });

  it('edits a task, clearing its description and due date', async () => {
    const task = await createTask(setup.repo, setup.deps.newId, {
      nodeId: (await byName('Maths')).id,
      title: 'Read',
      description: 'pages 1-20',
      dueOn: '2026-10-05',
    });
    const { data } = await call('update_task', {
      task_id: task.id,
      title: 'Read chapter 1',
      description: null,
      due_date: null,
      scored: true,
      default_max_score: 10,
    });
    expect(data.task).toMatchObject({
      title: 'Read chapter 1',
      description: null,
      dueOn: null,
      scored: true,
      defaultMaxScore: 10,
    });
    const weeklyWithDate = await call('update_task', { task_id: task.id, weekly: true });
    expect(weeklyWithDate.data.task).toMatchObject({ weekly: true, dueOn: null });
  });

  it('refuses to delete a task with sub-tasks unless asked to', async () => {
    const parent = await createTask(setup.repo, setup.deps.newId, { nodeId: null, title: 'P' });
    const child = await createTask(setup.repo, setup.deps.newId, {
      nodeId: null,
      parentTaskId: parent.id,
      title: 'C',
    });
    await createTask(setup.repo, setup.deps.newId, {
      nodeId: null,
      parentTaskId: child.id,
      title: 'G',
    });
    const refused = await call('delete_task', { task_id: parent.id });
    expect(refused.data.error).toMatchObject({ code: 'has_subtasks', subtaskCount: 2 });
    const deleted = await call('delete_task', { task_id: parent.id, include_subtasks: true });
    expect(deleted.data).toMatchObject({
      deleted: { id: parent.id, title: 'P' },
      subtasksDeleted: 2,
    });
    expect(await setup.repo.listTasks()).toHaveLength(1); // the seed's weekly task
  });
});

describe('scores (MCP-18)', () => {
  it('lists, edits, and deletes scores', async () => {
    const maths = await byName('Maths');
    const { repo, deps } = setup;
    await addScore(repo, deps.clock, deps.newId, {
      nodeId: maths.id,
      kind: 'mock_test',
      title: 'Mock 1',
      takenOn: '2026-09-20',
      score: 12,
      maxScore: 20,
    });
    const mock2 = await addScore(repo, deps.clock, deps.newId, {
      nodeId: maths.id,
      kind: 'mock_test',
      title: 'Mock 2',
      takenOn: '2026-09-27',
      score: 15,
      maxScore: 20,
    });
    const weekly = (await repo.listTasks()).find((t) => t.isScored);
    await completeTask(repo, deps.clock, deps.newId, weekly?.id ?? '', { score: 18 });

    const listed = await call('list_scores', { kind: 'mock_test', title_contains: 'mock 2' });
    expect(listed.data.scores).toEqual([expect.objectContaining({ id: mock2.id, percent: 75 })]);
    const fromTask = await call('list_scores', { from: '2026-10-01' });
    expect(fromTask.data.scores).toEqual([expect.objectContaining({ fromTask: true, score: 18 })]);

    const edited = await call('update_score', { score_id: mock2.id, score: 16, note: 'retake' });
    expect(edited.data.score).toMatchObject({ score: 16, percent: 80, note: 'retake' });
    const tooHigh = await call('update_score', { score_id: mock2.id, score: 21 });
    expect(tooHigh.data.error.code).toBe('score_above_max');

    const deleted = await call('delete_score', { score_id: mock2.id });
    expect(deleted.data.deleted).toMatchObject({ id: mock2.id, title: 'Mock 2' });
  });
});

describe('nodes (MCP-18)', () => {
  it('renames, sets a weekly target, archives, and restores', async () => {
    const renamed = await call('update_node', { node: 'maths', name: 'Mathematics' });
    expect(renamed.data.node).toMatchObject({ name: 'Mathematics', kind: 'subtask' });
    const target = await call('update_node', { node: 'school subjects', weekly_target: 300 });
    expect(target.data.node).toMatchObject({ weeklyTargetMinutes: 300, kind: 'track' });
    const notTrack = await call('update_node', { node: 'english', weekly_target: 60 });
    expect(notTrack.data.error.code).toBe('target_tracks_only');

    const archived = await call('archive_node', { node: 'english' });
    expect(archived.data.node).toMatchObject({ name: 'English', archived: true });
    // A visible node with the same name doesn't get in the way of restoring the archived one.
    await addNode(setup.repo, setup.deps.newId, {
      parentId: (await byName('Exam Prep')).id,
      name: 'English',
    });
    const restored = await call('unarchive_node', { node: 'english' });
    expect(restored.data.node).toMatchObject({ path: 'School Subjects > English' });
    expect(restored.data.node.archived).toBeUndefined();
  });

  it('marks exam deadlines (EXAM-1)', async () => {
    const maths = await byName('Maths');
    await setup.repo.insertDeadline({
      id: setup.deps.newId(),
      nodeId: maths.id,
      title: 'Final',
      dueOn: '2026-11-02',
      isExam: true,
    });
    const { data } = await call('list_deadlines');
    expect(data.deadlines[0]).toMatchObject({ title: 'Final', isExam: true });
  });
});

describe('mistakes (MCP-21)', () => {
  it('saves a mistake, lists it when due, and reviews it', async () => {
    const added = await call('add_mistake', {
      node: 'english',
      text: 'their/there',
      date: 'yesterday',
    });
    expect(added.data.mistake).toMatchObject({
      path: 'School Subjects > English',
      date: '2026-10-02',
      status: 'open',
      step: 1,
      nextDueOn: '2026-10-03',
    });
    const due = await call('list_due_mistakes');
    expect(due.data).toMatchObject({ today: '2026-10-03', mistakes: [{ text: 'their/there' }] });
    const reviewed = await call('review_mistake', {
      mistake_id: added.data.mistake.id,
      result: 'right',
    });
    expect(reviewed.data.mistake).toMatchObject({
      step: 2,
      nextDueOn: '2026-10-05',
      lastResult: 'right',
    });
    expect((await call('list_due_mistakes')).data.mistakes).toEqual([]);
    expect((await setup.repo.listMistakes())[0]?.source).toBe('claude');
  });
});

describe('change history (MCP-24)', () => {
  it("records Claude's writes as coming from Claude", async () => {
    await call('log_session', { node: 'maths', minutes: 20 });
    await call('update_node', { node: 'maths', name: 'Algebra' });
    const changes = await listRecentChanges(setup.repo, setup.deps.clock);
    expect(changes.map((c) => [c.source, c.entity, c.action])).toEqual([
      ['claude', 'node', 'update'],
      ['claude', 'session', 'create'],
    ]);
  });

  it('can be undone in the app afterwards', async () => {
    await updateNode(setup.repo, setup.deps.clock, (await byName('Maths')).id, { archived: true });
    expect((await call('unarchive_node', { node: 'maths' })).data.node.archived).toBeUndefined();
  });
});

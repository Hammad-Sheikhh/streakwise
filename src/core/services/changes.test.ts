import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TreeNode } from '../domain/types.js';
import { InMemoryRepository } from '../repo/InMemoryRepository.js';
import { recordChanges } from '../repo/RecordingRepository.js';
import type { Repository } from '../repo/Repository.js';
import { listRecentChanges, undoChange } from './changes.js';
import { addDeadline, deleteDeadline, updateDeadline } from './deadlines.js';
import { addMistake, deleteMistake, reviewMistake, updateMistake } from './mistakes.js';
import { addScore, deleteScore, updateScore } from './scores.js';
import { seedIfEmpty } from './seed.js';
import { deleteSession, logSession, updateSession } from './sessions.js';
import { addNode, deleteNode, moveNode, setTopicStatus, updateNode } from './structure.js';
import { completeTask, createTask, deleteTask, uncompleteTaskOn, updateTask } from './tasks.js';

// UNDO-3, UNDO-5: every change is recorded once, and each kind can be undone.

let now: Date;
const clock = () => now;
let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
let store: InMemoryRepository;
let repo: Repository;
let maths: TreeNode;
let english: TreeNode;

beforeEach(async () => {
  now = new Date('2026-11-10T10:00:00Z');
  store = new InMemoryRepository(clock);
  await seedIfEmpty(store, newId);
  repo = recordChanges(store, { source: 'app', newId });
  const nodes = await store.listNodes();
  const find = (name: string) => {
    const node = nodes.find((x) => x.name === name);
    if (!node) throw new Error(`seed has no ${name}`);
    return node;
  };
  maths = find('Maths');
  english = find('English');
});

/** The newest recorded change. */
async function latest() {
  const [entry] = await listRecentChanges(repo, clock);
  if (!entry) throw new Error('nothing recorded');
  return entry;
}

const undo = async () => undoChange(repo, clock, (await latest()).id);

describe('recording (UNDO-3)', () => {
  it('records a change once, after the write, with its source and a summary', async () => {
    const session = await logSession(repo, clock, newId, {
      nodeId: maths.id,
      studiedOn: '2026-11-10',
      minutes: 45,
    });
    const changes = await listRecentChanges(repo, clock);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      source: 'app',
      entity: 'session',
      entityId: session.id,
      action: 'create',
      summary: 'Logged 45m · School Subjects > Maths',
      before: null,
      after: session,
      undoneAt: null,
    });
  });

  it('marks changes made through Claude', async () => {
    const claude = recordChanges(store, { source: 'claude', newId });
    await logSession(claude, clock, newId, {
      nodeId: maths.id,
      studiedOn: '2026-11-10',
      minutes: 5,
    });
    expect((await latest()).source).toBe('claude');
  });

  it('keeps the write when recording fails, and says so', async () => {
    const onRecordError = vi.fn();
    const failing = recordChanges(store, { source: 'app', newId, onRecordError });
    vi.spyOn(store, 'insertChange').mockRejectedValueOnce(new Error('down'));
    await logSession(failing, clock, newId, {
      nodeId: maths.id,
      studiedOn: '2026-11-10',
      minutes: 5,
    });
    expect(onRecordError).toHaveBeenCalledOnce();
    expect(await store.listSessions({})).toHaveLength(1);
    expect(await listRecentChanges(repo, clock)).toEqual([]);
  });

  it("doesn't record reordering, or edits that change nothing", async () => {
    await moveNode(repo, english.id, { direction: 'up' });
    await updateNode(repo, clock, maths.id, { name: 'Maths' });
    expect(await listRecentChanges(repo, clock)).toEqual([]);
  });

  it('lists only the last 7 days', async () => {
    await logSession(repo, clock, newId, { nodeId: maths.id, studiedOn: '2026-11-10', minutes: 5 });
    now = new Date('2026-11-17T10:00:01Z');
    expect(await listRecentChanges(repo, clock)).toEqual([]);
  });
});

describe('undo (UNDO-5)', () => {
  it('undoes logging, editing, and deleting a session', async () => {
    const session = await logSession(repo, clock, newId, {
      nodeId: maths.id,
      studiedOn: '2026-11-10',
      minutes: 30,
      note: 'Day 3',
    });
    await updateSession(repo, clock, session.id, { minutes: 60, note: null });
    expect((await latest()).summary).toBe('Edited session · 1h · School Subjects > Maths');
    await undo();
    expect(await store.getSession(session.id)).toMatchObject({ minutes: 30, note: 'Day 3' });

    await deleteSession(repo, session.id);
    await undo();
    expect(await store.getSession(session.id)).toMatchObject({
      minutes: 30,
      createdAt: session.createdAt,
    });

    // The original "Logged" entry: its edit and delete were undone, so it can be undone too.
    const created = (await listRecentChanges(repo, clock)).find((c) => c.action === 'create');
    await undoChange(repo, clock, created?.id ?? '');
    expect(await store.getSession(session.id)).toBeNull();
  });

  it('refuses while a later change to the same item stands, and only once', async () => {
    const session = await logSession(repo, clock, newId, {
      nodeId: maths.id,
      studiedOn: '2026-11-10',
      minutes: 30,
    });
    const [created] = await listRecentChanges(repo, clock);
    await updateSession(repo, clock, session.id, { minutes: 40 });
    await expect(undoChange(repo, clock, created?.id ?? '')).rejects.toMatchObject({
      kind: 'conflict',
      code: 'changed_since',
    });
    const edit = await undo();
    expect(edit.undoneAt).toBe(now.toISOString());
    await expect(undoChange(repo, clock, edit.id)).rejects.toMatchObject({
      code: 'already_undone',
    });
    await undoChange(repo, clock, created?.id ?? '');
  });

  it("isn't recorded itself (no redo)", async () => {
    await logSession(repo, clock, newId, { nodeId: maths.id, studiedOn: '2026-11-10', minutes: 5 });
    await undo();
    const changes = await listRecentChanges(repo, clock);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.undoneAt).not.toBeNull();
  });

  it("refuses when the item can't be put back", async () => {
    const topic = await addNode(repo, newId, { parentId: maths.id, name: 'Chapter 9' });
    const session = await logSession(repo, clock, newId, {
      nodeId: topic.id,
      studiedOn: '2026-11-10',
      minutes: 5,
    });
    await deleteSession(repo, session.id);
    const deleted = await latest();
    await deleteNode(repo, topic.id);
    await expect(undoChange(repo, clock, deleted.id)).rejects.toMatchObject({
      code: 'cannot_undo',
    });
  });

  it('undoes a completion together with its score, and brings an untick back', async () => {
    const task = (await store.listTasks()).find((t) => t.title === 'Weekly self-test');
    if (!task) throw new Error('seed has no weekly task');
    const completion = await completeTask(repo, clock, newId, task.id, { score: 17 });
    expect((await latest()).summary).toBe('Completed · Weekly self-test · 17/20 · Tue 10 Nov 2026');
    await undo();
    expect(await store.listTaskCompletions()).toEqual([]);
    expect(await store.listScores()).toEqual([]);

    // Undone entries don't block a fresh completion and untick.
    const again = await completeTask(repo, clock, newId, task.id, { score: 18 });
    const [score] = await store.listScores();
    await uncompleteTaskOn(repo, clock, task.id);
    expect((await latest()).action).toBe('uncomplete');
    await undo();
    expect(await store.listTaskCompletions()).toEqual([
      expect.objectContaining({ id: again.id, completedOn: '2026-11-10' }),
    ]);
    expect(await store.listScores()).toEqual([
      expect.objectContaining({ id: score?.id, taskCompletionId: again.id, score: 18 }),
    ]);
    expect(completion.id).not.toBe(again.id);
  });

  it('brings back a deleted task tree with its ticks and score links', async () => {
    const parent = await createTask(repo, newId, { nodeId: maths.id, title: 'Revision pack' });
    const child = await createTask(repo, newId, {
      nodeId: maths.id,
      parentTaskId: parent.id,
      title: 'Worksheet',
      isScored: true,
      defaultMaxScore: 10,
    });
    const done = await completeTask(repo, clock, newId, child.id, { score: 7 });
    await deleteTask(repo, parent.id);
    expect((await latest()).summary).toBe('Deleted task · Revision pack and 1 sub-task');
    expect((await store.listScores())[0]?.taskCompletionId).toBeNull();
    await undo();
    expect((await store.listTasks()).map((t) => t.id)).toEqual(
      expect.arrayContaining([parent.id, child.id]),
    );
    expect((await store.listScores())[0]?.taskCompletionId).toBe(done.id);
  });

  it('undoes archiving, editing, and creating a task', async () => {
    const task = await createTask(repo, newId, { nodeId: maths.id, title: 'Read' });
    await updateTask(repo, clock, task.id, { archived: true });
    expect(await latest()).toMatchObject({ action: 'archive', summary: 'Archived task · Read' });
    await undo();
    await updateTask(repo, clock, task.id, { title: 'Read chapter 2', dueOn: '2026-11-12' });
    await undo();
    expect((await store.listTasks()).find((t) => t.id === task.id)).toMatchObject({
      title: 'Read',
      dueOn: null,
      archivedAt: null,
    });
    const created = (await listRecentChanges(repo, clock)).find((c) => c.action === 'create');
    await createTask(repo, newId, { nodeId: maths.id, parentTaskId: task.id, title: 'Sub' });
    await expect(undoChange(repo, clock, created?.id ?? '')).rejects.toMatchObject({
      code: 'cannot_undo',
    });
  });

  it('undoes node changes: create, rename, target, archive, delete, topic status', async () => {
    const topic = await addNode(repo, newId, { parentId: maths.id, name: 'Chapter 1' });
    expect((await latest()).summary).toBe('Added topic · School Subjects > Maths > Chapter 1');
    await setTopicStatus(repo, clock, topic.id, { status: 'done' });
    await undo();
    await updateNode(repo, clock, maths.id, { name: 'Mathematics' });
    expect((await latest()).summary).toBe('Renamed Maths → Mathematics');
    await undo();
    const track = maths.parentId ?? '';
    await updateNode(repo, clock, track, { weeklyTargetMinutes: 300 });
    await undo();
    await updateNode(repo, clock, maths.id, { archived: true });
    expect((await latest()).action).toBe('archive');
    await undo();
    const nodes = await store.listNodes();
    expect(nodes.find((x) => x.id === topic.id)).toMatchObject({ topicStatus: 'not_started' });
    expect(nodes.find((x) => x.id === maths.id)).toMatchObject({ name: 'Maths', archivedAt: null });
    expect(nodes.find((x) => x.id === track)?.weeklyTargetMinutes).toBeNull();

    await deleteNode(repo, topic.id);
    await undo();
    expect((await store.listNodes()).find((x) => x.id === topic.id)?.name).toBe('Chapter 1');
  });

  it('records the topic that logging started, separately from the session', async () => {
    const topic = await addNode(repo, newId, { parentId: maths.id, name: 'Chapter 2' });
    await logSession(repo, clock, newId, { nodeId: topic.id, studiedOn: '2026-11-10', minutes: 5 });
    const [status, logged] = await listRecentChanges(repo, clock);
    expect(status?.summary).toBe('School Subjects > Maths > Chapter 2 → in progress');
    expect(logged?.entity).toBe('session');
  });

  it('undoes score changes and relinks a deleted task score', async () => {
    const score = await addScore(repo, clock, newId, {
      nodeId: maths.id,
      kind: 'quiz',
      title: 'Quiz 1',
      takenOn: '2026-11-09',
      score: 8,
      maxScore: 10,
    });
    await updateScore(repo, clock, score.id, { score: 9 });
    await undo();
    expect((await store.listScores())[0]?.score).toBe(8);
    await deleteScore(repo, score.id);
    await undo();
    expect((await store.listScores())[0]).toMatchObject({
      id: score.id,
      createdAt: score.createdAt,
    });

    const task = await createTask(repo, newId, {
      nodeId: maths.id,
      title: 'Mock',
      isScored: true,
      defaultMaxScore: 20,
    });
    const done = await completeTask(repo, clock, newId, task.id, { score: 15 });
    const linked = (await store.listScores()).find((s) => s.taskCompletionId === done.id);
    await deleteScore(repo, linked?.id ?? '');
    await undo();
    expect((await store.listScores()).find((s) => s.id === linked?.id)?.taskCompletionId).toBe(
      done.id,
    );
  });

  it('undoes mistake changes, including a review', async () => {
    const mistake = await addMistake(repo, clock, newId, {
      nodeId: maths.id,
      text: 'sign error',
      createdOn: '2026-11-09',
    });
    await reviewMistake(repo, clock, mistake.id, { result: 'right' });
    expect((await latest()).summary).toBe('Reviewed mistake · right · School Subjects > Maths');
    await undo();
    expect((await store.listMistakes())[0]).toMatchObject({
      step: 1,
      reviewCount: 0,
      nextDueOn: '2026-11-10',
      lastResult: null,
    });
    await updateMistake(repo, mistake.id, { text: 'sign slip' });
    await undo();
    await deleteMistake(repo, mistake.id);
    await undo();
    expect((await store.listMistakes())[0]).toMatchObject({ id: mistake.id, text: 'sign error' });
    const created = (await listRecentChanges(repo, clock)).find((c) => c.action === 'create');
    await undoChange(repo, clock, created?.id ?? '');
    expect(await store.listMistakes()).toEqual([]);
  });

  it('undoes deadline changes', async () => {
    const deadline = await addDeadline(repo, newId, {
      nodeId: maths.id,
      title: 'Mock exam',
      dueOn: '2026-12-01',
      isExam: true,
    });
    expect((await latest()).summary).toBe('Added exam · Mock exam · Tue 1 Dec 2026');
    await updateDeadline(repo, deadline.id, { dueOn: '2026-12-02' });
    await undo();
    expect((await store.listDeadlines())[0]?.dueOn).toBe('2026-12-01');
    await deleteDeadline(repo, deadline.id);
    await undo();
    expect(await store.listDeadlines()).toEqual([deadline]);
  });
});

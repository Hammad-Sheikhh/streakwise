import { beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../domain/errors';
import type { TreeNode } from '../domain/types';
import { addDays } from '../logic/dates';
import { InMemoryRepository } from '../repo/InMemoryRepository';
import { seedIfEmpty } from './seed';
import { deleteSession, getHistory, logSession, recentNodeIds, updateSession } from './sessions';
import { addNode, updateNode } from './structure';

// 2026-10-03 23:30 in Karachi is 18:30 UTC, so "today" is still the 3rd.
let now = new Date('2026-10-03T18:30:00Z');
const clock = () => now;
const TODAY = '2026-10-03';

let repo: InMemoryRepository;
let newId: () => string;

function sequentialIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

async function byName(name: string): Promise<TreeNode> {
  const node = (await repo.listNodes()).find((n) => n.name === name);
  if (!node) throw new Error(`no node ${name}`);
  return node;
}

async function errorOf(promise: Promise<unknown>): Promise<DomainError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error('expected a DomainError');
}

const log = (nodeId: string, studiedOn: string, minutes = 30, note?: string) =>
  logSession(repo, clock, newId, { nodeId, studiedOn, minutes, note });

beforeEach(async () => {
  now = new Date('2026-10-03T18:30:00Z');
  repo = new InMemoryRepository(clock);
  newId = sequentialIds();
  await seedIfEmpty(repo, newId);
});

describe('logSession', () => {
  it('stores a session with source app and an empty note as null', async () => {
    const maths = await byName('Maths');
    const session = await log(maths.id, TODAY, 45, '   ');
    expect(session).toMatchObject({
      nodeId: maths.id,
      studiedOn: TODAY,
      minutes: 45,
      note: null,
      source: 'app',
    });
  });

  it('records the source given (MCP-7 uses claude)', async () => {
    const maths = await byName('Maths');
    const session = await logSession(
      repo,
      clock,
      newId,
      { nodeId: maths.id, studiedOn: TODAY, minutes: 10 },
      'claude',
    );
    expect(session.source).toBe('claude');
  });

  it('rejects future dates in Karachi time (LOG-3)', async () => {
    const maths = await byName('Maths');
    expect(await errorOf(log(maths.id, '2026-10-04'))).toMatchObject({ code: 'future_date' });
    // Half an hour later it is the 4th in Karachi, so the same date is fine.
    now = new Date('2026-10-03T19:30:00Z');
    await expect(log(maths.id, '2026-10-04')).resolves.toBeTruthy();
  });

  it.each([0, 1441, 12.5])('rejects %s minutes (LOG-4)', async (minutes) => {
    const maths = await byName('Maths');
    expect(await errorOf(log(maths.id, TODAY, minutes))).toMatchObject({ kind: 'validation' });
  });

  it('rejects notes over 500 characters (LOG-5)', async () => {
    const maths = await byName('Maths');
    expect(await errorOf(log(maths.id, TODAY, 30, 'x'.repeat(501)))).toMatchObject({
      kind: 'validation',
    });
  });

  it('rejects archived nodes and nodes under them', async () => {
    const exams = await byName('School Subjects');
    await updateNode(repo, clock, exams.id, { archived: true });
    const maths = await byName('Maths');
    expect(await errorOf(log(maths.id, TODAY))).toMatchObject({ code: 'node_archived' });
  });

  it('marks a not-started topic as in progress (LOG-6)', async () => {
    const maths = await byName('Maths');
    const topic = await addNode(repo, newId, { parentId: maths.id, name: 'Algebra' });
    await log(topic.id, TODAY);
    expect((await byName('Algebra')).topicStatus).toBe('in_progress');
  });

  it('leaves a done topic alone', async () => {
    const maths = await byName('Maths');
    const topic = await addNode(repo, newId, { parentId: maths.id, name: 'Algebra' });
    await repo.updateNode(topic.id, { topicStatus: 'done', topicDoneAt: now.toISOString() });
    await log(topic.id, TODAY);
    expect((await byName('Algebra')).topicStatus).toBe('done');
  });
});

describe('updateSession and deleteSession (HIST-2)', () => {
  it('changes any field', async () => {
    const maths = await byName('Maths');
    const english = await byName('English');
    const session = await log(maths.id, TODAY, 30, 'first');
    const updated = await updateSession(repo, clock, session.id, {
      nodeId: english.id,
      studiedOn: '2026-10-02',
      minutes: 50,
      note: '',
    });
    expect(updated).toMatchObject({
      nodeId: english.id,
      studiedOn: '2026-10-02',
      minutes: 50,
      note: null,
    });
  });

  it('can keep a session on a node that was archived later', async () => {
    const maths = await byName('Maths');
    const session = await log(maths.id, TODAY);
    await updateNode(repo, clock, maths.id, { archived: true });
    await expect(updateSession(repo, clock, session.id, { minutes: 20 })).resolves.toMatchObject({
      minutes: 20,
    });
  });

  it('starts a topic when a session moves onto it', async () => {
    const maths = await byName('Maths');
    const topic = await addNode(repo, newId, { parentId: maths.id, name: 'Algebra' });
    const session = await log(maths.id, TODAY);
    await updateSession(repo, clock, session.id, { nodeId: topic.id });
    expect((await byName('Algebra')).topicStatus).toBe('in_progress');
  });

  it('rejects a future date and an unknown session', async () => {
    const maths = await byName('Maths');
    const session = await log(maths.id, TODAY);
    expect(
      await errorOf(updateSession(repo, clock, session.id, { studiedOn: '2026-10-05' })),
    ).toMatchObject({ code: 'future_date' });
    expect(await errorOf(updateSession(repo, clock, newId(), { minutes: 5 }))).toMatchObject({
      kind: 'not_found',
    });
  });

  it('deletes', async () => {
    const maths = await byName('Maths');
    const session = await log(maths.id, TODAY);
    await deleteSession(repo, session.id);
    expect(await repo.getSession(session.id)).toBeNull();
    expect(await errorOf(deleteSession(repo, session.id))).toMatchObject({ kind: 'not_found' });
  });
});

describe('getHistory (HIST-1, HIST-3)', () => {
  it('groups by day, newest first, with daily totals', async () => {
    const maths = await byName('Maths');
    const english = await byName('English');
    await log(maths.id, '2026-10-01', 30);
    await log(english.id, TODAY, 20);
    await log(maths.id, TODAY, 40);

    const page = await getHistory(repo, clock);
    expect(page.days.map((d) => [d.date, d.totalMinutes, d.sessions.length])).toEqual([
      [TODAY, 60, 2],
      ['2026-10-01', 30, 1],
    ]);
    // Within a day, the most recently created comes first.
    expect(page.days[0]?.sessions[0]?.minutes).toBe(40);
    expect(page.nextTo).toBeNull();
  });

  it('loads 30 days at a time and jumps over empty stretches', async () => {
    const maths = await byName('Maths');
    await log(maths.id, addDays(TODAY, -29));
    await log(maths.id, addDays(TODAY, -30));
    await log(maths.id, addDays(TODAY, -100));

    const first = await getHistory(repo, clock);
    expect(first.days.map((d) => d.date)).toEqual([addDays(TODAY, -29)]);
    expect(first.nextTo).toBe(addDays(TODAY, -30));

    const second = await getHistory(repo, clock, { to: first.nextTo ?? undefined });
    expect(second.days.map((d) => d.date)).toEqual([addDays(TODAY, -30)]);
    expect(second.nextTo).toBe(addDays(TODAY, -100));
  });

  it('filters by node (with descendants), source, and date range', async () => {
    const exams = await byName('School Subjects');
    const maths = await byName('Maths');
    const german = await byName('Exam Prep');
    const topic = await addNode(repo, newId, { parentId: maths.id, name: 'Algebra' });
    await log(topic.id, TODAY);
    await log(german.id, TODAY);
    await logSession(
      repo,
      clock,
      newId,
      { nodeId: maths.id, studiedOn: '2026-09-20', minutes: 15 },
      'claude',
    );

    const byExams = await getHistory(repo, clock, { nodeId: exams.id });
    expect(byExams.days.flatMap((d) => d.sessions).map((s) => s.nodeId)).toEqual([
      topic.id,
      maths.id,
    ]);

    const fromClaude = await getHistory(repo, clock, { source: 'claude', to: '2026-09-30' });
    expect(fromClaude.days.map((d) => d.date)).toEqual(['2026-09-20']);

    const ranged = await getHistory(repo, clock, { from: '2026-10-01' });
    expect(ranged.days.map((d) => d.date)).toEqual([TODAY]);
    expect(ranged.nextTo).toBeNull();
  });
});

describe('recentNodeIds (LOG-7)', () => {
  it('returns up to 5 distinct visible nodes, most recent first', async () => {
    const names = ['Flashcards', 'Practice', 'Maths', 'English', 'Online Course'];
    const nodes = await Promise.all(names.map(byName));
    for (const node of nodes) await log(node.id, TODAY);
    const german = await byName('Exam Prep');
    await log(german.id, TODAY);
    await log(nodes[4]?.id ?? '', TODAY);

    expect(await recentNodeIds(repo)).toEqual([
      nodes[4]?.id,
      german.id,
      nodes[3]?.id,
      nodes[2]?.id,
      nodes[1]?.id,
    ]);

    await updateNode(repo, clock, german.id, { archived: true });
    expect(await recentNodeIds(repo)).not.toContain(german.id);
  });
});

// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Runs every migration on PGlite (Postgres compiled to WebAssembly) so SQL mistakes and broken
// rules are caught in CI, long before the owner pastes a migration into Supabase.
const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(path.join(migrationsDir, name), 'utf8'));

// Migrating once and copying the data directory for each test is much faster than migrating again.
let migratedSnapshot: Promise<File | Blob> | undefined;

/** A new database with Supabase's built-in roles and the first `count` migrations applied. */
async function migratedUpTo(count: number): Promise<PGlite> {
  const db = new PGlite();
  // Supabase's built-in roles.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
  `);
  for (const sql of migrations.slice(0, count)) await db.exec(sql);
  return db;
}

async function migrate(): Promise<File | Blob> {
  const db = await migratedUpTo(migrations.length);
  const snapshot = await db.dumpDataDir('none');
  await db.close();
  return snapshot;
}

async function freshDatabase(): Promise<PGlite> {
  migratedSnapshot ??= migrate();
  return PGlite.create({ loadDataDir: await migratedSnapshot });
}

async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('expected the statement to fail');
}

const ids = {
  user: '00000000-0000-4000-8000-0000000000f1',
  track: '00000000-0000-4000-8000-000000000001',
  subtask: '00000000-0000-4000-8000-000000000002',
  topic: '00000000-0000-4000-8000-000000000003',
  task: '00000000-0000-4000-8000-000000000004',
};

/** Every data row needs an owner (0004); most tests use this one user. */
async function insertUser(db: PGlite): Promise<void> {
  await db.query('insert into auth.users (id) values ($1)', [ids.user]);
}

async function insertTree(db: PGlite): Promise<void> {
  await insertUser(db);
  await db.query(
    `insert into nodes (id, user_id, parent_id, name, color) values ($1, $2, null, 'Track', 'amber')`,
    [ids.track, ids.user],
  );
  await db.query(
    `insert into nodes (id, user_id, parent_id, name) values ($1, $2, $3, 'Subtask')`,
    [ids.subtask, ids.user, ids.track],
  );
  await db.query(
    `insert into nodes (id, user_id, parent_id, name, topic_status)
     values ($1, $2, $3, 'Topic', 'not_started')`,
    [ids.topic, ids.user, ids.subtask],
  );
}

describe('migrations', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshDatabase();
  }, 30_000);
  afterEach(() => db.close());

  describe('cleanup after accounts (0004)', () => {
    it('requires an owner on every data row', async () => {
      expect(
        await errorOf(db.query(`insert into nodes (name, color) values ('No owner', 'amber')`)),
      ).toMatch(/user_id/);
      const { rows } = await db.query<{ table_name: string }>(
        `select table_name from information_schema.columns
         where table_schema = 'public' and column_name = 'user_id' and is_nullable = 'YES'`,
      );
      expect(rows).toEqual([]);
    });

    it('removes the single-user table and functions', async () => {
      const { rows } = await db.query<{ name: string }>(
        `select proname as name from pg_proc where pronamespace = 'public'::regnamespace
         and proname in ('seed_if_empty', 'delete_node_tree', 'complete_task', 'uncomplete_task',
                         'has_unclaimed_data', 'claim_unclaimed_data')`,
      );
      expect(rows).toEqual([]);
      expect(await errorOf(db.query('select 1 from settings'))).toMatch(/does not exist/);
    });

    it('refuses to run while unclaimed data exists, changing nothing', async () => {
      const db0003 = await migratedUpTo(3);
      await db0003.query(`insert into nodes (name, color) values ('Old', 'amber')`);
      expect(await errorOf(db0003.exec(migrations[3] ?? ''))).toMatch(/unclaimed_data/);
      await db0003.exec('rollback');
      const { rows } = await db0003.query<{ n: number }>('select count(*)::int as n from settings');
      expect(rows[0]?.n).toBe(1);
      await db0003.close();
    }, 30_000);
  });

  describe('nodes', () => {
    beforeEach(() => insertTree(db));

    it('derives depth from the parent', async () => {
      const { rows } = await db.query<{ name: string; depth: number }>(
        'select name, depth from nodes order by depth',
      );
      expect(rows.map((r) => [r.name, r.depth])).toEqual([
        ['Track', 1],
        ['Subtask', 2],
        ['Topic', 3],
      ]);
    });

    it('rejects a fourth level', async () => {
      expect(
        await errorOf(
          db.query(
            `insert into nodes (user_id, parent_id, name, topic_status)
             values ($1, $2, 'Too deep', 'done')`,
            [ids.user, ids.topic],
          ),
        ),
      ).toBe('max_depth');
    });

    it('rejects duplicate sibling names case-insensitively, including tracks', async () => {
      expect(
        await errorOf(
          db.query(`insert into nodes (user_id, name, color) values ($1, 'TRACK', 'blue')`, [
            ids.user,
          ]),
        ),
      ).toMatch(/duplicate key/);
      expect(
        await errorOf(
          db.query(`insert into nodes (user_id, parent_id, name) values ($1, $2, 'subtask')`, [
            ids.user,
            ids.track,
          ]),
        ),
      ).toMatch(/duplicate key/);
    });

    it('keeps track-only and topic-only fields in their level', async () => {
      expect(
        await errorOf(
          db.query(
            `insert into nodes (user_id, parent_id, name, color) values ($1, $2, 'X', 'blue')`,
            [ids.user, ids.track],
          ),
        ),
      ).toMatch(/nodes_track_fields/);
      expect(
        await errorOf(
          db.query(`insert into nodes (user_id, name) values ($1, 'No color')`, [ids.user]),
        ),
      ).toMatch(/nodes_track_has_color/);
      expect(
        await errorOf(
          db.query(`insert into nodes (user_id, parent_id, name) values ($1, $2, 'No status')`, [
            ids.user,
            ids.subtask,
          ]),
        ),
      ).toMatch(/nodes_topic_fields/);
    });
  });

  describe('delete_user_node_tree', () => {
    const deleteTree = (node: string) =>
      db.query<{ n: number }>('select delete_user_node_tree($1, $2) as n', [ids.user, node]);

    it('deletes an unused subtree and returns the count', async () => {
      await insertTree(db);
      const { rows } = await deleteTree(ids.track);
      expect(rows[0]?.n).toBe(3);
      expect((await db.query('select * from nodes')).rows).toEqual([]);
    });

    it('refuses when a descendant has a session, and deletes nothing', async () => {
      await insertTree(db);
      await db.query(
        `insert into sessions (user_id, node_id, studied_on, minutes)
         values ($1, $2, '2026-10-01', 30)`,
        [ids.user, ids.topic],
      );
      expect(await errorOf(deleteTree(ids.track))).toBe('node_in_use');
      expect((await db.query('select * from nodes')).rows).toHaveLength(3);
    });

    it('reports a missing node', async () => {
      expect(await errorOf(deleteTree(ids.track))).toBe('node_not_found');
    });
  });

  describe('complete_user_task and uncomplete_user_task', () => {
    beforeEach(async () => {
      await insertTree(db);
      await db.query(
        `insert into tasks (id, user_id, node_id, title, recurrence, is_scored, default_max_score)
         values ($1, $2, $3, 'Weekly self-test', 'weekly', true, 20)`,
        [ids.task, ids.user, ids.track],
      );
    });

    const score = {
      node_id: ids.track,
      kind: 'revision',
      title: 'Recall',
      taken_on: '2026-09-29',
      score: 18,
      max_score: 20,
    };

    const complete = (periodStart: string, withScore: object | null) =>
      db.query<{ id: string }>(`select complete_user_task($1, $2, $3, now(), null, $4) as id`, [
        ids.user,
        ids.task,
        periodStart,
        withScore,
      ]);

    it('records a completion with its score atomically, once per week', async () => {
      const { rows } = await complete('2026-09-28', score);
      const scores = await db.query<{ task_completion_id: string }>(
        'select task_completion_id from scores',
      );
      expect(scores.rows).toEqual([{ task_completion_id: rows[0]?.id }]);

      expect(await errorOf(complete('2026-09-28', score))).toBe('already_completed');
      expect((await db.query('select * from scores')).rows).toHaveLength(1);
    });

    it('rolls back the completion when the score is invalid', async () => {
      expect(await errorOf(complete('2026-09-28', { ...score, score: 25 }))).toMatch(
        /scores_score_within_max/,
      );
      expect((await db.query('select * from task_completions')).rows).toEqual([]);
    });

    it('rejects a weekly period that does not start on Monday', async () => {
      expect(await errorOf(complete('2026-09-29', null))).toMatch(/check/);
    });

    it('uncompletes and removes the linked score', async () => {
      const { rows } = await complete('2026-09-28', score);
      await db.query('select uncomplete_user_task($1, $2)', [ids.user, rows[0]?.id]);
      expect((await db.query('select * from task_completions')).rows).toEqual([]);
      expect((await db.query('select * from scores')).rows).toEqual([]);
    });

    it('allows tasks without a node ("Other"), but not scored ones (0002)', async () => {
      await db.query(
        `insert into tasks (user_id, node_id, title) values ($1, null, 'Renew card')`,
        [ids.user],
      );
      expect(
        await errorOf(
          db.query(
            `insert into tasks (user_id, node_id, title, is_scored, default_max_score)
             values ($1, null, 'Scored', true, 10)`,
            [ids.user],
          ),
        ),
      ).toMatch(/tasks_scored_needs_node/);
    });
  });

  describe('seed_user_if_empty', () => {
    const payload = {
      nodes: [
        { id: ids.track, parent_id: null, name: 'Track', color: 'amber', sort_order: 0 },
        { id: ids.subtask, parent_id: ids.track, name: 'Subtask', color: null, sort_order: 0 },
      ],
      tasks: [
        {
          id: ids.task,
          node_id: ids.track,
          title: 'Task',
          recurrence: 'weekly',
          is_scored: true,
          default_max_score: 20,
          sort_order: 0,
        },
      ],
    };

    it('seeds once and is a no-op afterwards', async () => {
      await insertUser(db);
      const seed = () =>
        db.query<{ seeded: boolean }>('select seed_user_if_empty($1, $2) as seeded', [
          ids.user,
          payload,
        ]);
      const first = await seed();
      const second = await seed();
      expect([first.rows[0]?.seeded, second.rows[0]?.seeded]).toEqual([true, false]);
      expect((await db.query('select * from nodes')).rows).toHaveLength(2);
      expect((await db.query('select * from tasks')).rows).toHaveLength(1);
    });
  });

  describe('accounts (0003)', () => {
    const userA = '00000000-0000-4000-8000-0000000000a1';
    const userB = '00000000-0000-4000-8000-0000000000b1';
    const nodeB = '00000000-0000-4000-8000-0000000000b2';

    beforeEach(async () => {
      await db.query('insert into auth.users (id) values ($1), ($2)', [userA, userB]);
      await db.query(
        `insert into nodes (id, user_id, name, color) values ($1, $2, 'B track', 'blue')`,
        [nodeB, userB],
      );
    });

    it("refuses rows that point at another user's rows", async () => {
      expect(
        await errorOf(
          db.query(
            `insert into sessions (user_id, node_id, studied_on, minutes) values ($1, $2, '2026-10-01', 30)`,
            [userA, nodeB],
          ),
        ),
      ).toMatch(/sessions_node_same_user/);
      expect(
        await errorOf(
          db.query(`insert into nodes (user_id, parent_id, name) values ($1, $2, 'Sub')`, [
            userA,
            nodeB,
          ]),
        ),
      ).toMatch(/nodes_parent_same_user/);
      expect(
        await errorOf(
          db.query(
            `insert into deadlines (user_id, node_id, title, due_on) values ($1, $2, 'X', '2026-12-01')`,
            [userA, nodeB],
          ),
        ),
      ).toMatch(/deadlines_node_same_user/);
    });

    it('keeps sibling names unique per user only', async () => {
      await db.query(`insert into nodes (user_id, name, color) values ($1, 'B track', 'amber')`, [
        userA,
      ]);
      expect(
        await errorOf(
          db.query(`insert into nodes (user_id, name, color) values ($1, 'b TRACK', 'amber')`, [
            userB,
          ]),
        ),
      ).toMatch(/duplicate key/);
    });

    it('seeds each user once, separately', async () => {
      const payload = {
        nodes: [{ id: ids.track, parent_id: null, name: 'Track', color: 'amber', sort_order: 0 }],
        tasks: [],
      };
      const seed = (user: string) =>
        db.query<{ seeded: boolean }>('select seed_user_if_empty($1, $2) as seeded', [
          user,
          payload,
        ]);
      expect((await seed(userA)).rows[0]?.seeded).toBe(true);
      expect((await seed(userA)).rows[0]?.seeded).toBe(false);
      expect((await seed(userB)).rows[0]?.seeded).toBe(false); // B already has a track
      expect((await db.query('select user_id from user_settings order by user_id')).rows).toEqual([
        { user_id: userA },
        { user_id: userB },
      ]);
    });

    it("doesn't let one user delete or complete another user's rows", async () => {
      expect(await errorOf(db.query('select delete_user_node_tree($1, $2)', [userA, nodeB]))).toBe(
        'node_not_found',
      );
      const taskB = '00000000-0000-4000-8000-0000000000b3';
      await db.query(`insert into tasks (id, user_id, node_id, title) values ($1, $2, $3, 'T')`, [
        taskB,
        userB,
        nodeB,
      ]);
      expect(
        await errorOf(
          db.query(`select complete_user_task($1, $2, null, now(), null, null)`, [userA, taskB]),
        ),
      ).toBe('task_not_found');
      const { rows } = await db.query<{ id: string }>(
        `select complete_user_task($1, $2, null, now(), null, null) as id`,
        [userB, taskB],
      );
      expect(
        await errorOf(db.query('select uncomplete_user_task($1, $2)', [userA, rows[0]?.id])),
      ).toBe('completion_not_found');
    });

    it("deletes all of a user's data when the account is deleted", async () => {
      const sub = '00000000-0000-4000-8000-0000000000b4';
      const topic = '00000000-0000-4000-8000-0000000000b5';
      await db.query(
        `insert into nodes (id, user_id, parent_id, name) values ($1, $2, $3, 'Sub')`,
        [sub, userB, nodeB],
      );
      await db.query(
        `insert into nodes (id, user_id, parent_id, name, topic_status)
         values ($1, $2, $3, 'Topic', 'done')`,
        [topic, userB, sub],
      );
      await db.query(
        `insert into sessions (user_id, node_id, studied_on, minutes)
         values ($1, $2, '2026-10-01', 30)`,
        [userB, topic],
      );
      await db.query('delete from auth.users where id = $1', [userB]);
      expect((await db.query('select 1 from nodes')).rows).toEqual([]);
      expect((await db.query('select 1 from sessions')).rows).toEqual([]);
    });
  });

  describe('v1.1 (0005)', () => {
    beforeEach(() => insertTree(db));

    const addTask = () =>
      db.query(
        `insert into tasks (id, user_id, node_id, title, is_scored, default_max_score)
         values ($1, $2, $3, 'Mock 1', true, 20)`,
        [ids.task, ids.user, ids.track],
      );

    it('backfills completion dates in Karachi time and fills them for v1.0.1 inserts', async () => {
      const db0004 = await migratedUpTo(4);
      await db0004.query('insert into auth.users (id) values ($1)', [ids.user]);
      await db0004.query(
        `insert into nodes (id, user_id, name, color) values ($1, $2, 'Track', 'amber')`,
        [ids.track, ids.user],
      );
      await db0004.query(
        `insert into tasks (id, user_id, node_id, title) values ($1, $2, $3, 'Old')`,
        [ids.task, ids.user, ids.track],
      );
      // 20:30 UTC on the 22nd is 01:30 on the 23rd in Karachi.
      await db0004.query(
        `insert into task_completions (user_id, task_id, completed_at)
         values ($1, $2, '2026-11-22T20:30:00Z')`,
        [ids.user, ids.task],
      );
      await db0004.exec(migrations[4] ?? '');
      const backfilled = await db0004.query<{ completed_on: string }>(
        `select completed_on::text as completed_on from task_completions`,
      );
      expect(backfilled.rows).toEqual([{ completed_on: '2026-11-23' }]);

      // The v1.0.1 RPC doesn't know the column; the trigger fills it.
      await db0004.query('delete from task_completions');
      await db0004.query(
        `select complete_user_task($1, $2, null, '2026-11-23T19:30:00Z', null, null)`,
        [ids.user, ids.task],
      );
      const filled = await db0004.query<{ completed_on: string }>(
        `select completed_on::text as completed_on from task_completions`,
      );
      expect(filled.rows).toEqual([{ completed_on: '2026-11-24' }]);
      await db0004.close();
    }, 30_000);

    it('keeps the functions the v1.0.1 code calls', async () => {
      const { rows } = await db.query<{ name: string }>(
        `select proname as name from pg_proc where pronamespace = 'public'::regnamespace
         and proname in ('seed_user_if_empty', 'delete_user_node_tree', 'complete_user_task',
                         'uncomplete_user_task')
         order by proname`,
      );
      expect(rows.map((r) => r.name)).toEqual([
        'complete_user_task',
        'delete_user_node_tree',
        'seed_user_if_empty',
        'uncomplete_user_task',
      ]);
    });

    it('stores "My day ends at" in half-hour steps up to 06:00, default 00:00', async () => {
      await db.query('insert into user_settings (user_id) values ($1)', [ids.user]);
      const { rows } = await db.query<{ day_ends_at_minutes: number }>(
        'select day_ends_at_minutes from user_settings',
      );
      expect(rows).toEqual([{ day_ends_at_minutes: 0 }]);
      await db.query('update user_settings set day_ends_at_minutes = 240');
      for (const bad of [-30, 390, 45]) {
        expect(
          await errorOf(db.query('update user_settings set day_ends_at_minutes = $1', [bad])),
        ).toMatch(/day_ends_at_minutes/);
      }
    });

    it('completes on a chosen date with given ids, and refuses a second completion', async () => {
      await addTask();
      const completionId = '00000000-0000-4000-8000-0000000000c1';
      const scoreId = '00000000-0000-4000-8000-0000000000c2';
      const score = {
        id: scoreId,
        node_id: ids.track,
        kind: 'mock_test',
        title: 'Mock 1',
        taken_on: '2026-11-20',
        score: 14,
        max_score: 20,
        created_at: '2026-11-20T10:00:00Z',
      };
      const complete = () =>
        db.query<{ id: string }>(
          `select complete_user_task_on($1, $2, null, now(), '2026-11-20', 'ok', $3, $4) as id`,
          [ids.user, ids.task, score, completionId],
        );
      expect((await complete()).rows).toEqual([{ id: completionId }]);
      const scores = await db.query<{ id: string; task_completion_id: string }>(
        'select id, task_completion_id from scores',
      );
      expect(scores.rows).toEqual([{ id: scoreId, task_completion_id: completionId }]);
      const { rows } = await db.query<{ completed_on: string }>(
        'select completed_on::text as completed_on from task_completions',
      );
      expect(rows).toEqual([{ completed_on: '2026-11-20' }]);
      expect(await errorOf(complete())).toBe('already_completed');
    });

    it('restores a deleted task tree with its completions and score links', async () => {
      const parent = ids.task;
      const child = '00000000-0000-4000-8000-0000000000d1';
      const completion = '00000000-0000-4000-8000-0000000000d2';
      const score = '00000000-0000-4000-8000-0000000000d3';
      await db.query(
        `insert into scores (id, user_id, node_id, kind, title, taken_on, score, max_score)
         values ($1, $2, $3, 'quiz', 'Quiz', '2026-11-20', 5, 10)`,
        [score, ids.user, ids.track],
      );
      const payload = {
        // The child comes first on purpose: the order mustn't matter.
        tasks: [
          { id: child, node_id: ids.track, parent_task_id: parent, title: 'Child' },
          {
            id: parent,
            node_id: ids.track,
            parent_task_id: null,
            title: 'Parent',
            recurrence: 'none',
            created_at: '2026-11-01T08:00:00Z',
          },
        ],
        completions: [
          {
            id: completion,
            task_id: child,
            period_start: null,
            completed_at: '2026-11-20T08:00:00Z',
            completed_on: '2026-11-20',
            note: null,
          },
        ],
        score_links: [{ score_id: score, completion_id: completion }],
      };
      const { rows } = await db.query<{ n: number }>('select restore_user_task_tree($1, $2) as n', [
        ids.user,
        payload,
      ]);
      expect(rows[0]?.n).toBe(2);
      const linked = await db.query<{ task_completion_id: string }>(
        'select task_completion_id from scores',
      );
      expect(linked.rows).toEqual([{ task_completion_id: completion }]);
      const created = await db.query<{ created_at: Date }>(
        'select created_at from tasks where id = $1',
        [parent],
      );
      expect(created.rows[0]?.created_at.toISOString()).toBe('2026-11-01T08:00:00.000Z');
    });

    it('refuses to delete a node that has mistakes', async () => {
      await db.query(
        `insert into mistakes (user_id, node_id, text, created_on, anchor_on, next_due_on)
         values ($1, $2, 'der/die', '2026-11-20', '2026-11-20', '2026-11-21')`,
        [ids.user, ids.topic],
      );
      expect(
        await errorOf(db.query('select delete_user_node_tree($1, $2)', [ids.user, ids.track])),
      ).toBe('node_in_use');
    });

    it("keeps a mistake's status, next review, and learned date consistent", async () => {
      const insert = (status: string, next: string | null, learned: string | null) =>
        db.query(
          `insert into mistakes (user_id, node_id, text, created_on, status, anchor_on, next_due_on, learned_on)
           values ($1, $2, 'x', '2026-11-20', $3, '2026-11-20', $4, $5)`,
          [ids.user, ids.topic, status, next, learned],
        );
      expect(await errorOf(insert('open', null, null))).toMatch(/mistakes_open_has_next_due/);
      expect(await errorOf(insert('learned', null, null))).toMatch(/mistakes_learned_has_date/);
      await insert('learned', null, '2026-11-27');
      await insert('open', '2026-11-21', null);
    });

    it('cascades exam targets with their deadline', async () => {
      const deadline = '00000000-0000-4000-8000-0000000000e1';
      await db.query(
        `insert into deadlines (id, user_id, node_id, title, due_on, is_exam)
         values ($1, $2, $3, 'Exam', '2026-12-20', true)`,
        [deadline, ids.user, ids.track],
      );
      await db.query(
        `insert into exam_targets (user_id, deadline_id, label, target_on, min_percent)
         values ($1, $2, 'Mock 1', '2026-12-01', 60)`,
        [ids.user, deadline],
      );
      expect(
        await errorOf(
          db.query(
            `insert into exam_targets (user_id, deadline_id, label, target_on, min_percent)
             values ($1, $2, 'Too high', '2026-12-01', 101)`,
            [ids.user, deadline],
          ),
        ),
      ).toMatch(/check/);
      await db.query('delete from deadlines where id = $1', [deadline]);
      expect((await db.query('select 1 from exam_targets')).rows).toEqual([]);
    });

    it('records changes with checked entity and action names', async () => {
      await db.query(
        `insert into change_log (user_id, source, entity, entity_id, action, summary, after)
         values ($1, 'claude', 'session', $2, 'create', 'Logged 45m', '{"minutes":45}')`,
        [ids.user, ids.topic],
      );
      expect(
        await errorOf(
          db.query(
            `insert into change_log (user_id, source, entity, entity_id, action, summary)
             values ($1, 'app', 'settings', $2, 'create', 'x')`,
            [ids.user, ids.topic],
          ),
        ),
      ).toMatch(/check/);
    });

    describe('restore_user_backup', () => {
      const n = (suffix: string) => `00000000-0000-4000-8000-0000000001${suffix}`;
      const payload = {
        settings: { student_name: 'Demo Student', neglect_days: 5, day_ends_at_minutes: 240 },
        // Out of order on purpose: nodes are inserted by depth, tasks in one statement.
        nodes: [
          { id: n('03'), parent_id: n('02'), depth: 3, name: 'Topic', topic_status: 'done' },
          { id: n('01'), parent_id: null, depth: 1, name: 'Track', color: 'blue' },
          { id: n('02'), parent_id: n('01'), depth: 2, name: 'Sub' },
        ],
        sessions: [
          {
            id: n('10'),
            node_id: n('03'),
            studied_on: '2026-11-01',
            minutes: 30,
            source: 'claude',
          },
        ],
        tasks: [
          { id: n('21'), node_id: n('02'), parent_task_id: n('20'), title: 'Child' },
          {
            id: n('20'),
            node_id: n('01'),
            parent_task_id: null,
            title: 'Parent',
            is_scored: true,
            default_max_score: 10,
          },
        ],
        completions: [
          {
            id: n('30'),
            task_id: n('20'),
            completed_at: '2026-11-02T08:00:00Z',
            completed_on: '2026-11-02',
          },
        ],
        scores: [
          {
            id: n('40'),
            node_id: n('01'),
            task_completion_id: n('30'),
            kind: 'quiz',
            title: 'Parent',
            taken_on: '2026-11-02',
            score: 8,
            max_score: 10,
          },
        ],
        deadlines: [
          { id: n('50'), node_id: n('01'), title: 'Exam', due_on: '2026-12-20', is_exam: true },
        ],
        exam_targets: [
          {
            id: n('60'),
            deadline_id: n('50'),
            label: 'Mock 1',
            target_on: '2026-12-01',
            min_percent: 60,
          },
        ],
        mistakes: [
          {
            id: n('70'),
            node_id: n('03'),
            text: 'der/die',
            created_on: '2026-11-01',
            anchor_on: '2026-11-01',
            next_due_on: '2026-11-02',
          },
        ],
      };

      const count = async (table: string) =>
        (await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]?.n;

      it('replaces the study data, keeps the account and shared links, clears history', async () => {
        await db.query(
          `insert into user_settings (user_id, mcp_token_hash) values ($1, repeat('a', 64))`,
          [ids.user],
        );
        await db.query(
          `insert into sessions (user_id, node_id, studied_on, minutes)
           values ($1, $2, '2026-10-01', 30)`,
          [ids.user, ids.topic],
        );
        await db.query(
          `insert into shared_reports (user_id, slug, snapshot, period_label)
           values ($1, 'abcdefghijklmnopqrstuvwx', '{}', 'This week')`,
          [ids.user],
        );
        await db.query(
          `insert into change_log (user_id, source, entity, entity_id, action, summary)
           values ($1, 'app', 'session', $2, 'create', 'Logged 30m')`,
          [ids.user, ids.topic],
        );

        await db.query('select restore_user_backup($1, $2)', [ids.user, payload]);

        expect(await count('nodes')).toBe(3);
        expect(await count('sessions')).toBe(1);
        expect(await count('tasks')).toBe(2);
        expect(await count('task_completions')).toBe(1);
        expect(await count('scores')).toBe(1);
        expect(await count('deadlines')).toBe(1);
        expect(await count('exam_targets')).toBe(1);
        expect(await count('mistakes')).toBe(1);
        expect(await count('change_log')).toBe(0);
        expect(await count('shared_reports')).toBe(1);
        const depths = await db.query<{ depth: number }>('select depth from nodes order by depth');
        expect(depths.rows.map((r) => r.depth)).toEqual([1, 2, 3]);
        const settings = await db.query(
          `select student_name, neglect_days, day_ends_at_minutes,
                  mcp_token_hash is not null as linked
           from user_settings`,
        );
        expect(settings.rows).toEqual([
          { student_name: 'Demo Student', neglect_days: 5, day_ends_at_minutes: 240, linked: true },
        ]);
      });

      it('changes nothing when the backup is invalid', async () => {
        const broken = { ...payload, sessions: [{ ...payload.sessions[0], minutes: 0 }] };
        expect(
          await errorOf(db.query('select restore_user_backup($1, $2)', [ids.user, broken])),
        ).toMatch(/check/);
        const { rows } = await db.query<{ name: string }>('select name from nodes order by depth');
        expect(rows.map((r) => r.name)).toEqual(['Track', 'Subtask', 'Topic']);
      });

      it("never touches another user's data", async () => {
        const other = '00000000-0000-4000-8000-0000000000a9';
        await db.query('insert into auth.users (id) values ($1)', [other]);
        await db.query(`insert into nodes (user_id, name, color) values ($1, 'Mine', 'rose')`, [
          other,
        ]);
        await db.query('select restore_user_backup($1, $2)', [ids.user, payload]);
        const { rows } = await db.query<{ n: number }>(
          'select count(*)::int as n from nodes where user_id = $1',
          [other],
        );
        expect(rows[0]?.n).toBe(1);
      });
    });
  });

  describe('access control', () => {
    const tables = [
      'nodes',
      'sessions',
      'tasks',
      'task_completions',
      'scores',
      'deadlines',
      'shared_reports',
      'login_attempts',
      'user_settings',
      'auth_requests',
      'exam_targets',
      'mistakes',
      'change_log',
    ];

    it('enables RLS with no policies on every table', async () => {
      const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
        `select relname, relrowsecurity from pg_class
         where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`,
      );
      expect(rows.map((r) => r.relname).sort()).toEqual([...tables].sort());
      expect(rows.every((r) => r.relrowsecurity)).toBe(true);
      expect(
        (await db.query(`select * from pg_policies where schemaname = 'public'`)).rows,
      ).toEqual([]);
    });

    it('gives the API roles no access to tables or functions', async () => {
      for (const role of ['anon', 'authenticated']) {
        for (const table of tables) {
          const { rows } = await db.query<{ ok: boolean }>(
            `select has_table_privilege($1, $2, 'select, insert, update, delete') as ok`,
            [role, `public.${table}`],
          );
          expect(rows[0]?.ok, `${role} on ${table}`).toBe(false);
        }
        const { rows } = await db.query<{ name: string }>(
          `select p.proname as name from pg_proc p
           where p.pronamespace = 'public'::regnamespace and has_function_privilege($1, p.oid, 'execute')`,
          [role],
        );
        expect(rows, role).toEqual([]);
      }
    });

    it('lets the server role call the RPC functions', async () => {
      const { rows } = await db.query<{ ok: boolean }>(
        `select has_function_privilege('service_role', 'public.delete_user_node_tree(uuid, uuid)', 'execute') as ok`,
      );
      expect(rows[0]?.ok).toBe(true);
    });
  });
});

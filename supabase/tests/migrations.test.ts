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

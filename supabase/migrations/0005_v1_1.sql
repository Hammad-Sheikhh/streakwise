-- 0005: v1.1 "the exam update" (SPEC §B7.1), written once for all of v1.1 so the owner runs SQL once.
--
-- Backward compatible on purpose: there is one database for every environment (D15), so the
-- v1.0.1 code keeps running against it until release R6. This file only adds columns (with
-- defaults), tables, indexes, triggers, and functions. Nothing the v1.0.1 code uses is dropped or
-- renamed, and the old RPC signatures keep working.

begin;

-- ---------------------------------------------------------------------------------------------
-- DAY-1: "My day ends at", in minutes after midnight (00:00 to 06:00, half-hour steps).
-- ---------------------------------------------------------------------------------------------

alter table public.user_settings
  add column day_ends_at_minutes smallint not null default 0
    constraint user_settings_day_ends_at_minutes_check
    check (day_ends_at_minutes between 0 and 360 and day_ends_at_minutes % 30 = 0);

-- ---------------------------------------------------------------------------------------------
-- TASK-11: every completion has a completion date (a study day). Existing rows get the Karachi
-- date of their timestamp, which is what the app showed until now (the cutoff was always 00:00).
-- ---------------------------------------------------------------------------------------------

alter table public.task_completions add column completed_on date;

update public.task_completions
set completed_on = (completed_at at time zone 'Asia/Karachi')::date
where completed_on is null;

alter table public.task_completions alter column completed_on set not null;

-- The v1.0.1 code doesn't know the column; its inserts leave it null and get the same default.
create or replace function public.task_completions_fill_completed_on() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.completed_on is null then
    new.completed_on := (new.completed_at at time zone 'Asia/Karachi')::date;
  end if;
  return new;
end;
$$;

create trigger task_completions_fill_completed_on before insert on public.task_completions
  for each row execute function public.task_completions_fill_completed_on();

create index task_completions_user_id_completed_on_idx
  on public.task_completions (user_id, completed_on);

-- ---------------------------------------------------------------------------------------------
-- EXAM-1, EXAM-3: exam deadlines and their score targets.
-- ---------------------------------------------------------------------------------------------

alter table public.deadlines add column is_exam boolean not null default false;

-- Needed by the same-user key below (as nodes, tasks, and completions got in 0003).
alter table public.deadlines add constraint deadlines_id_user_id_key unique (id, user_id);

create table public.exam_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  deadline_id uuid not null,
  label text not null check (char_length(label) between 1 and 60),
  target_on date not null,
  min_percent numeric not null check (min_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_targets_deadline_same_user foreign key (deadline_id, user_id)
    references public.deadlines (id, user_id) on delete cascade
);

create index exam_targets_deadline_id_target_on_idx on public.exam_targets (deadline_id, target_on);
create index exam_targets_user_id_idx on public.exam_targets (user_id);
create trigger exam_targets_set_updated_at before update on public.exam_targets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- ERR: mistakes with a +1/+3/+7 day review schedule (SPEC §B9.13).
-- ---------------------------------------------------------------------------------------------

create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  node_id uuid not null,
  text text not null check (char_length(text) between 1 and 500),
  created_on date not null,
  source text not null default 'app' check (source in ('app', 'claude')),
  status text not null default 'open' check (status in ('open', 'learned')),
  step smallint not null default 1 check (step between 1 and 3),
  anchor_on date not null,
  next_due_on date,
  review_count integer not null default 0 check (review_count >= 0),
  last_reviewed_on date,
  last_result text check (last_result in ('right', 'wrong')),
  learned_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- NO ACTION (the default), like the other node keys since 0003: deleting an account removes
  -- the mistakes and the nodes in the same statement.
  constraint mistakes_node_same_user foreign key (node_id, user_id)
    references public.nodes (id, user_id),
  constraint mistakes_open_has_next_due check ((status = 'open') = (next_due_on is not null)),
  constraint mistakes_learned_has_date check ((status = 'learned') = (learned_on is not null))
);

create index mistakes_user_id_status_next_due_on_idx
  on public.mistakes (user_id, status, next_due_on);
create index mistakes_node_id_idx on public.mistakes (node_id);
create trigger mistakes_set_updated_at before update on public.mistakes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- UNDO: the change history (SPEC §B3.8). Written by the server after each change; kept 30 days.
-- ---------------------------------------------------------------------------------------------

create table public.change_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  source text not null check (source in ('app', 'claude')),
  entity text not null check (entity in (
    'session', 'score', 'task', 'completion', 'mistake', 'node', 'deadline', 'exam_target'
  )),
  entity_id uuid not null,
  action text not null check (action in (
    'create', 'update', 'delete', 'complete', 'uncomplete', 'archive', 'unarchive', 'review'
  )),
  summary text not null check (char_length(summary) <= 200),
  before jsonb,
  after jsonb,
  undone_at timestamptz
);

create index change_log_user_id_at_idx on public.change_log (user_id, at desc);
-- Undo looks for later changes to the same item.
create index change_log_user_id_entity_id_idx on public.change_log (user_id, entity_id);

-- ---------------------------------------------------------------------------------------------
-- RPC functions. Errors follow 0001: SQLSTATE P0001 with a short code; P0002 means "not found".
-- ---------------------------------------------------------------------------------------------

-- TREE-3 for one user's node, now also refusing when the subtree has mistakes. Same signature as
-- 0003, so the v1.0.1 code keeps calling it.
create or replace function public.delete_user_node_tree(p_user_id uuid, p_node_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  ids uuid[];
begin
  perform 1 from public.nodes where id = p_node_id and user_id = p_user_id for update;
  if not found then
    raise exception 'node_not_found' using errcode = 'P0002';
  end if;

  with recursive t as (
    select id from public.nodes where id = p_node_id
    union all
    select n.id from public.nodes n join t on n.parent_id = t.id
  )
  select array_agg(id) into ids from t;

  if exists (select 1 from public.sessions where node_id = any (ids))
    or exists (select 1 from public.tasks where node_id = any (ids))
    or exists (select 1 from public.scores where node_id = any (ids))
    or exists (select 1 from public.deadlines where node_id = any (ids))
    or exists (select 1 from public.mistakes where node_id = any (ids)) then
    raise exception 'node_in_use' using errcode = 'P0001';
  end if;

  for d in reverse 3..1 loop
    delete from public.nodes where id = any (ids) and depth = d;
  end loop;

  return cardinality(ids);
end;
$$;

-- TASK-6 + TASK-11: like complete_user_task (0003) with the completion date, and optional ids so
-- undo can bring back a completion and its score exactly as they were (UNDO-5). Returns the
-- completion id. p_score may carry "id" and "created_at".
create or replace function public.complete_user_task_on(
  p_user_id uuid,
  p_task_id uuid,
  p_period_start date,
  p_completed_at timestamptz,
  p_completed_on date,
  p_note text,
  p_score jsonb,
  p_completion_id uuid default null
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  completion_id uuid;
begin
  if not exists (select 1 from public.tasks where id = p_task_id and user_id = p_user_id) then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  begin
    insert into public.task_completions
      (id, user_id, task_id, period_start, completed_at, completed_on, note)
    values (
      coalesce(p_completion_id, gen_random_uuid()),
      p_user_id,
      p_task_id,
      p_period_start,
      p_completed_at,
      p_completed_on,
      p_note
    )
    returning id into completion_id;
  exception when unique_violation then
    raise exception 'already_completed' using errcode = 'P0001';
  end;

  if p_score is not null then
    insert into public.scores
      (id, user_id, node_id, task_completion_id, kind, title, taken_on, score, max_score, note, created_at)
    values (
      coalesce((p_score ->> 'id')::uuid, gen_random_uuid()),
      p_user_id,
      (p_score ->> 'node_id')::uuid,
      completion_id,
      p_score ->> 'kind',
      p_score ->> 'title',
      (p_score ->> 'taken_on')::date,
      (p_score ->> 'score')::numeric,
      (p_score ->> 'max_score')::numeric,
      p_score ->> 'note',
      coalesce((p_score ->> 'created_at')::timestamptz, now())
    );
  end if;

  return completion_id;
end;
$$;

-- UNDO-5: brings back a deleted task tree from its change-log snapshot, atomically: the tasks
-- (with their ids), their completions, and the links to the scores that were kept but unlinked.
-- Payload: { tasks: [...], completions: [...], score_links: [{ score_id, completion_id }] }, in
-- the column names of the tables. Returns the number of tasks restored.
create or replace function public.restore_user_task_tree(p_user_id uuid, p_payload jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  restored integer;
begin
  -- One statement: the parent keys are checked at its end, so the order of the rows doesn't matter.
  insert into public.tasks (
    id, user_id, node_id, parent_task_id, title, description, due_on, recurrence, is_scored,
    default_max_score, sort_order, archived_at, created_at, updated_at
  )
  select
    t.id, p_user_id, t.node_id, t.parent_task_id, t.title, t.description, t.due_on,
    coalesce(t.recurrence, 'none'), coalesce(t.is_scored, false), t.default_max_score,
    coalesce(t.sort_order, 0), t.archived_at, coalesce(t.created_at, now()),
    coalesce(t.updated_at, now())
  from jsonb_to_recordset(coalesce(p_payload -> 'tasks', '[]'::jsonb)) as t(
    id uuid, node_id uuid, parent_task_id uuid, title text, description text, due_on date,
    recurrence text, is_scored boolean, default_max_score numeric, sort_order integer,
    archived_at timestamptz, created_at timestamptz, updated_at timestamptz
  );
  get diagnostics restored = row_count;

  insert into public.task_completions
    (id, user_id, task_id, period_start, completed_at, completed_on, note)
  select c.id, p_user_id, c.task_id, c.period_start, c.completed_at, c.completed_on, c.note
  from jsonb_to_recordset(coalesce(p_payload -> 'completions', '[]'::jsonb)) as c(
    id uuid, task_id uuid, period_start date, completed_at timestamptz, completed_on date,
    note text
  );

  update public.scores s
  set task_completion_id = l.completion_id
  from jsonb_to_recordset(coalesce(p_payload -> 'score_links', '[]'::jsonb)) as l(
    score_id uuid, completion_id uuid
  )
  where s.id = l.score_id and s.user_id = p_user_id and s.task_completion_id is null;

  return restored;
end;
$$;

-- DATA-4: replaces all of one user's study data with a backup, in one transaction. The server
-- validates the file and gives every row a fresh id (links remapped) before calling this. Keeps
-- the account, the Claude link, and shared links; clears the change history. Never merges.
-- Payload keys: settings { student_name, neglect_days, day_ends_at_minutes }, nodes (with depth),
-- sessions, tasks, completions, scores, deadlines, exam_targets, mistakes, in column names.
create or replace function public.restore_user_backup(p_user_id uuid, p_payload jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('streakwise.restore.' || p_user_id::text));

  -- Children first. Completions go with their tasks, exam targets with their deadlines.
  delete from public.change_log where user_id = p_user_id;
  delete from public.mistakes where user_id = p_user_id;
  delete from public.exam_targets where user_id = p_user_id;
  delete from public.scores where user_id = p_user_id;
  delete from public.task_completions where user_id = p_user_id;
  delete from public.tasks where user_id = p_user_id;
  delete from public.sessions where user_id = p_user_id;
  delete from public.deadlines where user_id = p_user_id;
  delete from public.nodes where user_id = p_user_id;

  -- Nodes top-down: the depth trigger reads each node's parent.
  for d in 1..3 loop
    insert into public.nodes (
      id, user_id, parent_id, depth, name, color, sort_order, weekly_target_minutes,
      topic_status, topic_done_at, archived_at, created_at, updated_at
    )
    select
      n.id, p_user_id, n.parent_id, d, n.name, n.color, coalesce(n.sort_order, 0),
      n.weekly_target_minutes, n.topic_status, n.topic_done_at, n.archived_at,
      coalesce(n.created_at, now()), coalesce(n.updated_at, now())
    from jsonb_to_recordset(coalesce(p_payload -> 'nodes', '[]'::jsonb)) as n(
      id uuid, parent_id uuid, depth smallint, name text, color text, sort_order integer,
      weekly_target_minutes integer, topic_status text, topic_done_at timestamptz,
      archived_at timestamptz, created_at timestamptz, updated_at timestamptz
    )
    where n.depth = d;
  end loop;

  insert into public.sessions (id, user_id, node_id, studied_on, minutes, note, source, created_at, updated_at)
  select s.id, p_user_id, s.node_id, s.studied_on, s.minutes, s.note, coalesce(s.source, 'app'),
    coalesce(s.created_at, now()), coalesce(s.updated_at, now())
  from jsonb_to_recordset(coalesce(p_payload -> 'sessions', '[]'::jsonb)) as s(
    id uuid, node_id uuid, studied_on date, minutes integer, note text, source text,
    created_at timestamptz, updated_at timestamptz
  );

  -- One statement, so sub-tasks may come before their parents.
  insert into public.tasks (
    id, user_id, node_id, parent_task_id, title, description, due_on, recurrence, is_scored,
    default_max_score, sort_order, archived_at, created_at, updated_at
  )
  select
    t.id, p_user_id, t.node_id, t.parent_task_id, t.title, t.description, t.due_on,
    coalesce(t.recurrence, 'none'), coalesce(t.is_scored, false), t.default_max_score,
    coalesce(t.sort_order, 0), t.archived_at, coalesce(t.created_at, now()),
    coalesce(t.updated_at, now())
  from jsonb_to_recordset(coalesce(p_payload -> 'tasks', '[]'::jsonb)) as t(
    id uuid, node_id uuid, parent_task_id uuid, title text, description text, due_on date,
    recurrence text, is_scored boolean, default_max_score numeric, sort_order integer,
    archived_at timestamptz, created_at timestamptz, updated_at timestamptz
  );

  insert into public.task_completions
    (id, user_id, task_id, period_start, completed_at, completed_on, note)
  select c.id, p_user_id, c.task_id, c.period_start, c.completed_at, c.completed_on, c.note
  from jsonb_to_recordset(coalesce(p_payload -> 'completions', '[]'::jsonb)) as c(
    id uuid, task_id uuid, period_start date, completed_at timestamptz, completed_on date,
    note text
  );

  insert into public.scores (
    id, user_id, node_id, task_completion_id, kind, title, taken_on, score, max_score, note,
    created_at
  )
  select s.id, p_user_id, s.node_id, s.task_completion_id, s.kind, s.title, s.taken_on, s.score,
    s.max_score, s.note, coalesce(s.created_at, now())
  from jsonb_to_recordset(coalesce(p_payload -> 'scores', '[]'::jsonb)) as s(
    id uuid, node_id uuid, task_completion_id uuid, kind text, title text, taken_on date,
    score numeric, max_score numeric, note text, created_at timestamptz
  );

  insert into public.deadlines (id, user_id, node_id, title, due_on, is_exam, created_at)
  select dl.id, p_user_id, dl.node_id, dl.title, dl.due_on, coalesce(dl.is_exam, false),
    coalesce(dl.created_at, now())
  from jsonb_to_recordset(coalesce(p_payload -> 'deadlines', '[]'::jsonb)) as dl(
    id uuid, node_id uuid, title text, due_on date, is_exam boolean, created_at timestamptz
  );

  insert into public.exam_targets
    (id, user_id, deadline_id, label, target_on, min_percent, created_at, updated_at)
  select e.id, p_user_id, e.deadline_id, e.label, e.target_on, e.min_percent,
    coalesce(e.created_at, now()), coalesce(e.updated_at, now())
  from jsonb_to_recordset(coalesce(p_payload -> 'exam_targets', '[]'::jsonb)) as e(
    id uuid, deadline_id uuid, label text, target_on date, min_percent numeric,
    created_at timestamptz, updated_at timestamptz
  );

  insert into public.mistakes (
    id, user_id, node_id, text, created_on, source, status, step, anchor_on, next_due_on,
    review_count, last_reviewed_on, last_result, learned_on, created_at, updated_at
  )
  select m.id, p_user_id, m.node_id, m.text, m.created_on, coalesce(m.source, 'app'),
    coalesce(m.status, 'open'), coalesce(m.step, 1), m.anchor_on, m.next_due_on,
    coalesce(m.review_count, 0), m.last_reviewed_on, m.last_result, m.learned_on,
    coalesce(m.created_at, now()), coalesce(m.updated_at, now())
  from jsonb_to_recordset(coalesce(p_payload -> 'mistakes', '[]'::jsonb)) as m(
    id uuid, node_id uuid, text text, created_on date, source text, status text, step smallint,
    anchor_on date, next_due_on date, review_count integer, last_reviewed_on date,
    last_result text, learned_on date, created_at timestamptz, updated_at timestamptz
  );

  insert into public.user_settings (user_id, student_name, neglect_days, day_ends_at_minutes)
  values (
    p_user_id,
    coalesce(p_payload -> 'settings' ->> 'student_name', ''),
    coalesce((p_payload -> 'settings' ->> 'neglect_days')::smallint, 3),
    coalesce((p_payload -> 'settings' ->> 'day_ends_at_minutes')::smallint, 0)
  )
  on conflict (user_id) do update set
    student_name = excluded.student_name,
    neglect_days = excluded.neglect_days,
    day_ends_at_minutes = excluded.day_ends_at_minutes;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Access control, as in 0001 and 0003: RLS on, no policies, only service_role.
-- ---------------------------------------------------------------------------------------------

alter table public.exam_targets enable row level security;
alter table public.mistakes enable row level security;
alter table public.change_log enable row level security;

revoke all on public.exam_targets, public.mistakes, public.change_log from anon, authenticated;
grant select, insert, update, delete on public.exam_targets, public.mistakes, public.change_log
  to service_role;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

commit;

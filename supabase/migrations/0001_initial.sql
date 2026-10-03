-- Streakwise: full initial schema (SPEC §B7). Never edit this file after it has been applied;
-- later changes go in new numbered migrations.
--
-- Security model (SPEC D5): the browser never talks to Supabase. Only Netlify Functions, using the
-- secret key (role service_role, which bypasses RLS), read and write. RLS is on for every table with
-- no policies, and the anon/authenticated roles get no privileges at all.

begin;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

create or replace function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- nodes: the structure tree (1 = track, 2 = subtask, 3 = topic)
-- ---------------------------------------------------------------------------------------------

create table public.nodes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.nodes (id) on delete restrict,
  depth smallint not null check (depth between 1 and 3),
  name text not null check (char_length(name) between 1 and 60),
  color text check (color in ('amber', 'blue', 'violet', 'emerald', 'rose', 'cyan', 'orange', 'slate')),
  sort_order integer not null default 0,
  weekly_target_minutes integer check (weekly_target_minutes >= 0),
  topic_status text check (topic_status in ('not_started', 'in_progress', 'done')),
  topic_done_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nodes_not_own_parent check (parent_id is distinct from id),
  constraint nodes_root_is_track check ((parent_id is null) = (depth = 1)),
  constraint nodes_track_fields check (depth = 1 or (color is null and weekly_target_minutes is null)),
  constraint nodes_track_has_color check (depth <> 1 or color is not null),
  constraint nodes_topic_fields check ((depth = 3) = (topic_status is not null)),
  constraint nodes_topic_done_at check (topic_done_at is null or topic_status = 'done')
);

-- Sibling names are unique, case-insensitively; tracks (parent_id null) count as siblings too.
create unique index nodes_sibling_name_key on public.nodes (parent_id, lower(name)) nulls not distinct;
create index nodes_parent_id_idx on public.nodes (parent_id);

-- Depth always follows the parent, so callers can't create a 4th level or a mismatched depth.
create or replace function public.nodes_set_depth() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_depth smallint;
begin
  if tg_op = 'UPDATE' and new.parent_id is not distinct from old.parent_id then
    new.depth := old.depth;
    return new;
  end if;

  -- Moving a node with children would also need its descendants' depths changed (TREE-7, not built).
  if tg_op = 'UPDATE' and exists (select 1 from public.nodes where parent_id = new.id) then
    raise exception 'node_has_children' using errcode = 'P0001';
  end if;

  if new.parent_id is null then
    new.depth := 1;
  else
    select depth into parent_depth from public.nodes where id = new.parent_id;
    if parent_depth is null then
      raise exception 'parent_not_found' using errcode = 'P0002';
    end if;
    if parent_depth >= 3 then
      raise exception 'max_depth' using errcode = 'P0001';
    end if;
    new.depth := parent_depth + 1;
  end if;
  return new;
end;
$$;

create trigger nodes_set_depth before insert or update of parent_id on public.nodes
  for each row execute function public.nodes_set_depth();
create trigger nodes_set_updated_at before update on public.nodes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes (id) on delete restrict,
  studied_on date not null,
  minutes integer not null check (minutes between 1 and 1440),
  note text check (char_length(note) <= 500),
  source text not null default 'app' check (source in ('app', 'claude')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_studied_on_idx on public.sessions (studied_on);
create index sessions_node_id_studied_on_idx on public.sessions (node_id, studied_on);
create trigger sessions_set_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- tasks and completions
-- ---------------------------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes (id) on delete restrict,
  parent_task_id uuid references public.tasks (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 2000),
  due_on date,
  recurrence text not null default 'none' check (recurrence in ('none', 'weekly')),
  is_scored boolean not null default false,
  default_max_score numeric check (default_max_score > 0),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_weekly_has_no_due_date check (recurrence = 'none' or due_on is null),
  constraint tasks_not_own_parent check (parent_task_id is distinct from id)
);

create index tasks_node_id_idx on public.tasks (node_id);
create index tasks_parent_task_id_idx on public.tasks (parent_task_id);
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  -- The week's Monday for weekly tasks; null for one-off tasks.
  period_start date check (period_start is null or extract(isodow from period_start) = 1),
  completed_at timestamptz not null default now(),
  note text check (char_length(note) <= 500)
);

create unique index task_completions_one_off_key on public.task_completions (task_id)
  where period_start is null;
create unique index task_completions_weekly_key on public.task_completions (task_id, period_start)
  where period_start is not null;

-- ---------------------------------------------------------------------------------------------
-- scores, deadlines, shared reports
-- ---------------------------------------------------------------------------------------------

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes (id) on delete restrict,
  task_completion_id uuid references public.task_completions (id) on delete set null,
  kind text not null check (kind in ('past_paper', 'quiz', 'mock_test', 'revision', 'other')),
  title text not null check (char_length(title) between 1 and 200),
  taken_on date not null,
  score numeric not null check (score >= 0),
  max_score numeric not null check (max_score > 0),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint scores_score_within_max check (score <= max_score)
);

create index scores_node_id_taken_on_idx on public.scores (node_id, taken_on);
create index scores_task_completion_id_idx on public.scores (task_completion_id);

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 200),
  due_on date not null,
  created_at timestamptz not null default now()
);

create index deadlines_due_on_idx on public.deadlines (due_on);
create index deadlines_node_id_idx on public.deadlines (node_id);

create table public.shared_reports (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) between 16 and 64),
  snapshot jsonb not null,
  period_label text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

-- ---------------------------------------------------------------------------------------------
-- settings (a single row) and login attempts
-- ---------------------------------------------------------------------------------------------

create table public.settings (
  id boolean primary key default true check (id),
  student_name text not null default '' check (char_length(student_name) <= 80),
  neglect_days smallint not null default 3 check (neglect_days between 1 and 14),
  last_export_at timestamptz,
  last_mcp_call_at timestamptz
);

insert into public.settings (id) values (true);

create table public.login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);

create index login_attempts_ip_hash_attempted_at_idx on public.login_attempts (ip_hash, attempted_at);

-- ---------------------------------------------------------------------------------------------
-- RPC functions for atomic multi-step writes (SPEC §B7)
-- Errors use SQLSTATE P0001 with a short code as the message; P0002 means "not found".
-- ---------------------------------------------------------------------------------------------

-- First-login seed (SPEC §B4). Does nothing and returns false when any node already exists.
-- The payload is built by the core seed service so the server and demo mode share one definition:
-- { "nodes": [{ id, parent_id, name, color, sort_order }], "tasks": [{ id, node_id, title,
--   recurrence, is_scored, default_max_score, sort_order }] }. Nodes must be listed parents first.
create or replace function public.seed_if_empty(p_payload jsonb) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
begin
  -- Two first logins at once must not both seed.
  perform pg_advisory_xact_lock(hashtext('streakwise.seed'));
  if exists (select 1 from public.nodes) then
    return false;
  end if;

  for item in select * from jsonb_array_elements(p_payload -> 'nodes') loop
    insert into public.nodes (id, parent_id, depth, name, color, sort_order, topic_status)
    values (
      (item ->> 'id')::uuid,
      (item ->> 'parent_id')::uuid,
      1, -- recomputed by the nodes_set_depth trigger
      item ->> 'name',
      item ->> 'color',
      coalesce((item ->> 'sort_order')::integer, 0),
      item ->> 'topic_status'
    );
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload -> 'tasks', '[]'::jsonb)) loop
    insert into public.tasks (id, node_id, title, recurrence, is_scored, default_max_score, sort_order)
    values (
      (item ->> 'id')::uuid,
      (item ->> 'node_id')::uuid,
      item ->> 'title',
      item ->> 'recurrence',
      coalesce((item ->> 'is_scored')::boolean, false),
      (item ->> 'default_max_score')::numeric,
      coalesce((item ->> 'sort_order')::integer, 0)
    );
  end loop;

  return true;
end;
$$;

-- TREE-3: delete a node and all its descendants, only when nothing in the subtree has sessions,
-- tasks, scores, or deadlines. Returns the number of nodes deleted.
create or replace function public.delete_node_tree(p_node_id uuid) returns integer
language plpgsql
set search_path = ''
as $$
declare
  ids uuid[];
begin
  -- Lock the node so a concurrent insert of a child can't slip in between the check and the delete.
  perform 1 from public.nodes where id = p_node_id for update;
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
    or exists (select 1 from public.deadlines where node_id = any (ids)) then
    raise exception 'node_in_use' using errcode = 'P0001';
  end if;

  -- Deepest first, because parent_id is ON DELETE RESTRICT.
  for d in reverse 3..1 loop
    delete from public.nodes where id = any (ids) and depth = d;
  end loop;

  return cardinality(ids);
end;
$$;

-- Complete a task, optionally recording a score linked to the completion. Returns the completion id.
-- p_score: null, or { node_id, kind, title, taken_on, score, max_score, note }.
create or replace function public.complete_task(
  p_task_id uuid,
  p_period_start date,
  p_completed_at timestamptz,
  p_note text,
  p_score jsonb
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  completion_id uuid;
begin
  if not exists (select 1 from public.tasks where id = p_task_id) then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  begin
    insert into public.task_completions (task_id, period_start, completed_at, note)
    values (p_task_id, p_period_start, p_completed_at, p_note)
    returning id into completion_id;
  exception when unique_violation then
    raise exception 'already_completed' using errcode = 'P0001';
  end;

  if p_score is not null then
    insert into public.scores (node_id, task_completion_id, kind, title, taken_on, score, max_score, note)
    values (
      (p_score ->> 'node_id')::uuid,
      completion_id,
      p_score ->> 'kind',
      p_score ->> 'title',
      (p_score ->> 'taken_on')::date,
      (p_score ->> 'score')::numeric,
      (p_score ->> 'max_score')::numeric,
      p_score ->> 'note'
    );
  end if;

  return completion_id;
end;
$$;

-- Undo a completion and delete any score recorded with it (the FK alone would only unlink it).
create or replace function public.uncomplete_task(p_completion_id uuid) returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.task_completions where id = p_completion_id) then
    raise exception 'completion_not_found' using errcode = 'P0002';
  end if;
  delete from public.scores where task_completion_id = p_completion_id;
  delete from public.task_completions where id = p_completion_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Access control: RLS on, no policies; only service_role (the server's secret key) has access.
-- ---------------------------------------------------------------------------------------------

alter table public.nodes enable row level security;
alter table public.sessions enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.scores enable row level security;
alter table public.deadlines enable row level security;
alter table public.shared_reports enable row level security;
alter table public.settings enable row level security;
alter table public.login_attempts enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Objects created by later migrations (run as this same role) start with no access for the API roles.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

commit;

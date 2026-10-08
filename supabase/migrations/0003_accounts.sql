-- 0003: accounts (SPEC D17, ACCT-1–12). Every data row gets an owner (`user_id` → auth.users).
--
-- Backward compatible on purpose: there is one database for every environment (D15), so the code
-- deployed before accounts keeps working after this runs. Old rows keep user_id null ("unclaimed")
-- until the owner claims them (ACCT-7); the old single-user `settings` table and the old RPC
-- signatures stay. Migration 0004 (after release R3) removes them and makes user_id required.

begin;

-- ---------------------------------------------------------------------------------------------
-- Owner columns. ON DELETE CASCADE: deleting an account (ACCT-9) deletes all of its data.
-- ---------------------------------------------------------------------------------------------

alter table public.nodes add column user_id uuid references auth.users (id) on delete cascade;
alter table public.sessions add column user_id uuid references auth.users (id) on delete cascade;
alter table public.tasks add column user_id uuid references auth.users (id) on delete cascade;
alter table public.task_completions add column user_id uuid references auth.users (id) on delete cascade;
alter table public.scores add column user_id uuid references auth.users (id) on delete cascade;
alter table public.deadlines add column user_id uuid references auth.users (id) on delete cascade;
alter table public.shared_reports add column user_id uuid references auth.users (id) on delete cascade;

create index nodes_user_id_idx on public.nodes (user_id);
create index sessions_user_id_studied_on_idx on public.sessions (user_id, studied_on);
create index tasks_user_id_idx on public.tasks (user_id);
create index task_completions_user_id_idx on public.task_completions (user_id);
create index scores_user_id_idx on public.scores (user_id);
create index deadlines_user_id_idx on public.deadlines (user_id);
create index shared_reports_user_id_idx on public.shared_reports (user_id);

-- Sibling names are unique per user. Unclaimed rows (null user) form one group, as before.
drop index public.nodes_sibling_name_key;
create unique index nodes_sibling_name_key on public.nodes (user_id, parent_id, lower(name))
  nulls not distinct;

-- ---------------------------------------------------------------------------------------------
-- Same-owner rules (ACCT-5): a row may only point at rows of the same user. Composite foreign keys
-- do this in the database itself. They are skipped while user_id is null (MATCH SIMPLE), which is
-- why the single-column keys stay too.
--
-- The single-column keys become NO ACTION instead of RESTRICT, so deleting an account (one
-- cascading statement) isn't blocked halfway; NO ACTION still refuses any delete that would leave
-- a dangling reference once the statement ends.
-- ---------------------------------------------------------------------------------------------

alter table public.nodes add constraint nodes_id_user_id_key unique (id, user_id);
alter table public.tasks add constraint tasks_id_user_id_key unique (id, user_id);
alter table public.task_completions
  add constraint task_completions_id_user_id_key unique (id, user_id);

alter table public.nodes drop constraint nodes_parent_id_fkey;
alter table public.nodes
  add constraint nodes_parent_id_fkey foreign key (parent_id) references public.nodes (id),
  add constraint nodes_parent_same_user foreign key (parent_id, user_id)
    references public.nodes (id, user_id);

alter table public.sessions drop constraint sessions_node_id_fkey;
alter table public.sessions
  add constraint sessions_node_id_fkey foreign key (node_id) references public.nodes (id),
  add constraint sessions_node_same_user foreign key (node_id, user_id)
    references public.nodes (id, user_id);

alter table public.tasks drop constraint tasks_node_id_fkey;
alter table public.tasks
  add constraint tasks_node_id_fkey foreign key (node_id) references public.nodes (id),
  add constraint tasks_node_same_user foreign key (node_id, user_id)
    references public.nodes (id, user_id),
  add constraint tasks_parent_same_user foreign key (parent_task_id, user_id)
    references public.tasks (id, user_id) on delete cascade;

alter table public.task_completions
  add constraint task_completions_task_same_user foreign key (task_id, user_id)
    references public.tasks (id, user_id) on delete cascade;

alter table public.scores drop constraint scores_node_id_fkey;
alter table public.scores
  add constraint scores_node_id_fkey foreign key (node_id) references public.nodes (id),
  add constraint scores_node_same_user foreign key (node_id, user_id)
    references public.nodes (id, user_id),
  -- Only the completion link is cleared when the completion goes; the owner stays.
  add constraint scores_completion_same_user foreign key (task_completion_id, user_id)
    references public.task_completions (id, user_id) on delete set null (task_completion_id);

alter table public.deadlines drop constraint deadlines_node_id_fkey;
alter table public.deadlines
  add constraint deadlines_node_id_fkey foreign key (node_id) references public.nodes (id),
  add constraint deadlines_node_same_user foreign key (node_id, user_id)
    references public.nodes (id, user_id);

-- ---------------------------------------------------------------------------------------------
-- Per-user settings (replaces the single-row `settings` table after 0004). The Claude link token is
-- stored only as a SHA-256 hash (ACCT-8).
-- ---------------------------------------------------------------------------------------------

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  student_name text not null default '' check (char_length(student_name) <= 80),
  neglect_days smallint not null default 3 check (neglect_days between 1 and 14),
  last_export_at timestamptz,
  last_mcp_call_at timestamptz,
  mcp_token_hash text unique check (char_length(mcp_token_hash) = 64),
  created_at timestamptz not null default now()
);

-- ACCT-10: sign-up and reset requests per hashed IP (login failures stay in login_attempts).
create table public.auth_requests (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  kind text not null check (kind in ('signup', 'reset')),
  requested_at timestamptz not null default now()
);

create index auth_requests_ip_hash_kind_requested_at_idx
  on public.auth_requests (ip_hash, kind, requested_at);

-- ---------------------------------------------------------------------------------------------
-- RPC functions, per user. New names, so the deployed code's functions keep working until 0004.
-- Errors follow 0001: SQLSTATE P0001 with a short code; P0002 means "not found".
-- ---------------------------------------------------------------------------------------------

-- ACCT-6: the §B4 seed for one user. Same payload as seed_if_empty (0001).
create or replace function public.seed_user_if_empty(p_user_id uuid, p_payload jsonb)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
begin
  -- Two first logins of the same user at once must not both seed.
  perform pg_advisory_xact_lock(hashtext('streakwise.seed.' || p_user_id::text));

  insert into public.user_settings (user_id) values (p_user_id) on conflict (user_id) do nothing;

  if exists (select 1 from public.nodes where user_id = p_user_id) then
    return false;
  end if;

  for item in select * from jsonb_array_elements(p_payload -> 'nodes') loop
    insert into public.nodes (id, user_id, parent_id, depth, name, color, sort_order, topic_status)
    values (
      (item ->> 'id')::uuid,
      p_user_id,
      (item ->> 'parent_id')::uuid,
      1, -- recomputed by the nodes_set_depth trigger
      item ->> 'name',
      item ->> 'color',
      coalesce((item ->> 'sort_order')::integer, 0),
      item ->> 'topic_status'
    );
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_payload -> 'tasks', '[]'::jsonb)) loop
    insert into public.tasks (id, user_id, node_id, title, recurrence, is_scored, default_max_score, sort_order)
    values (
      (item ->> 'id')::uuid,
      p_user_id,
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

-- TREE-3 for one user's node (see delete_node_tree in 0001).
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
    or exists (select 1 from public.deadlines where node_id = any (ids)) then
    raise exception 'node_in_use' using errcode = 'P0001';
  end if;

  for d in reverse 3..1 loop
    delete from public.nodes where id = any (ids) and depth = d;
  end loop;

  return cardinality(ids);
end;
$$;

-- TASK-6 for one user (see complete_task in 0001). Returns the completion id.
create or replace function public.complete_user_task(
  p_user_id uuid,
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
  if not exists (select 1 from public.tasks where id = p_task_id and user_id = p_user_id) then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  begin
    insert into public.task_completions (user_id, task_id, period_start, completed_at, note)
    values (p_user_id, p_task_id, p_period_start, p_completed_at, p_note)
    returning id into completion_id;
  exception when unique_violation then
    raise exception 'already_completed' using errcode = 'P0001';
  end;

  if p_score is not null then
    insert into public.scores (user_id, node_id, task_completion_id, kind, title, taken_on, score, max_score, note)
    values (
      p_user_id,
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

create or replace function public.uncomplete_user_task(p_user_id uuid, p_completion_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.task_completions where id = p_completion_id and user_id = p_user_id
  ) then
    raise exception 'completion_not_found' using errcode = 'P0002';
  end if;
  delete from public.scores where task_completion_id = p_completion_id;
  delete from public.task_completions where id = p_completion_id;
end;
$$;

-- Whether any data from before accounts is still unclaimed (ACCT-7).
create or replace function public.has_unclaimed_data() returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.nodes where user_id is null);
$$;

-- ACCT-7: moves every unclaimed row and the old settings to one user, atomically. Refuses if that
-- user already has a structure, so two trees never mix. Returns the number of nodes claimed.
create or replace function public.claim_unclaimed_data(p_user_id uuid) returns integer
language plpgsql
set search_path = ''
as $$
declare
  claimed integer;
begin
  perform pg_advisory_xact_lock(hashtext('streakwise.claim'));

  if not exists (select 1 from public.nodes where user_id is null) then
    raise exception 'nothing_to_claim' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.nodes where user_id = p_user_id) then
    raise exception 'account_has_data' using errcode = 'P0001';
  end if;

  -- Order matters: the same-user keys check each row's parent, so nodes go top-down, and they go
  -- before the rows that point at them.
  for d in 1..3 loop
    update public.nodes set user_id = p_user_id where user_id is null and depth = d;
  end loop;
  select count(*) into claimed from public.nodes where user_id = p_user_id;

  -- Parent tasks before sub-tasks, for the same reason.
  loop
    update public.tasks t set user_id = p_user_id
    where t.user_id is null
      and (t.parent_task_id is null
        or exists (select 1 from public.tasks p where p.id = t.parent_task_id and p.user_id = p_user_id));
    exit when not found;
  end loop;

  update public.task_completions set user_id = p_user_id where user_id is null;
  update public.sessions set user_id = p_user_id where user_id is null;
  update public.scores set user_id = p_user_id where user_id is null;
  update public.deadlines set user_id = p_user_id where user_id is null;
  update public.shared_reports set user_id = p_user_id where user_id is null;

  insert into public.user_settings (user_id, student_name, neglect_days, last_export_at, last_mcp_call_at)
  select p_user_id, s.student_name, s.neglect_days, s.last_export_at, s.last_mcp_call_at
  from public.settings s where s.id
  on conflict (user_id) do update set
    student_name = excluded.student_name,
    neglect_days = excluded.neglect_days,
    last_export_at = excluded.last_export_at,
    last_mcp_call_at = excluded.last_mcp_call_at;

  return claimed;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Access control, as in 0001: RLS on, no policies, only service_role.
-- ---------------------------------------------------------------------------------------------

alter table public.user_settings enable row level security;
alter table public.auth_requests enable row level security;

revoke all on public.user_settings, public.auth_requests from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select, insert, update, delete on public.user_settings, public.auth_requests to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

commit;

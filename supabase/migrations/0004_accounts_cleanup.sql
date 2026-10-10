-- 0004: removes what was left from before accounts (SPEC D17), now that the owner has claimed the
-- old data (after release R3). Every data row must have an owner from here on.
--
-- Safe to run while the R3 code is live: that code only uses the per-user functions from 0003. The
-- only exception is the old-passcode form on the login page, which can't claim anything any more.

begin;

-- Stop here, changing nothing, if any row still has no owner (the old data was never claimed).
do $$
begin
  if exists (select 1 from public.nodes where user_id is null)
    or exists (select 1 from public.sessions where user_id is null)
    or exists (select 1 from public.tasks where user_id is null)
    or exists (select 1 from public.task_completions where user_id is null)
    or exists (select 1 from public.scores where user_id is null)
    or exists (select 1 from public.deadlines where user_id is null)
    or exists (select 1 from public.shared_reports where user_id is null) then
    raise exception 'unclaimed_data: claim the data from before accounts first, then run 0004';
  end if;
end;
$$;

-- With user_id required, the same-user keys from 0003 now check every row (MATCH SIMPLE only
-- skipped rows with a null user_id).
alter table public.nodes alter column user_id set not null;
alter table public.sessions alter column user_id set not null;
alter table public.tasks alter column user_id set not null;
alter table public.task_completions alter column user_id set not null;
alter table public.scores alter column user_id set not null;
alter table public.deadlines alter column user_id set not null;
alter table public.shared_reports alter column user_id set not null;

-- The single-user claim (ACCT-7) and the old RPC signatures from 0001.
drop function public.claim_unclaimed_data(uuid);
drop function public.has_unclaimed_data();
drop function public.seed_if_empty(jsonb);
drop function public.delete_node_tree(uuid);
drop function public.complete_task(uuid, date, timestamptz, text, jsonb);
drop function public.uncomplete_task(uuid);

-- Replaced by user_settings; claim_unclaimed_data copied its values there.
drop table public.settings;

commit;

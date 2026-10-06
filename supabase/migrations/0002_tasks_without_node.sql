-- 0002: tasks can belong to no track ("Other"), for to-dos outside the study structure.
-- Scored tasks still need a node, because the score they record must belong to one (scores.node_id
-- is required and the charts group scores by subtask).

alter table public.tasks alter column node_id drop not null;

alter table public.tasks
  add constraint tasks_scored_needs_node check (node_id is not null or not is_scored);

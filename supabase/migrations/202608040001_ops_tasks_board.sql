-- Turn ops_tasks into a per-project board: backlog / in progress / done,
-- instead of the old flat open/done/dropped. The "Today" page is being
-- replaced by a project-first todo board, so status needs a middle state
-- and tasks need a manual order within their column.

do $$
declare target record;
begin
  for target in
    select con.conname as constraint_name
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public' and cls.relname = 'ops_tasks'
      -- Match only the enum check (mentions 'open'), not the separate
      -- (status = 'done') = (completed_at is not null) pairing constraint.
      and con.contype = 'c' and pg_get_constraintdef(con.oid) like '%''open''%'
  loop
    execute format('alter table public.ops_tasks drop constraint %I', target.constraint_name);
  end loop;
end $$;

update public.ops_tasks set status = 'backlog' where status = 'open';

alter table public.ops_tasks alter column status set default 'backlog';
alter table public.ops_tasks add constraint ops_tasks_status_check
  check (status in ('backlog', 'in_progress', 'done', 'dropped'));

-- Manual ordering within a (project_id, status) lane. Backfilled from the
-- existing due-date order so cards don't all land in an arbitrary order the
-- first time the board renders.
alter table public.ops_tasks add column sort_order integer not null default 0;

with ranked as (
  select id, row_number() over (
    partition by project_id, status
    order by due_on nulls last, created_at
  ) - 1 as position
  from public.ops_tasks
)
update public.ops_tasks
set sort_order = ranked.position
from ranked
where ranked.id = ops_tasks.id;

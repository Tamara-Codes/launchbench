-- Founder ops cockpit: the workspace home becomes "what do I do right now".
--
-- Both tables are workspace-wide on purpose. Every other surface in the app
-- scopes to the current project via the lb_current_project cookie; the cockpit
-- is the one place that deliberately looks across all projects at once, so
-- product_id is nullable (company-level obligations like taxes belong to no
-- project). Projects are products -- there is no separate project table.
--
-- These are user-authored records, so they follow the products/territories
-- pattern: full grants to authenticated, writes through RLS from server actions,
-- no service-role involvement.

create table public.ops_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid,
  title text not null,
  kind text not null default 'meeting' check (kind in ('meeting', 'deadline', 'tax', 'admin', 'focus')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text not null default '',
  -- Free text on purpose. Quarterly taxes are four rows a year, not an RRULE
  -- engine; the agent reads this note to answer "when is the next one".
  recurrence text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete set null
);
create index ops_events_when_idx on public.ops_events(workspace_id, starts_at);

create table public.ops_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid,
  title text not null,
  status text not null default 'open' check (status in ('open', 'done', 'dropped')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  -- A plain date, not a timestamp: "due Thursday" has no meaningful time of day,
  -- and a timestamp would drag timezone questions into every comparison.
  due_on date,
  notes text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'done') = (completed_at is not null)),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete set null
);
-- Serves both cockpit reads: the dated agenda and the "what am I ignoring" list.
create index ops_tasks_open_idx on public.ops_tasks(workspace_id, status, due_on);

-- Keep updated_at honest without every caller remembering to set it.
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ops_events_touch before update on public.ops_events
  for each row execute function public.touch_updated_at();
create trigger ops_tasks_touch before update on public.ops_tasks
  for each row execute function public.touch_updated_at();

alter table public.ops_events enable row level security;
alter table public.ops_tasks enable row level security;

grant select, insert, update, delete on public.ops_events to authenticated;
grant select, insert, update, delete on public.ops_tasks to authenticated;

create policy ops_events_member_select on public.ops_events for select to authenticated using (public.is_workspace_member(workspace_id));
create policy ops_events_admin_write on public.ops_events for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy ops_tasks_member_select on public.ops_tasks for select to authenticated using (public.is_workspace_member(workspace_id));
create policy ops_tasks_admin_write on public.ops_tasks for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

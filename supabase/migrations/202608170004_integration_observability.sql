create table if not exists public.integration_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  territory_id uuid references public.territories(id) on delete cascade,
  job_id uuid references public.agent_jobs(id) on delete cascade,
  provider text not null,
  operation text not null,
  status text not null check (status in ('success', 'failure')),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  request_id text not null default '',
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists integration_events_workspace_created_idx
  on public.integration_events(workspace_id, created_at desc);
create index if not exists integration_events_project_created_idx
  on public.integration_events(project_id, created_at desc)
  where project_id is not null;
create index if not exists integration_events_job_created_idx
  on public.integration_events(job_id, created_at)
  where job_id is not null;

alter table public.integration_events enable row level security;
grant select on public.integration_events to authenticated;

create policy integration_events_member_select on public.integration_events
  for select to authenticated
  using (public.is_workspace_member(workspace_id));


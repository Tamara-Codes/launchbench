-- Durable execution support. agent_jobs is the application outbox and source
-- of truth; a workflow runner may be replaced without changing user data.

alter table public.agent_jobs
  add column attempt_count integer not null default 0 check (attempt_count >= 0),
  add column max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  add column not_before timestamptz not null default now(),
  add column lease_token uuid,
  add column lease_expires_at timestamptz,
  add column workflow_run_id text not null default '',
  add column cancel_requested boolean not null default false;

create index agent_jobs_ready_idx on public.agent_jobs(status, not_before, created_at)
  where status in ('queued', 'running');

create table public.agent_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.agent_jobs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null check (event_type in ('queued', 'started', 'progress', 'retrying', 'completed', 'failed', 'cancelled')),
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index agent_job_events_job_idx on public.agent_job_events(job_id, created_at);
create index agent_job_events_workspace_idx on public.agent_job_events(workspace_id, created_at desc);

create or replace function public.record_agent_job_queued()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.agent_job_events (job_id, workspace_id, event_type, message)
  values (new.id, new.workspace_id, 'queued', 'Job queued.');
  return new;
end;
$$;
create trigger agent_jobs_record_queued after insert on public.agent_jobs
for each row execute function public.record_agent_job_queued();

alter table public.agent_job_events enable row level security;
grant select on public.agent_job_events to authenticated;
create policy agent_job_events_member_select on public.agent_job_events
  for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.cancel_agent_job(job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cancelled public.agent_jobs;
begin
  update public.agent_jobs
  set cancel_requested = true, status = 'cancelled', completed_at = now(),
      lease_token = null, lease_expires_at = null
  where id = job_id
    and workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    and status in ('queued', 'running')
  returning * into cancelled;
  if found then
    insert into public.agent_job_events (job_id, workspace_id, event_type, message)
    values (cancelled.id, cancelled.workspace_id, 'cancelled', 'Cancelled by workspace member.');
  end if;
end;
$$;

-- Only a trusted worker may lease jobs. SKIP LOCKED permits horizontally scaled
-- workers without two workers processing the same job at once.
create or replace function public.lease_next_agent_job(worker_token uuid, lease_seconds integer default 300)
returns setof public.agent_jobs language plpgsql security definer set search_path = public as $$
declare leased public.agent_jobs;
begin
  if lease_seconds < 30 or lease_seconds > 3600 then raise exception 'Invalid lease duration'; end if;
  with candidate as (
    select id from public.agent_jobs
    where status = 'queued'
      and not_before <= now()
      and cancel_requested = false
    order by created_at
    for update skip locked
    limit 1
  )
  update public.agent_jobs job
  set status = 'running',
      started_at = coalesce(started_at, now()),
      attempt_count = attempt_count + 1,
      lease_token = worker_token,
      lease_expires_at = now() + make_interval(secs => lease_seconds)
  from candidate
  where job.id = candidate.id
  returning job.* into leased;
  if found then
    insert into public.agent_job_events (job_id, workspace_id, event_type, message)
    values (leased.id, leased.workspace_id, 'started', 'Worker started job attempt ' || leased.attempt_count);
    return next leased;
  end if;
end;
$$;

create or replace function public.claim_agent_job(job_id uuid, worker_token uuid, lease_seconds integer default 300)
returns public.agent_jobs language plpgsql security definer set search_path = public as $$
declare claimed public.agent_jobs;
begin
  if lease_seconds < 30 or lease_seconds > 3600 then raise exception 'Invalid lease duration'; end if;
  update public.agent_jobs
  set status = 'running',
      started_at = coalesce(started_at, now()),
      attempt_count = attempt_count + 1,
      lease_token = worker_token,
      lease_expires_at = now() + make_interval(secs => lease_seconds)
  where id = job_id and status = 'queued' and not_before <= now() and cancel_requested = false
  returning * into claimed;
  if not found then return null; end if;
  insert into public.agent_job_events (job_id, workspace_id, event_type, message)
  values (claimed.id, claimed.workspace_id, 'started', 'Workflow started job attempt ' || claimed.attempt_count);
  return claimed;
end;
$$;

-- A worker can requeue an expired lease. It must provide the job lease token
-- for all normal completion/progress writes in application code.
create or replace function public.requeue_expired_agent_jobs()
returns integer language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  with expired as (
    update public.agent_jobs
    set status = 'queued', lease_token = null, lease_expires_at = null,
        not_before = now() + interval '30 seconds'
    where status = 'running' and lease_expires_at < now() and cancel_requested = false
    returning id, workspace_id
  ), events as (
    insert into public.agent_job_events (job_id, workspace_id, event_type, message)
    select id, workspace_id, 'retrying', 'Worker lease expired; job requeued.' from expired
  ) select count(*) into changed from expired;
  return changed;
end;
$$;

revoke all on function public.lease_next_agent_job(uuid, integer), public.claim_agent_job(uuid, uuid, integer), public.requeue_expired_agent_jobs() from public, anon, authenticated;
grant execute on function public.lease_next_agent_job(uuid, integer), public.claim_agent_job(uuid, uuid, integer), public.requeue_expired_agent_jobs() to service_role;

-- A lost workflow lease may be recovered, but retries must remain bounded.

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
  where id = job_id and status = 'queued' and not_before <= now()
    and cancel_requested = false and attempt_count < max_attempts
  returning * into claimed;
  if not found then return null; end if;
  insert into public.agent_job_events (job_id, workspace_id, event_type, message)
  values (claimed.id, claimed.workspace_id, 'started', 'Workflow started job attempt ' || claimed.attempt_count);
  return claimed;
end;
$$;

create or replace function public.requeue_expired_agent_jobs()
returns integer language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  with retryable as (
    update public.agent_jobs
    set status = 'queued', lease_token = null, lease_expires_at = null, workflow_run_id = '',
        not_before = now() + interval '30 seconds'
    where status = 'running' and lease_expires_at < now()
      and cancel_requested = false and attempt_count < max_attempts
    returning id, workspace_id
  ), exhausted as (
    update public.agent_jobs
    set status = 'failed', error = 'Maximum job attempts exhausted after worker lease expiry.',
        completed_at = now(), lease_token = null, lease_expires_at = null
    where status = 'running' and lease_expires_at < now()
      and cancel_requested = false and attempt_count >= max_attempts
    returning id, workspace_id
  ), retry_events as (
    insert into public.agent_job_events (job_id, workspace_id, event_type, message)
    select id, workspace_id, 'retrying', 'Worker lease expired; job requeued.' from retryable
  ), fail_events as (
    insert into public.agent_job_events (job_id, workspace_id, event_type, message)
    select id, workspace_id, 'failed', 'Maximum job attempts exhausted.' from exhausted
  ) select (select count(*) from retryable) + (select count(*) from exhausted) into changed;
  return changed;
end;
$$;

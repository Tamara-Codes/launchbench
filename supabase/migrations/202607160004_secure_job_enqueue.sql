-- Security hardening: agent execution spends shared provider credits. Queue
-- requests must therefore be authorized and throttled in one atomic database
-- operation, rather than trusting a browser or server-action check alone.

revoke insert on public.agent_jobs from authenticated;
drop policy if exists agent_jobs_member_insert on public.agent_jobs;

create or replace function public.request_agent_job(
  requested_product_id uuid,
  requested_kind text,
  requested_input jsonb,
  requested_idempotency_key text
)
returns public.agent_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
  existing_job public.agent_jobs;
  created_job public.agent_jobs;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if requested_kind not in ('lead_search', 'content_generation', 'gmail_sync', 'send_email', 'prepare_follow_ups') then
    raise exception 'Invalid job kind';
  end if;
  if requested_idempotency_key is null or char_length(trim(requested_idempotency_key)) not between 8 and 160 then
    raise exception 'Invalid idempotency key';
  end if;
  if pg_column_size(coalesce(requested_input, '{}'::jsonb)) > 65536 then
    raise exception 'Job input is too large';
  end if;

  select workspace_id into target_workspace_id
  from public.workspace_members
  where user_id = auth.uid() and role in ('owner', 'admin')
  order by created_at asc
  limit 1;
  if target_workspace_id is null then raise exception 'Workspace admin access required'; end if;

  if requested_product_id is not null and not exists (
    select 1 from public.products
    where id = requested_product_id and workspace_id = target_workspace_id
  ) then
    raise exception 'Product not found in this workspace';
  end if;

  -- Serialize requests per workspace so concurrent tabs cannot bypass the
  -- active-job limit or create duplicate idempotency rows.
  perform pg_advisory_xact_lock(hashtextextended(target_workspace_id::text, 0));
  select * into existing_job from public.agent_jobs
  where workspace_id = target_workspace_id and idempotency_key = trim(requested_idempotency_key);
  if found then return existing_job; end if;

  if (select count(*) from public.agent_jobs
      where workspace_id = target_workspace_id and status in ('queued', 'running')) >= 3 then
    raise exception 'Too many active jobs. Wait for an existing job to finish.';
  end if;

  insert into public.agent_jobs (workspace_id, product_id, kind, idempotency_key, input, requested_by)
  values (target_workspace_id, requested_product_id, requested_kind, trim(requested_idempotency_key),
          coalesce(requested_input, '{}'::jsonb), auth.uid())
  returning * into created_job;
  return created_job;
end;
$$;

revoke all on function public.request_agent_job(uuid, text, jsonb, text) from public, anon;
grant execute on function public.request_agent_job(uuid, text, jsonb, text) to authenticated;

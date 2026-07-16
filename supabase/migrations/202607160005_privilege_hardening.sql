-- Privilege hardening for direct Supabase API access. RLS must remain safe
-- even when a customer calls PostgREST directly instead of using the UI.

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

grant execute on function public.is_workspace_owner(uuid) to authenticated;

-- Admins can manage products and agent work, but may not change who owns a
-- workspace or promote themselves. Membership changes are owner-only until a
-- dedicated invitation flow adds finer-grained, audited rules.
drop policy if exists members_admin_manage on public.workspace_members;
create policy members_owner_manage on public.workspace_members
  for all to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- Connection IDs and connected email addresses are configuration data; normal
-- members do not need access to them.
drop policy if exists integration_connections_member_select on public.integration_connections;
create policy integration_connections_admin_select on public.integration_connections
  for select to authenticated using (public.is_workspace_admin(workspace_id));

-- Cancelling a job affects shared provider spend and workflow state, so it is
-- an admin operation just like starting a job.
create or replace function public.cancel_agent_job(job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.agent_jobs
  set cancel_requested = true, status = 'cancelled', completed_at = now()
  where id = job_id
    and public.is_workspace_admin(workspace_id)
    and status in ('queued', 'running');
end;
$$;

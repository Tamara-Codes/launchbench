-- nos-astra SaaS foundation
--
-- Every customer-owned record has a workspace_id. RLS is the enforcement
-- boundary: application code must never be the only protection against a
-- cross-tenant read or write.

create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.connection_status as enum ('pending', 'active', 'revoked', 'error');
create type public.job_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members(user_id, workspace_id);

-- Kept separately from products: this is workspace-wide sending identity and
-- defaults, not sales copy for a particular offer.
create table public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  sender_name text not null default '',
  sender_company text not null default '',
  sender_email text not null default '',
  sender_signature text not null default '',
  daily_lead_target integer not null default 10 check (daily_lead_target between 1 and 100),
  follow_up_settings jsonb not null default '{"firstFollowUpDays":4,"finalFollowUpDays":7,"maxFollowUps":2}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  short_description text not null default '',
  full_description text not null default '',
  target_customer text not null default '',
  core_benefit text not null default '',
  price_text text not null default '',
  demo_url text not null default '',
  website_url text not null default '',
  email_generation_context text not null default '',
  brand_voice text not null default '',
  visual_style text not null default '',
  color_notes text not null default '',
  social_media_notes text not null default '',
  preferred_cta text not null default '',
  preferred_language text not null default 'hr',
  content_dos text not null default '',
  content_donts text not null default '',
  ideal_business_types jsonb not null default '[]'::jsonb,
  fit_signals jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  search_guidance text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, name)
);
create index products_workspace_idx on public.products(workspace_id, active, name);

-- Sales templates are product/project assets. A product can have exactly one
-- template per language + sequence step.
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null,
  name text not null,
  language text not null default 'hr',
  sequence_step text not null check (sequence_step in ('initial', 'first_follow_up', 'final_follow_up')),
  subject text not null,
  body text not null,
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete cascade,
  unique (product_id, language, sequence_step)
);
create index email_templates_workspace_product_idx on public.email_templates(workspace_id, product_id);

create table public.territories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null,
  town text not null,
  country text not null default 'Croatia',
  included_settlements jsonb not null default '[]'::jsonb,
  excluded_settlements jsonb not null default '[]'::jsonb,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete cascade,
  unique (workspace_id, product_id, town, country)
);
create index territories_workspace_product_idx on public.territories(workspace_id, product_id, active);

-- Composio's connection identifier is not a credential, but it is still
-- tenant-sensitive data. The OAuth tokens remain with Composio.
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('gmail')),
  composio_connection_id text not null unique,
  connected_email text not null default '',
  status public.connection_status not null default 'pending',
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

-- This is the product-level source of truth for a durable executor such as
-- Vercel Workflows. The executor receives an ID, not customer data or secrets.
create table public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid,
  kind text not null check (kind in ('lead_search', 'content_generation', 'gmail_sync', 'send_email', 'prepare_follow_ups')),
  status public.job_status not null default 'queued',
  idempotency_key text not null,
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text not null default '',
  requested_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete set null (product_id),
  unique (workspace_id, idempotency_key)
);
create index agent_jobs_workspace_status_idx on public.agent_jobs(workspace_id, status, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger workspace_settings_set_updated_at before update on public.workspace_settings for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger email_templates_set_updated_at before update on public.email_templates for each row execute function public.set_updated_at();
create trigger territories_set_updated_at before update on public.territories for each row execute function public.set_updated_at();
create trigger integration_connections_set_updated_at before update on public.integration_connections for each row execute function public.set_updated_at();
create trigger agent_jobs_set_updated_at before update on public.agent_jobs for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Security-definer helpers avoid recursive RLS policies on workspace_members.
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- Workspace creation is atomic: users cannot create an orphaned workspace or
-- assign themselves arbitrary roles through direct table inserts.
create or replace function public.create_workspace(workspace_name text, workspace_slug text)
returns public.workspaces language plpgsql security definer set search_path = public as $$
declare created public.workspaces;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if workspace_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Invalid workspace slug'; end if;
  insert into public.workspaces (name, slug, created_by)
  values (trim(workspace_name), workspace_slug, auth.uid()) returning * into created;
  insert into public.workspace_members (workspace_id, user_id, role) values (created.id, auth.uid(), 'owner');
  insert into public.workspace_settings (workspace_id) values (created.id);
  return created;
end;
$$;

create or replace function public.cancel_agent_job(job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.agent_jobs
  set status = 'cancelled', completed_at = now()
  where id = job_id
    and workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
    and status in ('queued', 'running');
end;
$$;

grant execute on function public.is_workspace_member(uuid), public.is_workspace_admin(uuid), public.create_workspace(text, text), public.cancel_agent_job(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.products enable row level security;
alter table public.email_templates enable row level security;
alter table public.territories enable row level security;
alter table public.integration_connections enable row level security;
alter table public.agent_jobs enable row level security;

-- Table grants are deliberately narrow; RLS below determines which rows may be
-- touched. The service_role bypasses RLS and is reserved for verified workers.
grant select, update on public.profiles to authenticated;
grant select, update on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select, update on public.workspace_settings to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.email_templates to authenticated;
grant select, insert, update, delete on public.territories to authenticated;
grant select on public.integration_connections to authenticated;
grant select, insert on public.agent_jobs to authenticated;

create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy workspaces_member_select on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_admin_update on public.workspaces for update to authenticated using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));
create policy members_member_select on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy members_admin_manage on public.workspace_members for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

create policy workspace_settings_member_select on public.workspace_settings for select to authenticated using (public.is_workspace_member(workspace_id));
create policy workspace_settings_admin_update on public.workspace_settings for update to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

create policy products_member_select on public.products for select to authenticated using (public.is_workspace_member(workspace_id));
create policy products_admin_write on public.products for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy email_templates_member_select on public.email_templates for select to authenticated using (public.is_workspace_member(workspace_id));
create policy email_templates_admin_write on public.email_templates for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy territories_member_select on public.territories for select to authenticated using (public.is_workspace_member(workspace_id));
create policy territories_admin_write on public.territories for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy integration_connections_member_select on public.integration_connections for select to authenticated using (public.is_workspace_member(workspace_id));
create policy agent_jobs_member_select on public.agent_jobs for select to authenticated using (public.is_workspace_member(workspace_id));
create policy agent_jobs_member_insert on public.agent_jobs for insert to authenticated with check (public.is_workspace_member(workspace_id) and requested_by = auth.uid());

-- Customer files are private. Store objects under <workspace_id>/<product_id>/...
insert into storage.buckets (id, name, public) values ('workspace-media', 'workspace-media', false)
on conflict (id) do nothing;
create policy workspace_media_member_read on storage.objects for select to authenticated using (
  bucket_id = 'workspace-media' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);
create policy workspace_media_member_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'workspace-media' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);
create policy workspace_media_member_update on storage.objects for update to authenticated using (
  bucket_id = 'workspace-media' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
) with check (
  bucket_id = 'workspace-media' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);
create policy workspace_media_member_delete on storage.objects for delete to authenticated using (
  bucket_id = 'workspace-media' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);

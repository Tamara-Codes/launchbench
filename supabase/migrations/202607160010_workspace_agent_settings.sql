create table public.workspace_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slug text not null check (slug in ('sales-agent', 'content-agent')),
  name text not null,
  description text not null default '',
  avatar_color text not null default 'emerald' check (avatar_color in ('emerald', 'blue', 'violet', 'rose', 'amber', 'cyan')),
  enabled boolean not null default true,
  model text not null default 'gemini-3.5-flash',
  temperature numeric not null default 0.5 check (temperature between 0 and 1),
  system_prompt text not null default '',
  task_prompt_template text not null default '',
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);
create trigger workspace_agents_set_updated_at before update on public.workspace_agents for each row execute function public.set_updated_at();
alter table public.workspace_agents enable row level security;
grant select, insert, update on public.workspace_agents to authenticated;
create policy workspace_agents_member_select on public.workspace_agents for select to authenticated using (public.is_workspace_member(workspace_id));
create policy workspace_agents_admin_write on public.workspace_agents for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
insert into public.workspace_agents (workspace_id, slug, name, description, system_prompt, task_prompt_template)
select id, 'sales-agent', 'Sales Agent', 'Researches qualified prospects inside your selected territory.', 'You are Launchbench''s Sales Agent. Use verified public evidence only.', 'Research businesses in {{territory}} for {{product_name}}.' from public.workspaces
on conflict (workspace_id, slug) do nothing;
insert into public.workspace_agents (workspace_id, slug, name, description, system_prompt, task_prompt_template)
select id, 'content-agent', 'Content Agent', 'Creates product-aware social media content.', 'You are Launchbench''s Content Agent. Preserve the product''s voice and verified facts.', 'Create {{content_type}} content for {{product_name}}.' from public.workspaces
on conflict (workspace_id, slug) do nothing;

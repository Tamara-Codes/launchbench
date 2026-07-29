-- The cockpit's chat and its memory.
--
-- Three tables for three different lifetimes, which is the whole design:
--   ops_messages   — the transcript. Grows forever, read in a recent window.
--   ops_chat_state — the rolling summary of everything older than that window.
--   ops_facts      — durable knowledge. Small, and loaded in full every turn.
--
-- There is deliberately no vector column and no embedding. At one operator's
-- scale ops_facts is a few hundred rows, which fits in the prompt whole;
-- retrieval exists to solve "too big to fit", a problem this does not have.

create table public.ops_messages (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null default '',
  -- The model's requested tool calls, and the results we fed back. Kept so the
  -- UI can render what the agent did and so a turn can be replayed for debugging.
  tool_calls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
-- Every read is "the newest N for this workspace".
create index ops_messages_recent_idx on public.ops_messages(workspace_id, id desc);

create table public.ops_chat_state (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  -- Prose summary of the conversation older than the verbatim window.
  summary text not null default '',
  -- Everything up to and including this message is represented by `summary`,
  -- so summarising is incremental rather than re-reading the whole history.
  summarized_through_id bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table public.ops_facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid,
  -- A stable handle the agent reuses, so restating something updates the fact
  -- instead of adding a near-duplicate beside it.
  slug text not null,
  kind text not null default 'context' check (kind in ('context', 'preference', 'decision', 'person', 'constraint', 'reference')),
  body text not null,
  -- Where it came from, for trust: the agent inferred it, or she stated it.
  source text not null default 'agent' check (source in ('agent', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug),
  foreign key (product_id, workspace_id) references public.products(id, workspace_id) on delete set null
);
create index ops_facts_workspace_idx on public.ops_facts(workspace_id, kind);

create trigger ops_facts_touch before update on public.ops_facts
  for each row execute function public.touch_updated_at();
create trigger ops_chat_state_touch before update on public.ops_chat_state
  for each row execute function public.touch_updated_at();

alter table public.ops_messages enable row level security;
alter table public.ops_chat_state enable row level security;
alter table public.ops_facts enable row level security;

grant select, insert, delete on public.ops_messages to authenticated;
grant select, insert, update on public.ops_chat_state to authenticated;
grant select, insert, update, delete on public.ops_facts to authenticated;

create policy ops_messages_member_select on public.ops_messages for select to authenticated using (public.is_workspace_member(workspace_id));
create policy ops_messages_admin_write on public.ops_messages for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy ops_chat_state_member_select on public.ops_chat_state for select to authenticated using (public.is_workspace_member(workspace_id));
create policy ops_chat_state_admin_write on public.ops_chat_state for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy ops_facts_member_select on public.ops_facts for select to authenticated using (public.is_workspace_member(workspace_id));
create policy ops_facts_admin_write on public.ops_facts for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

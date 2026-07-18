alter table public.workspace_agents
  add column avatar_color text not null default 'emerald'
  check (avatar_color in ('emerald', 'blue', 'violet', 'rose', 'amber', 'cyan'));

update public.workspace_agents
set avatar_color = case slug
  when 'sales-agent' then 'blue'
  when 'content-agent' then 'rose'
  else 'emerald'
end;

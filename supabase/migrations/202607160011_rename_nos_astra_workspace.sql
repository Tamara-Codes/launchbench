-- Rebrand existing workspace data without changing stable workspace slugs.
update public.workspaces
set name = 'LaunchBench'
where lower(trim(name)) = 'nos astra';

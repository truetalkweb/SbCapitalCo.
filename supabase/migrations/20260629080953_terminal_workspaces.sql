create table if not exists public.terminal_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.terminal_workspaces enable row level security;

revoke all on table public.terminal_workspaces from anon;
grant select, insert, update, delete on table public.terminal_workspaces to authenticated;

drop policy if exists "workspace_select_own" on public.terminal_workspaces;
create policy "workspace_select_own"
on public.terminal_workspaces for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "workspace_insert_own" on public.terminal_workspaces;
create policy "workspace_insert_own"
on public.terminal_workspaces for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "workspace_update_own" on public.terminal_workspaces;
create policy "workspace_update_own"
on public.terminal_workspaces for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "workspace_delete_own" on public.terminal_workspaces;
create policy "workspace_delete_own"
on public.terminal_workspaces for delete
to authenticated
using ((select auth.uid()) = user_id);

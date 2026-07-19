-- Public-launch ownership, entitlement, and workspace concurrency hardening.

create table if not exists public.terminal_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb
    constraint terminal_workspaces_data_object_check
      check (jsonb_typeof(data) = 'object'),
  schema_version integer not null default 1
    constraint terminal_workspaces_schema_version_check check (schema_version > 0),
  revision bigint not null default 1
    constraint terminal_workspaces_revision_check check (revision > 0),
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.terminal_workspaces
  add column if not exists schema_version integer not null default 1,
  add column if not exists revision bigint not null default 1,
  add column if not exists client_updated_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.terminal_workspaces'::regclass
      and conname = 'terminal_workspaces_data_object_check'
  ) then
    alter table public.terminal_workspaces
      add constraint terminal_workspaces_data_object_check
      check (jsonb_typeof(data) = 'object') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.terminal_workspaces'::regclass
      and conname = 'terminal_workspaces_data_size_check'
  ) then
    alter table public.terminal_workspaces
      add constraint terminal_workspaces_data_size_check
      check (pg_column_size(data) <= 2097152) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.terminal_workspaces'::regclass
      and conname = 'terminal_workspaces_schema_version_check'
  ) then
    alter table public.terminal_workspaces
      add constraint terminal_workspaces_schema_version_check
      check (schema_version > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.terminal_workspaces'::regclass
      and conname = 'terminal_workspaces_revision_check'
  ) then
    alter table public.terminal_workspaces
      add constraint terminal_workspaces_revision_check
      check (revision > 0) not valid;
  end if;
end
$$;

alter table public.terminal_workspaces
  validate constraint terminal_workspaces_data_object_check,
  validate constraint terminal_workspaces_data_size_check,
  validate constraint terminal_workspaces_schema_version_check,
  validate constraint terminal_workspaces_revision_check;

alter table public.terminal_workspaces enable row level security;

revoke all on table public.terminal_workspaces from anon, authenticated;
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

create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free', 'pro', 'premium', 'admin')),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'cancelled', 'manual')),
  features jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_entitlements enable row level security;

revoke all on table public.user_entitlements from anon, authenticated;
grant select on table public.user_entitlements to authenticated;

drop policy if exists "Users can read their own entitlement" on public.user_entitlements;
drop policy if exists "entitlement_select_own" on public.user_entitlements;
create policy "entitlement_select_own"
on public.user_entitlements for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.set_workspace_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' then
    new.created_at = now();
    new.revision = 1;
  else
    new.created_at = old.created_at;
    new.revision = old.revision + 1;
  end if;
  return new;
end;
$$;

revoke all on function public.set_workspace_audit_fields() from public, anon, authenticated;

drop trigger if exists terminal_workspaces_set_audit_fields
on public.terminal_workspaces;
create trigger terminal_workspaces_set_audit_fields
before insert or update on public.terminal_workspaces
for each row execute function public.set_workspace_audit_fields();

create or replace function public.set_entitlement_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' then
    new.created_at = now();
  else
    new.created_at = old.created_at;
  end if;
  return new;
end;
$$;

revoke all on function public.set_entitlement_audit_fields() from public, anon, authenticated;

drop trigger if exists user_entitlements_set_audit_fields
on public.user_entitlements;
create trigger user_entitlements_set_audit_fields
before insert or update on public.user_entitlements
for each row execute function public.set_entitlement_audit_fields();

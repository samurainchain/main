-- Mirror cloud sync: one row per journal record, private to its owner.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

create table if not exists public.journal_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null check (collection in ('accounts', 'trades', 'mistakes', 'setups', 'rules', 'reviews', 'profile')),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  -- When the record changed on the device that changed it; decides conflicts.
  updated_at timestamptz not null,
  -- When the server stored this version; lets devices pull only what's new.
  server_updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

create index if not exists journal_records_pull on public.journal_records (user_id, server_updated_at);

-- Each user sees and changes only their own rows.
alter table public.journal_records enable row level security;

drop policy if exists "Users manage their own journal" on public.journal_records;
create policy "Users manage their own journal" on public.journal_records
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Saves a batch of changes, keeping whichever version of each record is newer.
create or replace function public.push_journal_records(records jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.journal_records as existing (user_id, collection, id, data, deleted, updated_at, server_updated_at)
  select auth.uid(), r.collection, r.id, r.data, r.deleted, r.updated_at, now()
  from jsonb_to_recordset(records) as r(collection text, id text, data jsonb, deleted boolean, updated_at timestamptz)
  on conflict (user_id, collection, id) do update
    set data = excluded.data,
        deleted = excluded.deleted,
        updated_at = excluded.updated_at,
        server_updated_at = now()
    where existing.updated_at < excluded.updated_at;
$$;

revoke all on function public.push_journal_records(jsonb) from public, anon;
grant execute on function public.push_journal_records(jsonb) to authenticated;

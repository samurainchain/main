-- Mirror cloud sync: one row per journal record, private to its owner.
-- Run in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to run again
-- after updates: every statement either creates what's missing or replaces it.

create table if not exists public.journal_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  -- When the record changed on the device that changed it; decides conflicts.
  updated_at timestamptz not null,
  -- When the server stored this version; lets devices pull only what's new.
  server_updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

-- Kinds of records the app syncs. Re-created on every run, so it also updates older setups.
alter table public.journal_records drop constraint if exists journal_records_collection_check;
alter table public.journal_records add constraint journal_records_collection_check
  check (collection in ('accounts', 'trades', 'mistakes', 'setups', 'rules', 'reviews', 'images', 'profile'));

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

-- Trade screenshots: a private bucket, files under "<user id>/<image id>.jpg".
insert into storage.buckets (id, name, public)
values ('trade-images', 'trade-images', false)
on conflict (id) do nothing;

drop policy if exists "Users manage their own screenshots" on storage.objects;
create policy "Users manage their own screenshots" on storage.objects
  for all to authenticated
  using (bucket_id = 'trade-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'trade-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Billing: one row per user with their Stripe customer and subscription status. Written only by
-- the billing functions (service role); each user can read their own row to see Pro.
create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  status text not null default 'none',
  plan text,
  price_id text,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  event_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_customer on public.billing_subscriptions (stripe_customer_id);

alter table public.billing_subscriptions enable row level security;

drop policy if exists "Users read their own subscription" on public.billing_subscriptions;
create policy "Users read their own subscription"
  on public.billing_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

-- Feedback from the app (ideas, problems). Anyone can send a message, signed in or not; nobody
-- can read the table through the API, only the owner in the dashboard (Table Editor → feedback).
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null default 'idea' check (kind in ('idea', 'problem', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  email text check (email is null or char_length(email) <= 320),
  locale text check (locale is null or char_length(locale) <= 10),
  page text check (page is null or char_length(page) <= 64)
);

alter table public.feedback enable row level security;

grant insert on public.feedback to anon, authenticated;

drop policy if exists "Anyone can send feedback" on public.feedback;
create policy "Anyone can send feedback"
  on public.feedback for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- Crypto payments (NOWPayments): one row per invoice. Written only by the crypto functions
-- (service role); no policies, so the API can't read or change orders.
create table if not exists public.crypto_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('monthly', 'annual')),
  price_amount numeric(12, 2) not null check (price_amount > 0),
  price_currency text not null default 'usd',
  invoice_id text,
  payment_id text,
  status text not null default 'created',
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crypto_orders_user on public.crypto_orders (user_id);

alter table public.crypto_orders enable row level security;

-- Pro bought as a pass: until when it lasts. Each user reads their own row.
create table if not exists public.pro_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pro_until timestamptz not null,
  source text not null default 'crypto',
  updated_at timestamptz not null default now()
);

alter table public.pro_access enable row level security;

drop policy if exists "Users read their own Pro access" on public.pro_access;
create policy "Users read their own Pro access"
  on public.pro_access for select to authenticated
  using ((select auth.uid()) = user_id);

-- Applies a paid order once: marks it applied and adds its month or year to the user's Pro,
-- counting from the current end when Pro is still running. Returns the new end, or null when the
-- order was already applied. Only the service role may call it.
create or replace function public.apply_crypto_order(p_order uuid, p_payment text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  paid public.crypto_orders;
  period interval;
  until timestamptz;
begin
  update public.crypto_orders
    set applied_at = now(), status = 'paid', payment_id = p_payment, updated_at = now()
    where id = p_order and applied_at is null
    returning * into paid;
  if not found then
    return null;
  end if;
  period := case when paid.plan = 'annual' then interval '1 year' else interval '1 month' end;
  insert into public.pro_access (user_id, pro_until, source)
    values (paid.user_id, now() + period, 'crypto')
    on conflict (user_id) do update
      set pro_until = greatest(public.pro_access.pro_until, now()) + period, updated_at = now()
    returning pro_until into until;
  return until;
end;
$$;

revoke all on function public.apply_crypto_order(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_crypto_order(uuid, text) to service_role;

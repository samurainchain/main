-- Run once in the Supabase SQL editor (2026-10-28): the partner program.
-- Safe to run again. The same statements are in web/supabase/schema.sql.

-- Partner program (SPEC section 8). A partner shares tiltless.xyz/?ref=<code>; a trader who signs
-- up within 60 days of opening the link (kept in their browser) is theirs, and the partner earns
-- 30% of that trader's Pro payments for 12 months from the first one. A commission becomes
-- payable 14 days after the payment; the owner pays out in USDT (TRC20) by hand once a month from
-- $30 and marks the rows paid (queries in docs/partners.md). Partners see counts and sums only,
-- never who signed up.
create table if not exists public.partners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{6,16}$'),
  payout_wallet text check (payout_wallet is null or payout_wallet ~ '^T[1-9A-HJ-NP-Za-km-z]{33}$'),
  created_at timestamptz not null default now()
);

alter table public.partners enable row level security;

drop policy if exists "Partners read their own row" on public.partners;
create policy "Partners read their own row"
  on public.partners for select to authenticated
  using ((select auth.uid()) = user_id);

-- Who referred whom. No policies: read only through partner_stats().
create table if not exists public.referrals (
  referred_user_id uuid primary key references auth.users (id) on delete cascade,
  partner_user_id uuid not null references public.partners (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referred_user_id <> partner_user_id)
);

create index if not exists referrals_partner on public.referrals (partner_user_id);

alter table public.referrals enable row level security;

-- One commission per paid order. No policies: written by apply_crypto_order, read through
-- partner_stats(), marked paid by the owner.
create table if not exists public.partner_commissions (
  order_id uuid primary key references public.crypto_orders (id) on delete cascade,
  partner_user_id uuid not null references public.partners (user_id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  available_at timestamptz not null,
  paid_out_at timestamptz,
  payout_tx text,
  created_at timestamptz not null default now()
);

create index if not exists partner_commissions_partner on public.partner_commissions (partner_user_id);

alter table public.partner_commissions enable row level security;

-- Makes the signed-in user a partner (once) and returns their row with a new random code.
create or replace function public.become_partner()
returns public.partners
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  mine public.partners;
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  loop
    select * into mine from public.partners where user_id = me;
    if found then
      return mine;
    end if;
    begin
      insert into public.partners (user_id, code)
        values (me, substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
        returning * into mine;
      return mine;
    exception when unique_violation then
      -- The code was taken, or another tab just made this user a partner: look again.
      null;
    end;
  end loop;
end;
$$;

-- Sets or clears the partner's USDT (TRC20) payout address; the table checks its format.
create or replace function public.set_payout_wallet(p_wallet text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.partners set payout_wallet = nullif(trim(p_wallet), '') where user_id = auth.uid();
$$;

-- Ties the signed-in user to the partner whose code they arrived with. Only for a new account
-- (created in the last 7 days) that has never paid, never for oneself, and only once. Returns
-- 'ok' or why not. The 60-day window is checked in the browser, which saw the link.
create or replace function public.claim_referral(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  partner uuid;
  joined timestamptz;
begin
  if me is null then
    return 'not_signed_in';
  end if;
  if exists (select 1 from public.referrals where referred_user_id = me) then
    return 'already_referred';
  end if;
  select user_id into partner from public.partners where code = lower(trim(p_code));
  if partner is null then
    return 'unknown_code';
  end if;
  if partner = me then
    return 'self';
  end if;
  select created_at into joined from auth.users where id = me;
  if joined < now() - interval '7 days' then
    return 'existing_account';
  end if;
  if exists (select 1 from public.crypto_orders where user_id = me and applied_at is not null) then
    return 'already_paying';
  end if;
  insert into public.referrals (referred_user_id, partner_user_id) values (me, partner)
    on conflict (referred_user_id) do nothing;
  return 'ok';
end;
$$;

-- The signed-in partner's link and totals, or null for someone who isn't a partner.
create or replace function public.partner_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'code', p.code,
    'payout_wallet', p.payout_wallet,
    'referred', (select count(*) from public.referrals r where r.partner_user_id = p.user_id),
    'paying', (
      select count(distinct o.user_id) from public.partner_commissions c
        join public.crypto_orders o on o.id = c.order_id
        where c.partner_user_id = p.user_id
    ),
    'pending', (
      select coalesce(sum(amount), 0) from public.partner_commissions c
        where c.partner_user_id = p.user_id and c.paid_out_at is null and c.available_at > now()
    ),
    'available', (
      select coalesce(sum(amount), 0) from public.partner_commissions c
        where c.partner_user_id = p.user_id and c.paid_out_at is null and c.available_at <= now()
    ),
    'paid', (
      select coalesce(sum(amount), 0) from public.partner_commissions c
        where c.partner_user_id = p.user_id and c.paid_out_at is not null
    )
  )
  from public.partners p
  where p.user_id = auth.uid();
$$;

revoke all on function public.become_partner() from public, anon;
revoke all on function public.set_payout_wallet(text) from public, anon;
revoke all on function public.claim_referral(text) from public, anon;
revoke all on function public.partner_stats() from public, anon;
grant execute on function public.become_partner() to authenticated;
grant execute on function public.set_payout_wallet(text) to authenticated;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.partner_stats() to authenticated;

-- Applies a paid order once: marks it applied and adds its month or year to the user's Pro,
-- counting from the current end when Pro is still running, and credits the referring partner.
-- Returns the new end, or null when the order was already applied. Only the service role may call it.
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
  partner uuid;
  first_paid timestamptz;
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
  -- Partner program: 30% of payments in the 12 months from the trader's first one, payable after 14 days.
  select r.partner_user_id into partner from public.referrals r where r.referred_user_id = paid.user_id;
  if partner is not null then
    select min(applied_at) into first_paid from public.crypto_orders where user_id = paid.user_id and applied_at is not null;
    if paid.applied_at < first_paid + interval '12 months' then
      insert into public.partner_commissions (order_id, partner_user_id, amount, available_at)
        values (paid.id, partner, round(paid.price_amount * 0.30, 2), now() + interval '14 days')
        on conflict (order_id) do nothing;
    end if;
  end if;
  return until;
end;
$$;

revoke all on function public.apply_crypto_order(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_crypto_order(uuid, text) to service_role;

-- Day check-ins sync (from 2026-10-28, if not run yet): allow the 'checkins' collection.
alter table public.journal_records drop constraint if exists journal_records_collection_check;
alter table public.journal_records add constraint journal_records_collection_check
  check (collection in ('accounts','trades','mistakes','setups','rules','reviews','checkins','images','profile'));

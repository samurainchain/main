-- Run once in the Supabase SQL editor (2026-10-28): the 7-day Pro trial for new accounts, and
-- purchases marked as such. Run 2026-10-28-partners.sql first. Safe to run again.
-- Before Pro goes on sale nothing is locked, so trials started now simply run out unused.

-- Pro trial (SPEC section 8): every new account gets 7 days of Pro from sign-up. A purchase
-- during the trial adds its month or year on top of the trial's end.
create or replace function public.start_pro_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pro_access (user_id, pro_until, source)
    values (new.id, now() + interval '7 days', 'trial')
    on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.start_pro_trial() from public, anon, authenticated;

drop trigger if exists start_pro_trial on auth.users;
create trigger start_pro_trial
  after insert on auth.users
  for each row execute function public.start_pro_trial();

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
      set pro_until = greatest(public.pro_access.pro_until, now()) + period, source = 'crypto', updated_at = now()
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

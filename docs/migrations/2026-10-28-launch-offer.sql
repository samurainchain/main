-- Run once in the Supabase SQL editor (2026-10-28): the launch offer. Accounts created through
-- November 30, 2026 get 30 days of Pro instead of 7; after that the trial is 7 days again by
-- itself. Only changes the trigger's function; safe to run again.

-- Pro trial (SPEC section 8): every new account gets 7 days of Pro from sign-up; accounts made
-- through November 30, 2026 (before noon UTC on December 1) get 30 days, the launch offer
-- (LAUNCH_OFFER_ENDS in src/core/entitlements.ts). A purchase during the trial adds its month or
-- year on top of the trial's end.
create or replace function public.start_pro_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pro_access (user_id, pro_until, source)
    values (new.id, now() + case when now() < timestamptz '2026-12-01 12:00:00+00' then interval '30 days' else interval '7 days' end, 'trial')
    on conflict (user_id) do nothing;
  return new;
end;
$$;


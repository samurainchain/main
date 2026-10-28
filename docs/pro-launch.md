# Launching Pro on the web

Pro is built and switched off (`PRO_ON_SALE = false` in `web/src/app/billing.ts`). Until then
every feature is open to everyone. Free and Pro are split in `web/src/core/entitlements.ts`
(SPEC section 8).

## Before

1. A real test payment through NOWPayments goes through (CLAUDE.md, crypto payments): check the
   payout wallet is USDT TRC20, pay the monthly pass, see Pro extended on the account.
2. In Supabase, run `docs/migrations/2026-10-28-partners.sql` and `docs/migrations/2026-10-28-pro-trial.sql`.
3. Read `web/public/refund/index.html` and the Pro section of the Terms; change anything that
   doesn't match how you want to handle refunds.

## Launch day

1. Gift everyone who already has an account 30 days of Pro, so nothing locks without warning.
   Run in the SQL editor:

   ```sql
   insert into public.pro_access (user_id, pro_until, source)
   select id, now() + interval '30 days', 'gift' from auth.users
   on conflict (user_id) do update
     set pro_until = greatest(public.pro_access.pro_until, now() + interval '30 days'),
         source = case when public.pro_access.pro_until > now() + interval '30 days' then public.pro_access.source else 'gift' end,
         updated_at = now();
   ```

2. Set `PRO_ON_SALE = true`, push, and check the site: Profile shows "Tiltless Pro", locked
   features lead to the Pro page, and paying works.
3. Tell the users (Instagram, TikTok, the feedback replies): the journal stays free, Pro adds
   the deep analytics, and everyone with an account has a month of Pro as a thank-you.

People who used the site without an account have nothing to gift to: when they sign in they
get the 7-day trial like any new account.

## Trying it before launch

Open the site with `?pro=preview` (for example `https://tiltless.xyz/?pro=preview#/analytics`):
that tab behaves as if Pro were on sale, locks included.

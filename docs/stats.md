# Who uses Tiltless

The app has no analytics on purpose (Privacy), so only people who sign in show up here: a
journal kept in the browser without an account is invisible to us. Everything below is read in
the Supabase dashboard.

- **Authentication → Users**: every account, with its email, when it was created and when it last
  signed in.
- **SQL Editor**: the queries below (run as the project owner; they read `auth.users`).

## Overview

```sql
select
  (select count(*) from auth.users) as accounts,
  (select count(*) from auth.users where created_at > now() - interval '7 days') as new_7_days,
  (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days') as signed_in_7_days,
  (select count(distinct user_id) from public.journal_records where server_updated_at > now() - interval '7 days') as synced_7_days,
  (select count(*) from public.pro_access where pro_until > now() and source = 'trial') as pro_trial,
  (select count(*) from public.pro_access where pro_until > now() and source = 'gift') as pro_gift,
  (select count(*) from public.pro_access where pro_until > now() and source = 'crypto') as pro_paid,
  (select count(*) from public.crypto_orders where applied_at is not null) as paid_orders,
  (select coalesce(sum(price_amount), 0) from public.crypto_orders where applied_at is not null) as revenue_usd;
```

`synced_7_days` counts accounts whose journal changed in the last week: the closest thing to
"active" without analytics.

## Sign-ups per day

```sql
select created_at::date as day, count(*) as sign_ups
from auth.users
group by 1
order by 1 desc
limit 30;
```

## Every account

```sql
select
  u.email,
  u.created_at::date as signed_up,
  u.last_sign_in_at::date as last_sign_in,
  u.raw_user_meta_data ->> 'locale' as language,
  p.source as pro,
  p.pro_until::date as pro_until,
  (select count(*) from public.journal_records r
    where r.user_id = u.id and r.collection = 'trades' and not r.deleted) as trades,
  (select pa.code from public.referrals ref join public.partners pa on pa.user_id = ref.partner_user_id
    where ref.referred_user_id = u.id) as referred_by
from auth.users u
left join public.pro_access p on p.user_id = u.id
order by u.created_at desc;
```

## Payments

```sql
select o.created_at, u.email, o.plan, o.price_amount, o.status, o.applied_at
from public.crypto_orders o
join auth.users u on u.id = o.user_id
order by o.created_at desc;
```

Partner payouts have their own queries in docs/partners.md.

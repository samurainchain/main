# Partner program: running payouts

Terms (SPEC section 8, Terms page): 30% of each Pro payment from a referred trader for 12 months
from their first payment; payable 14 days after the payment; paid once a month in USDT (TRC20)
from $30. Commissions are written by `apply_crypto_order` when a crypto order is paid.

Run these in the Supabase SQL editor once a month.

## Who to pay

```sql
select p.code, p.payout_wallet, sum(c.amount) as amount_usd, count(*) as payments
from public.partner_commissions c
join public.partners p on p.user_id = c.partner_user_id
where c.paid_out_at is null and c.available_at <= now()
group by p.user_id, p.code, p.payout_wallet
having sum(c.amount) >= 30
order by amount_usd desc;
```

Partners without a `payout_wallet` wait until they add one in the app.

## After sending a payout

Replace the code and the transaction hash:

```sql
update public.partner_commissions
set paid_out_at = now(), payout_tx = '<tx hash>'
where partner_user_id = (select user_id from public.partners where code = '<code>')
  and paid_out_at is null
  and available_at <= now();
```

## Refunds and fraud

Delete the commission row of a refunded or fraudulent order before it is paid:

```sql
delete from public.partner_commissions where order_id = '<crypto order id>' and paid_out_at is null;
```

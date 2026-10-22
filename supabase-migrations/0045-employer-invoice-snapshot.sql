-- 0045: immutable invoice snapshot, partial-refund columns, gap-free invoice numbers.
-- Additive: every column is nullable. Deploy the code first; it tolerates this
-- migration being unapplied (old behaviour: number assigned by the column default).

-- Frozen supplier / buyer / tax data written at fulfilment (see server-handlers/_unlock-tax.ts).
alter table public.employer_unlock_payments add column if not exists invoice_snapshot jsonb;

-- Cumulative amount refunded (paise) when a payment is only partly refunded.
-- refunded_at stays reserved for a full refund; other code treats it as one.
alter table public.employer_unlock_payments add column if not exists partial_refund_paise integer;
alter table public.employer_unlock_payments add column if not exists partial_refund_at timestamptz;

-- The nextval() default burned a number on every insert that hit the unique
-- index on razorpay_payment_id (webhook/verify races) and numbered rows that
-- never became a tax invoice. Numbers are now assigned by the RPC below, only
-- for a fulfilled order with cash > 0. Historical gaps are not backfilled.
alter table public.employer_unlock_payments alter column invoice_no drop default;

create or replace function public.assign_unlock_invoice_no(p_payment_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no text;
begin
  update public.employer_unlock_payments
     set invoice_no = 'HSX-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.employer_invoice_seq')::text, 6, '0')
   where razorpay_payment_id = p_payment_id
     and invoice_no is null
     and amount > 0
  returning invoice_no into v_no;

  if v_no is null then
    -- already numbered (idempotent replay) or not eligible
    select invoice_no into v_no
      from public.employer_unlock_payments
     where razorpay_payment_id = p_payment_id and amount > 0;
  end if;
  return v_no;
end;
$$;

revoke all on function public.assign_unlock_invoice_no(text) from public, anon, authenticated;
grant execute on function public.assign_unlock_invoice_no(text) to service_role;

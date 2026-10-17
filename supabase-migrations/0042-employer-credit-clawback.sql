-- 0042: credit clawback + per-order credit bookkeeping.
--
-- * employer_unlock_orders.credit_applied_paise: the credit the order was
--   priced with, so fulfilment can verify the credit was really spent.
-- * employer_unlock_orders.refund_due_paise: cash share of candidates that
--   could not be unlocked after payment (returned automatically as credit).
-- * employer_credit_ledger gains two kinds:
--     `clawback`   (negative) credit reversed because the Razorpay payment it
--                  came from was refunded or lost in a dispute;
--     `conversion` (positive) a captured payment that could not fulfil its
--                  order (late payment on an expired order, credit no longer
--                  available) kept as credit instead.
--   and the reasons payment_refunded / payment_disputed / late_payment.
--   Balance can go negative when a clawback lands after the credit was spent;
--   spending is blocked until it is positive again (documented debt).
--
-- Optional: every handler tolerates this migration being unapplied.
alter table public.employer_unlock_orders
  add column if not exists credit_applied_paise integer,
  add column if not exists refund_due_paise integer;

alter table public.employer_credit_ledger drop constraint if exists employer_credit_ledger_kind_check;
alter table public.employer_credit_ledger add constraint employer_credit_ledger_kind_check
  check (kind in ('refund', 'spend', 'release', 'clawback', 'conversion'));

alter table public.employer_credit_ledger drop constraint if exists employer_credit_ledger_reason_check;
alter table public.employer_credit_ledger add constraint employer_credit_ledger_reason_check
  check (reason in ('declined', 'withdrew', 'blocked', 'no_response', 'unavailable', 'payment_refunded', 'payment_disputed', 'late_payment'));

alter table public.employer_credit_ledger drop constraint if exists employer_credit_ledger_sign;
alter table public.employer_credit_ledger add constraint employer_credit_ledger_sign check (
  (kind in ('spend', 'clawback') and amount < 0) or (kind not in ('spend', 'clawback') and amount > 0)
);

-- A clawback / conversion is keyed by a synthetic order_ref
-- (`clawback:<order>:<match>`, `<order>:convert`), applied at most once.
create unique index if not exists uq_employer_credit_adjustment_ref
  on public.employer_credit_ledger (order_ref) where kind in ('clawback', 'conversion');

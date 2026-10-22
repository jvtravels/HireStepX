-- 0052: a repurchased match can be refunded as credit again.
-- uq_employer_credit_refund_match (0041) allowed ONE refund row per match forever, so a match that was
-- refunded, unlocked again with a new order and then declined again could never be credited a second time.
-- The key becomes (match_id, order_ref): one refund per match per order. Additive and idempotent. The new
-- index is created first, so the match is never unprotected; the old one is dropped after. The application
-- already writes order_ref on every refund row and behaves as before while the old index is still in place.
create unique index if not exists uq_employer_credit_refund_match_order
  on public.employer_credit_ledger (match_id, order_ref) where kind = 'refund';

-- NULL order_refs are distinct in a unique index, so keep one-per-match for any legacy refund row without an order.
create unique index if not exists uq_employer_credit_refund_match_noorder
  on public.employer_credit_ledger (match_id) where kind = 'refund' and order_ref is null;

drop index if exists public.uq_employer_credit_refund_match;

-- 0041: employer credit ledger (refund-as-credit for unreachable paid candidates).
--
-- One signed row per movement; an employer's balance is the sum of `amount`
-- (paise). Positive: `refund` (a paid candidate could not be reached) and
-- `release` (credit returned because the order it was spent on never completed).
-- Negative: `spend` (credit applied to an unlock order).
--
-- Optional: until this is applied the handlers treat every balance as 0 and
-- skip refunds, so the code can ship first. Service-role only (no client policy).
create table if not exists public.employer_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  amount integer not null check (amount <> 0),
  kind text not null check (kind in ('refund', 'spend', 'release')),
  reason text check (reason in ('declined', 'withdrew', 'blocked', 'no_response', 'unavailable')),
  match_id uuid,
  order_ref text,
  created_at timestamptz not null default now(),
  constraint employer_credit_ledger_sign check (
    (kind = 'spend' and amount < 0) or (kind <> 'spend' and amount > 0)
  )
);

create index if not exists idx_employer_credit_employer on public.employer_credit_ledger (employer_id, created_at desc);
-- A match is refunded as credit at most once, however many triggers fire.
create unique index if not exists uq_employer_credit_refund_match
  on public.employer_credit_ledger (match_id) where kind = 'refund';
-- An order spends credit once and releases it once.
create unique index if not exists uq_employer_credit_spend_order
  on public.employer_credit_ledger (order_ref) where kind = 'spend';
create unique index if not exists uq_employer_credit_release_order
  on public.employer_credit_ledger (order_ref) where kind = 'release';

alter table public.employer_credit_ledger enable row level security; -- service-role only

-- Atomically spends up to p_amount of credit for one order. Returns the amount
-- actually spent: p_amount, or 0 when the balance no longer covers it. Locks
-- the employer row so two concurrent unlocks cannot both spend the same credit,
-- and is idempotent per p_order_ref.
create or replace function public.spend_employer_credit(p_employer uuid, p_amount integer, p_order_ref text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing integer;
  v_balance integer;
begin
  if p_amount is null or p_amount <= 0 then
    return 0;
  end if;

  perform 1 from public.employers where id = p_employer for update;

  select -amount into v_existing
    from public.employer_credit_ledger
   where kind = 'spend' and order_ref = p_order_ref;
  if found then
    return v_existing;
  end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.employer_credit_ledger
   where employer_id = p_employer;
  if v_balance < p_amount then
    return 0;
  end if;

  insert into public.employer_credit_ledger (employer_id, amount, kind, order_ref)
  values (p_employer, -p_amount, 'spend', p_order_ref);
  return p_amount;
end;
$$;

revoke all on function public.spend_employer_credit(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.spend_employer_credit(uuid, integer, text) to service_role;

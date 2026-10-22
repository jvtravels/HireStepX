-- 0047: per-refund credit notes, IST/untruncated invoice numbers, employer_suspended credit reason.
-- Additive. Deploy the code first: every reader/writer falls back to the old derived credit-note number
-- (CN-<invoice number>) while employer_credit_notes is missing, and credits a suspended employer's unlock
-- with reason 'unavailable' until the new reason is allowed.
-- Credit notes: one row per refund event, numbered from a gap-free-as-possible sequence.
create sequence if not exists public.employer_credit_note_seq;

create table if not exists public.employer_credit_notes (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  -- Razorpay refund id (rfnd_...), or a synthetic ref such as 'unavailable:<order>' for credit returned
  -- instead of cash. Unique, so a redelivered webhook can never mint a second note for the same refund.
  refund_id text not null unique,
  amount_paise integer not null check (amount_paise > 0),
  credit_note_no text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists idx_employer_credit_notes_order on public.employer_credit_notes (order_id);

alter table public.employer_credit_notes enable row level security; -- service-role only, no client policy
revoke all on table public.employer_credit_notes from public, anon, authenticated;
grant select, insert on table public.employer_credit_notes to service_role;

-- Idempotent per refund id: a repeat call returns the existing row and burns no number.
-- The month in the number is the IST month, matching the date the document shows.
create or replace function public.assign_employer_credit_note(p_order_id text, p_refund_id text, p_amount_paise integer)
returns public.employer_credit_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.employer_credit_notes;
  v_seq text;
begin
  if p_order_id is null or p_refund_id is null or p_amount_paise is null or p_amount_paise <= 0 then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtext('credit_note:' || p_refund_id));

  select * into v_row from public.employer_credit_notes where refund_id = p_refund_id;
  if found then
    return v_row;
  end if;

  v_seq := nextval('public.employer_credit_note_seq')::text;
  insert into public.employer_credit_notes (order_id, refund_id, amount_paise, credit_note_no)
  values (
    p_order_id, p_refund_id, p_amount_paise,
    -- lpad() would TRUNCATE a 7-digit sequence value; only pad when shorter.
    'CN-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMM') || '-' || case when length(v_seq) >= 6 then v_seq else lpad(v_seq, 6, '0') end
  )
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.assign_employer_credit_note(text, text, integer) from public, anon, authenticated;
grant execute on function public.assign_employer_credit_note(text, text, integer) to service_role;

-- Invoice numbers: same IST month and no truncation above 999999.
create or replace function public.assign_unlock_invoice_no(p_payment_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no text;
  v_seq text;
begin
  select invoice_no into v_no
    from public.employer_unlock_payments
   where razorpay_payment_id = p_payment_id and amount > 0;
  if v_no is not null then
    return v_no;
  end if;

  v_seq := nextval('public.employer_invoice_seq')::text;
  update public.employer_unlock_payments
     set invoice_no = 'HSX-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMM') || '-' || case when length(v_seq) >= 6 then v_seq else lpad(v_seq, 6, '0') end
   where razorpay_payment_id = p_payment_id
     and invoice_no is null
     and amount > 0
  returning invoice_no into v_no;

  if v_no is null then
    -- lost a race (or not eligible): read the winner's number
    select invoice_no into v_no
      from public.employer_unlock_payments
     where razorpay_payment_id = p_payment_id and amount > 0;
  end if;
  return v_no;
end;
$$;

revoke all on function public.assign_unlock_invoice_no(text) from public, anon, authenticated;
grant execute on function public.assign_unlock_invoice_no(text) to service_role;

-- A suspended employer's paid unlock is returned as credit with this reason.
alter table public.employer_credit_ledger drop constraint if exists employer_credit_ledger_reason_check;
alter table public.employer_credit_ledger add constraint employer_credit_ledger_reason_check
  check (reason in ('declined', 'withdrew', 'blocked', 'no_response', 'unavailable', 'payment_refunded', 'payment_disputed', 'late_payment', 'employer_suspended'));

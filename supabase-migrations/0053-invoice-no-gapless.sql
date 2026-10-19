-- 0053: gap-free invoice numbers per Indian financial year, and credit-only purchases get a tax invoice.
-- The 0047 function read, drew from the sequence and only then did a guarded update with no row lock, so concurrent
-- callers for one payment each burned a sequence value and left a hole in the series. This version locks the
-- payment row first and draws from a per-financial-year counter row inside the same transaction, so a rolled
-- back call also rolls the counter back and no number is skipped.
-- Number shape is unchanged (HSX-YYMM-NNNNNN, IST month). The counter restarts each April; the YYMM prefix keeps
-- numbers unique across years. Existing invoices are never renumbered: the first call in a financial year seeds
-- the counter from the highest number already issued in it, so the series continues from where the sequence was.
-- Eligibility: a cash order (amount > 0) or an order paid wholly from credit (synthetic credit_pay_ payment id).
-- Admin grants and other zero-amount rows stay unnumbered.
-- Additive. Deploy the code first: the app calls the function by name and keeps working on the old one.
create table if not exists public.employer_invoice_counters (
  fy text primary key,
  last_no bigint not null check (last_no >= 0)
);
alter table public.employer_invoice_counters enable row level security; -- service-role only, no client policy
revoke all on table public.employer_invoice_counters from public, anon, authenticated;
grant select, insert, update on table public.employer_invoice_counters to service_role;

create or replace function public.assign_unlock_invoice_no(p_payment_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no text;
  v_ist timestamp := now() at time zone 'Asia/Kolkata';
  v_start_year int;
  v_fy text;
  v_from int;
  v_to int;
  v_seed bigint := 0;
  v_n bigint;
  v_seq text;
begin
  select invoice_no into v_no
    from public.employer_unlock_payments
   where razorpay_payment_id = p_payment_id
     and (amount > 0 or razorpay_payment_id like 'credit\_pay\_%')
   for update;
  if not found then
    return null;
  end if;
  if v_no is not null then
    return v_no;
  end if;

  v_start_year := case when extract(month from v_ist) >= 4 then extract(year from v_ist)::int else extract(year from v_ist)::int - 1 end;
  v_fy := v_start_year::text || '-' || lpad(((v_start_year + 1) % 100)::text, 2, '0');

  if not exists (select 1 from public.employer_invoice_counters where fy = v_fy) then
    v_from := (v_start_year % 100) * 100 + 4;
    v_to := ((v_start_year + 1) % 100) * 100 + 3;
    -- The casts sit inside CASE so the shape guard is guaranteed to run first (a WHERE clause gives no
    -- evaluation-order guarantee, and a malformed invoice_no would raise on the ::int cast).
    select coalesce(max(s.n), 0) into v_seed
      from (
        select case when invoice_no ~ '^HSX-[0-9]{4}-[0-9]+$' then
                 case when substring(invoice_no from 5 for 4)::int between v_from and v_to
                      then substring(invoice_no from '^HSX-[0-9]{4}-([0-9]+)$')::bigint
                 end
               end as n
          from public.employer_unlock_payments
      ) s;
  end if;

  insert into public.employer_invoice_counters (fy, last_no) values (v_fy, v_seed + 1)
  on conflict (fy) do update set last_no = public.employer_invoice_counters.last_no + 1
  returning last_no into v_n;

  v_seq := v_n::text;
  v_no := 'HSX-' || to_char(v_ist, 'YYMM') || '-' || case when length(v_seq) >= 6 then v_seq else lpad(v_seq, 6, '0') end;
  update public.employer_unlock_payments set invoice_no = v_no where razorpay_payment_id = p_payment_id;
  return v_no;
end;
$$;

revoke all on function public.assign_unlock_invoice_no(text) from public, anon, authenticated;
grant execute on function public.assign_unlock_invoice_no(text) to service_role;

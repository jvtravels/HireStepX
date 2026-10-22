-- 0054: money guards for employer unlocks.
--   1. employer_unlock_match_claims: one open (created/paid) order per match, for BATCH orders too.
--      uq_unlock_orders_open_single (0032) only covers single orders; a batch relied on a read-then-insert in
--      the handler, so two overlapping batches could both be created and the same candidate charged twice.
--   2. Credit notes get a per-financial-year gap-free series (HCN-<FY>-NNNNNN) drawn from a counter row inside
--      the same transaction as the insert. Credit notes already issued from the global sequence (CN-YYMM-NNNNNN)
--      keep their numbers; the new prefix cannot collide with them or with the app's derived fallback (CND-...).
--   3. employer_unlock_payments.invoice_no is unique where set, and an issued invoice can no longer be
--      cascade-deleted along with its employer.
-- Additive and idempotent. Deploy the code first: every caller falls back to the old behaviour until this runs.

/* ── 1. open-order match claims ── */
create table if not exists public.employer_unlock_match_claims (
  match_id uuid primary key,
  order_id uuid not null references public.employer_unlock_orders(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_unlock_match_claims_order on public.employer_unlock_match_claims (order_id);
alter table public.employer_unlock_match_claims enable row level security; -- service-role only, no client policy
revoke all on table public.employer_unlock_match_claims from public, anon, authenticated;
grant select, insert, update, delete on table public.employer_unlock_match_claims to service_role;

-- An order holds a claim on each of its matches while it is open (created or paid). Inserting an order whose
-- match another live order already claims fails with a unique violation (the handler answers 409
-- order_in_progress). Everything else is fail-open: a status change must never be blocked by claim upkeep,
-- because a paid order has to be able to move to paid / fulfilled. A claim whose order is no longer open, or is
-- an abandoned 'created' order older than 30 minutes (the app's STALE_CREATED_ORDER_MS), is taken over rather
-- than blocking a new purchase; a late payment on such an order is handled when it is fulfilled.
create or replace function public.sync_unlock_match_claims()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if new.status not in ('created', 'paid') then
    begin
      delete from public.employer_unlock_match_claims where order_id = new.id;
    exception when others then
      raise warning 'unlock claim release failed for order %: %', new.id, sqlerrm;
    end;
    return null;
  end if;

  -- Sorted so concurrent inserts take their locks in the same order and cannot deadlock each other.
  for v_id in select distinct m from unnest(new.match_ids) as m order by m loop
    begin
      if tg_op = 'INSERT' then
        delete from public.employer_unlock_match_claims c
         using public.employer_unlock_orders o
         where c.match_id = v_id
           and c.order_id = o.id
           and o.id <> new.id
           and (o.status not in ('created', 'paid')
                or (o.status = 'created' and o.created_at < now() - interval '30 minutes'));
        insert into public.employer_unlock_match_claims (match_id, order_id) values (v_id, new.id);
      else
        insert into public.employer_unlock_match_claims (match_id, order_id) values (v_id, new.id)
        on conflict (match_id) do nothing;
      end if;
    exception
      when unique_violation then
        if tg_op = 'INSERT' then
          raise exception 'unlock_match_claim_conflict' using errcode = '23505', detail = v_id::text;
        end if;
      when others then
        raise warning 'unlock claim upkeep failed for order %: %', new.id, sqlerrm;
    end;
  end loop;
  return null;
end;
$$;

revoke all on function public.sync_unlock_match_claims() from public, anon, authenticated;

drop trigger if exists trg_sync_unlock_match_claims on public.employer_unlock_orders;
create trigger trg_sync_unlock_match_claims
  after insert or update of status, match_ids on public.employer_unlock_orders
  for each row execute function public.sync_unlock_match_claims();

-- Orders already open when this runs hold their claims too (the oldest wins an existing overlap).
insert into public.employer_unlock_match_claims (match_id, order_id)
select distinct on (s.m) s.m, s.id
  from (
    select unnest(o.match_ids) as m, o.id, o.created_at
      from public.employer_unlock_orders o
     where o.status in ('created', 'paid')
  ) s
 order by s.m, s.created_at, s.id
on conflict (match_id) do nothing;

/* ── 2. per-financial-year credit-note series ── */
create table if not exists public.employer_credit_note_counters (
  fy text primary key,
  last_no bigint not null check (last_no >= 0)
);
alter table public.employer_credit_note_counters enable row level security; -- service-role only, no client policy
revoke all on table public.employer_credit_note_counters from public, anon, authenticated;
grant select, insert, update on table public.employer_credit_note_counters to service_role;

-- Same contract as 0047 (idempotent per refund id, returns the row), new numbering. The counter row is
-- locked by the upsert and rolls back with the transaction, so a failed call burns no number.
-- Number: HCN-<FY start YY><FY end YY>-<6+ digit counter>, e.g. HCN-2627-000001 (15 chars, within GST rule 46's 16).
create or replace function public.assign_employer_credit_note(p_order_id text, p_refund_id text, p_amount_paise integer)
returns public.employer_credit_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.employer_credit_notes;
  v_ist timestamp := now() at time zone 'Asia/Kolkata';
  v_start_year int;
  v_fy text;
  v_n bigint;
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

  v_start_year := case when extract(month from v_ist) >= 4 then extract(year from v_ist)::int else extract(year from v_ist)::int - 1 end;
  v_fy := v_start_year::text || '-' || lpad(((v_start_year + 1) % 100)::text, 2, '0');

  insert into public.employer_credit_note_counters (fy, last_no) values (v_fy, 1)
  on conflict (fy) do update set last_no = public.employer_credit_note_counters.last_no + 1
  returning last_no into v_n;

  v_seq := v_n::text;
  insert into public.employer_credit_notes (order_id, refund_id, amount_paise, credit_note_no)
  values (
    p_order_id, p_refund_id, p_amount_paise,
    'HCN-' || lpad((v_start_year % 100)::text, 2, '0') || lpad(((v_start_year + 1) % 100)::text, 2, '0') || '-'
      || case when length(v_seq) >= 6 then v_seq else lpad(v_seq, 6, '0') end
  )
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.assign_employer_credit_note(text, text, integer) from public, anon, authenticated;
grant execute on function public.assign_employer_credit_note(text, text, integer) to service_role;

/* ── 3. invoice integrity ── */
-- Skipped (with a notice) rather than failing the migration if a duplicate already exists; fix the data and re-run.
do $$
begin
  if exists (
    select 1 from public.employer_unlock_payments where invoice_no is not null group by invoice_no having count(*) > 1
  ) then
    raise notice '0054: duplicate invoice_no values found, uq_employer_unlock_payments_invoice_no not created';
  else
    create unique index if not exists uq_employer_unlock_payments_invoice_no
      on public.employer_unlock_payments (invoice_no) where invoice_no is not null;
  end if;
end;
$$;

-- An issued invoice is a tax record: deleting an employer must not take it along. Erasure anonymises employers
-- that have payment rows (see _delete-account-helpers.ts), so nothing in the app relies on this cascade.
-- match_id already uses on delete set null (the invoice keeps its amounts when a match row is replaced).
alter table public.employer_unlock_payments drop constraint if exists employer_unlock_payments_employer_id_fkey;
alter table public.employer_unlock_payments
  add constraint employer_unlock_payments_employer_id_fkey
  foreign key (employer_id) references public.employers(id) on delete restrict not valid;
alter table public.employer_unlock_payments validate constraint employer_unlock_payments_employer_id_fkey;

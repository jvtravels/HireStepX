-- Growth/CRO audit follow-up: `_cost-helpers.ts`'s DEFAULT_COST_RATES are
-- admittedly "list estimates, not billed amounts" (see its own header
-- comment). This table is where a real, closed-period invoice total gets
-- recorded once and compared against that period's modeled estimate — the
-- FinOps "operational clock vs. financial clock" split. One row per
-- calendar month; re-saving the same month overwrites (see
-- saveCostReconciliation's upsert in admin-data.ts), it doesn't accumulate
-- duplicates. Admin-only: no client ever reads or writes this table
-- directly, so — mirroring promo_codes below — there is no anon/authenticated
-- policy at all; all access is via admin-data.ts's service-role key.
--
-- Backfill note: shipped in 09d97b63 (2026-10-03) with supabase-schema.sql
-- updated but no numbered migration created, so the DDL was never applied
-- to the live database — admin-data.ts's getCostData() has been silently
-- degrading (fetchJSON logs the error and returns []) ever since. This
-- migration is that missing apply step, run against production now.
create table if not exists cost_rate_reconciliations (
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  actual_invoice_inr numeric not null check (actual_invoice_inr >= 0),
  modeled_inr numeric not null,
  note text,
  created_at timestamptz default now()
);

alter table cost_rate_reconciliations enable row level security;

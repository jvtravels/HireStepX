-- Account erasure (DPDP s.12 / GDPR Art.17) vs. tax-record retention.
--
-- 1. payments.user_id was NOT NULL + ON DELETE CASCADE, so deleting a profile deleted
--    the payment record (a tax/accounting document). Make the link nullable and
--    ON DELETE SET NULL: erasure (server-handlers/_erase-user.ts) nulls user_id and
--    clears receipt_url, keeping amounts / plan / Razorpay ids as an anonymised record.
--    Until this migration is applied, erasure of any user WITH payments fails closed
--    (account stays soft-deleted and is retried) rather than destroying the records.
-- 2. account_erasure_log: proof an erasure ran, with no PII (sha256 of the user id,
--    step counts). Service-role only (RLS on, no policy).

alter table payments alter column user_id drop not null;
alter table payments drop constraint if exists payments_user_id_fkey;
alter table payments
  add constraint payments_user_id_fkey
  foreign key (user_id) references profiles(id) on delete set null;

create table if not exists account_erasure_log (
  id uuid primary key default gen_random_uuid(),
  user_hash text not null,
  trigger text not null check (trigger in ('user_hard', 'scheduled')),
  retained_financial boolean not null default false,
  counts jsonb not null default '{}'::jsonb,
  processors jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);
create index if not exists idx_account_erasure_log_hash on account_erasure_log(user_hash);
alter table account_erasure_log enable row level security;
comment on table account_erasure_log is
  'Service-role-only: no authenticated/anon policy is intentional. Holds no PII.';

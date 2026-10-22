-- Consent ledger (2026-10-11): one row per (user, purpose, version) for DPDP Act 2023.
-- Additive only; safe to apply before or after the code deploy (record-consent
-- answers 202/retry until this table exists). Inserts are service-role only
-- (server-handlers/record-consent.ts) -- no client insert/update/delete policy.
create table if not exists user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  ip_hash text,
  user_agent text,
  constraint user_consents_unique unique (user_id, purpose, version),
  constraint user_consents_len_chk check (char_length(purpose) <= 64 and char_length(version) <= 64 and (user_agent is null or char_length(user_agent) <= 300))
);
alter table user_consents enable row level security;
drop policy if exists "Users view own consents" on user_consents;
create policy "Users view own consents" on user_consents
  for select using ((auth.uid())::text = user_id::text);
revoke insert, update, delete on user_consents from anon, authenticated;

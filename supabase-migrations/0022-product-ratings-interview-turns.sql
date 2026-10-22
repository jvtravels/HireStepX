-- Audit fix (2026-10-07): product_ratings and interview_turns were live
-- tables in production with real reads/writes in server-handlers/*.ts and
-- src/supabase.ts, but had NO DDL anywhere in the repo — RLS coverage,
-- FKs, and indexing were unauditable from source, and neither table was
-- erased by delete-account.ts / cleanup-deleted-accounts.ts (DPDP gap).
-- This migration is idempotent: if the tables already exist live with a
-- compatible shape, `create table if not exists` is a no-op and only the
-- RLS/index/policy statements apply.

-- product-rating.ts: one row per (user, session), upserted on
-- (user_id, session_id). Feeds the k-anonymized /pricing aggregateRating
-- via _product-rating-helpers.ts (service role, floor of 20 ratings).
create table if not exists product_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  session_id text references sessions(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  created_at timestamptz default now()
);
create unique index if not exists ux_product_ratings_user_session on product_ratings(user_id, session_id);

alter table product_ratings enable row level security;
drop policy if exists "Users can view own product ratings" on product_ratings;
create policy "Users can view own product ratings" on product_ratings
  for select using ((auth.uid())::text = user_id::text);
drop policy if exists "Users can upsert own product ratings" on product_ratings;
create policy "Users can upsert own product ratings" on product_ratings
  for insert with check ((auth.uid())::text = user_id::text);
drop policy if exists "Users can update own product ratings" on product_ratings;
create policy "Users can update own product ratings" on product_ratings
  for update using ((auth.uid())::text = user_id::text)
  with check ((auth.uid())::text = user_id::text);

-- src/supabase.ts (initLiveSession / saveInterviewTurn): per-turn
-- transcript rows written in real time during a live interview, read back
-- in bulk by export-user-data.ts and erased by cleanup-deleted-accounts.ts.
-- No update/delete policy for the authenticated role: transcripts are
-- append-only from the client, matching the `sessions` DELETE-denial
-- rationale above (service-role GDPR/cleanup paths bypass RLS).
create table if not exists interview_turns (
  id uuid primary key,
  session_id text references sessions(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  turn_index integer not null,
  turn_type text not null check (turn_type in ('session_start', 'question', 'answer', 'follow_up')),
  speaker text not null check (speaker in ('ai', 'user', 'system')),
  content text not null default '',
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_interview_turns_user on interview_turns(user_id);
create index if not exists idx_interview_turns_session on interview_turns(session_id, turn_index);

alter table interview_turns enable row level security;
drop policy if exists "Users can view own interview turns" on interview_turns;
create policy "Users can view own interview turns" on interview_turns
  for select using ((auth.uid())::text = user_id::text);
drop policy if exists "Users can insert own interview turns" on interview_turns;
create policy "Users can insert own interview turns" on interview_turns
  for insert with check ((auth.uid())::text = user_id::text);

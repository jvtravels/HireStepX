-- Email opt-outs (2026-10-11): CAN-SPAM / Gmail+Yahoo one-click unsubscribe.
-- Additive only. Code tolerates this table being absent (treats everyone as not
-- suppressed), but the unsubscribe endpoint cannot record an opt-out until it
-- exists, so apply it right after deploying.
-- Separate table, not columns on profiles: employers have no profiles row, and a
-- narrow service-written table keeps opt-out state out of the wide profiles RLS surface.
create table if not exists public.email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  marketing_opt_out boolean not null default false,
  employer_notifications_opt_out boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.email_preferences enable row level security;
-- Owner may read their own row; every write goes through service-role handlers
-- (/api/unsubscribe, /api/email-preferences), same as notification_preferences.
drop policy if exists "Users view own email prefs" on public.email_preferences;
create policy "Users view own email prefs" on public.email_preferences
  for select using ((select auth.uid()) = user_id);

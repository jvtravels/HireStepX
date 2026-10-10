-- Notifications v2 (2026-10-10): priority, grouping, triage state, per-user preferences.
-- Additive only. Apply BEFORE deploying the code that reads these columns.
alter table notifications
  add column if not exists priority text not null default 'normal',
  add column if not exists group_key text,
  add column if not exists count int not null default 1,
  add column if not exists action_label text,
  add column if not exists snoozed_until timestamptz,
  add column if not exists archived_at timestamptz;

do $$ begin
  alter table notifications add constraint notifications_priority_chk check (priority in ('critical','normal','low'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table notifications add constraint notifications_len_chk check (char_length(title) <= 200 and char_length(body) <= 1000 and count >= 1);
exception when duplicate_object then null; end $$;

create index if not exists idx_notifications_inbox on notifications(user_id, created_at desc) where archived_at is null;
create index if not exists idx_notifications_group on notifications(user_id, group_key) where group_key is not null and read_at is null;

-- Clients may only change triage state, never content columns.
revoke update on notifications from authenticated, anon;
grant update (read_at, archived_at, snoozed_until) on notifications to authenticated;

create table if not exists notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  quiet_start smallint check (quiet_start between 0 and 23),
  quiet_end smallint check (quiet_end between 0 and 23),
  updated_at timestamptz not null default now()
);
alter table notification_preferences enable row level security;
drop policy if exists "Users view own notification prefs" on notification_preferences;
create policy "Users view own notification prefs" on notification_preferences
  for select using ((auth.uid())::text = user_id::text);

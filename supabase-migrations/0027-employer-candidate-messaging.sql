-- Employer <-> candidate text messaging (2026-10-07). One conversation per
-- requirement_matches row, denormalized employer_id/candidate_user_id on
-- every table for simple RLS (same shape as employer_requirement_activity).
-- All writes are service-role-only from send-message.ts / flag-message.ts.
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references requirement_matches(id) on delete cascade not null unique,
  requirement_id uuid references employer_requirements(id) on delete cascade not null,
  employer_id uuid references employers(id) on delete cascade not null,
  candidate_user_id uuid references profiles(id) on delete cascade not null,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_conversations_employer on conversations(employer_id, last_message_at desc nulls last);
create index if not exists idx_conversations_candidate on conversations(candidate_user_id, last_message_at desc nulls last);

alter table conversations enable row level security;
drop policy if exists "Employers view own conversations" on conversations;
create policy "Employers view own conversations" on conversations
  for select using ((auth.uid())::text = employer_id::text);
drop policy if exists "Candidates view own conversations" on conversations;
create policy "Candidates view own conversations" on conversations
  for select using ((auth.uid())::text = candidate_user_id::text);

create table if not exists conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  employer_id uuid references employers(id) on delete cascade not null,
  candidate_user_id uuid references profiles(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete cascade not null,
  sender_role text not null check (sender_role in ('employer', 'candidate')),
  body text not null default '',
  attachment_path text,
  attachment_name text,
  attachment_mime text,
  auto_flag_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_conversation_messages_conversation on conversation_messages(conversation_id, created_at);
create index if not exists idx_conversation_messages_employer on conversation_messages(employer_id, created_at desc);
create index if not exists idx_conversation_messages_candidate on conversation_messages(candidate_user_id, created_at desc);

alter table conversation_messages enable row level security;
drop policy if exists "Employers view own conversation messages" on conversation_messages;
create policy "Employers view own conversation messages" on conversation_messages
  for select using ((auth.uid())::text = employer_id::text);
drop policy if exists "Candidates view own conversation messages" on conversation_messages;
create policy "Candidates view own conversation messages" on conversation_messages
  for select using ((auth.uid())::text = candidate_user_id::text);

create table if not exists message_flags (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references conversation_messages(id) on delete cascade not null,
  conversation_id uuid references conversations(id) on delete cascade not null,
  flagged_by uuid references auth.users(id) on delete cascade not null,
  flagged_by_role text not null check (flagged_by_role in ('employer', 'candidate', 'system')),
  reason text not null,
  note text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_message_flags_status on message_flags(status, created_at desc);
create index if not exists idx_message_flags_conversation on message_flags(conversation_id, created_at desc);

alter table message_flags enable row level security;

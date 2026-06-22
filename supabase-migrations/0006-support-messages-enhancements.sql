-- Migration: support_messages enhancements
-- Adds type tagging, user context enrichment, and SLA timestamps.

alter table support_messages
  add column if not exists type text default 'other'
    check (type in ('bug', 'feature', 'billing', 'other'));

alter table support_messages
  add column if not exists plan_tier text;

alter table support_messages
  add column if not exists session_count_30d integer default 0;

alter table support_messages
  add column if not exists first_response_at timestamptz;

alter table support_messages
  add column if not exists resolved_at timestamptz;

create index if not exists idx_support_messages_type
  on support_messages (type) where type is not null;

create index if not exists idx_support_messages_status_created
  on support_messages (status, created_at desc);

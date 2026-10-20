-- Admin console audit trail: one row per admin data read/write and per sign-in event.
-- The console uses a shared credential, so admin_user_id is the fixed actor label
-- ('shared-admin') and session_id (the token's sid) is what tells sign-ins apart.
-- Never store request free text, emails, secrets or payload bodies here: only action
-- names, resource ids and a small allow-listed meta (tier, days, qty, status, ...).
-- Optional for the code: a failed insert never blocks an admin request.
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  admin_user_id text not null default 'shared-admin',
  session_id text,
  action text not null,
  resource_type text,
  resource_id text,
  outcome text not null default 'ok',
  ip text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_admin_audit_log_admin_created
  on public.admin_audit_log (admin_user_id, created_at desc);
create index if not exists idx_admin_audit_log_session_created
  on public.admin_audit_log (session_id, created_at desc);
create index if not exists idx_admin_audit_log_created
  on public.admin_audit_log (created_at desc);

-- Service-role only: RLS on with no policy denies anon/authenticated; the explicit revoke
-- keeps the table out of the REST surface for those roles as well.
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;

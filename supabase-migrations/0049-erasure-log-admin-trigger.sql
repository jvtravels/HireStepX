-- Admin-initiated erasures (admin-data "delete-user") now run through the shared
-- eraseUserData routine and log with trigger = 'admin'. Widen the CHECK from 0038.
alter table account_erasure_log drop constraint if exists account_erasure_log_trigger_check;
alter table account_erasure_log
  add constraint account_erasure_log_trigger_check
  check (trigger in ('user_hard', 'scheduled', 'admin'));

-- payment_dedup.user_id existed only in supabase-schema.sql: the table predates the column and
-- `create table if not exists` skipped it, so prod has just (razorpay_payment_id, created_at).
-- Effects until this is applied: account erasure PATCHes payment_dedup?user_id=eq.<id>, gets a 400
-- (column missing, not a skippable 404) and fails closed, so no account can be deleted; and the
-- razorpay-webhook claim insert that carries user_id fails (best-effort, so it is silent).
-- SET NULL (not CASCADE) keeps the dedup row, and so the duplicate-activation guard, after a
-- profile is deleted.
alter table payment_dedup add column if not exists user_id uuid;
alter table payment_dedup drop constraint if exists payment_dedup_user_id_fkey;
alter table payment_dedup
  add constraint payment_dedup_user_id_fkey
  foreign key (user_id) references profiles(id) on delete set null;

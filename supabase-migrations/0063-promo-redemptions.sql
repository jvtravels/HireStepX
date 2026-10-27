-- Per-user promo tracking (commit 83c183b4) existed only in supabase-schema.sql and was never
-- applied to prod: promo_redemptions is missing, so account erasure's delete on it 404s and fails
-- closed (no account can be deleted), and verify-payment's consume_promo_code(p_code, p_user_id)
-- RPC has no matching 2-arg function, so promo uses are not being counted (best-effort, silent).
-- Everything below is idempotent. The older 1-arg consume_promo_code is left in place.
create table if not exists promo_redemptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles(id) on delete cascade not null,
  promo_code   text not null,
  redeemed_at  timestamptz not null default now(),
  -- Each (user, code) pair is tracked. Remove the unique index below if you
  -- want per-user caps > 1 (and update consume_promo_code accordingly).
  unique (user_id, promo_code)
);
create index if not exists idx_promo_redemptions_code on promo_redemptions(promo_code);
create index if not exists idx_promo_redemptions_user on promo_redemptions(user_id);
alter table promo_redemptions enable row level security;
-- Users can see their own redemptions (e.g. "you already used this code").
-- No INSERT/DELETE — service role only.
drop policy if exists "Users view own redemptions" on promo_redemptions;
create policy "Users view own redemptions" on promo_redemptions
  for select using ((auth.uid())::text = user_id::text);

-- Optional: add max_uses_per_user column to promo_codes for per-user caps.
-- 0 = unlimited per user (default — preserves existing behaviour).
alter table promo_codes add column if not exists max_uses_per_user integer not null default 0;

-- Updated consume_promo_code: checks both global cap (max_uses) AND optional
-- per-user cap (max_uses_per_user). On success, inserts into promo_redemptions.
-- Returns the code's id on success, null when exhausted or already used.
create or replace function consume_promo_code(p_code text, p_user_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_max_per_user integer;
  v_user_count   integer;
begin
  -- 1. Atomically increment global counter (unchanged from before).
  update promo_codes
  set current_uses = current_uses + 1
  where code = p_code
    and (max_uses = 0 or current_uses < max_uses)
  returning id, max_uses_per_user into v_id, v_max_per_user;

  if v_id is null then
    return null;  -- code not found or globally exhausted
  end if;

  -- 2. If a user_id was provided, enforce per-user cap and record redemption.
  if p_user_id is not null then
    if v_max_per_user > 0 then
      select count(*) into v_user_count
      from promo_redemptions
      where user_id = p_user_id and promo_code = p_code;

      if v_user_count >= v_max_per_user then
        -- Roll back the global increment — the user is at their personal cap.
        update promo_codes set current_uses = current_uses - 1 where code = p_code;
        return null;
      end if;
    end if;

    -- Record the redemption. ON CONFLICT DO NOTHING for idempotency — a
    -- concurrent double-submission won't error; the first write wins.
    insert into promo_redemptions (user_id, promo_code)
    values (p_user_id, p_code)
    on conflict (user_id, promo_code) do nothing;
  end if;

  return v_id;
end;
$$;

revoke all on function consume_promo_code(text, uuid) from public;
revoke all on function consume_promo_code(text, uuid) from anon;
revoke all on function consume_promo_code(text, uuid) from authenticated;
grant execute on function consume_promo_code(text, uuid) to service_role;

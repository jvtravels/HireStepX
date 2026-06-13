# HireStepX — Post-Deploy Launch Steps

Code is already pushed to `main` (commit `7c6fc84`) and Vercel is building.
These are the **manual steps only you can do**. Do them in order.

---

## STEP 1 — Apply the required database migration (DO THIS FIRST) 🚨

**Why first:** the ₹9 "Per session" card is live. Until the `session_credits`
table exists in prod, a buyer is charged but the credit grant fails — they pay
and get nothing. This is the only money-affecting gap, so it goes first.

1. Open the **Supabase Dashboard** → your **production** project.
2. Left sidebar → **SQL Editor** → **New query**.
3. Paste the entire block below and click **Run**.
   (It is idempotent — safe to run more than once; the `if not exists` /
   `drop ... if exists` guards mean re-running never errors.)

```sql
-- ── 1. Session credits ledger (₹9 single-session purchases) ─────────────
create table if not exists session_credits (
  user_id    uuid primary key references profiles(id) on delete cascade,
  balance    integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table session_credits enable row level security;

drop policy if exists "Users read own session credits" on session_credits;
create policy "Users read own session credits" on session_credits
  for select using ((auth.uid())::text = user_id::text);

-- ── 2. Public-profile opt-in (private by default) ───────────────────────
alter table profiles add column if not exists is_profile_public boolean not null default false;

-- ── 3. Billing-column guard (blocks self-promotion to a paid tier) ──────
create or replace function guard_profile_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.subscription_tier        := old.subscription_tier;
    new.subscription_start       := old.subscription_start;
    new.subscription_end         := old.subscription_end;
    new.razorpay_payment_id      := old.razorpay_payment_id;
    new.razorpay_subscription_id := old.razorpay_subscription_id;
    new.cancel_at_period_end     := old.cancel_at_period_end;
    new.subscription_paused      := old.subscription_paused;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_billing on profiles;
create trigger trg_guard_profile_billing
  before update on profiles
  for each row execute function guard_profile_billing_columns();
```

4. Confirm "Success. No rows returned."

### Verify Step 1 worked (optional but recommended)
Run this in the SQL editor — all three should return a row:
```sql
select 'session_credits table'  as check, to_regclass('public.session_credits') is not null as ok
union all
select 'is_profile_public column', exists (
  select 1 from information_schema.columns
  where table_name = 'profiles' and column_name = 'is_profile_public')
union all
select 'billing guard trigger', exists (
  select 1 from pg_trigger where tgname = 'trg_guard_profile_billing');
```

---

## STEP 2 — Confirm the Vercel build went green

1. Open the **Vercel Dashboard** → the HireStepX project → **Deployments**.
2. Find the deployment for commit `7c6fc84` ("Make legal/brand India-first…").
3. Wait for status **Ready** (green). If it fails, copy the build log and send it to me.
4. New cron registered this deploy: `/api/cron/analyze-sessions` (daily 02:00) —
   it shows up under **Settings → Cron Jobs** once the build is Ready.

---

## STEP 3 — (Optional) Set environment variables in Vercel

All of these fail safe if left unset — set only the ones you want.
**Vercel Dashboard → Settings → Environment Variables** (scope: Production),
then **redeploy** for them to take effect.

| Variable | Value | Effect |
|---|---|---|
| `DEEPGRAM_PROJECT_ID` | your Deepgram project id | Enables secure scoped STT voice tokens (else STT returns 503) |
| `SARVAM_ALLOW_CLIENT_KEY` | `true` | Re-enables Sarvam client-side STT fallback |
| `QUOTA_FAIL_CLOSED` | `1` | Strict LLM-cost mode: deny when Redis is unavailable |

> Voice is shipping text-only for MVP, so skipping the two voice vars is fine.

---

## STEP 4 — Smoke-test production (5 minutes)

After Step 1 + Step 2 are done:

1. **₹9 purchase** — log in as a test user, buy one ₹9 session via the pricing
   page, complete the Razorpay flow, and confirm the dashboard credit pill goes
   up by 1 and you can start a session. *(This is the critical one — proves the
   migration + payment path work end-to-end.)*
2. **Pricing page** — `/pricing` shows 4 cards (Free, ₹9 Per session, ₹49 Weekly,
   ₹149 Monthly) and the comparison table has 4 plan columns.
3. **Legal pages** — `/privacy` and `/terms` say "HireStepX" (no "Silva Vitalis
   LLC"); footer office reads "India / built in India".
4. **Public profile** — a brand-new user's public profile URL returns "private"
   until they opt in (private-by-default).

---

## STEP 5 — Tell me the results

Reply with: migration ran ✅ / Vercel green ✅ / ₹9 test purchase result.
If anything errored, paste the message and I'll fix it.

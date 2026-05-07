# Ops Runbook — HireStepX

Incident response playbook for the on-call engineer. Pairs with the
admin dashboard at `/admin` and PostHog. Keep this short and actionable
— if a section grows past a screen, split it.

---

## Health checks

| Endpoint | What it checks | Expected |
|---|---|---|
| `GET /api/uptime-check` | Process alive | `200 ok` (auth-401 also means "endpoint up") |
| `GET /api/health` | Live ping to Supabase + Upstash + Groq/Gemini, env-presence for TTS/STT/payments/email | `200 healthy` (all "ok") or `503 degraded` |

Hit `/api/health` first when triaging — the JSON body breaks down which
service degraded.

---

## Common incidents

### 1. LLM cascade failure (both Groq AND Gemini failing)

**Symptoms:**
- Admin dashboard "Error Breakdown" card shows >30% errors on both
  Groq and Gemini cards
- PostHog `gq_static_fallback` event spikes
- User reports of "couldn't generate questions"

**Diagnose (in order):**
1. `/api/health` — confirms both LLM providers unreachable
2. PostHog → events → filter `model = "groq"` and `status = "error"`
   to see error messages
3. Probe Groq directly:
   ```sh
   curl -sS -D - https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY" | head -20
   ```
4. Probe Gemini directly:
   ```sh
   curl -sS "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" | head -20
   ```

**Mitigate:**
- If Groq is throttling (429 / TPM exhausted): nothing to do; the cache
  + fallback already kick in. The user gets curated questions until
  the rate-limit window resets (185ms-1m26s for free tier per probe).
- If Gemini is overloaded (503 "high demand"): same — wait it out.
  Static fallback is already firing.
- If `gq_static_fallback_skipped` events fire on `salary-negotiation`:
  the static fallback intentionally refuses salary-neg sessions to
  avoid arc-mismatch. Users see a real error and need to retry.

**Fix permanently:**
- Add `CEREBRAS_API_KEY` to Vercel env (third LLM fallback already
  wired in `_llm.ts:181`)
- Upgrade Groq to paid Dev tier (~$50/month, lifts TPM 25×)

### 2. Supabase Auth incident

**Symptoms:**
- Vercel logs show `[verifyAuth] transient` repeated
- Many users see "Unauthorized. Please log in." mid-session
- `/api/health` returns `supabase: error`

**Diagnose:**
- Supabase status page: https://status.supabase.com
- Vercel logs filter: `[verifyAuth] transient`

**Mitigate:**
- `verifyAuth` already retries once on 5xx with 500ms backoff. Brief
  blips are absorbed.
- For sustained outages: nothing app-side fixes it. Inform users via
  status banner; they'll be auto-restored when Supabase recovers.

### 3. Razorpay webhook double-firing

**Symptoms:**
- Vercel logs show `[verify-payment] duplicate call for payment XXX`
  (this is the dedup catching it — *good* signal)
- User reports of double credits / double rewards

**Diagnose:**
- Check `payments` table for two rows with same `razorpay_payment_id`
- Check Redis `pay_dedup:<payment_id>` should have TTL ~24h after first
  successful call

**Mitigate:**
- The `pay_dedup` Redis lock added in `verify-payment.ts:296` blocks
  duplicates atomically. If a duplicate slips through, Redis was
  unavailable (lock fails open). Revoke the duplicate row manually:
  ```sql
  DELETE FROM payments WHERE id = '<duplicate-uuid>';
  -- if rewards were granted twice, decrement session_credits / revoke streak
  ```

### 4. Quota system fail-open (Redis down)

**Symptoms:**
- Vercel logs: `[quota] CRITICAL: Redis quota check failed`
- Users exceeding daily LLM limits without being blocked
- Upstash status: https://status.upstash.com

**Mitigate:**
- The fail-open is intentional (better than locking everyone out).
- Wait for Upstash recovery — usually <30 min.
- If sustained: temporarily lower per-user `userLimit` in handlers as
  a hotfix (forces tighter IP-level throttle).

### 5. Cron job silent failure

**Symptoms:**
- Vercel logs filter `[cron:` shows `CRITICAL` lines
- Users not getting renewal reminders, expired subscriptions not
  downgraded, etc.

**Affected crons (each runs daily):**
- `send-renewal-reminders` — paid users 1-3 days before expiry
- `reset-expired-subscriptions` — downgrades expired paid users to free
- `cleanup-deleted-accounts` — hard-deletes accounts soft-deleted >7d
- `send-abandonment-emails` — re-engages users with stalled sessions

**Diagnose:**
```sh
# Manually trigger and watch logs:
curl -X POST https://hirestepx.com/api/cron/<name> -H "Authorization: Bearer $CRON_SECRET"
```

**Mitigate:**
- Each cron now has 10s timeouts on its primary fetch (35cff05). A
  hung cron exits cleanly within the window.
- Re-run manually once the underlying issue (Supabase, Resend) is
  resolved.

### 6. TTS / STT silent failure

**Symptoms:**
- PostHog `tts_failed` event spike (tracks `phase: "preview" | "question"`)
- Users see the new "Audio temporarily unavailable" toast in
  StatusToasts during interviews

**Diagnose:**
- Cartesia status: https://status.cartesia.ai (primary)
- Azure status: https://status.azure.com (TTS fallback)
- Deepgram status: https://status.deepgram.com (STT primary)
- Sarvam status: https://status.sarvam.ai (STT fallback for Indian English)

**Mitigate:**
- The interview engine continues on TTS failure — visual question is
  still shown. User sees the explanatory toast.
- For sustained TTS outage: post a status banner; users can still
  complete sessions in text-only mode.

---

## Useful queries

### How many sessions used the static fallback today?
```sh
# PostHog events explorer:
event = "gq_static_fallback" AND timestamp > now() - 1d
```

### Which endpoints are burning the most LLM tokens today?
```sh
# Supabase SQL:
SELECT endpoint, COUNT(*) calls, SUM(total_tokens) tokens
FROM llm_usage
WHERE created_at > now() - '1 day'::interval
GROUP BY endpoint
ORDER BY tokens DESC;
```

### Who's hitting the quota wall?
```sh
SELECT user_id, COUNT(*) blocked
FROM llm_usage
WHERE status = 'error' AND error_message ILIKE '%quota%'
  AND created_at > now() - '1 day'::interval
GROUP BY user_id
ORDER BY blocked DESC LIMIT 20;
```

### Live Groq quota right now (consumes 1 request)
```sh
curl -sS -D - -X POST https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"ok"}],"max_tokens":1}' \
  -o /dev/null | grep -i "^x-ratelimit"
```

---

## Deploy / rollback

- **Deploy**: `git push origin main` — Vercel auto-deploys
- **Rollback**: Vercel dashboard → Deployments → previous → Promote to
  Production. Takes ~30s.
- **Feature flag**: not currently wired. If you need one, add to
  `_shared.ts` env-driven toggle pattern (e.g.
  `process.env.DISABLE_NEGOTIATION_V4 === "1"`).

---

## On-call escalation

1. Try the fixes above first.
2. If LLM-side: post a status banner via `BlogPage`-style notice.
3. If payments-side: pause new checkouts via Razorpay dashboard.
4. If data-loss risk: stop all writes (manually disable `save-session`
   handler) and call the maintainer.

---

## Patterns added recently (for context)

- **Response cache for `generate-questions`** — 5min Redis-backed,
  responses marked `_cached: true`, telemetry via `gq_cache_hit`
- **Static fallback** — when LLMs fail, returns curated questions from
  `data/interview-question-bank.ts` marked `_fallback: "static"`
- **Transient-aware auth** — `verifyAuth` retries once on 5xx; permanent
  401/403 rejected immediately
- **Payment idempotency** — Redis `pay_dedup:<payment_id>` with 24h TTL
  blocks Razorpay webhook retries
- **Cron timeouts** — every cron's primary fetch wrapped in
  `AbortSignal.timeout(10_000)` with `[cron:NAME] CRITICAL` log marker

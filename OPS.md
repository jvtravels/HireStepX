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
- Add `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` to Vercel env
  (Workers AI overflow rung, already wired in `_llm.ts`)
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

### LLM limits, prompt versions and drift

- **Pre-emptive provider limits** (`_llm-limits.ts`): usage is counted in Redis (`llm_lim:*`) and a provider already spent is skipped instead of waiting for a 429. Gemini defaults to 20 calls/day per model (resets 08:00 UTC), Cloudflare to 10,000 neurons/day, Groq to 8,000 tokens/minute. Override with `GEMINI_DAILY_CALL_LIMIT` and `CLOUDFLARE_DAILY_NEURON_LIMIT`; set either to `0` to disable the check (do this once billing is enabled and the real limits are higher). Reads fail open, and the chain is never emptied.
- **Prompt versions** (`_prompt-versions.ts`): every `$ai_generation` PostHog event carries `prompt_version`, `json_valid` and `schema_enforced`. Bump the registry entry whenever a prompt, rubric or output schema changes. A test fails if a new `callLLM` endpoint is not registered.
- **Quality drift** (`/api/cron/llm-quality-drift`, daily 05:40 UTC): reads `model` and `overallScore` from recent `sessions.report_json` and alerts (email/Slack) on a mean-score shift of 8+ points vs the previous 18 days, a 12+ point gap between providers, or a fallback provider grading 60%+ of recent reports. It needs 15+ samples per side, so it stays quiet at low volume.
- **Unverified**: Gemini's `responseJsonSchema` request shape could not be tested (free quota exhausted); a 400 retries without the schema, so the worst case is the old behaviour. Check `schema_enforced` vs `json_valid` in PostHog after deploy.

## Evals

| Eval | What it gates | Where it runs | Local |
|---|---|---|---|
| Negotiation structural (`scripts/eval-negotiation.ts`) | Negotiation kernel and scenario structure. Free and deterministic, blocks merges. | `negotiation-eval` job in `ci.yml`, every PR. Subjective LLM-judged layer: `eval-negotiation-subjective.yml`, Mondays 08:00 UTC and manual. | `npm run eval:negotiation` |
| Report scoring (`scripts/eval-report-scoring.ts`) | Session-report scoring in `evaluate-session`: score bands, strong > mid > weak ordering, prompt-injection and empty-answer handling, schema completeness. Golden set in `data/report-scoring-golden.ts`, checker in `server-handlers/_report-eval-helpers.ts` (unit-tested, no LLM). Non-blocking on rollout. | `eval-report-scoring.yml`, on PRs touching evaluate-session, `_llm*` or the golden set; Tuesdays 08:00 UTC; manual. | `GROQ_API_KEY=... npm run eval:report` (`--cases a,b`, `--threshold 0.8`, `--json`) |
| Hallucination (`scripts/eval-hallucination.ts`) | Fact grounding of generated questions against `data/company-known-facts.ts`. Alert-only: fails the weekly run above 5%, nothing blocks. | `eval-hallucination.yml`, Wednesdays 08:00 UTC; manual. Rotates through the cell matrix, JSON uploaded as an artifact. | `GROQ_API_KEY=... npm run eval:hallucination -- --sample 4` |

The two LLM evals need `GROQ_API_KEY` or `GEMINI_API_KEY` (Cloudflare alone is not enough, the handlers refuse to run) and exit 0 with a "skipped" message when neither is set, so forks stay green. They call the real handlers with auth, quota and Redis bypassed, so they spend free-tier provider quota: run them sparingly and never in a loop. A case that hits a provider error is reported as inconclusive and excluded from the pass rate.

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
  -d '{"model":"openai/gpt-oss-20b","messages":[{"role":"user","content":"ok"}],"max_tokens":1}' \
  -o /dev/null | grep -i "^x-ratelimit"
```

---

## Data sent to AI processors

Every LLM call goes through `callLLM` in `server-handlers/_llm-pii.ts`, which
runs `scrubPii()` (`server-handlers/_pii-scrub.ts`) over the prompt, then
`restorePii()` over the reply. `src/__tests__/piiLlmWiring.test.ts` fails if a
handler imports `callLLM` straight from `_llm.ts`. The scrub is regex and
checksum based, so it is best-effort data minimisation, not a guarantee.

**Replaced with placeholders before leaving our infrastructure** (`[EMAIL_1]`,
`[PHONE_1]`, ...): email addresses, Indian and international phone numbers,
Aadhaar (grouped, Verhoeff-valid, or labelled), PAN, IFSC, labelled bank
account and passport numbers, Luhn-valid card numbers, UPI IDs, labelled dates
of birth, linkedin.com/in/... and github.com/<user> URLs, address lines
(labelled "Address:" or flat/street keywords plus a PIN code) and labelled PIN
codes. `analyze-resume` also redacts anything the model echoes back
(`_pii-redact.ts`).

**Still sent** (the models need it to score and coach): candidate and
interviewer names, employer / college / project names, cities, job titles, the
full text of interview answers, salary and CTC figures, and any personal detail
the patterns above do not recognise (free-text addresses without a PIN, unlabelled
passport or account numbers, names inside answers).

**Processors**: Groq, Google Gemini, Cloudflare Workers AI. Which one serves a
call depends on the fallback chain in `_llm.ts`, so assume any of them can see
any prompt.

**Training use**: we do not opt anyone in to training. Each provider's own
terms and settings decide what happens to API data; the owner must confirm the
current position for the exact plan and API key in use (see below). Nothing here
is a legal commitment on behalf of those providers.

### Owner TODO (needs a human with account access)

- [ ] Sign or verify a Data Processing Agreement / data-processing terms with
  Groq, Google (Gemini API; check whether the free tier we run on is covered by the
  same terms as the paid tier) and Cloudflare.
- [ ] Confirm each provider's data retention setting for our API keys and
  record the answer here. Cloudflare Workers AI retention is undocumented as
  of 2026-10; get it in writing or treat it as unknown.
- [ ] Confirm each provider's training opt-out position for our plan and record it.
- [ ] Keep the sub-processor list in the privacy policy
  (`src/marketing-v2/MarketingPagesV2.tsx`, "Groq / Google (Gemini) /
  Cloudflare (Workers AI)" list) in sync with this section and with
  `server-handlers/_llm.ts` whenever a provider is added or removed, including
  Cerebras if it is ever enabled.
- [ ] Have counsel review whether the privacy policy and consent copy should say
  that identifiers are masked before AI processing.
- [ ] When adding a new handler that calls an LLM, import `callLLM` from
  `./_llm-pii` and add any new personal-data field to the scrubber tests.

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

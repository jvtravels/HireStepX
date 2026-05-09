# Release notes — Launch-readiness sweep

**Range**: `ee4c8ae..5ed7ee3` (8 commits) **Date**: 2026-05-02 **Theme**: Closing the audit punch-list before public launch — security, data integrity, observability, test coverage, UX polish.

> **Operator action required before this reaches prod.** See the "Deploy checklist" at the bottom — three env vars + one schema migration that must land before traffic hits the new code.

---

## Headline numbers

| Metric | Before | After | Delta |
| --- | --- | --- | --- |
| Tests | 777 | **1,002** | +225 (+29%) |
| Test files | 47 | **61** | +14 |
| ESLint warnings | 156 | **114** | −27% |
| `server-handlers/` line coverage | 8.5% | **12.6%** | +4.1 pts |
| `server-handlers/` function coverage | 8.6% | **18.9%** | +10.3 pts |
| Audit findings closed | — | **\~30 of 32** launch blockers + tier-2 | — |

---

## What shipped, by category

### 🔴 Security & data integrity

- **Server-side disposable-email enforcement** (`ee4c8ae`) — the client-side blocklist (`isDisposableEmail`) was UX only; a `curl` past the form bypassed it. New `_disposable-emails.ts` mirrors the same 50-domain list and gates every email-bearing action in `send-welcome.ts`. Closes the throwaway-account farming surface.
- `EMAIL_VERIFICATION_SECRET` **no longer falls back to the service-role key** (`ee4c8ae`) — production now refuses to issue or accept verification tokens unless the dedicated secret is configured. A leak of the service-role key no longer doubles as token-forgery capability.
- **CSP** `unsafe-eval` **removed** (`ee4c8ae`) — Razorpay's checkout SDK doesn't require `eval()`. Drops the largest XSS-escalation vector in our CSP.
- **Used-token replay defense** (`cd7f0f1`) — new `used_verification_tokens` ledger consumes each verification token at most once. SHA-256-only storage (raw token never persisted), 7-day auto-purge, fails CLOSED on infra fault. Reduces blast radius of an `EMAIL_VERIFICATION_SECRET` leak from "all accounts" to "one account per leaked token".
- **PII redactor** (`dfcbb90`) — strips emails, +91/E.164 phones, PAN, Aadhaar, US SSN from AI-generated profile fields before the response. Wired at all three response points (fresh, cache-hit, race-sibling) so legacy cached rows get cleaned at read time. Conservative pattern set with explicit false-positive guards (metrics, years, company names pass through).
- **Reflected XSS guard in cancellation email** (`5ed7ee3`) — user's display name now HTML-escaped before insertion into the cancellation confirmation. Edge case (their own inbox) but cleanly closed.
- **Content-Disposition header injection guard in data export** (`5ed7ee3`) — DPDP/GDPR export filename now sanitized + length-capped. Prevents CRLF in filename from forging a second response header.

### 🛡️ Auth hardening

- **Per-email signup rate limit** (`6b73489`) — 3 signups per email per 24h, layered on top of the existing per-IP cap. Targeted abuse on a single address now stops cold; legit "typo → resend" headroom preserved.
- **Forgot-password enumeration parity** (`6b73489`) — endpoint now returns `200` + identical body whether the email is registered or not. Probing `/forgot-password` to enumerate valid accounts is now useless.
- **Supabase auto-confirm probe** (`dfcbb90`) — distinguishes legitimately-existing accounts from new signups that arrived already-verified (which only happens when Supabase "Confirm email" is OFF — a config disaster). When detected: `[CRITICAL]` log + analytics event + correct user routing.

### 🐛 User-facing bug fixes

- **Resume cache key now includes** `targetRole` (`6b73489`) — same resume + different role no longer surfaces yesterday's role's analysis under today's role.
- **Resume cache key now includes** `fileHash` (`6d4f91c`) — same PDF re-uploaded across browsers (where pdf.js whitespace differs) now hits the cache by file identity instead of triggering a fresh LLM call.
- `resumeVersionId` **pinned to user profile** (`6b73489`) — captured at LLM completion across all three onboarding analyze paths, threaded through to session creation. Mid-flight tab close no longer orphans the binding.
- **Analysis client timeout aligned with server** (`6b73489`) — 40s → 25s. Users no longer see "timed out" on requests the server actually completed.
- **Re-analyze cache parity** (`6d4f91c`) — explicit "Re-analyze" button now passes `domain` so role changes invalidate cleanly.
- **Score cache** `created_at.asc` **first-writer-wins** (prior session, but completes the story) — stable score from the first canonical analysis onward.

### 🗣️ UX / accessibility

- `app/error.tsx` **+** `app/global-error.tsx` (`6b73489`) — runtime errors now render a proper boundary with retry / home / contact-support CTAs and surface the Next.js digest as a reference number. Previously: blank page.
- **Interview turn-taking labels rewritten** (`6d4f91c`) — `"AI is preparing…"` / `"AI is speaking…"` / `"Your turn — speak now"` instead of passive `"Preparing…"` / `"Speaking…"` / `"Listening"`. Users were talking over the AI because the old copy described the system, not the user's expected action.
- **Disabled primary CTA contrast** (`ddff733`) — opacity-faded buttons replaced with an explicit cream-line / ink-soft pair. Restores WCAG AA contrast on the disabled state and makes "intentionally inactive" read distinctly from "broken / not yet rendered".
- **DPDP Act 2023 compliance language** (`6d4f91c`) — Privacy Policy now has a dedicated section: purpose-limited processing, no-sale assertion, India-compatible data residency, full DPDP-mandated rights (access, correction, erasure, withdrawal, nomination), and a Data Protection Officer email (`privacy@hirestepx.com`).

### 📈 Observability

- **Health check probes the DB and Redis live** (`6b73489`) — `/api/health` now hits `profiles` via PostgREST `Range: 0-0` and pings Upstash. Surfaces partial outages where the front layer is up but downstream is degraded.
- **Resume cache hit/miss/race-sibling tracked** (`6b73489`) — events log to `service_usage` so we can measure LLM cost savings + tune the cache.

### 🧪 Test coverage

- **+225 tests across 14 new test files**:

  - `disposableEmails.test.ts` (18) — server-side blocklist + password parity
  - `verifyEmail.test.ts` (19) — HMAC token round-trip, replay, expiry, format
  - `razorpayWebhook.test.ts` (29) — signature verification + dedup
  - `piiRedact.test.ts` (21) — match cases + false-positive guards
  - `interviewEngine.test.ts` (38) — surrender detection, answer rubric, persona bands
  - `usedTokens.test.ts` (14) — one-shot consumption ledger
  - `evaluateSession.test.ts` (47) — score blend math, hallucination guards
  - `generateQuestions.test.ts` (23) — LLM contract drift detection
  - `cancelSubscription.test.ts` (16) — XSS escape + payment state
  - `exportUserData.test.ts` (15) — header-injection guard + DPDP envelope
  - regressions added to `resumeVersioning.test.ts` (4 — `targetRole` hash) and `updateProfile.test.ts` (1)

- **10 new helper modules** extracted from monolithic handlers, each ≤300 LOC and unit-testable in isolation:

  - `_disposable-emails`, `_email-verify-helpers`, `_razorpay-helpers`, `_pii-redact`, `_interview-engine-helpers`, `_used-tokens`, `_evaluate-session-helpers`, `_generate-questions-helpers`, `_cancel-subscription-helpers`, `_export-user-data-helpers`

- **Per-folder coverage gate** for `server-handlers/**` (`cd7f0f1`, ratcheted in `5ed7ee3`) — 11% lines / 12% statements / 17% functions / 11% branches. Independent of the JSX-heavy global aggregate; ratchets monotonically as new tests land.

### 🧹 Code quality

- **ESLint sweep** (`dad13c8`) — 156 → 114 warnings. All 36 `react-hooks/exhaustive-deps` warnings cleared. Mix of genuinely-missing deps fixed in-place and intentional suppressions (each with a one-line comment explaining why; never file-level).
- **Two** `as unknown as X` **cleanups** (`dfcbb90`) — `Profile.deleted_at` + `Profile.resume_version_id` now properly typed; `DashboardAnalytics` uses the `isAiResume()` discriminated-union guard.

---

## Commit map

| SHA | What |
| --- | --- |
| `ee4c8ae` | 🔴 Security launch-blockers — disposable email, `EMAIL_SECRET` strict, CSP `unsafe-eval`, password parity |
| `6b73489` | UX breakage + onboarding + observability + auth + 48 new tests via background agent |
| `dfcbb90` | PII redactor + Supabase auto-confirm probe + type cleanups |
| `6d4f91c` | Onboarding cache parity (`fileHash`, `domain`) + interview turn-clarity + DPDP + 38 engine tests |
| `ddff733` | Disabled-CTA contrast |
| `dad13c8` | ESLint sweep — 156 → 114 warnings |
| `cd7f0f1` | Used-token replay defense + per-server-handlers coverage gate |
| `5ed7ee3` | Handler tests batch — `evaluate-session` / `generate-questions` / `cancel-subscription` / `export-user-data` (+101 tests) |

---

## Deploy checklist (must complete before this reaches production)

> **Verification will fail-closed in production until items 1 and 4 are done.** That's the safe-fail behavior, not a regression.

1. `EMAIL_VERIFICATION_SECRET` — set to any cryptographically-random string ≥32 chars in Vercel Production env. Until set, `verify-email` returns `error=verification-failed` for every link.
2. **Custom email domain in Resend** — set up `noreply@hirestepx.com` (or chosen address), add SPF / DKIM / DMARC records at the registrar, then set `FROM_EMAIL` env var. Production deliverability is unacceptable on the shared `onboarding@resend.dev`.
3. **Supabase Auth password policy** — Dashboard → Authentication → Settings → match the in-app rules: ≥8 chars, ≥1 uppercase, ≥1 digit, ≥1 special, ≤128 chars. Closes the direct-`curl`-to-Supabase password bypass.
4. `used_verification_tokens` **schema migration** — copy the relevant section from `supabase-schema.sql` into the Supabase SQL editor and run it. Until the table exists, every verification will fail-closed (which is the safe-fail behavior, but blocks all signups).
5. *(optional but recommended)* — Toggle Supabase "Confirm email" ON in project settings. The new auto-confirm probe will detect if it's OFF and log `[CRITICAL]`, but the right answer is to have it ON and never see that log fire.

---

## What's still on the runway (deferred, not blocking)

- `useInterviewEngine.ts` (2,146 LOC) — pure helpers extracted in this batch; deeper decomposition would risk closure-state drift and is best done as a focused multi-day refactor.
- 20 second-tier untested handlers — top 4 covered; remaining ones are lower-risk (admin tooling, cron jobs, public profile read paths).
- ESLint warnings still at 114 — remaining are mostly `react-refresh/only-export-components` (low-stakes warnings per project convention) and intentional `as unknown as` retained where pragmatic.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
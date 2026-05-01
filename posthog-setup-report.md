# PostHog post-wizard report

PostHog has been integrated end-to-end into HireStepX (Next.js 15 / React 19 / Vercel Edge). The integration covers both client-side events (signup, login, abandonment, onboarding) and server-side events (resume parse, interview lifecycle, payments, subscription churn, referrals, account deletion, share).

## What was added

**New files**
- `server-handlers/_posthog.ts` — server singleton wrapping `posthog-node`. Uses `flushAt: 1, flushInterval: 0` for short-lived Vercel functions, calls `captureImmediate` / `captureExceptionImmediate` so events flush before the isolate exits. Includes `enableExceptionAutocapture: true`. Reads distinct id from `X-PostHog-Distinct-Id` request header and falls back to `auth.userId`.
- `src/posthogClient.ts` — lazy client wrapper around `posthog-js`. Initialized only after cookie consent. Provides `captureClientEvent`, `identifyClient`, `resetClient`, `getDistinctId`, `getSessionId`. All wrapped in try/catch — telemetry never throws.

**Modified files**
- `package.json` — added `posthog-node@^5.30.6` and `posthog-js@^1.372.3` dependencies.
- `app/ConsentGatedAnalytics.tsx` — calls `initPostHog()` after the user accepts cookies; mirrors the existing Vercel Analytics consent gating.
- `src/AuthContext.tsx` — `identifyClient` + `user_signed_up` on signup completion; `identifyClient` + `user_logged_in` on login success; `resetClient()` on logout. Sits next to the existing `track()` calls so neither tool replaces the other.
- `src/apiClient.ts` — forwards `X-PostHog-Distinct-Id` and `X-PostHog-Session-Id` headers on every authenticated XHR mutation so server-side events join the same person/session.
- `src/Interview.tsx` — `interview_abandoned` fires on `pagehide` / unmount when the user leaves before `handleEnd` runs (with question count, elapsed time, phase).
- `src/OnboardingComplete.tsx` — `onboarding_completed` fires on landing.
- `server-handlers/analyze-resume.ts` — `resume_uploaded` on success, `captureServerException` on failure.
- `server-handlers/generate-questions.ts` — `interview_started` with question count.
- `server-handlers/save-session.ts` — `interview_completed` with session id and streak milestone.
- `server-handlers/evaluate-session.ts` — `session_evaluated` with score, band, latency, model.
- `server-handlers/create-order.ts` — `checkout_started` with plan, amount, order id, quantity.
- `server-handlers/verify-payment.ts` — `payment_completed` (both single-session and subscription paths) with plan, tier, payment id, prorated days. Also fires `referral_converted` on the referrer's distinct id when `grantReferralReward` succeeds.
- `server-handlers/cancel-subscription.ts` — `subscription_cancelled` with tier and access-until date.
- `server-handlers/reactivate-subscription.ts` — `subscription_reactivated` with tier and next billing date.
- `server-handlers/delete-account.ts` — `account_deleted`.
- `server-handlers/share-report.ts` — `report_shared` with TTL and expiry.

## Events instrumented

| Event | Description | File |
|---|---|---|
| `user_signed_up` | New signup completes (custom verification flow) | `src/AuthContext.tsx` |
| `user_logged_in` | Successful sign-in (email/password) | `src/AuthContext.tsx` |
| `resume_uploaded` | Resume PDF/text accepted by /api/analyze-resume | `server-handlers/analyze-resume.ts` |
| `onboarding_completed` | Onboarding wizard finished | `src/OnboardingComplete.tsx` |
| `interview_started` | Mock interview questions generated | `server-handlers/generate-questions.ts` |
| `interview_abandoned` | User left interview before completion | `src/Interview.tsx` |
| `interview_completed` | Session row persisted | `server-handlers/save-session.ts` |
| `session_evaluated` | LLM evaluation finished, score produced | `server-handlers/evaluate-session.ts` |
| `checkout_started` | Razorpay order created | `server-handlers/create-order.ts` |
| `payment_completed` | Razorpay payment verified — revenue event | `server-handlers/verify-payment.ts` |
| `subscription_cancelled` | User cancels subscription | `server-handlers/cancel-subscription.ts` |
| `subscription_reactivated` | User reactivates a cancel-pending subscription | `server-handlers/reactivate-subscription.ts` |
| `referral_converted` | Referee paid; referrer credited | `server-handlers/verify-payment.ts` |
| `account_deleted` | User deletes their account | `server-handlers/delete-account.ts` |
| `report_shared` | Public share link generated | `server-handlers/share-report.ts` |

## Required environment variables

Add to Vercel (production + preview):

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_API_KEY=phc_...                  # same project key, server-side
POSTHOG_HOST=https://us.i.posthog.com    # optional override
```

Update `next.config.js` CSP `connect-src` to include `https://us.i.posthog.com` (or your region's PostHog host) so the browser SDK can reach the ingestion endpoint.

## Next steps

The PostHog MCP requires authentication (`mcp__posthog__authenticate`). Once authenticated, the recommended dashboard is **Analytics basics** with these insights:

- **Activation funnel**: `user_signed_up` → `resume_uploaded` → `onboarding_completed` → `interview_started` → `interview_completed`
- **Revenue funnel**: `interview_completed` → `checkout_started` → `payment_completed`
- **Churn / retention**: `subscription_cancelled` weekly trend, broken down by tier
- **Abandonment**: `interview_abandoned` rate vs `interview_completed`, broken down by `phase` and `questions_answered`
- **Referral loop**: `referral_converted` count + cohorted retention of referees vs organic signups

Run `mcp__posthog__authenticate` then `mcp__posthog__complete_authentication` and ask Claude to create the dashboard with these insights.

### Agent skill

The `.claude/skills/integration-javascript_node/` folder was used to drive this integration. Keep it for future agent runs that want to extend the PostHog setup with feature flags, surveys, or additional event coverage.

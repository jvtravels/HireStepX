# HireStepX — North Star Metric & Tracking Plan

**Status:** Active | **Owner:** Founder/PM (one engineer co-signs instrumentation correctness) | **Date:** June 2026

This is the single source of truth for *what we measure and why*. It defines the North Star, its input-metric tree, the guardrails, and the governed event taxonomy. It is re-verified against the code at the top of every weekly review; an event that fires with the wrong name or drifts from this plan is a defect.

> **Data caveat (verified).** PostHog project 370211 ("Hirloop") currently holds essentially founder-QA traffic. Until real user traffic accrues, **every funnel number is _unavailable_, not "low"** — do not report activation, conversion, or retention rates yet. Instrumentation in code is real; the user data behind it is not.

## North Star metric

**Weekly Verified-Ready Candidates** — the count of distinct users per ISO week who:

1. completed an interview session, **and**
2. opened its report, **and**
3. hold a Readiness Index at or above their target company's hire-bar, **or** posted a positive Readiness delta versus their prior session.

Why this and not a vanity proxy: the customer value HireStepX delivers is *becoming interview-ready*, and the product already computes exactly that — the five-pillar Readiness Index (`server-handlers/_readiness-core.ts`) against a company hire-bar (`DEFAULT_HIRE_BAR = 70`). "Completed *and* reviewed" closes the loop because the report is where coaching lands and where the score is reconciled in one atomic write (`server-handlers/evaluate-session.ts`). It deliberately excludes raw session count (gameable) and raw signups (not value).

## Input-metric tree (the levers)

- **Activation — signup to first reviewed session.** Time-to-value on-ramp. Measured `user_signed_up` to `interview_session_completed` to `report_viewed`. Surface to optimize: `OnboardingComplete.tsx`.
- **Depth — sessions per active user per week.** Counted from `interview_session_started` / `interview_session_completed`, constrained by tier caps (`FREE_SESSION_LIMIT`, weekly = 10, `PRO_MONTHLY_LIMIT = 40`).
- **Readiness gain — median Readiness delta per reviewing user per week.** The value lever that distinguishes HireStepX from a question-spitter. Computed from the persisted `report_json.overallScore` reconciled onto `sessions.score`, folded through `computeReadiness`.
- **Currency / retention — 7-day return driven by the skill-decay queue.** The Currency pillar models a 7-day grace then linear decay; `buildRefresh()` surfaces the top-5 idle skills. Instrumented by `readiness:refresh_queue_shown` (new) — measure 7-day return for users who saw a non-empty queue vs. those who didn't.

## Guardrail metrics

Monetization is a **guardrail, not a North Star input** — it must not be improved at the expense of verified readiness.

- Free to paid conversion (`plan_upgraded` / `billing:payment_verified`).
- Report-quality complaints (the `feedback` table: `too_harsh` / `inaccurate`).
- Voice/STT failure rate (provider fallbacks in `useInterviewSTT.ts`, `_tts-telemetry.ts`).

## Event taxonomy

Convention: `category:object_action`, snake_case, fixed-string names, variable data in properties. Booleans `is_`/`has_`; timestamps end `_ms`. Reuse existing names — do not rename. Keep the plan to roughly 10-200 events. Server-side for anything load-bearing (`server-handlers/_posthog.ts`).

Acquisition / activation:

- `user_signed_up` — exists (`AuthContext.tsx`). props: method.
- `onboarding_completed` — exists (`OnboardingComplete.tsx`).
- `dashboard_loaded`, `dashboard_start_clicked` — exist (`DashboardHome.tsx`); surface-tagged start funnel.

Engagement to readiness:

- `interview_session_started` / `interview_session_completed` — exist (`useInterviewEngine.ts`). props: focus, duration.
- `report_viewed` — exists. props: overall_score, readiness, readiness_delta.
- `coaching:next_move_cta_clicked` — **new, shipped.** Fired from the "Your next move" primary CTA (`DashboardHome.tsx`). props: gap_code, weakest_skill_name, drill_key. This makes the coaching loop measurable independently of the generic Start funnel.

Retention / currency:

- `readiness:refresh_queue_shown` — **new, shipped.** Fired once per readiness-page load when the skill-decay queue is non-empty (`readinessIndex/ReadinessIndex.tsx`). props: idle_skill_count, top_idle_days. Required for the retention lever.
- `analytics_viewed`, `analytics_empty`, `ri_fetch_error` — exist.

Referral / monetization (guardrails):

- `referral_invite_sent` / `referral_signup` / `referral_reward_granted` — exist.
- `pricing_page_viewed`, `checkout_opened`, `plan_upgraded` — exist.
- `billing:payment_verified` — recommended, server-side from `verify-payment.ts`.

## Acceptance (the score does not rise until these are true on real traffic)

- The two new events (`coaching:next_move_cta_clicked`, `readiness:refresh_queue_shown`) fire in PostHog on non-founder traffic.
- A PostHog funnel signup to first session to report to 7-day return renders non-founder data.
- This plan is reviewed at the weekly business review; drift is a defect.

## Process rituals (founder-owned — not code)

These cannot be "fixed" in code; they are operating-cadence commitments tracked in the Department Audit doc 01 Solution Plan:

- Weekly Business Review (30 min, fixed format): North Star + 4 inputs + guardrails.
- Weekly customer-discovery interview synthesized into an opportunity-solution tree.
- RICE-scored backlog for the next quarter's candidates.
- Quarterly OKRs expressed against this North Star tree.

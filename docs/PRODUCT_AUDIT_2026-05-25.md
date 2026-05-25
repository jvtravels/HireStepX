# HireStepX — Product Audit (re-audit, 2026-05-25)

Three weeks after `PRODUCT_AUDIT_2026-05-04.md`. Re-rates the same nine
dimensions against the current code, flags what's improved vs regressed,
and updates the final calibrated score.

**TL;DR:** Final score moves **7.6 → 8.1**. Driven mostly by monetisation
maturity (single-tier → 5-tier ladder), analyzer depth on the four flagship
focuses, observability fills (voice stack), and a ~5× test-suite expansion.
Held back by the `useInterviewEngine.ts` complexity warning getting **worse,
not better** (2,146 → 3,467 LOC, +62%), and 6 of 11 analyzers still being
v1 thin shells.

---

## What shipped since 2026-05-04 (the why-it-moved)

- **850 commits, 819 new files, 21-day window** — ~40 commits/day, almost
  all by `Co-Authored-By: Claude Opus 4.7`. This is a hyperactive
  iteration regime, not a stagnant codebase.
- **Voice stack observability** (957ba8e, f2305ad, 2026-05-25): Cartesia
  REST 15s timeout closes the silent-stall hole; `tts_provider_used`
  + `stt_provider_used` + `stt_setup_failed` emit the full fallback
  chain per utterance. **The #1 audit blocker — invisible escalation
  to expensive providers — is now metered.**
- **Salary-negotiation v9** (ec7d29e, 9b456eb, etc.): multi-round kernel
  state, NextAction threading, ZOPA tracker, candidate-profile registry
  in shadow mode, fact-grounding validator, walkaway-detection
  consolidation, STT mishear tolerance for LPA tokens. The PDF#37–#45
  Flipkart-transcript drive (16+ commits) closed dozens of architectural
  bugs by replaying real interviews.
- **Campus-placement v6.5 → v6.10**: realism calibration, MTI
  whitelist, service-tier rubric, severity coherence, flag-tip
  registry extraction, regex constants extraction.
- **HR-round v5.2 → v5.6**: bond/pedigree/fresher gate, deferential
  opener, comp-held guard fix, honest-unknown carve-out, Hinglish
  recall, employer cross-check, 5 RESCORE entries.
- **Behavioral v6 + v4 layering**: Phase-6 cross-session auto-prebias,
  designer-affinity bank coverage, topical-alignment detector,
  answer-shape probing (METRIC_NAKED / REHEARSED / LOW_CONVICTION /
  RAMBLING_EMPTY), failure-specificity gate.
- **New ops surfaces**: `/admin/quality` dashboard + 7 quality-routing
  routes, `app/api/cron/analyze-sessions`, `OPS.md`, `RUNBOOK.md`,
  `DEFERRED.md`, two CI workflows (`e2e.yml`, `salary-drift-monthly.yml`).
- **Pricing expansion**: single Pro tier → 5-tier ladder (see §6).
- **Test-suite growth**: 1,149 → **5,544 tests** across **414 test
  files** (~5× growth, mostly fixture-driven analyzer coverage).
- **Sitemap + robots** (`app/robots.ts`, `app/sitemap.ts`) and dynamic
  per-company marketing pages (`app/(marketing)/companies/[slug]/`)
  — first real organic-acquisition surface.

---

## Refreshed scorecard

| Dim | 05-04 | 05-25 | Δ | Why moved |
|---|---|---|---|---|
| 1. Positioning & messaging | 8.5 | 8.5 | – | Copy unchanged; still strong |
| 2. Visual & interaction design | 8.0 | 8.0 | – | No major redesign |
| 3. Information architecture | 6.5 | 6.5 | – | Still no global nav rework |
| 4. Core experience: interview | 6.5 | **7.5** | +1.0 | Behavioral v6, salary-neg v9, voice telemetry, engine.ts grew |
| 5. Session report | 8.5 | 8.5 | – | View grew 752→3,040 LOC but rubric unchanged |
| 6. Funnel & monetisation | 7.0 | **8.0** | +1.0 | 1-tier → 5-tier ladder; ₹49 weekly + annual added |
| 7. Technical foundation | 8.0 | **8.5** | +0.5 | 5× tests, voice observability, CI workflows; engine.ts liability worse |
| 8. Trust & compliance | 7.5 | 7.5 | – | Still on `onboarding@resend.dev` |
| 9. Competitive defensibility | 6.5 | **7.5** | +1.0 | Salary-neg v9 + analyzer flag density is real moat |
| **Final calibrated** | **7.6** | **8.1** | **+0.5** | |

---

## 1. Positioning & messaging — 8.5/10 (unchanged)

Hero copy at `src/landing/Hero.tsx:285, 367–369` unchanged: still
"Nail your next interview. Every single time." + the ₹0-starting,
TCS/Flipkart/Google value prop. **Still one of the most committed
landing-page value props in this category.** Social-proof badge above
the H1 reads "3 free sessions, no credit card required" — concrete.

12 brand logos rendered (Google, Amazon, Microsoft, TCS, Flipkart,
Meta, Infosys, Deloitte, Razorpay, McKinsey, Goldman Sachs, Apple).
**Mixed Indian + Western premium logos signal "we serve everyone who
matters in Indian hiring."**

The FAQ section (`landingData.tsx:149–158`) is genuinely well-written
— answers the actual buyer objections ("How is this different from
ChatGPT?", "₹10 per session vs ₹3,000–10,000 career coach") with
specific numbers, not weasel words.

**No regression. No improvement.** Worth re-running a hero A/B test
once paid traffic starts (was punted to V1.1 in the prior audit).

---

## 2. Visual & interaction design — 8.0/10 (unchanged)

No design-system shifts since 05-04. The mesh-gradient hero, parallax
geometric circles, gilt-pulse social-proof dot, and word-by-word fade-in
(now opacity-1 on first paint for LCP) all unchanged. **Holds the
"premium calm" feel.**

Worth noting: there are **no new component primitives** added in 850
commits — all the iteration is on logic, not chrome. **This is correct
prioritisation for a pre-PMF product** but starts to look thin once
paid traffic hits and conversion-rate-optimisation matters.

---

## 3. Information architecture — 6.5/10 (unchanged)

Still no consolidated nav. Dashboard surface fragmentation noted in the
prior audit unaddressed. `DashboardHome.tsx` is **1,659 LOC** (was
~similar 05-04) — the "nextMove" pure-logic module is still bolted onto
a dense JSX surface rather than driving a leaner shell.

**One IA win**: `app/(marketing)/companies/[slug]/page.tsx` adds dynamic
per-company landing pages (Google, TCS, etc.) — the first surface
that solves the "I want to prep specifically for Razorpay" funnel
without making them click through 4 levels.

---

## 4. Core experience: interview — 7.5/10 (+1.0)

**The big mover.** Three reasons:

### What got better

1. **Salary-negotiation went from "exists" to "the best in category."**
   v9 is 1,659 LOC + 37 quality flags + 8 helper modules. Multi-round
   kernel, ZOPA tracker, NextAction threading, persona-aware
   walkaway, fact-grounding validator. **No US competitor has a
   negotiation simulator at this depth, let alone one that handles
   Indian comp structure (LPA / variable / RSU vesting / notice
   period).**

2. **Behavioral analyzer doubled in capability.** v5 = 890 LOC + 21
   flags + 6 helpers. New: topical-alignment detector, cross-session
   auto-prebias, answer-shape probing (METRIC_NAKED / REHEARSED /
   LOW_CONVICTION / RAMBLING_EMPTY), failure-specificity gate.
   The follow-up handler now picks one probe per answer based on
   detected shape — that's Bar-Raiser-grade probing.

3. **Voice stack is no longer a black box.** Cartesia REST timeout
   eliminates the hung-blob silent stall. `tts_provider_used`
   + `stt_provider_used` events expose every Sarvam→Cartesia→Azure
   and Deepgram→Sarvam→WebSpeech fallback. **Cost surprises are no
   longer invisible.**

### What's still weak

- **6 of 11 analyzers are still v1 thin shells** (system-design,
  strategic, panel, case-study, management, government-psu — all
  ~90–130 LOC with 4–6 flags). A candidate prepping for
  Government/PSU gets nowhere near the rigour a Salary-Neg candidate
  gets. **Uneven product quality across the 10-focus matrix is the
  next moat-builder.**
- **`useInterviewEngine.ts` is now 3,467 LOC** (was 2,146 at 05-04
  audit). +62% growth. The prior audit warned this was "a maintenance
  liability waiting to happen" — it now IS one. Splitting it is the
  highest-ROI refactor on the board.
- **Still no avatar / no video.** Same gap as 05-04. Pramp / Final
  Round AI both have some visual interlocutor; HireStepX still shows
  a dot-grid. A single illustration per persona would lift "feels
  like a real interview" measurably.

---

## 5. Value delivery: the session report — 8.5/10 (unchanged)

`src/sessionReport/SessionReportView.tsx` grew **752 → 3,040 LOC** and
`SessionReport.tsx` is 752 LOC. The split is good (view = render,
SessionReport = data). The rubric / STAR breakdown / coached model
answer / skill-decay tracking all still present — and now consume
the much richer per-analyzer flag set, so the report fidelity for the
four mature focuses is meaningfully better than at 05-04.

**Why not bumped?** The mid + thin analyzer reports look similar to
05-04 — the bar is set by the worst card in the report, not the best.
When Govt-PSU report renders "5 generic tips" while Salary-Neg renders
"37-flag-aware multi-section deep dive", the user notices the
inconsistency.

---

## 6. Funnel & monetisation — 8.0/10 (+1.0)

**The other big mover.** Pricing went from monolithic to a real ladder
(`src/landingData.tsx:141–147`):

| Tier | Price | Period | Slot |
|---|---|---|---|
| Free | ₹0 | 3 sessions | Trial / activation |
| Single Session | ₹10 | per session | UPI-friendly impulse buy |
| Starter | ₹49 | /week | 7 sessions, low-commit habit |
| **Pro** *(featured)* | **₹149** | /month | 30 sessions + analytics + coaching |
| Annual | ₹1,199 | /year | -33% — long-tail prep window |

**This is good ladder design.** ₹10 single-session catches the
"buying a ticket for tomorrow's interview" impulse; ₹49 weekly is
under the chai-per-day threshold for daily prep; ₹149 is the obvious
upgrade after Free runs out; Annual gives an honest discount.

Two new conversion events wired (`first_paid_subscription`,
`subscription_upgraded`) at `PricingSection.tsx:153, 155` — the funnel
is properly measured.

**Why not 9.0?** No visible referral mechanic (the audit
mentioned `_referral-reward.ts` exists, but nothing on the landing or
dashboard surfaces a "refer a friend" CTA). For an Indian-market
product where WhatsApp word-of-mouth IS the acquisition channel, this
is leaving 20–30% growth on the table.

---

## 7. Technical foundation — 8.5/10 (+0.5)

### What got better

- **5,544 tests** across 414 files (was 1,149). **~5× growth in 3
  weeks.** Most of it is fixture-driven analyzer coverage —
  behavioral-fixtures, salary-neg replay harness, hr-round 45-fixture
  corpus, campus-placement multi-version fixtures.
- **Two new CI workflows**: `.github/workflows/e2e.yml` (Playwright)
  + `salary-drift-monthly.yml` (drift detection on the salary-band
  corpus).
- **Voice stack telemetry** (covered in §4).
- **Ops docs**: `OPS.md`, `RUNBOOK.md`, `DEFERRED.md` — runbook
  discipline emerging.
- **Admin quality dashboard** (`/admin/quality` + 7 routes) — the
  first surface for proactive failure triage.
- **ESLint clean**: 118 problems / 3 errors / 115 warnings on real
  code. Errors are 2 useless-escapes + 1 `<article role="article">`
  — trivial.

### What got worse

- **`useInterviewEngine.ts` is 3,467 LOC**, up from 2,146 (+62%).
  This is **above the 1500 LOC ESLint warn threshold** by 2.3×.
  The prior audit flagged this as a maintenance liability; the
  liability has compounded. **Highest-leverage tech-debt item.**
- `InterviewPanels.tsx` (1,642 LOC), `DashboardHome.tsx` (1,659),
  `SessionReportView.tsx` (3,040) all over the 1,500 warn threshold.
  Splitting them is non-blocking but the surface area for accidental
  regressions is large.

### Unchanged but still strong

- RLS on every user-scoped table
- Server-side enforcement on every client check
- Score determinism end-to-end
- PII redactor at write + read paths
- Replay defense, CSP without `unsafe-eval`, fail-closed EMAIL_VERIFICATION_SECRET

---

## 8. Trust & compliance — 7.5/10 (unchanged)

- DPDP Act language present, audit log + IP/UA, data export, account
  deletion with 30-day grace — all unchanged.
- **Still on `onboarding@resend.dev`** — this remains the single
  biggest pre-launch trust gap. Easy fix once a custom domain lands
  + SPF/DKIM/DMARC are set at the registrar.
- No SOC2 / ISO badges (appropriate for stage, but a "RLS-enforced,
  encrypted in transit, DPDP-compliant" footer strip would lift trust
  without claiming what's not true).

---

## 9. Competitive defensibility — 7.5/10 (+1.0)

The audit's three defensibility levers at 05-04 were: Indian-market
positioning, distribution channels, product depth on negotiation +
behavioral. Two of the three got materially stronger:

1. **Indian-market positioning** — strengthened by per-company
   marketing pages, Hinglish recall flag, LPA / Cr / lakh expansion
   in the TTS path, Indian-recruiter persona corpus.
2. **Product depth** — Salary-neg v9 + Campus v6.10 + HR-round v5.6
   + Behavioral v6 give 4 deep-moat focuses. The PDF#37–#45 Flipkart
   replay drive proves the iteration loop (real transcript →
   analyzer fix → fixture lockdown) actually compounds quality.
3. **Distribution** — still the weakest of the three. No referral
   CTA surfaced, no SEO content beyond the new company-slug pages.

A US competitor cloning this in 6 months would still have to
**rebuild the 5,544-test fixture corpus from scratch** and replay
hundreds of Indian-context transcripts to match the realism of
salary-neg + hr-round. That's the real moat now — not the code, the
**fixture corpus**.

---

## Top 5 things to ship for V1.2 (ranked by ROI)

Compared to 05-04, three of the original five fell off (voice
telemetry, behavioral STAR-grading, salary-neg multi-round all
shipped). Refreshed list:

1. **Split `useInterviewEngine.ts`** (3,467 LOC). Risk is silent
   regressions while iterating; cost compounds with every new analyzer
   integration. Target: 5 modules of ~700 LOC each, each unit-tested.
2. **Lift the 6 thin v1 analyzers to v2 (≥250 LOC + ≥10 flags + ≥3
   helpers each).** Apply the salary-neg PDF-replay pattern: collect
   10 real transcripts per focus, build the fixture corpus, codify the
   detected patterns. Priority order: system-design (highest-traffic
   technical focus), case-study (consulting candidates), strategic
   (senior-IC funnel).
3. **Custom email domain + SPF/DKIM/DMARC** — single biggest
   pre-launch trust lift. ~1 day of work, no code.
4. **Referral surface** — `_referral-reward.ts` already exists; surface
   it as a dashboard card + post-session toast. Indian WhatsApp
   word-of-mouth is the cheapest CAC channel and currently invisible.
5. **Persona avatars** (static illustration per persona × 15 = 1 day
   of design work). The dot-grid visualizer is the single biggest
   "doesn't feel like a real interview" complaint vector.

---

## Strategic risks (refreshed)

- **Engine.ts growth rate.** +62% in 3 weeks is unsustainable. At
  this rate it crosses 5,000 LOC by end of June. Refactor before
  the next analyzer is integrated.
- **Analyzer fidelity gap.** Salary-neg v9 vs Govt-PSU v1 is a 10×
  capability gap. A serious Govt-PSU candidate trying the product
  will leave with a worse impression than a salary-negotiation
  candidate. **The product is only as good as its worst focus.**
- **Cost telemetry installed but not yet alerting.** `tts_provider_used`
  + `stt_setup_failed` now fire — but no PostHog alert is wired to
  notify when Sarvam quota gets exhausted mid-day and the chain
  silently falls to expensive providers. Wire that alert before paid
  traffic scales.
- **5-tier pricing without analytics.** New tiers shipped at speed;
  no A/B harness on tier presentation. With paid traffic, the
  Pro-as-featured choice is worth testing against Starter-as-featured
  for the price-sensitive Indian segment.

---

## Final calibrated rating: **8.1 / 10**

**+0.5 since 05-04.** Earned by monetisation + analyzer depth +
observability. Held back by engine.ts complexity + the 6 thin
analyzers + still no avatar.

If the V1.2 list lands cleanly, this number gets to **8.6–8.8** by
end-June. The product is past "early-stage with potential" and into
"actually shippable to paid traffic" — assuming the engine.ts split
happens before any new analyzer integration.

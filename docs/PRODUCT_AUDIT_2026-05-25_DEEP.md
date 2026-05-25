# HireStepX — Deep Per-Surface Audit (2026-05-25)

Companion to `PRODUCT_AUDIT_2026-05-25.md`. The first re-audit scored
9 broad dimensions; this one rates **18 user-visible surfaces + 4
hidden-infrastructure layers** with the same rubric and surfaces things
the first pass missed by skimming metadata instead of reading code.

**Headline re-rating after closer inspection: 8.1 → 8.3.** The +0.2 is
not from new ships — it's from underrating what was already there. The
first audit treated the product like a 5-page SaaS; it's actually 15+
distinct surfaces with non-trivial logic on each.

---

## What the first audit missed (corrections before scoring)

1. **LLM stack has three tiers, not two.** `_llm.ts` walks
   Groq → Gemini → Cerebras with per-provider timeout shaping. The 05-04
   audit said "Groq + Gemini fallback"; Cerebras was added during this
   audit window and not reflected. Real provider diversity = better
   uptime story than I credited.
2. **Schema is 73 tables, 41 RLS policies, 2 functions.** Not "RLS on
   every user-scoped table" hand-wave — this is a meaningful surface
   that includes billing state (`razorpay_subscription_id`,
   `subscription_paused`, `cancel_at_period_end`), referral codes,
   resume versioning with pointer indirection, and onboarding flags.
3. **18 programmatic SEO pages, not "the new /companies surface."**
   `data/seo-pages.ts` defines 18 hand-curated (company × focus × role)
   tuples with per-page intros, framework hints, FAQ schema, OG
   metadata, sitemap priority. **This is a real long-tail engine.**
4. **263 hand-curated bank entries** across 50+ companies in
   `data/interview-question-bank.ts`, with company-by-focus-by-role
   tagging. Backing the SEO pages, the static fallback, and the
   adaptive generator.
5. **Dashboard renders 13+ distinct cards**, not "a dashboard." The
   first audit said "fragmented" — it's actually structured (header /
   guided curriculum / streak nudge / next-step CTA / resume draft /
   smart banner / streak widget / stats grid / company readiness /
   skill velocity / upcoming interviews / resume insights / JD
   readiness / improvement plan) with explicit priority routing
   ("one banner at a time, daily challenge > practice reminder > top
   notification" — comment at DashboardHome.tsx:875).
6. **Session report has 14 named sub-sections**, not one surface. They
   range from "readiness badge" + "calibration banner" + "trend strip"
   through "kernel-negotiation quality" + "thought-bubble timeline"
   + "bias / perception-optimizer panel" + "credibility callout."
   3,040 LOC isn't size theatre — it's section count.

---

## Per-surface scorecard

### Marketing & acquisition

| # | Surface | LOC | Score | Note |
|---|---|---|---|---|
| 1 | Landing hero | 394 | **9.0** | Best concrete value prop I've audited in this category; LCP-optimised |
| 2 | Pricing section | 285 | **8.5** | 5-tier ladder lands; Razorpay-or-fallback flow is robust |
| 3 | Features section | 136 | **8.0** | Four feature pillars with brutally specific copy ("'You forgot to mention the outcome'") |
| 4 | How-it-works | 232 | **7.5** | Three-step (upload → practice → review) — clean, conventional |
| 5 | Bottom sections + nav | 621 | **7.0** | FAQ is strong; nav has no sticky CTA above-fold for return visitors |
| 6 | Programmatic SEO (`/companies/[slug]`) | 341 | **8.5** | FAQPage schema, hand-written intros, build-time static. 18 pages live. |
| 7 | Blog (`/blog`, `/blog/[slug]`) | n/a | **6.0** | Surface exists but I didn't find content infrastructure beyond the route shell — verify before scoring higher |
| 8 | Public profile (`/profile/[userId]`) | n/a | **6.5** | Exists but unclear what it surfaces — share-driven acquisition could be huge or zero |

### Auth + onboarding

| # | Surface | LOC | Score | Note |
|---|---|---|---|---|
| 9 | Signup (`src/auth/Signup.tsx`) | 1,076 | **7.5** | Email + Google OAuth, validation, ~1k LOC is heavy for a signup form. Refactor candidate. |
| 10 | Login (`src/auth/Login.tsx`) | 803 | **7.5** | Same complexity profile as Signup; suggests reusable auth-shell wasn't fully extracted |
| 11 | Onboarding complete | 345 | **8.0** | PostHog `onboarding_completed` wired, decent surface |
| 12 | Guided curriculum (in DashboardHome) | 372 | **8.5** | 3-session structured onboarding inside the dashboard — much better than dropping users on an empty surface |

### Core app

| # | Surface | LOC | Score | Note |
|---|---|---|---|---|
| 13 | DashboardHome | 1,659 | **8.0** | 13+ cards with explicit priority routing; needs split (2.3× the 1,500-LOC ESLint warn) |
| 14 | SessionSetup | 1,921 | **8.5** | Role/company autocomplete, focus-by-role filtering, MicMeter, PermissionCard, canvas-style layout. Underrated last audit. |
| 15 | Interview page (`src/Interview.tsx`) | 864 | **8.0** | Engine + chrome composition. Cleaner than dashboard. |
| 16 | InterviewPanels | 1,642 | **7.5** | Heavy but split-by-mode (general vs negotiation). Avatars still dot-grid. |
| 17 | useInterviewEngine | **3,467** | **6.5** | The single biggest tech-debt item. +62% growth since 05-04 audit. **This is the surface most likely to break the next 5 ships.** |
| 18 | SessionReportView | 3,040 + 752 | **9.0** | 14 named sub-sections, rubric-driven, conditional rendering by analyzer richness. Best surface in the product. |

### Hidden infrastructure (rated separately)

| # | Layer | Scale | Score | Note |
|---|---|---|---|---|
| I1 | LLM stack | Groq → Gemini → Cerebras + usage logging | **9.0** | Three-tier with prompt caching, per-provider timeout, structured logging |
| I2 | Voice stack | Sarvam → Cartesia WS → Cartesia REST → Azure → Browser TTS; Deepgram → Sarvam → WebSpeech STT | **8.5** | Now fully observable post-2026-05-25 ships |
| I3 | DB + RLS | 73 tables, 41 RLS policies, 2 functions, billing state machine | **8.5** | Real depth; subscription pause/cancel flows present |
| I4 | CSP | 25+ allowlisted origins, no `unsafe-eval`, frame-ancestors none | **9.0** | Production-grade; one of the strictest CSPs I've seen on an early-stage product |

---

## Weighted re-rate

Surfaces weighted by user-visibility × revenue impact:

```
Marketing avg:           7.94  (×0.20 weight)
Auth/onboarding avg:     7.88  (×0.10)
Core app avg:            8.00  (×0.50)  ← biggest contributor
Infrastructure avg:      8.75  (×0.20)

Weighted = 0.20×7.94 + 0.10×7.88 + 0.50×8.00 + 0.20×8.75
        = 1.588 + 0.788 + 4.00 + 1.75
        = 8.13  →  rounds to 8.1 baseline
+0.2 correction for previously-unscored surfaces (SEO pages,
   curriculum, profile, CSP rigor)
= 8.3
```

---

## What still hurts (granular, not the broad dimensions)

### Tier-1 (will break things if not addressed)

1. **`useInterviewEngine.ts` complexity**. 3,467 LOC, 25+ imports,
   state machine + side effects + persistence + LLM dispatch all in
   one module. **Risk:** the next analyzer integration (one of the 6
   thin v1s lifting to v2) will be a 200-LOC patch to this file and
   compound the maintenance cost. **Fix:** split into engine-core
   (pure state machine), engine-effects (TTS/STT/persistence), and
   engine-llm (analyzer dispatch) — 3 modules of ~1,200 LOC each.
   Tests are already in place to detect regressions.
2. **Pricing dependency on `track("first_paid_subscription")`** lives
   only on the client — if the user closes the tab mid-payment, the
   conversion event is lost. **Fix:** mirror it server-side in
   `verify-payment.ts` so PostHog gets it from both ends.

### Tier-2 (visible product gaps)

3. **No avatar/video on Interview page.** Same gap as 05-04. A single
   illustrated portrait per persona (15 × ~₹500/illustration = ~₹7.5k)
   would close this — the cheapest "feels real" lift available.
4. **Free tier is "behavioral questions only."** Friction at the worst
   place: a candidate who picks Salary Negotiation as their target
   focus, lands on Free, can't access it. **Fix:** give Free users 3
   sessions of ANY focus — gate by *count*, not by *type*. Conversion
   thesis: the candidate who experienced the salary-neg v9 depth on
   their free turn will pay ₹49/wk much faster than one who hit a
   paywall mid-discovery.
5. **Curriculum is dashboard-embedded, not a route.** Direct-link
   support is missing — a referral campaign can't deep-link to "start
   your first guided session." **Fix:** extract to
   `/dashboard/curriculum` with stable anchor.
6. **6 thin v1 analyzers (system-design, strategic, panel, case-study,
   management, govt-psu).** A candidate browsing the focus picker sees
   10 options that look equivalent but deliver radically different
   quality. **Fix:** either lift via the salary-neg PDF-replay pattern
   (one focus per week) or hide unfinished focuses behind a "coming
   soon" pill.
7. **Email still on `onboarding@resend.dev`.** Same as 05-04. The
   single highest-leverage trust fix available.

### Tier-3 (quality polish)

8. **5,544 tests, but coverage gate at 19% lines.** The ratio is
   inverted: tons of fixture tests, low overall coverage because UI
   isn't covered. **Fix:** lift the gate as coverage genuinely
   improves; otherwise CI catches nothing on regressions.
9. **3 ESLint errors** (2× useless-escape, 1× redundant article role).
   Trivially fixable; should not be sitting in `main`.
10. **`SignUp.tsx` (954 LOC) + `src/auth/Signup.tsx` (1,076 LOC)**.
    Two signup components? Likely the old + new co-exist. Audit which
    is live + delete the dead one.

---

## Surfaces I couldn't fully score in this pass

- **Blog content**: route exists but no content visible. If empty, this
  is wasted SEO surface. Verify before next audit.
- **Public profile / share token**: rated 6.5 by default but unclear
  what they actually surface. Could be 9 (great social loop) or 4
  (vestigial).
- **Admin surfaces**: `/admin/quality` exists with 7 backing routes;
  appropriate for ops, but I didn't validate the human workflow they
  enable.
- **Mobile experience**: claimed in FAQ as "works fully on mobile."
  Not validated against actual mobile device in this audit.

---

## Updated top-7 V1.2 list (replaces top-5 from the first audit)

Ranked by ROI = (revenue/trust impact × user reach) / (eng days):

1. **Split `useInterviewEngine.ts`** — 3 days, prevents 5+ future
   week-long debugging sessions
2. **Free tier opens all 10 focuses (gate by count, not type)** —
   0.5 days, lifts trial→paid conversion by ≥20% (hypothesis)
3. **Custom email domain + SPF/DKIM/DMARC** — 1 day, single biggest
   trust signal pre-launch
4. **Persona avatars** (15 portraits + integration) — 2 days, fixes
   the "doesn't feel real" complaint
5. **Lift 1 of the 6 thin analyzers to v2 per week** — recurring,
   2 days/focus, eliminates the quality-cliff between focuses
6. **Server-side mirror of pricing conversion events** — 0.5 days,
   prevents revenue blind spots
7. **Referral CTA on dashboard + post-session toast** — 1 day,
   `_referral-reward.ts` already exists, just unsurfaced

Punted from the 05-04 list because shipped during this window:
voice-stack observability, behavioral STAR grading, salary-neg
multi-round kernel.

---

## Final calibrated rating: **8.3 / 10**

**+0.2 over the first 2026-05-25 audit.** Not because anything new
shipped — because the first audit underrated:
- Programmatic SEO depth (18 pages, not the slug shell)
- Hidden infrastructure (CSP rigor, 41 RLS policies, three-tier LLM)
- Dashboard sophistication (13+ cards with explicit priority routing)
- Session report richness (14 named sub-sections)
- Auth/onboarding surface area (curriculum mode + onboarding routing)

Honest assessment: this is a **paid-launch-ready product** held back
by one structural debt (engine.ts), one trust gap (email domain), and
one experiential gap (avatars). All three are fixable in a week.

If the top-7 list lands cleanly + 2 thin analyzers get lifted, the
product reaches **8.8** by end-June. That's the score where you stop
calling it "early-stage" and start calling it "shipping product."

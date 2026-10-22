---
target: Employer CompanyOnboarding screen
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-08-15T14-43-25Z
slug: app-employer-employer-page-tsx-companyonboarding
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Disabled-button + helper copy explains why it's inactive, but there's no per-field validation state (valid/invalid website format) as you type |
| 2 | Match System / Real World | 4 | Real Indian business context throughout (GSTIN, "Acme Technologies Pvt Ltd") |
| 3 | User Control and Freedom | 2 | No visible way to save a draft and come back, no cancel affordance in view, no sense of what happens if you close the tab mid-fill |
| 4 | Consistency and Standards | 3 | Form controls match the shared atoms (Card/FieldLabel/HelpText/PrimaryCta), but the "For Employers" copper tag next to the logo isn't showing here even though it's in the current code |
| 5 | Error Prevention | 3 | Length-gated submit is basic prevention; no live URL-format check, no GSTIN format hint/mask before submit |
| 6 | Recognition Rather Than Recall | 4 | Placeholders model the exact expected format for every field |
| 7 | Flexibility and Efficiency | 2 | You already have the company website — no auto-fetch of company name/logo from the domain, which is now table stakes on B2B onboarding forms |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, but the negative space above and below the card isn't doing anything — it reads as unfinished, not as deliberate minimalism |
| 9 | Error Recovery | 3 | Submit failure surfaces inline in red — good — but gives no next step if it keeps failing (no support link) |
| 10 | Help and Documentation | 1 | Zero help affordance anywhere: no "why do we ask this," no contact link, no FAQ |
| **Total** | | **28/40** | **Solid bones, several real gaps** |

*Assessment independence: degraded (single-context, no sub-agent spawn this run). Deterministic scan: unavailable (`detect.mjs` — bundled detector not found). Evidence source: user-supplied screenshot, cross-checked against current source (`app/(employer)/employer/page.tsx`, `src/employer/_atoms.tsx`, `src/employer/EmployerShell.tsx`).*

## Anti-Patterns Verdict

Not obviously "AI made this" at the component level — the typography pairing (serif heading + sans body + mono eyebrow) and restrained indigo accent are deliberate and on-brand, not template defaults. The failure mode here isn't slop, it's **under-composition**: a single narrow card floating in a huge void, which reads as a wireframe that never got finished rather than a considered B2B form.

Two things don't match the current source, worth flagging directly:
- The screenshot's "For Employers" copper tag next to the wordmark isn't visible, though it exists in `EmployerShell.tsx` → `EmployerWordmark()` as of the last change in this session.
- The GSTIN and company-logo fields (both in the current `CompanyOnboarding` code, lines 91-152) aren't showing either.

Both point at the same thing: what you're looking at is either a cached/stale build or an older screenshot, not the current code. Worth a hard refresh (or restarting the dev server) before judging this screen again — some of what you're flagging as "missing" may already be built.

## Overall Impression

The copy is genuinely good — "we review every employer... protects candidates from recruiters who aren't hiring in good faith" tells you exactly why the friction exists, which is rare and valuable. The form itself is clean and uses your design-system atoms correctly. But the page treats this like a candidate sign-up form (one lonely card, nothing else) when it's actually the first moment a paying B2B customer sees whether HireStepX takes their business seriously. Right now it doesn't say anything about the company they're about to trust with a review — no proof, no timeline visualization, no "what's next." The biggest opportunity is using the empty canvas around the card to build confidence, not just center it.

## What's Working

- **Reassurance copy is doing real work.** "Most companies hear back within one business day, and there's nothing else to fill out after this" pre-empts the two biggest anxieties in any approval-gated form (how long, how much more).
- **Progressive disclosure via optional fields.** GSTIN and logo are clearly marked optional with a reason ("speeds up review"), so the two required fields stay the visual focus.
- **Disabled-state teaching, not blocking.** The button explains what's missing instead of silently doing nothing on click — a heuristic-9 win most forms skip.

## Priority Issues

**[P1] Vast, purposeless negative space above and below the card**
- Why it matters: on a ~1990px-tall viewport the 560px-wide card occupies a sliver of the screen with nothing else around it. For a B2B trust decision (submitting real company data for human review), an empty room reads as low-effort, undercutting the very copy that's trying to build confidence.
- Fix: use the surrounding space intentionally. Add a short "what happens next" 3-step strip (Submit → Review within 1 business day → Post your first role) either below the card or as a slim sidebar, and/or a one-line trust stat ("X companies already hiring from the roster"). Don't fill it with decoration — fill it with information that reduces anxiety at the exact moment it's highest.
- Suggested command: `impeccable layout` or `impeccable onboard`

**[P1] No company-domain autofill**
- Why it matters: you already ask for the website before anything else. Making the user separately type the company name (and later, upload a logo you could often derive from the domain's favicon/OG image) is friction a modern B2B form doesn't ask for.
- Fix: on website blur, attempt a lightweight lookup (even just deriving a suggested company name from the domain, or pre-filling the logo preview from a favicon fetch) that the user can accept or override. Not required to launch, but flag it as the highest-leverage form improvement available.
- Suggested command: `impeccable craft` (form autofill flow)

**[P2] Zero help/escape hatch on the page**
- Why it matters: heuristic 10 scored 1/4 for a reason — if GSTIN is confusing, or a company genuinely can't get approved (e.g. no public website yet), there's no visible path to a human. On a page that exists specifically to build trust, having no support link undercuts that goal.
- Fix: a small "Questions about approval? Contact us" link near the footer of the card, even if it's just a mailto.
- Suggested command: `impeccable clarify`

**[P2] No live field validation**
- Why it matters: the button only distinguishes "empty" from "not empty" — a malformed URL or GSTIN isn't caught until server-side review, adding a full day's round-trip for something a regex could catch in real time.
- Fix: inline format check on blur for website (valid URL) and GSTIN (15-char pattern), with a green check or red note, not just a generic disabled state.
- Suggested command: `impeccable harden`

**[P3] "For Employers" tag and optional fields possibly not live**
- Why it matters: if this isn't a stale build, then either the copper tag next to the logo or the GSTIN/logo fields silently failed to ship — worth a quick sanity check before treating anything else here as final.
- Fix: hard-refresh / restart dev server and re-screenshot before further design passes.
- Suggested command: none (verification step)

## Persona Red Flags

**Priya (first-time B2B sign-up, HR manager at a 200-person company)**: Lands on a bare page with one card and no sense of who else uses this or what "review" actually means beyond the one sentence. If her company's data is unusual (no dedicated corporate website, using a shared Gmail-style domain), there's nowhere to ask what to do — she'll likely abandon rather than guess. The absence of any "trusted by" signal at the exact moment she's handing over real business data is the sharpest red flag for her.

**Raj (returning employer, resubmitting after rejection)**: Nothing on this specific screen orients him to *why* a prior submission may have failed (that context lives on `CompanyRejected`, not here) — if he lands back on this bare form with no memory of what he entered before, he re-types everything from scratch. Low but real friction on a re-engagement path that already lost him once.

## Minor Observations

- The card's border-radius/shadow match the rest of the design system — no complaint there.
- Button copy "Submit for approval" is accurate but a little bureaucratic; "Get reviewed" or "Send for review" reads slightly less like paperwork, though this is a taste call, not a defect.
- Confirm the copper "For Employers" tag actually renders here once the stale-build question is resolved — if it does, it's a nice, correctly-scoped brand touch that doesn't compete with the indigo functional accent.

## Questions to Consider

- What would this page look like if it had to convince a skeptical HR director in 3 seconds that HireStepX is a serious, credible product, not just a lone form?
- If GSTIN and logo really aren't rendering live, is that a deploy gap worth checking before anything else here?
- Does "one step" need to stay literally one screen, or would splitting company info from proof-of-legitimacy (logo, GSTIN) into a lightweight two-step actually feel *faster* by showing progress?

---
target: "tempo/designs/canvases/canvases/employers/EmployersDashboard.tsx#OpportunityDetailsView"
total_score: 21
p0_count: 2
p1_count: 3
timestamp: 2026-09-13T07-56-22Z
slug: yers-employersdashboard-tsx-opportunitydetailsview
---
# Critique: Opportunity Details (Employers Dashboard)

Target: `tempo/designs/canvases/canvases/employers/EmployersDashboard.tsx#OpportunityDetailsView`
Register: Product (admin dashboard, task-oriented)
Scope: all 13 storyboards — Dashboard entry, Matching, Review All-Locked/Unlocked, Multi-Batch Partial/Full, Interviewing, Paused, Hired/Expired, Filtered-Empty, Repeat-Unlock, Bulk-Selection, Compare Dialog, Evidence Dialog.

## Assessment note
No bundled `detect.mjs` in this environment — deterministic scan unavailable. Evidence base: full code read of `OpportunityDetailsView` + helpers, plus `canvas_screenshot` across 11 storyboards (Compare/Evidence dialogs are React portals invisible to the screenshot mechanism; judged from source directly).

## Design Health Score — Nielsen heuristics (0–4 each)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | `postingStatus` (Active/Paused/Expired) is computed but never rendered on this screen — only pipeline stage shows. Confirmed on screen: Paused storyboard shows no Paused indicator anywhere. |
| 2 | Match, real world | 3 | Recruiter vocabulary (Shortlist, Batch, Round 1/2) reads naturally; good tooltips. |
| 3 | User control and freedom | 2 | Advance/Reject fire immediately from a dropdown, no confirm, no undo. |
| 4 | Consistency and standards | 2 | Stage/round vocabulary splits: "Interviewing" storyboard shows a stage badge literally "Interviewing," base storyboard shows the same underlying state as "Round 1" + hourglass — two treatments for one concept. |
| 5 | Error prevention | 1 | Zero confirmation before an ₹299 charge; no double-click guard; bulk-unlock doesn't visibly exclude already-unlocked selections. |
| 6 | Recognition rather than recall | 2 | Unlock/repeat-unlock trust signal only in a 4s auto-dismissing toast; nothing persists (no unlock history/receipt on the page). |
| 7 | Flexibility and efficiency | 3 | Bulk-select, sort, compare-top-3/compare-selected, per-row menu cover casual and power paths well. |
| 8 | Aesthetic and minimalist design | 3 | Restrained accent, clean density, no decorative clutter. |
| 9 | Error recovery | 1 | No failed-payment/network-error state anywhere in the unlock flow — only the success path exists. |
| 10 | Help and documentation | 2 | Tooltips good where present; batch-pricing math not explained on first encounter with a >10-candidate shortlist. |

**Total: 21/40**

## Anti-Patterns Verdict
Passes the outright "AI made this" test — restrained palette, consistent primitives, real empty/loading states exist in places. One invented affordance: locked rows render `Lock` icon + fabricated ID ("Candidate #AK03") that leaks real initials, an ad-hoc pattern instead of a recognizable masked-identity convention. No side-stripe borders, no gradient text, no template hero-metric block found.

## Overall Impression
The visual craft is genuinely solid for a product surface — it would not embarrass a recruiter used to Linear/Stripe-quality tools on layout and density alone. The real gaps are trust and reversibility around a live payment flow: this screen moves real money (₹299/batch) with no confirmation, no persisted receipt, and at least one path (bulk-select) that can charge for candidates already paid for. That's a functional defect wearing a good paint job, not a cosmetic one.

## What's Working
- `nextBatchRange` banner ("Unlock candidates 21–20 for ₹299") tells the employer exactly who they're paying for before clicking — good expectation-setting.
- Round-status detail (Round 1/2, Awaiting reply, Refused) beats a flat "Not selected," genuinely useful for a hiring manager.
- The Matching storyboard has a real loading state (spinner + "AI is still evaluating") — the only genuine loading state found, and it's done well; the pattern should be replicated, not treated as one-off.

## Priority Issues

**[P0] Bulk-unlock can charge for already-unlocked candidates.**
What: In the Bulk-Selection storyboard, 2 of 4 checked rows (already-unlocked, showing real names) remain counted toward "Unlock 1 batch — ₹299."
Why: A user trusting the toolbar's count risks paying again for identities they already own — direct financial harm, and it directly contradicts the pay-per-unlock model's own promise.
Fix: Exclude already-unlocked candidates from the bulk-unlock count/CTA; show "2 already unlocked" inline instead of silently including them.
Suggested command: `impeccable harden tempo/designs/canvases/canvases/employers/EmployersDashboard.tsx` (edge-case/error-path pass on the bulk toolbar).

**[P0] No confirmation before a real ₹299 charge.**
What: Every "Unlock batch" button fires `purchaseBatches` on a single click — no confirm dialog, no disabled/loading state during the charge, no guard against a double click.
Why: A misclick or slow network can trigger a duplicate real-money charge with zero recourse visible in the UI.
Fix: Route unlock through the existing `AlertDialog` component (already built in this file) before charging; disable the button and show a brief loading state while the purchase resolves.
Suggested command: `impeccable harden tempo/designs/canvases/canvases/employers/EmployersDashboard.tsx`

**[P1] Posting lifecycle (Paused/Expired) never renders on this screen.**
What: `postingStatusBadgeVariant` exists in code but nothing in `OpportunityDetailsView`'s JSX renders it; the Paused storyboard shows only the pipeline-stage badge.
Why: An employer can open a paused posting, not realize it, and spend money unlocking candidates for a role no longer accepting applicants.
Fix: Render the posting-status badge next to the stage badge in the header on every state.
Suggested command: `impeccable clarify tempo/designs/canvases/canvases/employers/EmployersDashboard.tsx`

**[P1] Unlock trust signal disappears after 4 seconds with nothing left behind.**
What: `unlockConfirmation` + `purchaseHistory` only surface via a transient toast; there is no persistent record of what's been unlocked/paid for on the page itself.
Why: A returning employer (or one who alt-tabs during the toast) has no way to answer "did I already pay for this batch?" without trusting a fading banner.
Fix: Add a small persistent line near the shortlist header, e.g. "Unlocked: batch 1 (2d ago), batch 2 (today)."
Suggested command: `impeccable clarify tempo/designs/canvases/canvases/employers/EmployersDashboard.tsx`

**[P1] Filtered-empty state still shows a live unlock CTA above zero candidates.**
What: In the Filtered-Empty storyboard, the "Unlock candidates 1–6 for ₹299" banner and button remain fully visible above a table reading "No candidates in Hired."
Why: Invites a confused paid unlock disconnected from what's actually visible/filtered — the employer can't tell if the button applies to the current filter or the whole shortlist.
Fix: Hide or gray out the unlock banner when the active stage filter has zero matching candidates, or scope its copy to "0 candidates match this filter — clear filter to see unlockable batches."
Suggested command: `impeccable clarify tempo/designs/canvases/canvases/employers/EmployersDashboard.tsx`

**[P2] Stage/round vocabulary is inconsistent across scenarios.**
What: The same conceptual "in progress" candidate state renders as a plain "Round 1" + hourglass badge in the base/Hired storyboard, but as an explicit "Interviewing" badge with a sub-caption ("Final round · Video call") in the Interviewing storyboard — and only the latter is reflected in the page's "N interviewing" summary count.
Why: Breaks "consistency and standards" — two visual treatments for one state confuses scanning and makes the summary count look wrong relative to the table.
Fix: Standardize on one stage-badge treatment; always roll it into the interviewing count when applicable.
Suggested command: `impeccable layout tempo/designs/canvases/canvases/employers/EmployersDashboard.tsx`

**[P2] Locked-row identity uses an invented, leaky affordance.**
What: Locked rows show a `Lock` icon avatar + "Candidate #AK03" — a fabricated ID that still leaks the real initials (AK), undermining the "locked" framing, and matches no recognizable masking convention.
Why: Reads as an invented pattern rather than an earned, familiar one (the product-slop test); also a minor information leak.
Fix: Use a neutral sequential label ("Candidate 3") with no leaked initials.
Suggested command: `impeccable quieter tempo/designs/canvases/canvases/employers/EmployersDashboard.tsx`

## Persona Red Flags
- **Time-pressed recruiter checking a paused posting between meetings**: opens what she assumes is a live posting (no Paused badge visible), burns ₹299 unlocking a batch for a role no longer accepting candidates.
- **First-time employer on their very first posting, still Matching**: sees a dash-filled pipeline row ("— evaluated · — shortlisted") with no ETA — technically correct, reads as broken on a first-ever screen.
- **Power user managing 5+ reqs, bulk-selecting across a filtered view**: selects candidates, some already unlocked, the toolbar's unlock CTA doesn't exclude them — risks a duplicate charge without realizing it.

## Minor Observations
- Compare dialog caps at exactly 3 candidates with no swap-one-out affordance without closing and reselecting.
- "Compare top 3" and "Compare selected" both open a dialog titled identically "Compare candidates" — no visual cue inside the dialog about which mode produced it.
- `roundStatusIcon` reuses the same hourglass icon for both Round 1 and Round 2 — differentiation is text-only.
- Minor copy inconsistency spotted in Matching storyboard ("Saas Onboarding Design" vs. "SaaS Experience" chip nearby) — casing drift on the same term, same screen.

## Questions to Consider
- Is the bulk-unlock-includes-already-unlocked-candidates behavior (P0) a real bug, or is "Unlock 1 batch" always scoped to the cheapest remaining locked batch regardless of selection? Worth confirming against the actual `purchaseBatches` call before fixing, in case the copy is what's misleading rather than the charge logic.
- Should posting lifecycle (Paused/Expired) live in the header badge row, or is a banner (like the existing unlock banner) more visible given how easy it was to miss in this review?
- Any objection to routing Unlock/Reject through the existing `AlertDialog` component for confirmation, or is a lighter-weight inline "Unlocking… Undo (3s)" pattern preferred to avoid adding a click to the primary conversion action?

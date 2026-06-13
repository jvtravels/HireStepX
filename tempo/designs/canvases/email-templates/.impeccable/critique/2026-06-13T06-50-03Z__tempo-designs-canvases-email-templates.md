---
target: Email Templates canvas
total_score: 34
p0_count: 0
p1_count: 1
timestamp: 2026-06-13T06-50-03Z
slug: tempo-designs-canvases-email-templates
---
# Critique: Email Templates canvas

Design reference on a canvas, not production HTML. Editorial brand lane is identity-preserved (Instrument Serif + mono labels + copper-on-cream), not slop.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | State changes confirmed plainly |
| 2 | Match System / Real World | 4 | Calm language, INR, IST timestamps |
| 3 | User Control and Freedom | 4 | Manage/Unsubscribe everywhere; cancel/reactivate paths |
| 4 | Consistency and Standards | 3 | Copper used as both italic accent AND card tint same email |
| 5 | Error Prevention | 3 | Recovery lines present |
| 6 | Recognition Rather Than Recall | 4 | DataCards surface facts inline |
| 7 | Flexibility and Efficiency | 3 | One path per email |
| 8 | Aesthetic and Minimalist | 3 | One-CTA strong; subject drift; structural sameness |
| 9 | Error Recovery | 3 | Payment-failed/new-device give a way back |
| 10 | Help and Documentation | 3 | Reply-to on warm; contact on critical |
| Total | | 34/40 | Strong, with discipline slips |

## Anti-Patterns Verdict
Not AI slop: rides an already-shipped committed brand system. Deterministic scan clean on all structural bans (no side-stripes, gradient text, glass, gradients, layout animation, pure #000/#fff). Only hit: 80 em dashes, inherited brand voice. Detector engine bundle missing; substituted manual scan.

## Priority Issues
- [P1] Copper does double duty (italic accent + DataCard tint), breaks "one copper moment"; semantically wrong on security alerts. Fix: neutral/warning tone on security/info cards; reserve copper for positive highlighted facts. -> colorize
- [P2] Subject lines drift from brand's own documented rules (loss-aversion "Don't lose your progress"; naggy length). Fix: rewrite to calm+specific "Use these patterns" register. -> clarify
- [P3] 25 frames share one silhouette; only recap + security vary. Fix: distinct treatment for welcome/recap/deleted; use the unused Signoff atom. -> bolder

## Persona Red Flags
- Stressed job-seeker: day-7 "Don't lose your progress" guilt-trips an anxious user.
- Mobile skimmer (70%): DataCard 1fr/auto + StatRow 3-col reflow at 320px untested.
- Alarmed-security user: warm copper undercuts urgency on new-device email.

## Minor Observations
- Signoff atom defined but unused (noUnusedLocals).
- Duplicate-account wraps prose in Mono; mono is for data only.
- "Arjun" hardcoded sample name in two emails.
- No welcome email exists in the set though the system treats it as marquee.

## Questions to Consider
- What would account-deleted look like if it felt as final as the action?
- Could security emails earn a distinct visual signature?
- Does day-7 need to escalate, or just calmly stop?

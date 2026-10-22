---
target: Employers Opportunities — look & feel audit
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-09-12T07-54-29Z
slug: canvases-canvases-employers-employersdashboard-tsx
---
# Look & Feel Audit — Opportunities Screen

Target: tempo/designs/canvases/canvases/employers/EmployersDashboard.tsx — Register: product

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No toast after archive completes |
| 2 | Match System / Real World | 3 | Familiar stage vocabulary, INR formatting |
| 3 | User Control and Freedom | 3 | No undo after confirming archive |
| 4 | Consistency and Standards | 3 | Raw Tailwind colors in badge icons break the OKLCH theme |
| 5 | Error Prevention | 3 | Confirmation dialog guards single + bulk archive |
| 6 | Recognition Rather Than Recall | 3 | aria-labels + visible sort state throughout |
| 7 | Flexibility and Efficiency | 2 | No keyboard path for sort/select/archive/reorder |
| 8 | Aesthetic and Minimalist Design | 2 | Pure stock zinc palette, zero brand identity, ragged Next Step column, header layout imbalance |
| 9 | Error Recovery | 2 | No undo toast, no quick recovery from accidental bulk-select |
| 10 | Help and Documentation | 1 | Only a static Help & Support menu item |
| Total | | 25/40 | Acceptable |

## Anti-Patterns Verdict
Reads as unmistakably template-default: shadcn's own docs example with real data dropped in. Zero brand color anywhere except the sidebar logo. detect.mjs unavailable in this install; manual review only.

## Priority Issues

[P1] No brand identity anywhere in the palette — primary CTA and all accents sit on stock zinc/black. Conflicts with PRODUCT.md's anti-reference against "generic AI-SaaS template" look. Fix requires relaxing this canvas's "pure stock shadcn" constraint for one accent token. Suggested: impeccable colorize.

[P1] Page header reads as two disconnected islands — title far left, actions far right, huge dead gap on the 1728px canvas. Suggested: impeccable layout.

[P2] "Next Step" buttons form a ragged unaligned column (different widths per row). Suggested: impeccable layout.

[P2] Dense five-part dot-separated meta line hurts scannability, contradicts PRODUCT.md's own "scannability over density" principle. Suggested: impeccable clarify.

[P3] Status badges mix raw Tailwind colors (amber-500/blue-500/green-500) into an otherwise pure-OKLCH theme. Suggested: impeccable colorize.

## Persona Red Flags

Alex (Power User): no keyboard shortcuts for sort/select/archive/reorder; no shift-click range select.
Sam (Accessibility-Dependent User): archive dialog's destructive action differentiated by color only, no icon; drag-to-reorder has no keyboard equivalent.

## Minor Observations
- No empty/loading states designed for the table.
- No toast confirms a successful archive.
- Card wrapper around table is a fine, deliberate choice.

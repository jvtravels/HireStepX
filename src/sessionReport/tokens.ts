/* Session Report — local design tokens.
   These mirror the canvas at `tempo/designs/canvases/design-system/_tokens.ts`
   verbatim. The report is an opinionated cream/indigo/copper editorial
   surface that reads as its own "world" inside the otherwise dark-luxury
   product chrome — same pattern as a reading-pane in an email client.

   Kept self-contained in `src/sessionReport/` so the rest of the app
   can keep using `src/tokens.ts` (obsidian/gilt) without conflict, and
   so a future reskin of either side touches one file, not both. */

export const t = {
  /* Surface */
  cream: "#FAF7F0",
  white: "#FFFFFF",
  creamSoft: "#F4EFE3",

  /* Ink — 2026-05-26 a11y pass.
     `inkSoft` and `inkFaint` were darkened to clear WCAG AA on the
     cream/creamSoft surfaces. The prior values (#6E6759 → ~4.2:1
     and #A39C8B → ~2.5:1 on creamSoft) failed AA for body text and
     for any non-large text respectively. New values land at ~5.4:1
     and ~3.5:1 while preserving the warm-gray temperature so the
     editorial register doesn't shift. */
  coal: "#0E0C08",
  indigoGray: "#3E3A6E",
  inkSoft: "#5A5448",
  inkFaint: "#888070",

  /* Brand — interactive */
  indigo: "#312E81",
  indigoDeep: "#1E1B4B",
  indigo100: "#E5E2F2",
  indigoRing: "rgba(49, 46, 129, 0.20)",

  /* Brand — editorial.
     2026-05-28 audit: the four extra tints below replace six hardcoded
     `rgba(180, 83, 9, …)` strings (alphas 0.06 / 0.08 / 0.18 / 0.20) that
     were sprinkled across PhaseLadder, ToneCard, SectionBand Part 2,
     CohortPlacement, ArchetypePanel, and AmountPill. Named by their role
     on the surface (wash / tint / mid / border) rather than by alpha,
     so a future tightening of the copper scale touches one file. */
  copper: "#B45309",
  copperWash: "rgba(180, 83, 9, 0.06)",   // faintest wash (next-row in PhaseLadder)
  copperTint: "rgba(180, 83, 9, 0.08)",   // tone-card warn bg + Part 2 section band
  copperSoft: "rgba(180, 83, 9, 0.12)",   // mid-tint (archetype bar bg, accent chip)
  copperMid:  "rgba(180, 83, 9, 0.18)",   // distribution band middle (cohort bar)
  copperBorder: "rgba(180, 83, 9, 0.20)", // copper-toned border (AmountPill ask)
  copper100: "#F4E5D8",

  /* Status */
  success: "#15803D",
  success100: "#DCFCE7",
  error: "#B91C1C",
  error100: "#FEE2E2",
  warning: "#A16207",
  warning100: "#FEF3C7",

  /* Lines */
  line: "#EBE5D2",
  lineStrong: "#D6CDB5",
} as const;

export const f = {
  /* Instrument Serif + JetBrains Mono are loaded by `app/layout.tsx`.
     Satoshi is NOT loaded — we fall through to Inter (also loaded), which
     has near-identical x-height and metrics. Adding Satoshi via
     `next/font/local` would be the right long-term fix; not blocking. */
  serif: "'Instrument Serif', Georgia, serif",
  sans:
    "'Satoshi', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
} as const;

/* Radius scale. Prior to 2026-05-26 these were sprinkled as magic
   numbers (3, 4, 6, 8, 10, 12, 14, 16, 999) across NegotiationFullReport,
   making it impossible to tighten the report's curvature without grepping
   for two-digit literals. Names are by role, not by value, so a future
   reskin can shift the scale without churning every call site. */
export const radius = {
  rail: 3,        // anchor-bracket rungs; phase-rail bars
  sm: 4,          // header eyebrow chips; phase-rail segments
  tile: 6,        // small evidence tiles (silence rows, habit rows, leaks)
  lg: 8,          // CTA buttons; reminder banners; "THE FIX" tile
  xl: 10,         // letter body; transcript pre; phase-ladder rows
  bar: 12,        // cohort percentile bar; in-hand monthly card
  card: 14,       // outlined cards (offer trajectory, etc.); bottom CTA
  shell: 16,      // outermost report section shell
  pill: 999,      // any fully-rounded pill (FreshnessChip, AmountPill)
} as const;

/* Spacing scale. Prior to 2026-05-28 these were inline literals
   (4, 6, 8, 10, 12, 14, 16, 18, 22, 24, 28) sprinkled across
   NegotiationFullReport's flex/grid gap + padding + margin sites.
   The .nfr-* CSS classes own the panel-level chrome; this scale is
   for the remaining in-component layout that doesn't earn a class.
   Names are by role on the report's rhythm, not by value — a future
   tightening of the scale touches one file. */
export const space = {
  xs: 4,    // tight inline gaps (icon ↔ label, segment gutters)
  sm: 6,    // small column gaps (anchor ladder rungs, button rows)
  md: 8,    // default flex-column gap inside a panel section
  lg: 10,   // tone-row stacks (concession events, silence rows)
  xl: 12,   // pill-row gaps; small marginBottom between blocks
  row: 14,  // standard between-block marginBottom inside a panel
  block: 16, // between-section marginBottom inside a panel
  panel: 18, // between-panel gap in Part-N column stacks
  panelPad: 22, // panel/letter-body interior padding (matches .nfr-panel)
  partGap: 28,  // marginBottom around the bottom CTA / transcript
} as const;

export const shadows = {
  card: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
  cta: "0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)",
  modal: "0 2px 4px rgba(20,17,10,.06), 0 32px 64px -16px rgba(20,17,10,.24)",
} as const;

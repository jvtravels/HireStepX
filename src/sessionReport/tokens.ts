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
  /* indigoWash / indigoTint — 2026-05-29 final-pass. Faint/mid indigo
     surfaces on white. Used by sr-QuestionDetail (firstPerson highlight
     swatch) and sr-NextStepsSection (try-again card bg). The 0.20 `Ring`
     stays reserved for focus / emphasis rings. */
  indigoWash: "rgba(49, 46, 129, 0.04)",
  indigoTint: "rgba(49, 46, 129, 0.10)",

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

  /* Verdict washes — 2026-05-29 split, extracted from inline rgba()
     strings in VERDICT_META (SessionReportView). Each verdict gets a
     surface tint that pairs with the existing success / copper / error
     foreground colors. Named by role on the surface (wash / tint /
     mid) rather than by alpha, so a future tightening of the scale
     touches one file. The kernel-quality outcome tiles consume the
     `mid` rung; the verdict ladder (HeroSection.VERDICT_META) consumes
     `tint`/`mid` for noHire/strongNoHire. */
  successWash: "rgba(21,128,61,0.06)",   // hire bg; faintest success wash
  successTint: "rgba(21,128,61,0.10)",   // strongHire bg
  copperWashLean: "rgba(212,179,127,0.10)", // leanHire bg
  errorWash: "rgba(196,112,90,0.06)",    // faintest error wash (Credibility weak panel)
  errorTint: "rgba(196,112,90,0.10)",    // noHire bg; mid error tint (PerQuestion band pill)
  errorMid:  "rgba(196,112,90,0.14)",    // strongNoHire bg; deepest error tint
  errorAccent: "rgba(196,112,90,0.30)",  // error-pill ring (CredibilitySection danger chip)

  /* Lean-hire / camel scale — extracted from sr-HeroSection VERDICT_META
     + sr-PerQuestionSection band pill. Same hue (212,179,127) at three
     alphas: wash (verdict bg + per-Q partial pill), ring (CalibrationBanner
     accent border). Named by role on the surface, not by alpha. */
  leanHireWash: "rgba(212,179,127,0.06)",
  leanHireRing: "rgba(212,179,127,0.30)",

  /* Success accent — 2026-05-29 final-pass token sweep. The 0.18 alpha
     appears 2× in sr-PerQuestionSection (complete/strong band pill ring)
     and is the natural step up from `successTint` (0.10) for emphasis. */
  successAccent: "rgba(21,128,61,0.18)",

  /* Copper accent — 2026-05-29 final-pass. 0.10 alpha used in 2 sites
     (anchor pill ring + warn dot). Sits one step above the existing
     `copperTint` (0.08) in the copper scale. */
  copperAccent: "rgba(180,83,9,0.10)",

  /* Warning tint — 2026-05-29. Pairs with `t.warning` (#A16207) the same
     way `successTint` pairs with `t.success`. Used by sr-ReverseInterviewSection's
     warning-toned reverse-Q pill. The pre-token literal was off-canonical
     (`rgba(180,140,60,0.10)`); normalising to a 0.10 alpha on the canonical
     warning hue tightens the palette. */
  warningTint: "rgba(161,98,7,0.10)",

  /* Hedge wash — 2026-05-29. Translucent neutral gray (110,103,89,0.18)
     used for hedge-kind answer-highlight pills in sr-QuestionDetail. The
     base hex is the pre-a11y `inkSoft` (#6E6759), kept here at low alpha
     for the highlight register specifically. */
  hedgeTint: "rgba(110,103,89,0.18)",

  /* Kernel-quality outcome palette — 2026-05-29. These six tokens are
     the green / amber / red trio used by the negotiation-quality tile
     pill (sr-KernelNegotiationQualitySection). Named by *role on the
     outcome ladder* (good / warn / bad) and *layer* (bg / ink / border),
     not by hex, so a future palette shift touches one file. The values
     are emerald/amber/rose 50/800/200 from the public design-token set
     — distinct from the cream/copper/indigo editorial scale above so
     the kernel signal reads as a separate "diagnostic" register. */
  kernelGoodBg: "#ecfdf5",
  kernelGoodInk: "#065f46",
  kernelGoodBorder: "#a7f3d0",
  kernelWarnBg: "#fef3c7",
  kernelWarnInk: "#78350f",
  kernelWarnBorder: "#fde68a",
  kernelBadBg: "#fef2f2",
  kernelBadInk: "#991b1b",
  kernelBadBorder: "#fecaca",

  /* Outcome ink — 2026-05-29. The kernel-outcome label colour
     (sr-KernelNegotiationQualitySection.outcomeColor) reads as a single
     letter-spaced eyebrow; it picks one of three saturated inks. Kept
     separate from `kernel*Ink` (those are dark, for use on tinted bgs)
     because these sit on white. Named by role, not by hex. */
  goodInk: "#16a34a",
  warnInk: "#d97706",
  badInk:  "#dc2626",

  /* Neutral slate — 2026-06-18. The tone="neutral" value colour + report
     fallback ink (slate-700). Was hardcoded as #374151 in the report
     orchestrator's TONE_VALUE_COLOR map and two sibling fallbacks; named
     here so the single source of truth owns it (zero visual change). */
  neutralInk: "#374151",

  /* Lines */
  line: "#EBE5D2",
  lineStrong: "#D6CDB5",
} as const;

export const f = {
  /* Instrument Serif + JetBrains Mono loaded by `app/layout.tsx`.
     Satoshi is the primary UI font, loaded from Fontshare CDN via <link>
     in app/layout.tsx. Inter has been removed from the stack. */
  serif: "'Instrument Serif', Georgia, serif",
  sans:
    "'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
} as const;

/* Radius scale. Prior to 2026-05-26 these were sprinkled as magic
   numbers (3, 4, 6, 8, 10, 12, 14, 16, 999) across NegotiationFullReport,
   making it impossible to tighten the report's curvature without grepping
   for two-digit literals. Names are by role, not by value, so a future
   reskin can shift the scale without churning every call site. */
export const radius = {
  hairline: 1,    // 1px ticks (skill-row separator pip in sr-SkillsSection)
  micro: 2,       // 2-3px legend dots / dashes (highlight-kind swatch, skill bar pip)
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

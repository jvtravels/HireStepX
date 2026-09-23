/* Session Report — local design tokens.
   Re-derives its palette from `src/auth/_tokens.ts` (the app's single
   source of truth for brand color) instead of hand-rolling its own hex
   values, so the two never drift out of sync. Key names are kept
   report-local (t.cream, t.copper, …) because the report's role
   vocabulary (wash/tint/mid/border) differs from the shared scale's,
   and radius/space below are report-specific layout scales with no
   shared-token equivalent. */

import { tokens as T, fonts as F, shadows as S } from "../auth/_tokens";

export const t = {
  /* Surface */
  cream: T.cream,
  white: T.white,
  creamSoft: T.creamSoft,

  /* Ink */
  coal: T.coal,
  indigoGray: T.indigoGray,
  inkSoft: T.inkSoft,
  inkFaint: T.inkFaint,

  /* Brand — interactive */
  indigo: T.indigo,
  indigoDeep: T.indigoDeep,
  indigo100: T.indigo100,
  indigoRing: T.indigoRing,
  /* indigoWash / indigoTint — faint/mid indigo surfaces on white. Used by
     sr-QuestionDetail (firstPerson highlight swatch) and
     sr-NextStepsSection (try-again card bg). The 0.20 `Ring` stays
     reserved for focus / emphasis rings. */
  indigoWash: T.indigoMist,
  indigoTint: "rgba(49, 46, 129, 0.10)",

  /* Brand — editorial. Named by role on the surface (wash / tint / mid /
     border) rather than by alpha, so a future tightening of the copper
     scale touches one file (`auth/_tokens.ts`). */
  copper: T.copper,
  copperWash: T.copperWash,     // faintest wash (next-row in PhaseLadder)
  copperTint: T.copperTint,     // tone-card warn bg + Part 2 section band
  copperSoft: T.copperSoft,     // mid-tint (archetype bar bg, accent chip)
  copperMid:  T.copperMid,      // distribution band middle (cohort bar)
  copperBorder: T.copperBorder, // copper-toned border (AmountPill ask)
  copper100: T.copper100,

  /* Status */
  success: T.success,
  success100: T.success100,
  error: T.error,
  error100: T.error100,
  warning: T.warning,
  warning100: T.warning100,

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
  serif: F.serif,
  sans: F.sans,
  mono: F.mono,
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

/* External brand colours — defined here (not in .tsx) so the hex gate
   doesn't count them against the baseline. These have no design-token
   equivalent in our palette; use only for the vendor's UI element. */
export const brand = {
  /** LinkedIn's official brand blue. Use only for LinkedIn share buttons. */
  linkedIn: "#0A66C2",
} as const;

export const shadows = {
  card: S.card,
  cta: S.cta,
  modal: S.modal,
} as const;

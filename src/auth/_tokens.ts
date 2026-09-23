/* HireStepX — Design System / Shared Tokens
   Single source of truth. Every storyboard imports from here.
   Token changes propagate to all 16 storyboards via this one file. */

export const tokens = {
  // Surface
  cream: "oklch(1 0 0)",
  white: "oklch(1 0 0)",
  creamSoft: "oklch(0.967 0.001 286.375)",
  // Warmer raised surface — a hair lighter than cream, sits above it for
  // settings/dashboard cards. Was inlined as `graphite: "#FDFCF7"` in three
  // dashboard components.
  creamRaised: "oklch(0.987 0.002 197.1)",

  // Ink
  coal: "oklch(0.148 0.004 228.8)",
  indigoGray: "oklch(0.379 0.087 284.954)",
  inkSoft: "oklch(0.56 0.021 213.5)",
  // Was #A39C8B — failed WCAG AA at ~2.4:1 on cream #FAF7F0. Darkened
  // to #736B5D so body-text usages (spam-folder hint, password-meter
  // labels, footer legal, marketing eyebrow labels) clear AA 4.5:1 on
  // ALL cream surfaces — incl. the darker creamSoft #F4EFE3 used across
  // marketing-v2, where the prior #7A7263 only reached 4.15:1. #736B5D:
  // 4.59:1 on creamSoft, 4.92:1 on #FAF7F0, 5.26:1 on white; still
  // lighter than inkSoft (#6E6759) so the text hierarchy is preserved.
  // Decorative-only uses can drop back to inkFaintWeak.
  inkFaint: "oklch(0.45 0.017 213.2)",
  inkFaintWeak: "oklch(0.72 0.019 213.9)",

  // Brand — interactive
  indigo: "oklch(0.359 0.135 278.697)",
  indigoDeep: "oklch(0.257 0.086 281.288)",
  indigo100: "oklch(0.920 0.022 294.573)",
  indigoRing: "oklch(0.359 0.135 278.697 / 0.20)",

  // Brand — editorial
  copper: "oklch(0.555 0.163 48.998)",
  copperDark: "oklch(0.468 0.146 48.998)",
  copperSoft: "oklch(0.555 0.163 48.998 / 0.12)",
  copper100: "oklch(0.94 0.03 58.318)",

  // Copper alpha scale — replaces 16 inline rgba(180,83,9,0.x) literals
  // scattered across Interview, Dashboard, and Setup. Pick from coarsest
  // to most opaque; never inline a copper rgba again.
  copperWash:   "oklch(0.555 0.163 48.998 / 0.06)",
  copperTint:   "oklch(0.555 0.163 48.998 / 0.10)",
  copperMid:    "oklch(0.555 0.163 48.998 / 0.18)",
  copperBorder: "oklch(0.555 0.163 48.998 / 0.25)",
  copperRing:   "oklch(0.555 0.163 48.998 / 0.40)",

  // Status
  success: "oklch(0.527 0.137 150.069)",
  success100: "oklch(0.962 0.043 156.743)",
  // Darker success text shade for AA contrast on light/cream surfaces
  // (~7:1 on success100). Was inlined as "#166534" in the credits-balance
  // rows of settingsSections + DashboardLayout.
  successInk: "oklch(0.448 0.108 151.328)",
  error: "oklch(0.505 0.190 27.518)",
  error100: "oklch(0.936 0.031 17.717)",
  warning: "oklch(0.554 0.121 66.442)",
  warning100: "oklch(0.962 0.058 95.617)",
  // Promoted from a dashboard-local literal during the 2026-06 audit.
  // warningInk is the AA-passing text shade on warning100 (~6.7:1).
  // warningLine is the alpha sibling for borders on warning surfaces.
  warningInk: "oklch(0.457 0.100 66.296)",
  warningLine: "oklch(0.457 0.100 66.296 / 0.20)",

  // Fourth stage/status hue (interviewing-stage pipelines, "in progress"
  // states distinct from indigo/copper/success/warning/error). Mirrors the
  // existing status-color pattern: base + light tint for pill/dot fills.
  violet: "oklch(0.491 0.241 292.581)",
  violet100: "oklch(0.943 0.028 294.588)",

  // Lines
  line: "oklch(0.922 0.026 92.405)",
  lineStrong: "oklch(0.849 0.034 89.869)",

  // Overlays / faded surfaces (used in marketing-v2)
  coalOverlay: "rgba(14, 12, 8, 0.55)",
  coalShadow: "rgba(14, 12, 8, 0.38)",
  creamMuted: "rgba(245, 242, 237, 0.78)",   // editorial body copy on dark
  creamFaded: "rgba(245, 242, 237, 0.7)",
  creamLine: "rgba(245, 242, 237, 0.14)",    // hairline on dark
  creamLineSoft: "rgba(245, 242, 237, 0.1)",
  creamLineFaint: "rgba(245, 242, 237, 0.08)",
  creamSurfaceLow: "rgba(245, 242, 237, 0.06)",
  creamVeryFaint: "rgba(250, 247, 240, 0.04)",
  creamLowAlpha: "rgba(255, 255, 255, 0.06)",

  // Brand tints — sub-surface fills used in tables / pricing chips
  copper100Soft: "rgba(244, 229, 216, 0.12)",
  copper100SoftLine: "rgba(244, 229, 216, 0.18)",
  indigoMist: "rgba(49, 46, 129, 0.04)",
  indigoMist3: "rgba(49, 46, 129, 0.03)",
  indigoFog: "rgba(49, 46, 129, 0.025)",

  // Status tints
  successMist: "rgba(34, 197, 94, 0.14)",

  // Blog-infographic level badge colors (beginner / intermediate / advanced)
  levelBeginner:    "oklch(0.484 0.096 153.009)",
  levelIntermediate: "oklch(0.683 0.131 73.442)",
  levelAdvanced:    "oklch(0.565 0.143 45.402)",
} as const;

/* Satoshi is the primary UI font, loaded from Fontshare CDN via a <link>
 * in app/layout.tsx. --font-ui is defined in src/index.css :root so all
 * var(--font-ui) references resolve to Satoshi. Inter has been removed. */
export const fonts = {
  serif: "'Instrument Serif', Georgia, serif",
  sans: "'Satoshi', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

/* Typography scale — mirrors the --text-* CSS custom properties in index.css.
 * Use these in JS/TSX inline styles. Never introduce a raw pixel size outside
 * this scale for body/UI text. Hero display sizes (>28px) use clamp() inline. */
export const textSize = {
  xs:   11,  // captions, timestamps, metadata chips
  sm:   12,  // helper text, secondary labels, table cells
  base: 13,  // body copy, form fields, list items
  md:   14,  // slightly emphasised body (cards, nav items)
  lg:   16,  // sub-headings, section labels
  xl:   18,  // card headings, modal titles
  "2xl": 22, // section headings
  "3xl": 28, // page headings
} as const;

export const shadows = {
  card:
    "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
  cta:
    "0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)",
  modal:
    "0 2px 4px rgba(20,17,10,.06), 0 32px 64px -16px rgba(20,17,10,.24)",
  featured:
    "0 24px 60px -28px rgba(20, 18, 28, 0.55), 0 8px 18px -10px rgba(20, 18, 28, 0.20)",
  // Hover lifts — used by .mv2-mock-card / .mv2-price-card / .mv2-feature-card / .mv2-cta-primary
  mockHover: "0 32px 80px rgba(14, 12, 8, 0.14)",
  priceHover: "0 16px 48px rgba(14, 12, 8, 0.12)",
  featureHover: "0 24px 56px rgba(14, 12, 8, 0.10)",
  ctaPrimaryHover: "0 12px 28px rgba(49, 46, 129, 0.22)",
} as const;

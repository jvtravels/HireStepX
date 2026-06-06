/* HireStepX — Design System / Shared Tokens
   Single source of truth. Every storyboard imports from here.
   Token changes propagate to all 16 storyboards via this one file. */

export const tokens = {
  // Surface
  cream: "#FAF7F0",
  white: "#FFFFFF",
  creamSoft: "#F4EFE3",

  // Ink
  coal: "#0E0C08",
  indigoGray: "#3E3A6E",
  inkSoft: "#6E6759",
  // Was #A39C8B — failed WCAG AA at ~2.4:1 on cream #FAF7F0. Darkened
  // to #7A7263 (~4.5:1) so body-text usages (spam-folder hint,
  // password-meter labels, footer legal) read in sunlight on tier-2
  // OLED phones. Decorative-only uses can drop back to inkFaintWeak.
  inkFaint: "#7A7263",
  inkFaintWeak: "#A39C8B",

  // Brand — interactive
  indigo: "#312E81",
  indigoDeep: "#1E1B4B",
  indigo100: "#E5E2F2",
  indigoRing: "rgba(49, 46, 129, 0.20)",

  // Brand — editorial
  copper: "#B45309",
  copperDark: "#923F07",
  copperSoft: "rgba(180, 83, 9, 0.12)",
  copper100: "#F4E5D8",

  // Copper alpha scale — replaces 16 inline rgba(180,83,9,0.x) literals
  // scattered across Interview, Dashboard, and Setup. Pick from coarsest
  // to most opaque; never inline a copper rgba again.
  copperWash:   "rgba(180, 83, 9, 0.06)",
  copperTint:   "rgba(180, 83, 9, 0.10)",
  copperMid:    "rgba(180, 83, 9, 0.18)",
  copperBorder: "rgba(180, 83, 9, 0.25)",
  copperRing:   "rgba(180, 83, 9, 0.40)",

  // Status
  success: "#15803D",
  success100: "#DCFCE7",
  error: "#B91C1C",
  error100: "#FEE2E2",
  warning: "#A16207",
  warning100: "#FEF3C7",
  // Promoted from a dashboard-local literal during the 2026-06 audit.
  // warningInk is the AA-passing text shade on warning100 (~6.7:1).
  // warningLine is the alpha sibling for borders on warning surfaces.
  warningInk: "#7C4A03",
  warningLine: "rgba(124, 74, 3, 0.20)",

  // Lines
  line: "#EBE5D2",
  lineStrong: "#D6CDB5",

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
} as const;

/* Inter is loaded via next/font/google in app/layout.tsx as the --font-ui
 * CSS variable. The fallback chain mirrors next/font's so first paint
 * matches the loaded font's metrics. The previous "Satoshi" name silently
 * fell through to system-ui because the file was never loaded. */
export const fonts = {
  serif: "'Instrument Serif', Georgia, serif",
  sans: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  mono: "'JetBrains Mono', monospace",
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

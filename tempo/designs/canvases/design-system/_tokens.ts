/* HireStepX — Design System / Shared Tokens
   Single source of truth. Every storyboard imports from here.
   Token changes propagate to all storyboards via this one file.

   2026-09 SaaS-flat conversion: the editorial magazine aesthetic (display
   headlines, dramatic scale jumps, indigo co-starring with copper as a
   headline color) is retired in favor of a clean, functional SaaS look in
   the vein of Linear / Notion / Stripe. Color strategy is "restrained
   neutral + one accent": a flattened, evenly-stepped cool-gray scale
   (`tokens.gray`) does almost all the work, copper is the ONE accent used
   sparingly (primary CTAs, active/selected states, links, focus rings —
   never as a decorative headline color), and indigo has stepped back to a
   secondary/data-viz role (charts, not primary UI chrome). Typography is a
   compact functional scale (`type` below) — see that block for the ratio. */

export const tokens = {
  // Surface — cool neutrals, not warm/beige
  cream: "#FFFFFF",
  white: "#FFFFFF",
  creamSoft: "#F4F4F5",

  // Full 11-step cool-neutral (zinc) scale — Linear/Notion typically run
  // 8-12 gray steps; this is evenly spaced end to end so there's always an
  // adjacent step to reach for instead of a big jump. Named aliases below
  // (coal, inkSoft, inkFaint, line, lineStrong) stay as convenience handles
  // into this same scale — nothing here is a second, competing palette.
  gray: {
    50: "#FAFAFA",
    100: "#F4F4F5",
    200: "#E4E4E7",
    300: "#D4D4D8",
    400: "#A1A1AA",
    500: "#71717A",
    600: "#52525B",
    700: "#3F3F46",
    800: "#27272A",
    900: "#18181B",
    950: "#09090B",
  } as const,

  // Ink — cool grays. `inkMuted` (gray-700) is the default body/secondary
  // text color — use it in place of the old indigo-tinted `indigoGray` for
  // any general copy; `indigoGray` itself is kept only for the rare spot
  // that intentionally wants the data-viz/indigo hue (e.g. a chart legend
  // label), never for ordinary paragraph or list text.
  coal: "#18181B",
  inkMuted: "#3F3F46",
  inkSoft: "#71717A",
  inkFaint: "#A1A1AA",
  indigoGray: "#3E3A6E",

  // Brand — secondary / data-viz only. Indigo no longer drives any primary
  // UI chrome (buttons, active tabs, links, focus rings) — see copper below
  // for that. It remains for charts, secondary data series, and the rare
  // "this is structural, not an action" accent.
  indigo: "#312E81",
  indigoDeep: "#1E1B4B",
  indigo100: "#E5E2F2",
  indigoRing: "rgba(49, 46, 129, 0.20)",

  // Brand — the ONE accent (from the shadcn preset's own generated
  // "primary", oklch(0.555 0.163 48.998) → #BB4D00 — see shadcnTheme below).
  // Reserved for primary CTAs, active/selected states, links, and focus
  // rings — used in roughly ≤10% of any given surface, never as a
  // decorative headline color or large accent word.
  copper: "#BB4D00",
  copperSoft: "rgba(187, 77, 0, 0.12)",
  copper100: "#F5DFCB",

  // Status
  success: "#15803D",
  success100: "#DCFCE7",
  error: "#B91C1C",
  error100: "#FEE2E2",
  warning: "#A16207",
  warning100: "#FEF3C7",

  // Lines — cool neutral, not beige
  line: "#E4E4E7",
  lineStrong: "#D4D4D8",

  // Tinted borders — alpha siblings of the brand/status colors,
  // for borders on tinted-background strips (e.g. copperSoft cards,
  // success100 callouts).
  copperLine: "rgba(187, 77, 0, 0.20)",
  successLine: "rgba(21, 128, 61, 0.20)",
} as const;

/* Compact, functional SaaS type scale — replaces the old editorial scale's
   huge display sizes and 2x+ jumps between steps. Ratios here run roughly
   1.07-1.27x step to step (tightest at the body end, a little more room at
   the top), the way Linear/Notion/Stripe size an H1 down through a caption:
   information-dense, not billboard-scale. `size` is px, `lineHeight` is
   unitless, `letterSpacing` is only set where it matters (larger sizes read
   better very slightly tightened; body/caption sizes are left at normal).
   Every storyboard should reach for one of these instead of hand-rolling a
   one-off fontSize. */
export const type = {
  h1: { size: 28, lineHeight: 1.25, letterSpacing: "-0.01em", weight: 600 },
  h2: { size: 22, lineHeight: 1.3, letterSpacing: "-0.006em", weight: 600 },
  h3: { size: 18, lineHeight: 1.35, weight: 600 },
  h4: { size: 16, lineHeight: 1.4, weight: 600 },
  bodyLg: { size: 15, lineHeight: 1.5, weight: 400 },
  body: { size: 14, lineHeight: 1.5, weight: 400 },
  small: { size: 13, lineHeight: 1.45, weight: 400 },
  caption: { size: 12, lineHeight: 1.4, weight: 500 },
  micro: { size: 11, lineHeight: 1.35, letterSpacing: "0.04em", weight: 500 },
} as const;

/* Small-to-medium corner radii, matching Linear/Notion/Stripe's card and
   control geometry — never sharp (0px) and never heavily rounded (16px+). */
export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
} as const;

/* shadcn-style semantic CSS variables — the exact "neutral mist" palette
   supplied for this canvas: a cool neutral/gray-blue base (hues ~197-223)
   with a single warm copper/amber "primary" (hue ≈ 49) as the one accent,
   and a chart-1..5 ramp that is itself a cool neutral gray-blue mist (hues
   ~213-220, low chroma) rather than a saturated hue family — data-viz reads
   as tonal steps of the same restrained neutral, not a competing color.

   --primary/--ring drive copper through as the ONE UI accent (primary
   buttons, active states, links); the focus ring (`--ring`) is this
   palette's own neutral tone, not copper — a deliberately quieter, still
   clearly-visible focus indicator, distinct from the primary-action color.
   Indigo (`tokens.indigo`/`tokens.indigoGray`) plays no role in this theme
   at all now — even data-viz uses the neutral mist chart ramp below, not
   indigo. Consumed by _shadcn.tsx's component ports via `style={shadcnTheme}`. */
export const shadcnTheme: Record<string, string> = {
  "--background": "oklch(1 0 0)",
  "--foreground": "oklch(0.148 0.004 228.8)",
  "--card": "oklch(1 0 0)",
  "--card-foreground": "oklch(0.148 0.004 228.8)",
  "--popover": "oklch(1 0 0)",
  "--popover-foreground": "oklch(0.148 0.004 228.8)",
  "--primary": "oklch(0.555 0.163 48.998)",
  "--primary-foreground": "oklch(0.987 0.022 95.277)",
  "--secondary": "oklch(0.967 0.001 286.375)",
  "--secondary-foreground": "oklch(0.21 0.006 285.885)",
  "--muted": "oklch(0.963 0.002 197.1)",
  "--muted-foreground": "oklch(0.56 0.021 213.5)",
  "--accent": "oklch(0.963 0.002 197.1)",
  "--accent-foreground": "oklch(0.218 0.008 223.9)",
  "--destructive": "oklch(0.577 0.245 27.325)",
  "--border": "oklch(0.925 0.005 214.3)",
  "--input": "oklch(0.925 0.005 214.3)",
  "--ring": "oklch(0.723 0.014 214.4)",
  "--radius": "0.625rem",
  /* Custom token, not part of stock shadcn: same value as --primary above —
     kept as a named handle for the explicit "copper" component variants,
     so there's exactly one copper value in this file, never two diverging
     ones. */
  "--copper": "oklch(0.555 0.163 48.998)",
  "--copper-foreground": "oklch(0.987 0.022 95.277)",
  /* "Neutral mist" chart ramp — cool gray-blue tonal steps, not a
     saturated hue family. This is the data-viz palette now; indigo is
     retired from that role too. */
  "--chart-1": "oklch(0.872 0.007 219.6)",
  "--chart-2": "oklch(0.56 0.021 213.5)",
  "--chart-3": "oklch(0.45 0.017 213.2)",
  "--chart-4": "oklch(0.378 0.015 216)",
  "--chart-5": "oklch(0.275 0.011 216.9)",
  /* Preset's sidebar scale, for a future App Shell component family. */
  "--sidebar": "oklch(0.987 0.002 197.1)",
  "--sidebar-foreground": "oklch(0.148 0.004 228.8)",
  "--sidebar-primary": "oklch(0.666 0.179 58.318)",
  "--sidebar-primary-foreground": "oklch(0.987 0.022 95.277)",
  "--sidebar-accent": "oklch(0.963 0.002 197.1)",
  "--sidebar-accent-foreground": "oklch(0.218 0.008 223.9)",
  "--sidebar-border": "oklch(0.925 0.005 214.3)",
  "--sidebar-ring": "oklch(0.723 0.014 214.4)",
};

/* Dark counterpart of the same "neutral mist" palette. Same copper-drives-
   primary logic as the light theme; --ring is again this palette's own
   neutral dark-mode tone, not copper. The chart-1..5 ramp is identical to
   the light theme's — the mist tones read consistently across both modes. */
export const darkShadcnTheme: Record<string, string> = {
  "--background": "oklch(0.148 0.004 228.8)",
  "--foreground": "oklch(0.987 0.002 197.1)",
  "--card": "oklch(0.218 0.008 223.9)",
  "--card-foreground": "oklch(0.987 0.002 197.1)",
  "--popover": "oklch(0.218 0.008 223.9)",
  "--popover-foreground": "oklch(0.987 0.002 197.1)",
  "--primary": "oklch(0.473 0.137 46.201)",
  "--primary-foreground": "oklch(0.987 0.022 95.277)",
  "--secondary": "oklch(0.274 0.006 286.033)",
  "--secondary-foreground": "oklch(0.985 0 0)",
  "--muted": "oklch(0.275 0.011 216.9)",
  "--muted-foreground": "oklch(0.723 0.014 214.4)",
  "--accent": "oklch(0.275 0.011 216.9)",
  "--accent-foreground": "oklch(0.987 0.002 197.1)",
  "--destructive": "oklch(0.704 0.191 22.216)",
  "--border": "oklch(1 0 0 / 10%)",
  "--input": "oklch(1 0 0 / 15%)",
  "--ring": "oklch(0.56 0.021 213.5)",
  "--radius": "0.625rem",
  "--copper": "oklch(0.473 0.137 46.201)",
  "--copper-foreground": "oklch(0.987 0.022 95.277)",
  "--chart-1": "oklch(0.872 0.007 219.6)",
  "--chart-2": "oklch(0.56 0.021 213.5)",
  "--chart-3": "oklch(0.45 0.017 213.2)",
  "--chart-4": "oklch(0.378 0.015 216)",
  "--chart-5": "oklch(0.275 0.011 216.9)",
  "--sidebar": "oklch(0.218 0.008 223.9)",
  "--sidebar-foreground": "oklch(0.987 0.002 197.1)",
  "--sidebar-primary": "oklch(0.769 0.188 70.08)",
  "--sidebar-primary-foreground": "oklch(0.279 0.077 45.635)",
  "--sidebar-accent": "oklch(0.275 0.011 216.9)",
  "--sidebar-accent-foreground": "oklch(0.987 0.002 197.1)",
  "--sidebar-border": "oklch(1 0 0 / 10%)",
  "--sidebar-ring": "oklch(0.56 0.021 213.5)",
};

/* Typeface: AF Sobremesa stays (licensed family, installed at
   public/fonts/af-sobremesa.css, loaded via a static import in every
   storyboard, canvas-host only — see Login.tsx for the established
   precedent) for both `serif` and `sans` roles — no font-family swap in the
   2026-09 SaaS-flat pass. What changed is HOW it's used: headings now run
   through the compact `type` scale above instead of oversized magazine
   display sizes, so `fonts.serif` reads as "the heading weight of the same
   functional type system," not a separate display-serif identity sitting
   apart from the UI. No italics anywhere — use weight/color for emphasis. */
export const fonts = {
  serif: "'AF Sobremesa', Georgia, serif",
  sans: "'AF Sobremesa', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

/* Near-flat, border-first shadows — Linear/Notion/Stripe lean on a thin 1px
   border for definition and use shadow only as a faint lift, never a
   dramatic ambient glow. `cta`/`modal` keep a hair more presence for
   floating/overlay surfaces, but all three are much quieter than the old
   editorial "print poster" shadow stack. */
export const shadows = {
  card: "0 1px 2px rgba(24,24,27,.04)",
  cta: "0 1px 2px rgba(24,24,27,.06), 0 2px 6px -2px rgba(24,24,27,.10)",
  modal: "0 4px 12px -2px rgba(24,24,27,.10), 0 16px 32px -12px rgba(24,24,27,.16)",
} as const;

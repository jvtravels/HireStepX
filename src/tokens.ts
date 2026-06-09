/* ─── HireStepX Design Tokens (cream brand) ───────────────────────────
 *
 * This file is the LEGACY shim. The brand source of truth is
 * `src/auth/_tokens.ts`. The `c`, `font`, `shadow`, `gradient` names
 * here are kept so the ~28 surfaces that historically imported from
 * `./tokens` continue to compile while we migrate them one phase at
 * a time to the canonical `tokens` map.
 *
 * The mapping is ROLE-preserving, not VALUE-preserving:
 *   c.obsidian (was deepest dark, page bg)   → cream    (page bg)
 *   c.ivory    (was lightest, primary text)  → coal     (primary text)
 *   c.gilt     (was warm brand accent)       → copper   (editorial accent)
 *   c.sage     (was success on dark)         → success  (cream-safe green)
 *   c.ember    (was error on dark)           → error    (cream-safe red)
 *
 * If a surface used a name as background AND text in different places,
 * the inversion still holds visually: a coal chip on cream reads the
 * same intent as a cream chip on coal.
 *
 * New code: import from `./auth/_tokens` directly. Don't extend this file.
 */

import { tokens as T, fonts as F, shadows as S } from "./auth/_tokens";

export const c = {
  /* Surfaces — was deep-black ramp, now cream ramp */
  obsidian: T.cream,         // page background
  graphite: T.creamSoft,     // secondary surface
  carbon: T.white,           // elevated surface (card)
  onyx: T.white,             // card hover / raised — same as carbon on cream

  /* Text — inverted: lightest-on-dark becomes darkest-on-cream */
  ivory: T.coal,             // primary text
  chalk: T.inkSoft,          // secondary text
  stone: T.inkFaint,         // tertiary text (AA-hardened #7A7263)

  /* Brand — gilt becomes copper editorial */
  gilt: T.copper,
  giltDark: T.copperDark,
  giltLight: T.copper100,

  /* Semantic — cream-safe greens/reds */
  sage: T.success,
  sageLight: T.success100,
  ember: T.error,
  emberLight: T.error100,
  slate: T.indigo,           // cool neutral → interactive indigo
  slateLight: T.indigo100,

  /* Borders & effects — coal at low alpha on cream */
  border: "rgba(14, 12, 8, 0.08)",         // ~T.line in alpha form
  borderHover: "rgba(14, 12, 8, 0.14)",    // ~T.lineStrong
  borderSubtle: "rgba(14, 12, 8, 0.04)",
  glass: "rgba(250, 247, 240, 0.7)",       // cream glass
  glassBright: "rgba(255, 255, 255, 0.85)",
  glow: T.copperWash,                      // rgba(180,83,9,0.06)
  glowStrong: T.copperTint,                // rgba(180,83,9,0.10)
};

export const font = {
  display: F.serif,
  ui: F.sans,
  mono: F.mono,
};

/* ─── Spacing Scale (4px base) ─── */
export const sp = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 48,
  "5xl": 64,
  section: 96,
} as const;

/* ─── Shared Border Radius ─── */
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  "2xl": 24,
  pill: 100,
} as const;

/* ─── Z-Index Scale ─── */
export const z = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 50,
  modal: 90,
  toast: 100,
} as const;

/* ─── Shadows ─── Cream brand uses far lighter shadows than the dark
 * ramp; values mirror auth/_tokens shadows.card / .cta / .modal with
 * an `xl` extra for hero lifts and a glow alias for the copper wash. */
export const shadow = {
  sm: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04)",
  md: S.card,
  lg: S.modal,
  xl: "0 32px 80px rgba(14, 12, 8, 0.14), 0 8px 18px -10px rgba(20, 18, 28, 0.18)",
  glow: "0 0 30px rgba(180,83,9,0.06), 0 0 60px rgba(180,83,9,0.04)",
  glowStrong: "0 0 40px rgba(180,83,9,0.12), 0 0 80px rgba(180,83,9,0.06)",
  inner: "inset 0 1px 0 rgba(14,12,8,0.03)",
} as const;

/* ─── Gradients ─── Cream brand has almost no gradients in production
 * (it's editorial-flat). These exist only to satisfy legacy importers
 * during migration. New code should use flat fills + tokens.copperWash
 * scale instead. */
export const gradient = {
  giltShine: `linear-gradient(135deg, ${T.copper} 0%, ${T.copper100} 50%, ${T.copper} 100%)`,
  giltSubtle: "linear-gradient(135deg, rgba(180,83,9,0.12) 0%, rgba(180,83,9,0.04) 100%)",
  surface: `linear-gradient(180deg, ${T.cream} 0%, ${T.creamSoft} 100%)`,
  surfaceCard: `linear-gradient(180deg, ${T.white} 0%, ${T.creamSoft} 100%)`,
  meshBg: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(180,83,9,0.05) 0%, transparent 60%)",
  sageBg: "radial-gradient(ellipse at center, rgba(34,197,94,0.06) 0%, transparent 70%)",
  emberBg: "radial-gradient(ellipse at center, rgba(185,28,28,0.05) 0%, transparent 70%)",
} as const;

/* ─── Animation Durations ─── */
export const duration = {
  fast: "0.15s",
  normal: "0.2s",
  slow: "0.35s",
  enter: "0.4s",
} as const;

/* ─── Easing ─── */
export const ease = {
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

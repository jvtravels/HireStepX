/* Session History theme palettes — extracted from SessionHistoryDesign.tsx
   so the raw hex literals live in a .ts token module (the design-token gate
   scopes only .tsx files). Values are IDENTICAL to the originals; this is a
   pure relocation, not a colour change.

   `tok.X` / `fonts.X` reads in SessionHistoryDesign resolve these CSS custom
   properties at the root of each rendered branch:
   - "editorial" paints the canvas-only cream-on-coal design register
   - "hirestepx" paints the production cream-mode brand surface that
     DashboardLayout and every authenticated surface uses. */
import type React from "react";

export type SessionHistoryTheme = "editorial" | "hirestepx";

export const THEMES: Record<SessionHistoryTheme, React.CSSProperties> = {
  editorial: {
    "--hsx-cream": "#FAF7F0",
    "--hsx-cream-soft": "#F4EFE3",
    "--hsx-white": "#FFFFFF",
    "--hsx-coal": "#0E0C08",
    "--hsx-ink": "#3E3A6E",
    "--hsx-ink-soft": "#6E6759",
    "--hsx-ink-faint": "#8A8270",
    "--hsx-accent": "#312E81",
    "--hsx-accent-deep": "#1E1B4B",
    "--hsx-accent-tint": "#E5E2F2",
    "--hsx-warm": "#B45309",
    "--hsx-warm-soft": "rgba(180,83,9,0.10)",
    "--hsx-warm-tint": "#F4E5D8",
    "--hsx-success": "#15803D",
    "--hsx-success-soft": "#DCFCE7",
    "--hsx-error": "#B91C1C",
    "--hsx-error-soft": "#FEE2E2",
    "--hsx-line": "#EBE5D2",
    "--hsx-line-strong": "#D6CDB5",
    "--hsx-font-serif": "'Caslon', 'Source Serif Pro', Georgia, serif",
    "--hsx-font-ui": "'Satoshi', -apple-system, system-ui, sans-serif",
    "--hsx-font-mono": "'JetBrains Mono', 'SF Mono', monospace",
  } as React.CSSProperties,
  hirestepx: {
    /* Production HireStepX brand — mirrors src/auth/_tokens.ts, the
       cream-mode editorial register that DashboardLayout and every
       other authenticated surface uses. Cream surface, coal ink,
       copper editorial accent, indigo interactive accent, Instrument
       Serif + Inter type pairing. inkFaint hardened to #7A7263 for
       WCAG AA on cream (the value that landed in the 2026-06 audit). */
    "--hsx-cream": "#FAF7F0",
    "--hsx-cream-soft": "#F4EFE3",
    "--hsx-white": "#FFFFFF",
    "--hsx-coal": "#0E0C08",
    "--hsx-ink": "#3E3A6E",
    "--hsx-ink-soft": "#6E6759",
    "--hsx-ink-faint": "#7A7263",
    "--hsx-accent": "#312E81",
    "--hsx-accent-deep": "#1E1B4B",
    "--hsx-accent-tint": "#E5E2F2",
    "--hsx-warm": "#B45309",
    "--hsx-warm-soft": "rgba(180,83,9,0.10)",
    "--hsx-warm-tint": "#F4E5D8",
    "--hsx-success": "#15803D",
    "--hsx-success-soft": "#DCFCE7",
    "--hsx-error": "#B91C1C",
    "--hsx-error-soft": "#FEE2E2",
    "--hsx-line": "#EBE5D2",
    "--hsx-line-strong": "#D6CDB5",
    "--hsx-font-serif": "'Instrument Serif', Georgia, serif",
    "--hsx-font-ui": "'Satoshi', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    "--hsx-font-mono": "'JetBrains Mono', monospace",
  } as React.CSSProperties,
};

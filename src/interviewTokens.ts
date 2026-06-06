/* HireStepX — Interview Editorial Tokens (derived)
   Cream + coal + indigo + copper palette. Used by Interview.tsx and
   InterviewPanels.tsx (and the negotiation/components siblings) to
   present a unified editorial voice on the interview surface.

   Discipline rule: Indigo is interactive · Copper is editorial · Never mix.

   These tokens now DERIVE from src/auth/_tokens.ts — the single source
   of truth for the cream editorial system. The `e`/`ef`/`eShadow`
   export names are kept for zero-touch consumption from existing
   Interview modules. Any token change (WCAG fix, new shade) propagates
   here automatically. */

import { tokens as T, fonts as F, shadows as S } from "./auth/_tokens";

export const e = {
  /* Surface */
  cream:        T.cream,
  white:        T.white,
  creamSoft:    T.creamSoft,

  /* Ink */
  coal:         T.coal,
  indigoGray:   T.indigoGray,
  inkSoft:      T.inkSoft,
  inkFaint:     T.inkFaintWeak,  // legacy decorative shade — body uses inkSoft

  /* Brand — interactive */
  indigo:       T.indigo,
  indigoDeep:   T.indigoDeep,
  indigo100:    T.indigo100,
  indigoRing:   T.indigoRing,

  /* Brand — editorial */
  copper:       T.copper,
  copperDark:   T.copperDark,
  copperSoft:   T.copperSoft,
  copper100:    T.copper100,

  /* Status */
  success:      T.success,
  success100:   T.success100,
  error:        T.error,
  error100:     T.error100,
  warning:      T.warning,
  warning100:   T.warning100,

  /* Lines */
  line:         T.line,
  lineStrong:   T.lineStrong,
} as const;

export const ef = {
  serif: F.serif,
  sans:  F.sans,
  mono:  F.mono,
} as const;

export const eShadow = {
  card:  S.card,
  cta:   S.cta,
  modal: S.modal,
} as const;

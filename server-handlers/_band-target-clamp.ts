/* PDF #18 root-cause (2026-05-15) — target-role band clamp.
 *
 * Real session: target = QA Engineer at JP Morgan, resume = Senior
 * Product Designer (5 YoE). The Indian QA market at JPMC is ₹12-25 LPA.
 * The kernel anchored ₹54 LPA — that's senior engineering / product
 * GCC numbers leaking into a QA-target band because:
 *
 *   1. QA-testing isn't a distinct role family in _company-band-tiers.ts
 *      (classifyRoleFamily defaults to "engineering" for unknown technical
 *      titles), so QA inherits the engineering reference table.
 *   2. Engineering × GCC × 5yr in that table is {floor:22, ceil:38,
 *      target:28} — calibrated for SWE, not QA. QA is a structurally
 *      cheaper specialty (~60% of SWE comp in the same tier).
 *
 * Root-cause fix: a per-target-role-family multiplier applied on TOP of
 * the family-tier-yoe band, AFTER the standard resolver has produced
 * numbers. This is a one-way clamp — it only compresses overshoots
 * into the target-role's market reality; it never widens. Pure helper,
 * no IO.
 *
 * Why a separate module: the band-resolver is already complex; the
 * target-role clamp is conceptually independent (it doesn't depend on
 * resume, company, or YoE — only on the target role title). Adding it
 * inline would tangle two responsibilities. New role-clamp entries
 * land here as a single-line addition. */

import type { NegotiationBand } from "./_negotiation-kernel";

/** Target-role clamp factor. The factor is multiplied against floor,
 *  ceil and target after the family-tier-yoe lookup. Default 1.0 (no
 *  change). Values < 1.0 compress; values > 1.0 expand (not used yet).
 *
 *  Calibration source: 2026 Indian offer-scrape medians, comparing the
 *  named specialty against the engineering reference family in the same
 *  tier × YoE cell. */
const TARGET_ROLE_CLAMP_PATTERNS: Array<{ pattern: RegExp; factor: number; label: string }> = [
  /* QA / Test / SDET: ~60% of SWE in the same tier × YoE cell. PDF #18
   * canonical case — QA Engineer at JPMC ₹12-25L vs SWE ₹22-38L. */
  {
    pattern: /\b(qa|tester|test\s+engineer|sdet|quality\s+assurance|automation\s+test|test\s+lead|manual\s+test)\b/i,
    factor: 0.65,
    label: "qa-testing",
  },
  /* Support / Customer Support / Technical Support: ~50% of SWE. */
  {
    pattern: /\b(technical\s+support|tech\s+support|support\s+engineer|production\s+support|application\s+support|l1\s+support|l2\s+support)\b/i,
    factor: 0.55,
    label: "support",
  },
];

export interface TargetRoleClampResult {
  /** True when the clamp factor was applied. */
  clamped: boolean;
  /** The matched role-clamp label, e.g. "qa-testing". Null when no
   *  pattern matched. */
  label: string | null;
  /** The multiplier applied (or 1.0). */
  factor: number;
}

/** Apply the target-role clamp to a band. Pure. Returns a new band +
 *  the clamp metadata so callers can telemetry-log. When the target
 *  role doesn't match any clamp pattern, returns the band untouched
 *  with clamped=false.
 *
 *  The clamp is one-way (only compresses): if the resolver-produced
 *  band is already below the clamped ceiling, we leave it alone. We
 *  never inflate an under-band. */
export function clampBandToTargetRoleMarket(
  band: NegotiationBand,
  targetRole: string | null | undefined,
): { band: NegotiationBand; meta: TargetRoleClampResult } {
  if (!targetRole) {
    return { band, meta: { clamped: false, label: null, factor: 1.0 } };
  }
  for (const { pattern, factor, label } of TARGET_ROLE_CLAMP_PATTERNS) {
    if (pattern.test(targetRole)) {
      /* One-way clamp: only apply when the factor would COMPRESS the
       * band (factor < 1.0). For factor >= 1.0 patterns (none today,
       * future-proofing only), the multiplier expands and we apply
       * unconditionally. */
      if (factor < 1.0) {
        const clamped: NegotiationBand = {
          ...band,
          initialOffer: Math.round(band.initialOffer * factor * 10) / 10,
          maxStretch: Math.round(band.maxStretch * factor * 10) / 10,
          walkAway: Math.round(band.walkAway * factor * 10) / 10,
        };
        return {
          band: clamped,
          meta: { clamped: true, label, factor },
        };
      }
      return { band, meta: { clamped: false, label, factor } };
    }
  }
  return { band, meta: { clamped: false, label: null, factor: 1.0 } };
}

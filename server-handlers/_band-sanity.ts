/* Band sanity check — Phase 4 of the negotiation rebuild.
 *
 * The Lollypop session (May 2026) exposed a class of band-data bug that
 * was invisible to the negotiation kernel because the kernel trusts whatever
 * generateNegotiationBand returns. The override for "Senior UX Designer"
 * resolved to ₹14–24 LPA initial-offer range. Market reality for that role
 * in India (per Levels.fyi / AmbitionBox / Glassdoor in 2026) sits at ₹8–12
 * LPA. The bot opened at ₹18 LPA — high enough that any rational candidate
 * would accept on turn 2, which is exactly what happened.
 *
 * Two distinct failure modes the override path can produce:
 *   1. Stale curator data (band frozen against 2023 market when the market
 *      cooled in 2024-25)
 *   2. Wrong role-key match (override for "Senior Product Designer" applied
 *      to "Senior UX Designer" because the matcher's prefix logic picked the
 *      wrong key)
 *
 * Neither is detectable from the band alone — they require a reasonableness
 * baseline keyed on role family. This module provides that baseline. The
 * bounds are GENEROUS (1.5x–2.5x typical market spread) on purpose: we want
 * to catch order-of-magnitude data errors and silent override mis-applications,
 * NOT flag every band that lands outside median.
 *
 * Used by:
 *   - resolveServerBand in negotiate-turn.ts: log a telemetry warning when a
 *     resolved band is outside sanity bounds (does NOT clamp at runtime —
 *     a curator override might be legitimately wide for a senior FAANG role)
 *   - CI audit test (src/__tests__/bandSanity.test.ts) that fuzzes the
 *     override table against family bounds and fails the build when a new
 *     override is wildly off-baseline.
 *
 * Pure. */

export interface BandSanityBaseline {
  /** Role-family substring (matched case-insensitively against the
   *  request's role string). The first matching family wins. */
  pattern: RegExp;
  /** Lower bound in LPA for the band's initial-offer figure. Anything
   *  below this is suspiciously low and likely a unit error (₹ vs ₹L). */
  minInitialOfferLpa: number;
  /** Upper bound in LPA for the band's maxStretch figure. Anything
   *  above this is suspiciously high — likely a stale curator value or
   *  a role-key mismatch. */
  maxStretchLpa: number;
  /** Human-readable family name for telemetry. */
  family: string;
}

/* Bounds are derived from the 2025-26 Indian market spread for IC roles
 * across tier-1/2/3 cities and SME → unicorn companies. Bounds intentionally
 * cover senior + GCC outliers (e.g. Senior Software Engineer at a tier-1 GCC
 * can legitimately hit ₹80 LPA, so the SWE family's maxStretchLpa is 90).
 * If a real, verified band falls outside the bound, the bound is wrong —
 * widen it here rather than silencing the warning. */
export const BAND_SANITY_BASELINES: BandSanityBaseline[] = [
  /* Design family. UX/Product/UI/Visual/Interaction designers share a
     market band; senior outliers cap around 35-40 LPA at tier-1 product
     companies. The Lollypop "Senior UX Designer" override at ₹14-24
     would warn on the lower bound (₹14 is plausible) but the kernel
     opening at ₹18 was misleading because the candidate's market
     median for that title is ₹8-12. We can't catch THAT without per-
     family P50 — sanity bounds are deliberately wider to stay
     false-positive-free; the cross-check vs P75 lives in the CI audit. */
  { pattern: /\b(ux|ui|visual|interaction|product)\s+designer\b/i, family: "designer", minInitialOfferLpa: 3, maxStretchLpa: 45 },
  { pattern: /\bdesign\s+manager\b/i, family: "design-manager", minInitialOfferLpa: 15, maxStretchLpa: 70 },

  /* Engineering family. */
  /* Engineer family bounds widened (2026-05) to cover FAANG Bangalore
     senior outliers — a Google L5 / Microsoft Senior SDE / Amazon SDE-III
     legitimately resolves around ₹95-125 LPA, and the maxStretch sits
     above that. Anything beyond ₹140 LPA for an IC engineer in India is
     either a Director-equivalent role mis-labeled "engineer" or stale
     2022-bubble data, both of which we want to surface. */
  { pattern: /\b(software|backend|frontend|full\s*stack|fullstack|web)\s+engineer\b/i, family: "engineer", minInitialOfferLpa: 4, maxStretchLpa: 140 },
  { pattern: /\b(devops|sre|platform|infra(?:structure)?)\s+engineer\b/i, family: "infra-engineer", minInitialOfferLpa: 5, maxStretchLpa: 140 },
  /* Engineering managers at FAANG-tier GCCs go to ₹150-180 LPA at the
     senior end. Bound above that catches Director-band data leaks. */
  { pattern: /\bengineering\s+manager\b/i, family: "engineering-manager", minInitialOfferLpa: 20, maxStretchLpa: 200 },

  /* Data family. */
  { pattern: /\bdata\s+scientist\b/i, family: "data-scientist", minInitialOfferLpa: 5, maxStretchLpa: 80 },
  { pattern: /\bdata\s+(analyst|engineer)\b/i, family: "data-ic", minInitialOfferLpa: 4, maxStretchLpa: 70 },

  /* Product family. */
  { pattern: /\bproduct\s+manager\b/i, family: "product-manager", minInitialOfferLpa: 8, maxStretchLpa: 110 },
  { pattern: /\bproduct\s+marketing\s+manager\b/i, family: "pmm", minInitialOfferLpa: 8, maxStretchLpa: 90 },

  /* Generic fallback — must come last. Wide bounds to stay quiet on
     novel titles; specific families above tighten the check. */
  { pattern: /.?/, family: "generic", minInitialOfferLpa: 2, maxStretchLpa: 200 },
];

export interface BandLike {
  initialOffer: number;
  maxStretch: number;
  walkAway?: number;
}

export interface BandSanityWarning {
  family: string;
  kind: "initial-too-low" | "stretch-too-high" | "stretch-below-initial" | "walk-above-initial";
  band: BandLike;
  bound: number;
}

/** Returns a list of sanity warnings for a resolved band, given the role
 *  it was resolved for. Empty list = the band looks reasonable.
 *
 *  This is deliberately log-only at runtime — sessions in flight should
 *  NOT have their bands clamped mid-conversation because a curator-set
 *  value tripped a guardrail. The CI audit (see bandSanity.test.ts)
 *  catches override commits that introduce bad data; production warnings
 *  catch the stale-data / role-mismatch path. */
export function checkBandSanity(band: BandLike, role: string): BandSanityWarning[] {
  const baseline = BAND_SANITY_BASELINES.find(b => b.pattern.test(role || ""))!;
  const warnings: BandSanityWarning[] = [];

  if (band.initialOffer < baseline.minInitialOfferLpa) {
    warnings.push({ family: baseline.family, kind: "initial-too-low", band, bound: baseline.minInitialOfferLpa });
  }
  if (band.maxStretch > baseline.maxStretchLpa) {
    warnings.push({ family: baseline.family, kind: "stretch-too-high", band, bound: baseline.maxStretchLpa });
  }
  /* Structural sanity (not family-keyed). A maxStretch below initialOffer
     means the band is inverted; a walkAway floor above the initial means
     the kernel will see every legitimate offer as an under-bid. Both are
     data-construction bugs we'd rather surface than absorb. */
  if (band.maxStretch < band.initialOffer) {
    warnings.push({ family: baseline.family, kind: "stretch-below-initial", band, bound: band.initialOffer });
  }
  if (band.walkAway != null && band.walkAway > band.initialOffer) {
    warnings.push({ family: baseline.family, kind: "walk-above-initial", band, bound: band.initialOffer });
  }
  return warnings;
}

/** Convenience: lookup the baseline for a role, exposed so callers can
 *  emit family= telemetry alongside band= telemetry without re-running
 *  the pattern match. */
export function bandFamilyForRole(role: string): string {
  return (BAND_SANITY_BASELINES.find(b => b.pattern.test(role || ""))!).family;
}

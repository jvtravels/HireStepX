/* Band sanity check — Phase 4 of the negotiation rebuild,
 * Phase 7-tier extension after Wipro UI/UX session (May 2026).
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

import type { CompanyTier } from "../data/company-tiers";

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
  kind:
    | "initial-too-low"
    | "stretch-too-high"
    | "stretch-below-initial"
    | "walk-above-initial"
    /* The family-wide bounds (above) can't catch a band that is
       in-family-range but wildly mismatched for the COMPANY TIER.
       Wipro UI/UX session (May 2026): designer family bound is
       ₹3-45 LPA, ₹27 LPA opener passes — but Wipro is IT-services
       where UI/UX P50 ≈ ₹8 LPA. The opener was 3.4× the tier P50
       and the candidate accepted instantly. This warning fires
       whenever initialOffer > 1.5× tier-family P50. */
    | "initial-above-tier-p50";
  band: BandLike;
  bound: number;
}

/* Family × company-tier P50 (total CTC LPA). Reference points for the
 * "is this band plausible for THIS company tier?" check. Pulled from
 * AmbitionBox / Glassdoor / Levels.fyi / Naukri reconciliation, 2026.
 *
 * These are P50, not P75 — we want the CENTRE of the market for a tier,
 * so we can tell when a curator override is way off (e.g. an IT-services
 * company quoting a FAANG band).
 *
 * Completeness policy (Phase 9, 2026-05-13): every (family × tier) cell
 * is populated. Sparse data was a structural bug — missing cells silently
 * skipped the tier check, so an outlier band (e.g. an edtech FAANG-tier
 * quote) would pass with no warning. Cells we have weaker confidence on
 * are still filled with the best market reconciliation; the warning
 * MULTIPLIER (1.5×) absorbs noise, and `kernel_band_sanity_warn` events
 * carry the family + tier so we can refine over time.
 *
 * Scaling principles applied uniformly across families to fill gaps:
 *   - infra/platform engineer ≈ 1.1× base engineer
 *   - engineering-manager ≈ 2.0–2.3× base engineer
 *   - design-manager ≈ 2.0–2.5× base designer
 *   - data-scientist ≈ 1.15× base engineer; data-ic ≈ 0.85× data-scientist
 *   - product-manager ≈ 1.3× base engineer at growth tiers, flatter at
 *     consulting / services tiers
 *   - pmm ≈ 0.85× product-manager */
export const TIER_FAMILY_P50_LPA: Record<string, Partial<Record<CompanyTier, number>>> = {
  designer: {
    "it-services": 8,
    "indian-unicorn": 16,
    "startup-growth": 14,
    "startup-early": 10,
    "saas-product": 18,
    "gcc": 22,
    "big-tech": 28,
    "faang": 35,
    "consulting-mbb": 30,
    "consulting-big4": 18,
    "bfsi-domestic": 12,
    "bfsi-global": 22,
    "fmcg-mnc": 14,
    "government-psu": 9,
    "edtech": 14,
  },
  engineer: {
    "it-services": 10,
    "indian-unicorn": 24,
    "startup-growth": 22,
    "startup-early": 16,
    "saas-product": 28,
    "gcc": 35,
    "big-tech": 50,
    "faang": 60,
    "consulting-mbb": 28,
    "consulting-big4": 16,
    "bfsi-domestic": 14,
    "bfsi-global": 28,
    "fmcg-mnc": 16,
    "government-psu": 12,
    "edtech": 20,
  },
  "infra-engineer": {
    "it-services": 11,
    "indian-unicorn": 26,
    "startup-growth": 24,
    "startup-early": 17,
    "saas-product": 30,
    "gcc": 38,
    "big-tech": 50,
    "faang": 65,
    "consulting-mbb": 30,
    "consulting-big4": 17,
    "bfsi-domestic": 15,
    "bfsi-global": 30,
    "government-psu": 13,
    "fmcg-mnc": 17,
    "edtech": 22,
  },
  "engineering-manager": {
    "it-services": 28,
    "indian-unicorn": 60,
    "startup-growth": 50,
    "startup-early": 30,
    "saas-product": 65,
    "gcc": 75,
    "big-tech": 90,
    "faang": 110,
    "consulting-mbb": 60,
    "consulting-big4": 38,
    "bfsi-domestic": 35,
    "bfsi-global": 55,
    "government-psu": 28,
    "fmcg-mnc": 40,
    "edtech": 45,
  },
  "design-manager": {
    "it-services": 18,
    "indian-unicorn": 38,
    "startup-growth": 32,
    "startup-early": 22,
    "saas-product": 42,
    "gcc": 50,
    "big-tech": 60,
    "faang": 75,
    "consulting-mbb": 40,
    "consulting-big4": 25,
    "bfsi-domestic": 22,
    "bfsi-global": 38,
    "government-psu": 18,
    "fmcg-mnc": 25,
    "edtech": 28,
  },
  "data-scientist": {
    "it-services": 12,
    "indian-unicorn": 28,
    "startup-growth": 24,
    "startup-early": 18,
    "saas-product": 30,
    "gcc": 35,
    "big-tech": 45,
    "faang": 55,
    "consulting-mbb": 32,
    "consulting-big4": 18,
    "bfsi-domestic": 16,
    "bfsi-global": 30,
    "government-psu": 14,
    "fmcg-mnc": 18,
    "edtech": 22,
  },
  "data-ic": {
    "it-services": 10,
    "indian-unicorn": 20,
    "startup-growth": 18,
    "startup-early": 13,
    "saas-product": 24,
    "gcc": 28,
    "big-tech": 35,
    "faang": 45,
    "consulting-mbb": 24,
    "consulting-big4": 14,
    "bfsi-domestic": 12,
    "bfsi-global": 24,
    "government-psu": 11,
    "fmcg-mnc": 14,
    "edtech": 16,
  },
  "product-manager": {
    "it-services": 18,
    "indian-unicorn": 35,
    "startup-growth": 30,
    "startup-early": 22,
    "saas-product": 38,
    "gcc": 42,
    "big-tech": 50,
    "faang": 65,
    "consulting-mbb": 45,
    "consulting-big4": 25,
    "bfsi-domestic": 22,
    "bfsi-global": 35,
    "government-psu": 18,
    "fmcg-mnc": 26,
    "edtech": 28,
  },
  pmm: {
    "it-services": 16,
    "indian-unicorn": 32,
    "startup-growth": 26,
    "startup-early": 18,
    "saas-product": 35,
    "gcc": 38,
    "big-tech": 45,
    "faang": 55,
    "consulting-mbb": 38,
    "consulting-big4": 22,
    "bfsi-domestic": 18,
    "bfsi-global": 30,
    "government-psu": 15,
    "fmcg-mnc": 22,
    "edtech": 24,
  },
};

/** Multiplier above tier P50 that fires `initial-above-tier-p50` warning.
 *  1.5× tier P50 = "this is the upper end of plausible for this tier" —
 *  beyond it is either a senior IC band mis-labeled or curator data error. */
export const TIER_P50_WARN_MULTIPLIER = 1.5;

/** Multiplier above tier P50 that triggers CLAMPING at init (not just a
 *  warning). 2.0× P50 = "the bot would open at twice the typical market
 *  median for this tier" — the Wipro UI/UX case was 3.4×. We clamp at
 *  init time only; mid-session band changes would mask curator bugs and
 *  break thread coherence. */
export const TIER_P50_CLAMP_MULTIPLIER = 2.0;

/** When clamping, the new initial offer is set to this multiplier × P50.
 *  1.4× = mid-to-upper of plausible, still believable as "this employer
 *  knows the candidate is good", not "this employer is overpaying". */
export const CLAMP_INITIAL_MULTIPLIER = 1.4;

export interface TierP50Lookup {
  p50: number;
  family: string;
  tier: CompanyTier;
}

/** Look up the (family, tier) P50 baseline for a role + company tier.
 *  Returns null when we have no opinion (unknown family, unknown tier,
 *  or no P50 row for that combo). Pure. */
export function lookupTierP50(role: string, tier: CompanyTier | null | undefined): TierP50Lookup | null {
  if (!tier) return null;
  const family = bandFamilyForRole(role);
  const familyTable = TIER_FAMILY_P50_LPA[family];
  if (!familyTable) return null;
  const p50 = familyTable[tier];
  if (p50 == null) return null;
  return { p50, family, tier };
}

export interface BandClampResult {
  /** The band to actually use (possibly rewritten). */
  band: BandLike;
  /** True iff the band was rewritten because initialOffer was >2× tier P50. */
  clamped: boolean;
  /** Original initialOffer/maxStretch if clamped — kept for telemetry so we
   *  can audit what the curator data said vs what we shipped to the user. */
  originalInitial?: number;
  originalStretch?: number;
  reason?: string;
  p50?: number;
  tier?: CompanyTier;
  family?: string;
}

/** If the resolved band's initialOffer is more than 2× the tier P50 for
 *  the role's family, clamp the band to a tier-realistic spread. Returns
 *  the original band unchanged when below threshold or when we have no
 *  P50 opinion. Pure.
 *
 *  This is the only place in the system that REWRITES a band. It runs at
 *  init time only — mid-session clamping is explicitly avoided. The
 *  rationale: if the curator data is wrong for THIS company tier, we
 *  should not subject the candidate to an unrealistic opener. The full
 *  band + clamp result is emitted to telemetry so curator review can
 *  catch the bad data upstream. */
export function clampBandToTierP50(
  band: BandLike,
  role: string,
  tier: CompanyTier | null | undefined,
): BandClampResult {
  const lookup = lookupTierP50(role, tier);
  if (!lookup) return { band, clamped: false };
  const { p50, family } = lookup;
  if (band.initialOffer <= p50 * TIER_P50_CLAMP_MULTIPLIER) {
    return { band, clamped: false, p50, tier: lookup.tier, family };
  }
  const clampedInitial = Math.round(p50 * CLAMP_INITIAL_MULTIPLIER * 10) / 10;
  /* Stretch grows from clamped initial by ~40% to keep the negotiation
     surface non-degenerate (counter-base levers need room to move).
     Walk-away anchored at 75% of the new initial for the same reason —
     using the curator-provided walkAway would often land it above the
     clamped initial and invert the band. */
  const clampedStretch = Math.round(p50 * CLAMP_INITIAL_MULTIPLIER * 1.4 * 10) / 10;
  const clampedWalk = Math.round(clampedInitial * 0.75 * 10) / 10;
  return {
    band: {
      initialOffer: clampedInitial,
      maxStretch: clampedStretch,
      walkAway: clampedWalk,
    },
    clamped: true,
    originalInitial: band.initialOffer,
    originalStretch: band.maxStretch,
    reason: `initialOffer ${band.initialOffer} > ${TIER_P50_CLAMP_MULTIPLIER}× tier P50 (${p50}) for family=${family} tier=${tier}`,
    p50,
    tier: lookup.tier,
    family,
  };
}

/** Returns a list of sanity warnings for a resolved band, given the role
 *  it was resolved for. Empty list = the band looks reasonable.
 *
 *  This is deliberately log-only at runtime — sessions in flight should
 *  NOT have their bands clamped mid-conversation because a curator-set
 *  value tripped a guardrail. The CI audit (see bandSanity.test.ts)
 *  catches override commits that introduce bad data; production warnings
 *  catch the stale-data / role-mismatch path. */
export function checkBandSanity(
  band: BandLike,
  role: string,
  tier?: CompanyTier | null,
): BandSanityWarning[] {
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
  /* Tier × family P50 check — fires when the curator/sector-fallback
     band is plausibly within the family but mismatched for the company
     tier. Wipro UI/UX session (May 2026) is the canonical case:
     designer family allows ₹3-45 LPA, ₹27 LPA passes — but Wipro is
     IT-services tier where designer P50 is ₹8 LPA. The check below
     catches that. */
  if (tier) {
    const lookup = lookupTierP50(role, tier);
    if (lookup && band.initialOffer > lookup.p50 * TIER_P50_WARN_MULTIPLIER) {
      warnings.push({
        family: lookup.family,
        kind: "initial-above-tier-p50",
        band,
        bound: Math.round(lookup.p50 * TIER_P50_WARN_MULTIPLIER * 10) / 10,
      });
    }
  }
  return warnings;
}

/** Convenience: lookup the baseline for a role, exposed so callers can
 *  emit family= telemetry alongside band= telemetry without re-running
 *  the pattern match. */
export function bandFamilyForRole(role: string): string {
  return (BAND_SANITY_BASELINES.find(b => b.pattern.test(role || ""))!).family;
}

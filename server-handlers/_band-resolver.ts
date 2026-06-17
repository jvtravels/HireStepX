/* Server-side band resolver — single source of truth for converting
 * (role, company, experienceLevel | applicableYoe) → NegotiationBand.
 *
 * Two callers need this:
 *   - negotiate-turn.ts on `action: "init"` (seed the kernel band from
 *     the onboarding payload, untrusting the client's band hint).
 *   - _negotiation-kernel.ts inside `applyCandidateAnswer` when fresh-grad
 *     disclosure flips mid-session. The candidate's resume said senior
 *     ("5 yrs"), the kernel locked-in a senior band at init, then on
 *     turn N the candidate says "I'm pre-grad" / "still in college".
 *     Without re-resolution the AI keeps anchoring senior numbers; with
 *     re-resolution the band drops to entry-tier on the next move.
 *
 * Pure given inputs — same role/company/experience always returns the
 * same band. No IO, no clock. Safe to call from inside the kernel's
 * transition functions per the kernel's purity contract (design rule 2). */

import { generateNegotiationBand } from "../data/salary-lookup";
import { getCompanyTier } from "../data/company-tiers";
import { experienceLevelFromYoe } from "./_candidate-profile";
import type { CollegeTier } from "./_candidate-profile";
import type { NegotiationBand } from "./_negotiation-kernel";
import {
  classifyCompanyTier as classifyBandTier,
  getBandForRole as getBandTierRoleBand,
} from "./_company-band-tiers";
import { clampBandToTargetRoleMarket } from "./_band-target-clamp";
import { clampBandToTierP50 } from "./_band-sanity";

/** Fresher-flow extension (2026-05-14c). Per-college-tier multiplier
 *  applied to the entry-level band. Calibrated to Indian campus hiring
 *  norms — IIT-B SWE entry routinely lands ₹18-25L vs the ₹3.5-5L
 *  IT-services standard; a 25% lift on the resolved band captures the
 *  shape without compounding with the company-tier resolution.
 *  Only fires at entry level (the signal is irrelevant for laterals). */
const COLLEGE_TIER_BAND_MULTIPLIER: Record<CollegeTier, number> = {
  "tier-1": 1.25,
  "tier-2": 1.0,
  "tier-3": 0.85,
};

/** Fresher-flow extension (2026-05-14c). When a candidate is converting
 *  an internship to full-time (PPO), the recruiter typically anchors at
 *  the high end of the entry band (~P60 vs the default P35 opener) —
 *  the candidate already has demonstrated fit and 6 months of
 *  performance data. Lift by 15% on the entry band. */
const PPO_ANCHOR_LIFT = 1.15;

/** Options bag for fresher-flow extensions surfaced from
 *  state.candidateProfile. Threaded through the callers (init at
 *  negotiate-turn.ts and mid-session rebase in _negotiation-kernel.ts)
 *  so the band-resolver can apply college-tier and PPO adjustments
 *  without depending on the full kernel state shape. */
export interface ResolveBandOptions {
  collegeTier?: CollegeTier | null;
  internshipConversion?: boolean;
  /** Override the default 6-month internship duration. Used for
   *  12-week summer programs (3 months), winter internships (2-3
   *  months), or 12-month industrial trainee placements. Clamped to
   *  [1, 12] to guard against bad client input. When undefined, falls
   *  back to INTERN_DEFAULT_MONTHS. Only consumed when isInternshipRole
   *  fires (no effect on full-time bands). */
  internshipMonths?: number;
}

/** Light college-tier multiplier applied to intern stipends. Tier-1
 *  IIT/NIT interns at IT-services / GCC commonly land 20-30% above
 *  the median stipend (₹20-25k/mo vs the standard ₹15-18k/mo). The
 *  effect is smaller than at full-time entry (where the multiplier
 *  is 1.25) because stipend bands are tighter and per-tier ratios
 *  already capture most of the company-side variance. */
const COLLEGE_TIER_STIPEND_MULTIPLIER: Record<CollegeTier, number> = {
  "tier-1": 1.2,
  "tier-2": 1.0,
  "tier-3": 0.9,
};

/** Indian fresher-flow extension (2026-05-14, expanded 2026-05-14b).
 *  Per-tier probation gate. Tiers known to run a probation-vs-confirmed
 *  comp split at entry level:
 *    - it-services: 6-month probation @ 90% — TCS/Infosys/Wipro standard
 *    - consulting-big4: 3-month probation @ 85% — Deloitte/EY/KPMG/PwC
 *    - bfsi-domestic: 6-month trainee program @ 80% — HDFC/ICICI/Axis
 *    - bfsi-global: 6-month probation @ 90% — JPM/GS India arms
 *  Other tiers (faang, big-tech, indian-unicorn, startups, etc) either
 *  pay flat from day-one or use a separate joining-grant structure and
 *  are excluded from this gate. */
const PROBATION_TABLE: Record<string, { ratio: number; months: number }> = {
  "it-services": { ratio: 0.9, months: 6 },
  "consulting-big4": { ratio: 0.85, months: 3 },
  "bfsi-domestic": { ratio: 0.8, months: 6 },
  "bfsi-global": { ratio: 0.9, months: 6 },
};

/** Stipend band for active interns. Indian internship stipends vary
 *  sharply by tier — IT-services ₹15-25k/mo (~0.5× entry CTC),
 *  Indian-unicorn / big-tech / FAANG India ₹25-80k/mo (~0.55-0.7×).
 *  Per-tier ratio reflects market reality rather than a flat 0.4 that
 *  undershoots TCS by 20-40%. Fallback 0.45 when tier is unknown. */
const STIPEND_RATIO_BY_TIER: Record<string, number> = {
  "it-services": 0.5,
  "consulting-big4": 0.5,
  "bfsi-domestic": 0.45,
  "bfsi-global": 0.55,
  "consulting-mbb": 0.65,
  "indian-unicorn": 0.6,
  "big-tech": 0.65,
  "faang": 0.7,
  "saas-product": 0.55,
  "startup-growth": 0.55,
  "startup-early": 0.5,
  "gcc": 0.6,
  "edtech": 0.5,
  "fmcg-mnc": 0.55,
  "government-psu": 0.45,
};
const INTERN_STIPEND_RATIO_DEFAULT = 0.45;
const INTERN_DEFAULT_MONTHS = 6;

/** True when the original role string mentions intern/internship.
 *  Guards against false-positives like "internal-tools-engineer". */
function isInternshipRole(role: string): boolean {
  if (!role) return false;
  return /\b(intern|internship|intern[- ]?ship|summer intern|industrial trainee)\b/i.test(role);
}

/** Last-resort band when (role, company) can't resolve. Conservative
 *  mid-market numbers; chosen so a missing-data session still produces
 *  a coherent negotiation rather than a divide-by-zero. */
export const DEFAULT_BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: false,
};

/** Senior-inference fallback. When the client doesn't pass an explicit
 *  experienceLevel (legacy session, missing onboarding field), infer it
 *  from role-title prefixes so seniority still propagates into the band.
 *  Mirrors data/salary-lookup.ts:applyTitleExpFloor — that helper is
 *  private to salary-lookup so we duplicate the regex shape here at the
 *  resolveServerBand boundary. Returns undefined when no signal — caller
 *  passes-through to generateNegotiationBand which has its own
 *  applyTitleExpFloor pass over (params.role) downstream. */
export function inferExperienceFromRole(role: string): string | undefined {
  if (!role) return undefined;
  const r = role.toLowerCase();
  if (/\b(vp|vice president|director|head of|chief|cxo|c[deot]o|c-?suite|partner)\b/.test(r)) return "executive";
  if (/\b(lead|principal|staff|architect)\b/.test(r)) return "lead";
  if (/\b(senior|sr\.?|sr )/.test(r)) return "senior";
  return undefined;
}

/** Recompute the negotiation band server-side from (role, company).
 *  The client MAY supply a band hint, but it is never trusted —
 *  otherwise a tampered request could push the AI above maxStretch or
 *  below walkAway. We fall back to DEFAULT_BAND only when the
 *  data/salary-lookup pipeline can't resolve a band (no role / unknown
 *  company / lookup throws). Pure given inputs. */
export function resolveServerBand(
  role: string,
  company: string,
  experienceLevel?: string,
  applicableYoe?: number | null,
  opts?: ResolveBandOptions,
): NegotiationBand {
  if (!role) return DEFAULT_BAND;
  try {
    /* Phase 29 — when applicableYoe is known, derive the level from it
     * instead of trusting the onboarding-time experienceLevel. The
     * domain-pivot scenario (Senior PD → Java) explicitly requires this:
     * onboarding said "senior" but applicableYoe=0, so band must be
     * "entry". applicableYoe wins, then onboarding experienceLevel,
     * then title-regex inference. */
    const expFromYoe = experienceLevelFromYoe(applicableYoe ?? null);
    const expForBand = expFromYoe || experienceLevel || inferExperienceFromRole(role);
    const b = generateNegotiationBand({ role, company: company || undefined, experienceLevel: expForBand });
    /* SEMANTIC NORMALISATION: salary-lookup.ts stores `walkAway` as the
       RECRUITER's upper ceiling (= 1.1 × maxStretch — i.e. an ask above
       this and the recruiter walks). The kernel's `band.walkAway` means
       the CANDIDATE's floor (an offer below which the candidate walks).
       These are opposite ends of the band. Map salary-lookup's `minOffer`
       (= 0.95 × totalMin) to the kernel's walkAway so downstream
       validation (findOutOfBandNumber) lines up. Without this, every
       legitimate offer was being flagged out-of-band, the LLM retried
       endlessly, and we shipped the deterministic fallback unfiltered. */
    const kernelWalkAway = typeof b.minOffer === "number" && b.minOffer > 0 ? b.minOffer : Math.max(1, b.initialOffer * 0.75);
    const band: NegotiationBand = {
      initialOffer: b.initialOffer,
      maxStretch: b.maxStretch,
      walkAway: kernelWalkAway,
      hasEquity: Boolean(b.hasEquity),
    };

    /* Bug 1 (2026-05-14) — company-band-tier override. The legacy salary
     * lookup pipeline produces SWE-family bands that are mis-calibrated
     * for tier mismatches (Infosys React Dev was getting a ₹22L opener
     * against a ₹8-14L IT-services market). Our 10-tier band table is
     * the canonical Indian-market source; when the tier resolves AND
     * the lookup band sits materially above the tier ceiling, rebase
     * to the tier-table band. This is a one-way ratchet — we only
     * compress overshoots, never widen. Internship/PPO/college overrides
     * below still apply on top of the rebased band. */
    if (company && !isInternshipRole(role)) {
      const bandTier = classifyBandTier(company);
      const tierBand = getBandTierRoleBand(bandTier, role, applicableYoe ?? null);
      if (band.initialOffer > tierBand.ceil * 1.2 || band.maxStretch > tierBand.ceil * 1.4) {
        band.initialOffer = tierBand.target;
        band.maxStretch = tierBand.ceil;
        band.walkAway = Math.max(1, Math.round(tierBand.floor * 0.95 * 10) / 10);
      }
    }

    /* Fresher-flow extension 1: per-tier probation structure at entry.
     * Tiers that empirically run a confirmation-event comp split (see
     * PROBATION_TABLE above). Other tiers pay flat day-one. */
    const tier = company ? getCompanyTier(company) : null;
    const probationCfg = tier && expForBand === "entry" ? PROBATION_TABLE[tier] : undefined;
    if (probationCfg) {
      band.probationOffer = Math.round(band.initialOffer * probationCfg.ratio * 10) / 10;
      band.probationMonths = probationCfg.months;
    }

    /* Fresher-flow extension 2: internship role → scale band to stipend
     * range and flag isInternshipStipend. Detection must happen on the
     * ORIGINAL role string before alias resolution (salary-lookup
     * collapses "intern" → "software-engineer"). Per-tier ratio reflects
     * Indian market reality — flat 0.4 was undershooting IT-services by
     * 20-40% and unicorns by even more. */
    if (isInternshipRole(role)) {
      const stipendRatio = (tier && STIPEND_RATIO_BY_TIER[tier]) || INTERN_STIPEND_RATIO_DEFAULT;
      /* Compose with college-tier stipend multiplier (audit fix
       * 2026-05-14d): IIT/NIT interns at IT-services routinely land
       * ₹20-25k/mo vs ₹15-18k/mo standard. Tier-1 +20%, tier-3 -10%. */
      const collegeStipendMult =
        opts?.collegeTier ? COLLEGE_TIER_STIPEND_MULTIPLIER[opts.collegeTier] : 1.0;
      band.initialOffer = Math.round(band.initialOffer * stipendRatio * collegeStipendMult * 10) / 10;
      band.maxStretch = Math.round(band.maxStretch * stipendRatio * collegeStipendMult * 10) / 10;
      /* Floor sanity (audit concern 5): post-scale walkAway shouldn't
       * compress to a value that trips findOutOfBandNumber on legitimate
       * stipend counters. Use 80% of scaled initialOffer as the floor —
       * tighter than the salary-lookup minOffer (which was sized for the
       * full-CTC band) but loose enough to admit realistic candidate
       * asks like "₹20k vs ₹15k stipend". */
      band.walkAway = Math.round(band.initialOffer * 0.8 * 10) / 10;
      band.isInternshipStipend = true;
      /* Variable internship duration (audit fix 2026-05-14d). Clamp
       * to [1, 12] — anything outside this range is bad client input
       * (e.g., negative months, 50-month "internship"). */
      const requestedMonths = opts?.internshipMonths;
      band.internshipMonths =
        typeof requestedMonths === "number" && Number.isFinite(requestedMonths)
          ? Math.max(1, Math.min(12, Math.round(requestedMonths)))
          : INTERN_DEFAULT_MONTHS;
      /* Probation doesn't apply to interns — they have a fixed stipend
       * for the program duration, not a confirmation event. */
      delete band.probationOffer;
      delete band.probationMonths;
    }

    /* Fresher-flow extension 3 (2026-05-14c): college-tier multiplier.
     * Applies ONLY at entry level — once the candidate has work
     * experience, the resume signal dominates and college tier becomes
     * noise. Multiplier is applied to the core band numbers (and to
     * probationOffer when set) but NOT to internship stipends — those
     * are already calibrated by per-tier ratios. */
    if (opts?.collegeTier && expForBand === "entry" && !band.isInternshipStipend) {
      const mult = COLLEGE_TIER_BAND_MULTIPLIER[opts.collegeTier];
      band.initialOffer = Math.round(band.initialOffer * mult * 10) / 10;
      band.maxStretch = Math.round(band.maxStretch * mult * 10) / 10;
      band.walkAway = Math.round(band.walkAway * mult * 10) / 10;
      if (band.probationOffer != null) {
        band.probationOffer = Math.round(band.probationOffer * mult * 10) / 10;
      }
    }

    /* Fresher-flow extension 4 (2026-05-14c): PPO anchoring. A
     * converting intern has demonstrated fit + 6 months of performance
     * data — the recruiter typically opens at the high end of the entry
     * band, not the median. Lift the opening anchor (initialOffer) but
     * not the ceiling (maxStretch) — the band's upper bound is set by
     * what the company will pay for the role, regardless of conversion
     * history. walkAway nudges up slightly to keep the floor coherent. */
    if (opts?.internshipConversion && expForBand === "entry" && !band.isInternshipStipend) {
      const lifted = Math.round(band.initialOffer * PPO_ANCHOR_LIFT * 10) / 10;
      band.initialOffer = Math.min(lifted, band.maxStretch);
      band.walkAway = Math.min(
        Math.round(band.walkAway * 1.1 * 10) / 10,
        Math.round(band.initialOffer * 0.95 * 10) / 10,
      );
      if (band.probationOffer != null) {
        band.probationOffer = Math.round(band.initialOffer * 0.9 * 10) / 10;
      }
    }

    /* PDF #18 root-cause (2026-05-15) — target-role band clamp. QA-
     * testing / support roles inherit the engineering reference table
     * (classifyRoleFamily defaults unknown technical titles to
     * "engineering"), but their market is structurally lower. Apply
     * the target-role compressor here, AFTER all other resolver
     * passes, so internship / college-tier / probation transforms run
     * against the right starting band first. One-way: only compresses. */
    const clamped = clampBandToTargetRoleMarket(band, role);
    const targetClamped = clamped.band;

    /* DEBT #5 (2026-05-21) — tier-P50 clamp wired into the resolver
     * itself. Prior shape: the clamp ran at the negotiate-turn call-
     * site and at the kernel's mid-session rebase, but a new third
     * caller of resolveServerBand could quietly skip it. Folding the
     * clamp in here makes the resolver itself the single guarantee —
     * every band that leaves this function has been considered against
     * the tier-family P50. The clamp is idempotent (input ≤ 2× P50 is
     * a no-op), so existing call-sites that ALSO clamp downstream stay
     * correct. Skip on internship stipends — those are deliberately
     * scaled below the full-CTC P50. */
    let finalBand = targetClamped;
    if (!targetClamped.isInternshipStipend) {
      const resolverTier = company ? getCompanyTier(company) : null;
      const resolverClamp = clampBandToTierP50(targetClamped, role, resolverTier);
      if (resolverClamp.clamped) {
        finalBand = { ...targetClamped, ...resolverClamp.band };
      }
    }

    /* Gap D fix (2026-06-17) — keep probationOffer ≤ initialOffer.
     * probationOffer is derived from the PRE-clamp initialOffer (~line
     * 220). The target-role compressor (clampBandToTargetRoleMarket) and
     * the tier-P50 clamp above both push initialOffer DOWN for structurally
     * low-market titles (e.g. QA Engineer at IT-services: engineering-family
     * reference band → 5 LPA) WITHOUT touching probationOffer — stranding it
     * ABOVE the new initialOffer (6.9 > 5). probation pay is the *reduced*
     * rate, never a raise, so validateState enforces probationOffer ≤
     * initialOffer and threw `state.band.probationOffer-above-initialOffer`
     * — a hard 400 at session init for every fresher in that role×tier.
     * Re-derive from the final initialOffer using the same tier ratio. */
    if (finalBand.probationOffer != null && finalBand.probationOffer > finalBand.initialOffer) {
      const ratio = probationCfg?.ratio ?? 0.9;
      finalBand = {
        ...finalBand,
        probationOffer: Math.round(finalBand.initialOffer * ratio * 10) / 10,
      };
    }
    return finalBand;
  } catch {
    return DEFAULT_BAND;
  }
}

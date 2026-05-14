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
import type { NegotiationBand } from "./_negotiation-kernel";

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
      band.initialOffer = Math.round(band.initialOffer * stipendRatio * 10) / 10;
      band.maxStretch = Math.round(band.maxStretch * stipendRatio * 10) / 10;
      /* Floor sanity (audit concern 5): post-scale walkAway shouldn't
       * compress to a value that trips findOutOfBandNumber on legitimate
       * stipend counters. Use 80% of scaled initialOffer as the floor —
       * tighter than the salary-lookup minOffer (which was sized for the
       * full-CTC band) but loose enough to admit realistic candidate
       * asks like "₹20k vs ₹15k stipend". */
      band.walkAway = Math.round(band.initialOffer * 0.8 * 10) / 10;
      band.isInternshipStipend = true;
      band.internshipMonths = INTERN_DEFAULT_MONTHS;
      /* Probation doesn't apply to interns — they have a fixed stipend
       * for the program duration, not a confirmation event. */
      delete band.probationOffer;
      delete band.probationMonths;
    }

    return band;
  } catch {
    return DEFAULT_BAND;
  }
}

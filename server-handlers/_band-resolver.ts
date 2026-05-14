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

/** Indian fresher-flow extension (2026-05-14).
 *  IT-services majors (TCS / Infosys / Wipro / HCL / Tech Mahindra / LTI
 *  / Mindtree / Capgemini India / Cognizant India / Mphasis) pay a
 *  reduced rate during the 6-month probation period before stepping up
 *  to confirmed-CTC. ~90% is the industry-standard split. */
const PROBATION_RATIO = 0.9;
const PROBATION_MONTHS = 6;

/** Stipend band for active interns. Indian internship stipends typically
 *  run ~35-45% of the same company's entry-level confirmed CTC, with
 *  6-month default duration. We scale the resolved entry band by 0.4 and
 *  flag isInternshipStipend so downstream framing switches to
 *  stipend/PPO mode rather than CTC mode. */
const INTERN_STIPEND_RATIO = 0.4;
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

    /* Fresher-flow extension 1: IT-services entry → probation structure.
     * Only set probationOffer for IT-services tier at entry level — the
     * other tiers (product-tech, banks, etc) don't have the same
     * confirmed-CTC vs probation split as a default policy. */
    const tier = company ? getCompanyTier(company) : null;
    if (tier === "it-services" && expForBand === "entry") {
      band.probationOffer = Math.round(band.initialOffer * PROBATION_RATIO * 10) / 10;
      band.probationMonths = PROBATION_MONTHS;
    }

    /* Fresher-flow extension 2: internship role → scale band to stipend
     * range and flag isInternshipStipend. Detection must happen on the
     * ORIGINAL role string before alias resolution (salary-lookup
     * collapses "intern" → "software-engineer"). */
    if (isInternshipRole(role)) {
      band.initialOffer = Math.round(band.initialOffer * INTERN_STIPEND_RATIO * 10) / 10;
      band.maxStretch = Math.round(band.maxStretch * INTERN_STIPEND_RATIO * 10) / 10;
      band.walkAway = Math.round(band.walkAway * INTERN_STIPEND_RATIO * 10) / 10;
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

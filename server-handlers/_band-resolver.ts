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
import { experienceLevelFromYoe } from "./_candidate-profile";
import type { NegotiationBand } from "./_negotiation-kernel";

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
    return {
      initialOffer: b.initialOffer,
      maxStretch: b.maxStretch,
      walkAway: kernelWalkAway,
      hasEquity: Boolean(b.hasEquity),
    };
  } catch {
    return DEFAULT_BAND;
  }
}

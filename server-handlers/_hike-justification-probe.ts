/* PDF #18 follow-up (2026-05-15) — hike-justification auto-probe.
 *
 * Problem the user flagged: when a candidate asks for a >30% jump
 * (13 → 21 = 61%) and `valueProofProvided` is still false, the
 * existing `HIKE-LOGIC AWARENESS` rule + `valueProofProvided` flag
 * surface the GAP but never auto-inject the PROBE itself. Real HR
 * never moves money on a 60% jump without first asking "what
 * justifies it — automation framework ownership, test coverage,
 * production wins?" — i.e. a role-specific impact probe.
 *
 * This module is the single source of truth for:
 *   1. Whether the probe should fire this turn
 *      (`shouldProbeHikeJustification`)
 *   2. What the role-specific probe text is
 *      (`getHikeJustificationProbe`)
 *
 * Wired into the compactTurnBrief as a bracketed `[HIKE JUSTIFICATION
 * REQUIRED]` directive AND into the move-picker as a forced `probe`
 * lever when the candidate is still in discovery. Pure / stateless. */

import type { RoleFamily } from "./_company-band-tiers";

/* Threshold: matches the 30% bar the user specified. Strictly greater
 * than — a 30% jump on the nose doesn't fire (deserved annual hike at
 * many Indian firms). */
export const HIKE_JUSTIFICATION_THRESHOLD = 0.3;

export interface HikeJustificationInputs {
  /** Candidate's disclosed current CTC (LPA). */
  currentCtcLpa: number | null;
  /** Candidate's disclosed expected / target CTC (LPA). */
  expectedCtcLpa: number | null;
  /** Whether the candidate has already provided role-specific impact
   *  proof (ARR, quota, scale wins, etc.). */
  valueProofProvided: boolean;
}

/** Compute the hike delta as a fraction. Returns null when either CTC
 *  is missing or non-positive. Pure. */
export function computeHikeDelta(
  currentCtc: number | null,
  expectedCtc: number | null,
): number | null {
  if (currentCtc == null || expectedCtc == null) return null;
  if (currentCtc <= 0 || expectedCtc <= 0) return null;
  return (expectedCtc - currentCtc) / currentCtc;
}

/** Returns true iff the candidate is asking for a >30% jump and has
 *  NOT yet provided role-specific value proof. Pure. */
export function shouldProbeHikeJustification(
  input: HikeJustificationInputs,
): boolean {
  if (input.valueProofProvided) return false;
  const delta = computeHikeDelta(input.currentCtcLpa, input.expectedCtcLpa);
  if (delta == null) return false;
  return delta > HIKE_JUSTIFICATION_THRESHOLD;
}

/** Role-family-specific probe template. Pure. */
export function getHikeJustificationProbe(roleFamily: RoleFamily): string {
  switch (roleFamily) {
    case "engineering":
      return (
        'what justifies it — what\'s your impact in system design, ' +
        "codebase ownership, performance / scale wins?"
      );
    case "product":
      return (
        "what justifies it — features shipped, metrics moved, scope of " +
        "ownership?"
      );
    case "design":
      return (
        "what justifies it — design system ownership, user-research " +
        "depth, conversion / retention impact?"
      );
    case "sales":
      return "what justifies it — quota attainment, deal size, account growth?";
    case "csm-cs":
      return (
        "what justifies it — retention rate, expansion revenue, " +
        "account complexity?"
      );
    case "data":
      return (
        "what justifies it — model deployment, business metrics moved, " +
        "infra / platform ownership?"
      );
    case "marketing":
      return (
        "what justifies it — campaigns owned, growth / CAC / LTV " +
        "metrics moved, channel ownership?"
      );
    case "ops":
      return (
        "what justifies it — process / system ownership, efficiency / " +
        "cost metrics moved?"
      );
    default:
      /* Generic fallback — QA / other niche families land here until
       * they're modeled explicitly. */
      return (
        "what justifies it — your scope of ownership, automation / " +
        "framework impact, production-quality improvements?"
      );
  }
}

/** Convenience: produce the bracketed brief line the LLM consumes,
 *  e.g. `[HIKE JUSTIFICATION REQUIRED: 61% jump — ask "what justifies
 *  it — …"]`. Returns null when the probe should not fire. Pure. */
export function buildHikeJustificationBrief(
  input: HikeJustificationInputs,
  roleFamily: RoleFamily,
): string | null {
  if (!shouldProbeHikeJustification(input)) return null;
  const delta = computeHikeDelta(input.currentCtcLpa, input.expectedCtcLpa);
  if (delta == null) return null;
  const pct = Math.round(delta * 100);
  return `[HIKE JUSTIFICATION REQUIRED: ${pct}% jump — ask "${getHikeJustificationProbe(roleFamily)}"]`;
}


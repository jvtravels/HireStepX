/**
 * Recruiter-redirect helpers.
 *
 * Some candidate asks are NOT compensation negotiations and should be
 * escalated rather than countered. Examples:
 *   - spouse-job placement / referral
 *   - dependent-school sponsorship
 *   - relocation-benefit deep-dive when policy is fixed
 *
 * This module exposes a single pure helper that returns a brief-injection
 * string when the kernel state signals one of these patterns. Wiring into
 * the compactTurnBrief is the caller's choice; we keep the data-shape
 * leaf-level for safe testing. */

export interface RedirectInput {
  spouseJobNegotiation?: boolean;
  recommendWalkAway?: boolean;
}

/** Returns a brief-injection string or null. Pure. */
export function getRecruiterRedirect(input: RedirectInput): string | null {
  if (input.spouseJobNegotiation) {
    return "[RECRUITER REDIRECT — spouse-job placement is not a comp negotiation. Escalate to hiring manager / mobility partner; offer to introduce, do not concede on base / JB to compensate.]";
  }
  if (input.recommendWalkAway) {
    return "[RECRUITER REDIRECT — walk-away threshold reached. Stop conceding; offer one final structured close and prepare to disengage cleanly.]";
  }
  return null;
}

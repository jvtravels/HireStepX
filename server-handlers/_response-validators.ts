/* Response validators — architectural bug-prevention (2026-05-15).
 *
 * Promotes NUMBER DISCIPLINE and BUDGET DISCIPLINE from prompt-only
 * advisories to post-generation state validators. The prompt layer
 * still carries the rules (they coach the LLM on what to emit) but
 * enforcement no longer relies on the LLM honouring them. Both
 * validators are pure — input is the candidate-facing reply text plus
 * kernel state; output is `{ok}` or `{ok: false, reason, violations}`.
 *
 * Called from negotiate-turn.ts's reroll path so a single mis-emitted
 * number triggers exactly one reroll with the violation reason
 * appended to the prompt. After the reroll cap is hit (1), a fall-
 * through entry is logged to state.decisionLog with picker
 * "validator-reject-fallthrough" and the original reply is returned
 * (no user-facing hard fail — coverage is best-effort enforcement, not
 * a circuit breaker).
 */
import type { NegotiationState } from "./_negotiation-kernel";
import { getCompanyHikeCap } from "./_company-band-tiers";

/** Anchor deviation tolerance — 5% of locked anchor. */
const ANCHOR_DEVIATION_TOLERANCE = 0.05;
/** Above-ceiling tolerance — allow a 1% rounding fudge so "₹24.0L" against
 *  a ₹23.9L ceiling doesn't trip on numeric rounding. */
const CEILING_TOLERANCE = 0.01;

export interface ValidatorOk {
  ok: true;
}
export interface ValidatorReject {
  ok: false;
  reason: string;
  violations: string[];
}
export type ValidatorResult = ValidatorOk | ValidatorReject;

/** Extract every salary number (LPA / lakh / crore) emitted in the
 *  reply. Returns the normalized LPA value per match. Crore values
 *  convert ×100. */
function extractEmittedNumbers(reply: string): number[] {
  if (!reply) return [];
  const out: number[] = [];
  /* Match patterns like "18 LPA", "18.5L", "18 lakh", "1.5 crore". */
  const re = /(\d+(?:\.\d+)?)\s*(LPA|L|lakhs?|crores?|cr)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(reply)) !== null) {
    const v = parseFloat(m[1]);
    if (!Number.isFinite(v)) continue;
    const unit = m[2].toLowerCase();
    if (unit === "crore" || unit === "crores" || unit === "cr") {
      out.push(v * 100); // 1 cr = 100 LPA
    } else {
      out.push(v);
    }
  }
  return out;
}

/** NUMBER DISCIPLINE: every number the bot emits MUST be consistent with
 *  the locked anchor (if any) and the band ceiling. Rationale: PDF #18
 *  real session had the bot drift from a ₹54L anchor to a ₹28L follow-up;
 *  prompt-only rules failed to prevent it. */
export function validateNumberDiscipline(
  reply: string,
  state: NegotiationState,
): ValidatorResult {
  const nums = extractEmittedNumbers(reply);
  if (nums.length === 0) return { ok: true };
  const violations: string[] = [];

  /* Locked-anchor consistency (>5% deviation). */
  if (state.anchorLocked && state.lockedAnchorLpa != null && state.lockedAnchorLpa > 0) {
    const anchor = state.lockedAnchorLpa;
    const lo = anchor * (1 - ANCHOR_DEVIATION_TOLERANCE);
    /* Upward drift is bounded by the band ceiling check, not the anchor
     * tolerance — recruiters CAN concede upward within band. The anchor
     * lock is a floor against silent downward jumps. */
    for (const n of nums) {
      if (n < lo) {
        violations.push(
          `emitted ₹${n}L is ${((1 - n / anchor) * 100).toFixed(0)}% below locked anchor ₹${anchor}L (>5% downward drift)`,
        );
      }
    }
  }

  /* Band ceiling. */
  const ceiling = state.band?.maxStretch;
  if (ceiling != null && Number.isFinite(ceiling) && ceiling > 0) {
    const ceilingPlus = ceiling * (1 + CEILING_TOLERANCE);
    for (const n of nums) {
      if (n > ceilingPlus) {
        violations.push(
          `emitted ₹${n}L exceeds band ceiling (maxStretch ₹${ceiling}L)`,
        );
      }
    }
  }

  if (violations.length === 0) return { ok: true };
  return {
    ok: false,
    reason: `NUMBER DISCIPLINE — emitted numbers violate anchor/band invariants: ${violations.join("; ")}`,
    violations,
  };
}

/** BUDGET DISCIPLINE: numbers must not exceed the company's hike-cap-
 *  implied ceiling given current CTC. Uses the same COMPANY_HIKE_CAP_PCT
 *  the kernel already consults during counter-offer sizing. */
export function validateBudgetDiscipline(
  reply: string,
  state: NegotiationState,
): ValidatorResult {
  const nums = extractEmittedNumbers(reply);
  if (nums.length === 0) return { ok: true };
  const currentCtc = state.candidateCurrentCtc;
  if (currentCtc == null || currentCtc <= 0) return { ok: true };
  const cap = getCompanyHikeCap(state.company);
  if (cap == null) return { ok: true };
  const budgetCeiling = currentCtc * (1 + cap / 100);
  const budgetCeilingPlus = budgetCeiling * (1 + CEILING_TOLERANCE);
  const violations: string[] = [];
  for (const n of nums) {
    if (n > budgetCeilingPlus) {
      violations.push(
        `emitted ₹${n}L exceeds hike-cap budget ₹${budgetCeiling.toFixed(1)}L ` +
          `(currentCtc ₹${currentCtc}L × ${1 + cap / 100} for ${state.company})`,
      );
    }
  }
  if (violations.length === 0) return { ok: true };
  return {
    ok: false,
    reason: `BUDGET DISCIPLINE — hike-cap exceeded: ${violations.join("; ")}`,
    violations,
  };
}

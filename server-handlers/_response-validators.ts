/* Response validators — kernel-first survivors (2026-05-16).
 *
 * After the kernel-first pipeline took over (commit 43d9586) the LLM no
 * longer authors prose from scratch — it only restyles canonical text.
 * Most of the previous validator stack (range-discipline, hike-probe,
 * close-vocab matching, opening-anchor guard, etc.) policed an LLM
 * authorship surface that no longer exists; those have been deleted.
 *
 * Two validators survive because they police the RESTYLED output, not
 * the canonical input:
 *
 *   validateNumberDiscipline   — emitted numbers must not drift below
 *                                a locked anchor or above the band
 *                                ceiling. Restyle CAN introduce a
 *                                number that wasn't in the canonical
 *                                (rare, but possible), so we still
 *                                guard.
 *   validateNoFabricatedFacts  — restyle must not introduce a phrase
 *                                that implies the candidate disclosed
 *                                something they didn't (competing
 *                                offer, current CTC, notice period).
 *
 * Both are pure. Both are kept here rather than inlined into
 * `_response-pipeline.ts` so they can be unit-tested in isolation.
 */
import type { NegotiationState } from "./_negotiation-kernel";

export interface ValidatorOk {
  ok: true;
}
export interface ValidatorReject {
  ok: false;
  reason: string;
  violations: string[];
}
export type ValidatorResult = ValidatorOk | ValidatorReject;

/** Anchor deviation tolerance — 5% of locked anchor. */
const ANCHOR_DEVIATION_TOLERANCE = 0.05;
/** Above-ceiling tolerance — allow a 1% rounding fudge so "₹24.0L" against
 *  a ₹23.9L ceiling doesn't trip on numeric rounding. */
const CEILING_TOLERANCE = 0.01;

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
 *  prompt-only rules failed to prevent it. Kept post-kernel-first because
 *  restyle is still capable of introducing a stray number. */
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

/* ─── Fabricated-facts (F3 PDF#19 2026-05-15) ──────────────────────────
 *
 * Catches the LLM (now: the restyler) hallucinating candidate-side
 * context that was never disclosed. Conservative claim patterns; only
 * rejects when the corresponding kernel state field is empty. Design
 * bar: false-negatives OK, ZERO false-positives.
 */

/** Pattern → state-field claim table. Each pattern asserts a candidate-
 *  side fact; if the kernel state proves the candidate did NOT disclose
 *  it, the validator rejects. */
const FABRICATED_FACT_PATTERNS: Array<{
  re: RegExp;
  fact: string;
  hasFact: (s: NegotiationState) => boolean;
}> = [
  {
    /* "you mentioned another offer", "your competing offer", "the other
     * offer you mentioned" — all imply a disclosed competing offer. */
    re: /\b(you\s+mentioned|your\s+competing|the\s+other\s+offer|another\s+offer\s+you|competing\s+offer\s+you)\b/i,
    fact: "competing-offer",
    hasFact: (s) =>
      s.competingOffer != null || !!s.competingOfferDetail?.hasAny,
  },
  {
    /* "given your current CTC", "your current package of", "based on
     * your current salary" — implies a disclosed current CTC. */
    re: /\b(given\s+your\s+current\s+(ctc|salary|package)|your\s+current\s+(ctc|salary|package)\s+of|based\s+on\s+your\s+current\s+(ctc|salary|package))\b/i,
    fact: "current-ctc",
    hasFact: (s) => s.candidateCurrentCtc != null && s.candidateCurrentCtc > 0,
  },
  {
    /* "your N-day notice period", "given your notice period" — implies
     * a disclosed notice period. */
    re: /\b(your\s+\d+\s*(day|month|week)\s*notice|given\s+your\s+notice\s+period|with\s+your\s+notice\s+period)\b/i,
    fact: "notice-period",
    hasFact: (s) => (s.noticeJoining?.noticePeriodDays ?? null) != null,
  },
];

/** FABRICATED FACTS: rejects bot replies that claim the candidate
 *  disclosed something the kernel state has no record of. */
export function validateNoFabricatedFacts(
  reply: string,
  state: NegotiationState,
): ValidatorResult {
  if (!reply) return { ok: true };
  const violations: string[] = [];
  const reasons: string[] = [];
  for (const { re, fact, hasFact } of FABRICATED_FACT_PATTERNS) {
    if (re.test(reply) && !hasFact(state)) {
      violations.push(fact);
      reasons.push(`reply claims ${fact} but kernel state has no record`);
    }
  }
  if (violations.length === 0) return { ok: true };
  return {
    ok: false,
    reason: `FABRICATED FACTS — ${reasons.join("; ")}`,
    violations,
  };
}

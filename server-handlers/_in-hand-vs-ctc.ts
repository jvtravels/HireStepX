/**
 * In-hand vs CTC anchor disambiguation.
 *
 * Sprint B.3 (2026-05-15) — many Indian candidates anchor in in-hand
 * (take-home) rupees per year or per month, not in CTC. A recruiter who
 * treats a ₹16L in-hand ask as a ₹16L CTC ask under-quotes the candidate
 * by ~30%, and the candidate disengages mid-negotiation. This module
 * detects the in-hand framing and back-computes a CTC equivalent.
 *
 * Pure, no I/O. */

import { computeNewRegime } from "./_indian-tax-calculator";

const IN_HAND_PATTERNS: RegExp[] = [
  /\bin[\s-]?hand\b/i,
  /\btake[\s-]?home\b/i,
  /\bafter\s+tax\b/i,
  /\bpost\s+tax\b/i,
  /\bper\s+month\b/i,
  /\d+\s*in\s+hand\b/i,
];

/** True when the utterance frames a number as in-hand / take-home. Pure. */
export function detectInHandFraming(text: string | null | undefined): boolean {
  if (!text || typeof text !== "string") return false;
  return IN_HAND_PATTERNS.some((p) => p.test(text));
}

/** Back-compute the CTC (LPA) that produces approximately `inHandLpa` take-home.
 *
 *  Strategy: under the new regime FY25-26, take-home ≈ CTC × ~0.87 below the
 *  ₹12L rebate floor (full rebate, only standard-deduction cuts effective rate),
 *  ~CTC × 0.80 once tax slabs apply on a typical 60/0/40 fixed/variable split.
 *  Rather than fit a polynomial, we iterate: start with a 1.15× multiplier and
 *  adjust against the calculator's reported netLpa until within ±₹0.1L.
 *
 *  Returns null when inHandLpa is non-finite or ≤ 0. Pure. */
export function backComputeCtcFromInHand(inHandLpa: number): number | null {
  if (!Number.isFinite(inHandLpa) || inHandLpa <= 0) return null;
  /* Fast path: in-hand ≤ ~₹11L lands fully inside the new-regime rebate
   * window, so CTC ≈ in-hand × 1.15 is within the tolerance band. */
  if (inHandLpa <= 11) return Math.round(inHandLpa * 1.15 * 10) / 10;

  /* Iterate. Start at 1.15× and adjust. The fixed/variable assumption
   * (60/40) is a typical Indian metro shape; for the brief-injection
   * use-case the recruiter just needs an order-of-magnitude CTC anchor
   * to confirm with the candidate, not a precise tax-engineered figure. */
  let ctc = inHandLpa * 1.15;
  for (let i = 0; i < 6; i++) {
    const result = computeNewRegime({
      fixedLpa: ctc * 0.6,
      variableLpa: ctc * 0.4,
    });
    const diff = inHandLpa - result.netLpa;
    if (Math.abs(diff) < 0.1) break;
    ctc += diff * 1.05;
    if (ctc <= 0) return null;
  }
  return Math.round(ctc * 10) / 10;
}

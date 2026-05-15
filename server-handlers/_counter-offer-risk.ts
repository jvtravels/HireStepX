/**
 * Counter-offer-at-current risk detector.
 *
 * Indian recruitment reality (2026-05-15 audit): well-funded employers
 * routinely deploy retention counters within 2-3 weeks of resignation,
 * especially for short-tenure candidates whose departure would force a
 * costly backfill. When the candidate's "just enough to beat" target is in
 * the 15-22% range and the competing offer is vague, the probability that
 * the candidate accepts a retention counter (and reneges) is meaningfully
 * higher than baseline.
 *
 * This module produces a single low/medium/high signal that the kernel
 * surfaces in the compactTurnBrief. The move-picker can stiffen its close
 * and ask for written-offer commitment when high.
 *
 * Pure; no I/O. */

import { isCounterOfferRiskEmployer } from "./_company-band-tiers";

export interface CounterOfferRiskInput {
  /** Free-form profile descriptor — used only to bias heuristics in future. */
  candidateProfile?: { tenureSignal?: string | null } | null;
  /** Candidate's CURRENT package (LPA). */
  currentCtcLpa: number | null | undefined;
  /** Target / counter the candidate wants from this offer (LPA). */
  targetLpa: number | null | undefined;
  /** Months of tenure at current employer. */
  tenureMonths?: number | null;
  /** Current employer's name (free-form). */
  currentEmployer?: string | null;
  /** Strength of the competing-offer signal from the candidate's narrative.
   *  "vague" = no name / no letter / hand-wavy; "named" = name shared;
   *  "letter-in-hand" = candidate offered to share letter. */
  competingOfferCredibility?: "vague" | "named" | "letter-in-hand" | null;
}

export type CounterOfferRisk = "low" | "medium" | "high";

export interface CounterOfferRiskResult {
  risk: CounterOfferRisk;
  reasons: string[];
}

/** Estimate the probability that the candidate's current employer will
 *  deploy a retention counter and the candidate will accept. Heuristic;
 *  conservative on "high" (only fires when 3+ signals stack). Pure. */
export function estimateCounterOfferRisk(
  input: CounterOfferRiskInput,
): CounterOfferRiskResult {
  const reasons: string[] = [];
  let score = 0;

  const tenure = input.tenureMonths ?? null;
  const wellFunded = isCounterOfferRiskEmployer(input.currentEmployer ?? null);
  const credibility = input.competingOfferCredibility ?? null;

  // Signal 1: short tenure (≤ 24mo). Retention-counter ROI is highest when
  // the backfill cost is high; short-tenure exits trigger the strongest
  // retention response.
  if (tenure != null && tenure <= 24) {
    score += 1;
    reasons.push(`short tenure (${tenure}mo ≤ 24mo)`);
  }

  // Signal 2: well-funded employer.
  if (wellFunded) {
    score += 1;
    reasons.push(`well-funded current employer (${input.currentEmployer}) actively counter-offers`);
  }

  // Signal 3: target in the "just enough to beat" range (15-22% over current).
  // This is the classic retention-counter sweet spot — large enough to feel
  // worth chasing, small enough that the current employer can match.
  if (
    typeof input.currentCtcLpa === "number" &&
    typeof input.targetLpa === "number" &&
    input.currentCtcLpa > 0
  ) {
    const hikePct = ((input.targetLpa - input.currentCtcLpa) / input.currentCtcLpa) * 100;
    if (hikePct >= 15 && hikePct <= 22) {
      score += 1;
      reasons.push(`target hike ${hikePct.toFixed(0)}% is in the "just enough to beat" band`);
    }
  }

  // Signal 4: vague competing offer. If the candidate has a letter in hand
  // from a credible competitor, the current employer's retention counter
  // is less effective.
  if (credibility === "vague" || credibility == null) {
    score += 0.5;
    reasons.push("competing offer is vague / no letter shared");
  } else if (credibility === "letter-in-hand") {
    score -= 0.5;
    reasons.push("candidate has letter-in-hand from competitor (lowers counter risk)");
  }

  let risk: CounterOfferRisk;
  if (score >= 3) risk = "high";
  else if (score >= 1.5) risk = "medium";
  else risk = "low";

  return { risk, reasons };
}

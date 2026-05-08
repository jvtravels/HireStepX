/* HireStepX — Negotiation math
 *
 * Pure logic helpers the salary-neg analyzer + LLM coaching layer use to
 * ground their advice in the candidate's actual position. Three primitives:
 *
 *   1. landingZone(initial, ask, tierFlexibility)
 *      Given an initial offer + the candidate's ask, predict the realistic
 *      close. Recruiters typically move 5-15% on base, more on signing.
 *      Tier-aware (listed cos move less; growth-stage cos negotiate harder).
 *
 *   2. batnaStrength(offers)
 *      Quantify how much leverage a candidate's competing offers actually
 *      give them. A verbal "I have other interviews" is weak; a written
 *      offer at higher comp from a peer-tier company is strong. Scores
 *      0.0-1.0 so coaching can scale advice ("this is a stretch ask
 *      backed by weak BATNA — drop ask 10% or lose credibility").
 *
 *   3. askPositioning(askLpa, band)
 *      Where the candidate's ask falls vs the company's published band:
 *      "below" (leaving money), "in_band" (safe), "stretch" (top of band),
 *      "moonshot" (above band — needs justification or BATNA).
 *
 * Tested in src/__tests__/negotiationMath.test.ts.
 */

export type CompanyTierBucket =
  | "listed_big_tech"
  | "listed_unicorn"
  | "mature_unicorn"
  | "growth_startup"
  | "early_startup"
  | "it_services"
  | "bfsi"
  | "fmcg"
  | "psu";

/** How much above the initial offer a recruiter typically lands at,
 *  expressed as a multiplier on the gap (initial..ask). 1.0 = match the
 *  full ask, 0.0 = no movement. Tier-aware. */
export function tierFlexibility(tier: CompanyTierBucket | undefined): number {
  switch (tier) {
    case "listed_big_tech":  return 0.20; // tight bands, comp committee approval needed
    case "listed_unicorn":   return 0.30; // slightly more flex post-listing
    case "mature_unicorn":   return 0.45; // most negotiation happens here
    case "growth_startup":   return 0.55; // talent-hungry, will stretch
    case "early_startup":    return 0.40; // founder-led, idiosyncratic
    case "it_services":      return 0.10; // grade-bound, almost no flex
    case "bfsi":             return 0.25; // band-bound but signing/joining bonus flex
    case "fmcg":             return 0.20; // hierarchical pay structure
    case "psu":              return 0.05; // pay matrix is the matrix
    default:                 return 0.30;
  }
}

/** Predict the realistic landing zone given initial offer + candidate's ask
 *  + company tier flexibility. Returns an LPA range: [low, high].
 *
 *  Math: if initial=20, ask=30, flex=0.45, the recruiter typically lands
 *  at initial + (ask - initial) × flex × {0.7, 1.3} → [23.15, 26.85]. */
export function landingZone(
  initialOfferLpa: number,
  askLpa: number,
  tier: CompanyTierBucket | undefined,
): { lowLpa: number; highLpa: number; midLpa: number; flexibility: number } {
  const initial = Math.max(0, initialOfferLpa);
  const ask = Math.max(initial, askLpa);
  const flex = tierFlexibility(tier);
  const gap = ask - initial;
  const expectedMid = initial + gap * flex;
  const spread = gap * flex * 0.30; // ±30% around the expected midpoint
  return {
    lowLpa: round1(Math.max(initial, expectedMid - spread)),
    highLpa: round1(Math.min(ask, expectedMid + spread)),
    midLpa: round1(expectedMid),
    flexibility: flex,
  };
}

export interface CompetingOffer {
  /** Total CTC of the competing offer, in LPA. */
  totalCtcLpa: number;
  /** Whether the candidate has the offer in writing (offer letter / email). */
  inWriting: boolean;
  /** Whether the competing co is at a comparable tier (peer or above). */
  peerTier: boolean;
  /** Offer age in days. Older offers leak credibility. */
  ageDays: number;
}

/** BATNA = Best Alternative To Negotiated Agreement. Score 0..1.
 *  Multiple high-quality offers with peer cos move recruiters; a single
 *  verbal "I have interviews" doesn't. */
export function batnaStrength(offers: CompetingOffer[]): {
  score: number;
  label: "none" | "weak" | "moderate" | "strong";
  rationale: string;
} {
  if (!offers.length) {
    return { score: 0, label: "none", rationale: "No competing offers — leverage limited to role fit and market data." };
  }
  let score = 0;
  for (const o of offers) {
    let v = 0.20; // base credit per claimed offer
    if (o.inWriting) v += 0.20;
    if (o.peerTier) v += 0.15;
    if (o.ageDays <= 30) v += 0.10; // fresh offers carry urgency
    if (o.ageDays > 90) v -= 0.15; // stale offers leak credibility
    score += Math.max(0, v);
  }
  score = Math.min(1, score);
  let label: "none" | "weak" | "moderate" | "strong";
  if (score < 0.25) label = "weak";
  else if (score < 0.55) label = "moderate";
  else label = "strong";

  const writtenCount = offers.filter(o => o.inWriting).length;
  const peerCount = offers.filter(o => o.peerTier).length;
  const rationale = `${offers.length} competing offer(s); ${writtenCount} in writing, ${peerCount} from peer-tier cos. ` +
    (label === "strong" ? "Use as anchor — recruiters take written peer-tier offers seriously."
      : label === "moderate" ? "Useful but don't over-rely; recruiter may still test the credibility."
      : "Weak BATNA — lead with role-fit and market data, not these offers.");
  return { score: round2(score), label, rationale };
}

/** Where the candidate's ask sits vs the company's verified band. */
export type AskPosition = "below_band" | "in_band" | "stretch" | "moonshot";

export function askPositioning(
  askLpa: number,
  band: { totalMin: number; totalMax: number },
): { position: AskPosition; pctOfMax: number; advice: string } {
  if (askLpa <= 0 || band.totalMax <= 0) {
    return { position: "in_band", pctOfMax: 0, advice: "No band data — anchor on market range first." };
  }
  const pctOfMax = askLpa / band.totalMax;
  let position: AskPosition;
  let advice: string;
  if (askLpa < band.totalMin) {
    position = "below_band";
    advice = "Your ask is below this company's documented band. You're leaving money on the table — push to at least band-min.";
  } else if (askLpa <= band.totalMax * 0.85) {
    position = "in_band";
    advice = "Comfortably inside the band. Likely to close near here without strong BATNA needed.";
  } else if (askLpa <= band.totalMax * 1.05) {
    position = "stretch";
    advice = "Top of band / slight stretch. Justifiable with solid scope/competing offer; expect a counter at band-max.";
  } else {
    position = "moonshot";
    advice = "Above the documented band. Needs a strong BATNA (written peer offer) or clear scope justification, otherwise drops credibility.";
  }
  return { position, pctOfMax: round2(pctOfMax), advice };
}

function round1(n: number): number { return Math.round(n * 10) / 10; }
function round2(n: number): number { return Math.round(n * 100) / 100; }

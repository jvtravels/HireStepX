/* Hike justification + rationale parser — Phase 11 (2026-05-13).
 *
 * The audit (2026-05-13) flagged that the kernel had zero structured
 * handling for the dominant Indian-market negotiation frame: the
 * RECRUITER pushback "you're asking for X% hike, justify it." Pre-Phase
 * 11 the kernel knew `candidateTarget` and `candidateCurrentCtc` but
 * didn't compute hike%, nor track why the candidate believed the
 * number was fair.
 *
 * Failure modes this closes:
 *   1. Candidate states "I want 30 LPA" against current 18 LPA (67% hike).
 *      Pre-Phase-11 the AI would silently accept the ask without ever
 *      probing the justification — robotic from the recruiter side, and
 *      a wasted teaching moment for the candidate who's practising.
 *   2. Candidate states a rationale ("market for my YOE is 32 LPA") and
 *      the kernel folds the target but discards the framing. The LLM
 *      has to re-derive context every turn from the conversation log.
 *   3. The AI never asks "how did you arrive at this number?" — a
 *      probing question that real recruiters always ask. The new
 *      `probe-justification` lever fills this gap.
 *
 * Two outputs:
 *   - `hikePercent`: computed when both target and currentCtc are
 *     known. Surfaced in the LLM brief so the AI can frame "that's a
 *     X% hike" naturally.
 *   - `rationale`: classified into one of six kinds based on cue
 *     phrases the candidate uses to justify the ask. Conservative
 *     patterns — false positives would silently teach the kernel a
 *     rationale the candidate didn't state.
 *
 * Patterns are conservative. Each rationale kind requires explicit
 * cue language; unrecognized utterances return null. */

export type RationaleKind =
  /** Anchored to external market data — Glassdoor, Levels.fyi, peers,
   *  Naukri ranges. The strongest negotiation frame. */
  | "market-data"
  /** Anchored to the candidate's YOE / tenure / band level / past CTC
   *  growth trajectory. Common but weaker than market-data. */
  | "tenure-yoe"
  /** Anchored to a competing offer in hand (already structured in
   *  state.competingOffer; rationale here records that the candidate
   *  USED it as the justification, not just disclosed it). */
  | "competing-offer"
  /** Anchored to scope expansion — the new role has more reports / a
   *  larger budget / wider remit than current. */
  | "scope-expansion"
  /** Anchored to specialization — niche skill, certification, scarce
   *  domain. ("I'm one of 50 people in India with this stack.") */
  | "specialization"
  /** Anchored to cost-of-living delta — relocation premium for moving
   *  city (Bangalore/Mumbai/Gurgaon vs tier-2). Often co-states with
   *  the location-mode parser. */
  | "col-relocation";

export interface RationaleResult {
  kind: RationaleKind;
  /** Brief evidence snippet (≤80 chars) extracted from the candidate
   *  text. Helps the LLM frame "you mentioned ${evidence}" naturally. */
  evidence: string;
}

export interface HikeRationaleResult {
  /** Hike% from currentCtc to target. Null when either is missing.
   *  Rounded to 1 decimal. Negative possible (candidate took a cut). */
  hikePercent: number | null;
  /** Rationale classification + evidence; null when no rationale cue
   *  detected. Last-stated-wins on update (candidate can revise). */
  rationale: RationaleResult | null;
}

/* Rationale cue patterns — each requires explicit framing language.
 * Conservative: "I want 30 LPA" alone matches NOTHING (the rationale
 * is unstated). Only when the candidate gives a REASON do we tag it. */
const RATIONALE_PATTERNS: { kind: RationaleKind; pattern: RegExp }[] = [
  {
    kind: "market-data",
    pattern: /\b(market\s+(?:rate|data|range|standard|average)|glassdoor|levels\.?fyi|naukri|payscale|industry\s+(?:standard|average|range)|going\s+rate|benchmark|comparable\s+roles?|peers?\s+(?:at|in|earning|making)|similar\s+(?:roles?|positions?)\s+(?:at|in|pay|earn))\b/i,
  },
  {
    kind: "tenure-yoe",
    pattern: /\b((\d+)\+?\s*(?:years?|yrs?)\s+of\s+(?:experience|yoe)|years?\s+of\s+experience|yoe\b|seniority|tenure|career\s+(?:progression|growth|trajectory)|hike\s+from\s+last\s+(?:role|job|appraisal)|appraisal\s+cycle)\b/i,
  },
  {
    kind: "competing-offer",
    pattern: /\b(competing\s+offer|another\s+offer|other\s+offer|in[-\s]?hand\s+offer|offer\s+(?:in\s+hand|from|of)|already\s+(?:have|got|received)|received\s+(?:an?\s+)?offer)\b/i,
  },
  {
    kind: "scope-expansion",
    pattern: /\b(more\s+(?:scope|responsibility|reports?|ownership|budget|impact)|larger\s+(?:scope|team|remit|role)|wider\s+(?:scope|remit)|broader\s+(?:role|responsibility)|stepping\s+up|step[-\s]?up|level\s+up|bigger\s+role|managing\s+(?:more|larger|bigger)|leading\s+(?:more|larger|bigger))\b/i,
  },
  {
    kind: "specialization",
    pattern: /\b(niche\s+(?:skill|expertise|domain)|specializ(?:ed|ation)|rare\s+(?:skill|stack|expertise)|scarce|in[-\s]?demand\s+skill|certification|certified|expert\s+in|deep\s+expertise|domain\s+expert|one\s+of\s+(?:few|the\s+few)|hard\s+to\s+find)\b/i,
  },
  {
    kind: "col-relocation",
    pattern: /\b(cost\s+of\s+living|col\b|relocat(?:ing|ion|e)|moving\s+to|shifting\s+to|metro\s+(?:premium|city)|tier[-\s]?1\s+city|bangalore|bengaluru|mumbai|gurgaon|gurugram|delhi\s+ncr|hyderabad|pune|hsr|whitefield)\b/i,
  },
];

/** Compute hike % from current → target. Returns null when inputs
 *  invalid. Rounded to 1 decimal. */
export function computeHikePercent(
  target: number | null,
  current: number | null,
): number | null {
  if (target == null || current == null) return null;
  if (!Number.isFinite(target) || !Number.isFinite(current)) return null;
  if (current <= 0) return null;
  const pct = ((target - current) / current) * 100;
  if (!Number.isFinite(pct)) return null;
  return Math.round(pct * 10) / 10;
}

/** Classify rationale cue if any present. First-match-wins (the order
 *  in RATIONALE_PATTERNS reflects strength as a negotiation frame). */
export function extractRationale(text: string): RationaleResult | null {
  if (!text) return null;
  for (const { kind, pattern } of RATIONALE_PATTERNS) {
    const m = pattern.exec(text);
    if (m) {
      const evidence = m[0].slice(0, 80);
      return { kind, evidence };
    }
  }
  return null;
}

/** Parse hike + rationale from a single candidate utterance. The
 *  caller passes currentCtc + target FROM THE UPDATED STATE (after
 *  current-turn binding) so the hike% reflects the freshest numbers. */
export function extractHikeRationale(
  text: string,
  target: number | null,
  current: number | null,
): HikeRationaleResult {
  return {
    hikePercent: computeHikePercent(target, current),
    rationale: extractRationale(text || ""),
  };
}

/** A hike of >50% is considered aggressive in the Indian market;
 *  >30% is normal switch-job framing; <15% is conservative (often
 *  intra-company appraisal). The move-picker doesn't use these
 *  thresholds directly — they exist for telemetry + the LLM brief
 *  framing hint. */
export function categorizeHike(
  pct: number | null,
): "pay-cut" | "conservative" | "normal" | "aggressive" | "extreme" | null {
  if (pct == null) return null;
  /* OA-B8 — a negative "hike" is a pay CUT, not a conservative raise. The
   * old ladder bucketed anything < 15 as "conservative" and told the
   * recruiter it was "well within market norms, consider matching" — the
   * exact wrong frame for a candidate whose target sits BELOW their current
   * CTC (a misstatement, or a genuine non-cash-priority move). It gets its
   * own bucket so both the brief token and the calibration hint frame it
   * as a cut, never as a raise. */
  if (pct < 0) return "pay-cut";
  if (pct < 15) return "conservative";
  if (pct < 30) return "normal";
  if (pct < 50) return "aggressive";
  return "extreme";
}

/* Brief token fed to the recruiter LLM. A negative percent is emitted as an
 * explicit `payCut=` chip (absolute magnitude) rather than the nonsensical
 * `hike=-18%` — a "hike" is a raise by definition, so a negative one would
 * read as garbage to the model and could produce confused prose (OA-B8). */
export function hikeBriefToken(pct: number): string {
  return pct < 0 ? `payCut=${Math.abs(pct)}%` : `hike=${pct}%`;
}

/* Single-source calibration hint for the recruiter LLM's pushback intensity.
 * Replaces a duplicated inline ladder in _negotiate-turn-helpers. The
 * non-negative branches are byte-identical to that prior ladder; the
 * pay-cut branch is new (OA-B8 — previously a negative hike fell through
 * every branch and produced no hint at all). */
export function hikeCalibrationHint(pct: number): string {
  switch (categorizeHike(pct)) {
    case "pay-cut":
      return `The candidate's target is BELOW their current CTC — a ${Math.abs(pct)}% pay cut, not a raise. Treat this as a likely misstatement or a non-cash-priority move: clarify what they actually want (WLB, role, location?) before countering. Do NOT frame it as them asking for a raise.`;
    case "extreme":
      return `Hike is ${pct}% — extreme. Frame your pushback respectfully; ask for the justification before any concession.`;
    case "aggressive":
      return `Hike is ${pct}% — aggressive. A justification probe is appropriate before counter-offering.`;
    case "normal":
      return `Hike is ${pct}% — normal switch-job range. Probe lightly or proceed to counter.`;
    default:
      return `Hike is ${pct}% — conservative. The candidate's ask is well within market norms; consider matching.`;
  }
}

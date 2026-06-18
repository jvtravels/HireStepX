/* AUDIT-4 (2026-06-08) — Output rail: offer-ask invariant.
 *
 * BACKGROUND
 * The deep-research synthesis (deep-research workflow wjat3yvxr) named
 * one architectural change as the highest-leverage first step: a code
 * rail, separate from the planner, that enforces a single invariant —
 * if the candidate explicitly asks for a number, the bot's response
 * MUST contain either a number or an honest ceiling sentence. Never
 * marketing fluff. Never an indefinite defer.
 *
 * This is the NeMo Guardrails "output rail" pattern applied to one
 * specific failure mode we have prod evidence for (Flipkart Sr PD
 * session, T7-T11: "Our offer is competitive and based on your
 * experience" shipped twice when band stretch ≤ candidate current CTC).
 *
 * SCOPE — what this rail enforces
 * 1) DETECT: candidate's most recent utterance contains an explicit
 *    offer-ask vocabulary ("what's your offer", "what number", "what
 *    are you offering", "share the range", etc).
 * 2) ASSERT: drafted bot text contains EITHER
 *    (a) a salary number with an LPA/lakh/crore unit, OR
 *    (b) an honest-ceiling sentence ("the stretch on this role is X",
 *        "we can go up to X", "above where this role typically sits").
 * 3) BLOCK on violation: substitute a deterministic safe stub built
 *    from state.band (calibrated-question + honest ceiling) and emit
 *    a PostHog event so we can measure how often this fires.
 *
 * SCOPE — what this rail does NOT do
 * - It does not re-run the planner. (That's the right longer-term fix;
 *   for week 1 we want measurement + correct floor behaviour, not a
 *   feedback loop into the state machine.)
 * - It does not fire on every turn — only when the candidate text
 *   matches the offer-ask regex.
 * - It does not fire when the planner is in terminal phases (close /
 *   walk-away / etc.) — those have their own contracts.
 *
 * DESIGN INVARIANT
 * Pure function. No I/O except the telemetry capture, which is
 * fire-and-forget. Easy to unit test without mocking.
 */

import type { NegotiationState, NegotiationPhase } from "./_negotiation-kernel";

/** Vocabulary that signals "I want a number now". Curated from prod
 *  transcripts (Flipkart Sr PD, Meesho Sr PD, Swiggy SDE-3). Intentionally
 *  narrow: false positives here cost the candidate a real interaction
 *  (they get a stub instead of a probe), so we err toward false negatives.
 *
 *  2026-06-19 — live staging verify (Acme Sr PD) surfaced a gap: a
 *  candidate who pushes the cash lever directly ("push the base", "what
 *  can you do on the base") or demands an explicit figure ("I need a
 *  concrete revised base number to say yes") slipped past every
 *  alternation, so the rail never fired and the LLM-restyle path shipped
 *  a number-free concession ("there's some flexibility on the base").
 *  No figure ever landed on the table → the deal-summary extractor found
 *  nothing → the report rendered "0 of 5 stages / couldn't extract offer
 *  numbers" over an accepted close. These demand phrasings are
 *  unambiguous number-asks, so adding them keeps the rail's
 *  false-negative bias intact while closing the cash-push hole. */
export const OFFER_ASK_RE =
  /\b(?:what(?:'s| is)?\s+(?:your|the)\s+offer|what\s+(?:number|range|figure|fitment|package|ctc)\s+(?:are|do)\s+you|what\s+are\s+you\s+offering|share\s+(?:the|your)\s+(?:range|number|offer|fitment)|can\s+you\s+share\s+(?:the|a|your)\s+(?:range|number|offer|fitment|figure)|what(?:'s| is)?\s+the\s+(?:range|number|fitment|budget)|tell\s+me\s+the\s+(?:range|number|offer)|how\s+much\s+(?:are\s+you\s+offering|can\s+you\s+offer)|what\s+can\s+you\s+offer|what\s+can\s+you\s+do\s+(?:on|about|for|with)\s+(?:the\s+)?(?:base|number|salary|cash|fixed|figure|comp|compensation|package)|need\s+(?:a\s+)?(?:(?:concrete|specific|real|firm|actual|revised|exact|proper|hard)\s+){1,3}(?:base\s+|cash\s+)?number|(?:give|name|put|throw|share)\s+me\s+(?:a\s+)?(?:concrete|specific|real|firm|revised|hard)?\s*number|(?:push|raise|bump|move|increase|improve)\s+(?:the\s+|on\s+the\s+)?(?:base|number|fixed|cash|offer)|number\s+to\s+say\s+yes)\b/i;

/** Numbers in Indian salary register: bare "32", "32L", "32 LPA",
 *  "32 lakhs", "32.5L", "1.2 cr". A bare number alone is not enough
 *  (the bot could be quoting the candidate's CTC back), so we require
 *  a salary unit OR a phrase that contextually anchors the number to
 *  the offer. */
const SALARY_NUMBER_RE =
  /\b\d{1,3}(?:\.\d+)?\s*(?:L|LPA|lakh|lakhs|cr|crore|crores)\b|₹\s*\d|(?:offer|fitment|number|range|budget|stretch|ceiling)[^.]{0,40}\b\d{1,3}(?:\.\d+)?\b/i;

/** Honest-ceiling vocabulary — phrases that admit the band can't
 *  satisfy the candidate's expectation without naming a different
 *  number. Treated as "satisfies the rail" because they answer
 *  truthfully ("we cannot go above X for this role"). */
const HONEST_CEILING_RE =
  /\b(?:above\s+where\s+(?:this|the)\s+role\s+(?:typically\s+)?sits|cannot\s+(?:stretch|go)\s+(?:above|beyond|past)|(?:the\s+)?(?:band|range|stretch|ceiling)\s+(?:for\s+this\s+role\s+)?(?:caps|tops?\s+out|maxes?\s+out|sits|is)\s+(?:at|around)|stretch\s+(?:on\s+this\s+role\s+)?(?:is|caps)|won't\s+be\s+able\s+to\s+(?:match|stretch|go))\b/i;

const TERMINAL_PHASES: ReadonlySet<NegotiationPhase> = new Set<NegotiationPhase>([
  "closing-push",
  "accepted",
  "walked-away",
  "stalemate",
]);

export interface RailVerdict {
  /** True when the drafted text satisfies the invariant (or the rail
   *  was not triggered — e.g., candidate didn't ask for a number). */
  allow: boolean;
  /** Why the rail tripped, for telemetry. Empty when allow=true. */
  reason: "" | "no-number-no-ceiling" | "indefinite-defer-after-offer-ask";
  /** When allow=false, a deterministic safe substitute that satisfies
   *  the invariant. Always non-empty when allow=false. */
  substitute: string | null;
}

/** Patterns that look like an indefinite defer ("let me check and
 *  get back", "competitive and based on", "I'll align internally") —
 *  these are the exact failure-mode strings from the Flipkart session.
 *  Distinct from no-number because some legitimate flows ship a
 *  number-free turn (e.g., asking back what matters most to the
 *  candidate); we only treat as a violation when paired with an
 *  offer-ask candidate utterance. */
const INDEFINITE_DEFER_RE =
  /\b(?:competitive\s+and\s+based\s+on|let\s+me\s+(?:check|confirm|align|come\s+back|get\s+back)|circle\s+back|get\s+back\s+to\s+you|align\s+(?:internally|with\s+(?:the\s+)?team)|won't\s+be\s+able\s+to\s+share\s+(?:that|the\s+number))\b/i;

/** Build a deterministic safe substitute from the band. This is the
 *  Voss-style calibrated bounce paired with an honest ceiling, encoded
 *  as a single stub for the week-1 rail. */
function buildSafeSubstitute(state: NegotiationState): string {
  const stretch = state.band?.maxStretch;
  const candidateCurrent = state.candidateCurrentCtc;
  /* Three branches by what we know:
   *   (a) We have a stretch AND the candidate's current is at/above it
   *       — name the ceiling honestly + bounce a calibrated question
   *       about non-cash levers.
   *   (b) We have a stretch and the candidate is below it — name the
   *       stretch and ask what would make this work.
   *   (c) We don't have band data — fall back to a number-anchored
   *       deferral that doesn't dodge. */
  if (typeof stretch === "number" && stretch > 0) {
    if (typeof candidateCurrent === "number" && candidateCurrent >= stretch) {
      return (
        `Honest answer — the stretch on this role caps around ${formatLpa(stretch)}, which is below where you are today. ` +
        `How are you thinking about the move impacting that number, and is there room on the non-cash side — ESOPs, joining, role scope — that would change the maths?`
      );
    }
    return (
      `On the cash side the band for this role caps around ${formatLpa(stretch)}. ` +
      `What would make a number in that zone work for you?`
    );
  }
  /* No band data — still don't dodge; admit it and ask the question
   *  that lets us anchor next turn. */
  return (
    `I don't want to throw a number out before I've understood your side fully. ` +
    `What's the fitment you'd anchor on for this move, and what's driving that?`
  );
}

function formatLpa(n: number): string {
  if (Number.isInteger(n)) return `${n}L`;
  return `${n.toFixed(1)}L`;
}

/** Pure entry point. Returns the verdict; caller decides whether to
 *  substitute and how to emit telemetry. */
export function enforceOfferAskInvariant(input: {
  candidateAnswer: string | undefined | null;
  draftedText: string;
  state: NegotiationState;
}): RailVerdict {
  const candidate = (input.candidateAnswer ?? "").trim();
  if (!candidate || !OFFER_ASK_RE.test(candidate)) {
    return { allow: true, reason: "", substitute: null };
  }
  /* Don't enforce in terminal phases — the close path has its own
   *  contract and may legitimately not name a new number. */
  if (TERMINAL_PHASES.has(input.state.phase)) {
    return { allow: true, reason: "", substitute: null };
  }
  const text = input.draftedText ?? "";
  const hasNumber = SALARY_NUMBER_RE.test(text);
  const hasCeiling = HONEST_CEILING_RE.test(text);
  if (hasNumber || hasCeiling) {
    return { allow: true, reason: "", substitute: null };
  }
  /* No number AND no honest ceiling — block. Reason granularity helps
   *  telemetry distinguish "defer-language detected" (a known prod
   *  failure mode) from "just missing a number". */
  const reason: RailVerdict["reason"] = INDEFINITE_DEFER_RE.test(text)
    ? "indefinite-defer-after-offer-ask"
    : "no-number-no-ceiling";
  return {
    allow: false,
    reason,
    substitute: buildSafeSubstitute(input.state),
  };
}

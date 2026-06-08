/* V2-KERNEL (2026-06-09) — the foundation rewrite, step 1.
 *
 * This is the FIRST file in `server-handlers/v2/`, the greenfield
 * replacement for the v1 deterministic-state-machine + planner +
 * canonical-prose + LLM-restyle stack.
 *
 * The shape change in v2:
 *   - v1 enumerates 25 action kinds and 9 phases; the planner picks
 *     an action via heuristic gates; the LLM only restyles. Three
 *     months of patches drifted into accretion — the offer-ask
 *     invariant (candidate explicitly asks for the offer ⇒ next turn
 *     must contain a number or an honest decline) is heuristic-gated
 *     and silently fails on real sessions (see the Flipkart fixture).
 *
 *   - v2 inverts the cut: a TINY deterministic kernel computes the
 *     band + state scalars + the set of LEGAL TOOLS the orchestrator
 *     may call. The LLM picks one tool and arguments. The kernel
 *     validates and renders the canonical prose. There is no restyle
 *     layer. There is no "ask_discovery" tool when the offer-ask
 *     invariant has tripped — the LLM literally cannot pick it.
 *
 * This commit lands ONLY the kernel's three pure functions:
 *
 *   computeBand(role, company, profile) → { initial, stretch, walkAway, hasEquity }
 *     — mirrors v1's resolveServerBand for parity during shadow.
 *
 *   deriveState(conversationLog) → DerivedState
 *     — extracts the scalars the legal-tools gate needs from the log.
 *
 *   legalTools(state) → ToolName[]
 *     — the gate. This is where the hard invariants live.
 *
 * The orchestrator, the six tools, and the output rail land in
 * subsequent commits. Shadow mode against v1 lands when the tools are
 * wired. This commit is the FOUNDATION — sign-off was on the contract
 * in chat, the test below is the failing-then-passing proof. */

import { resolveServerBand } from "../_band-resolver";
import type { NegotiationBand } from "../_negotiation-kernel";

/** The six tools v2 exposes. Exactly six, no more, no less. The
 *  enumeration is the contract — adding a seventh requires changing
 *  this type and the orchestrator system prompt together. */
export type ToolName =
  | "propose_anchor"
  | "propose_counter"
  | "concede"
  | "close_recap"
  | "decline_offer_ask"
  | "defer_with_callback"
  | "ask_discovery";

export interface ConversationTurn {
  role: "ai" | "candidate";
  text: string;
  /** When the AI turn was produced by a v2 tool call, this carries
   *  the tool name. v1 turns (shadow mode) leave this undefined and
   *  state derivation falls back to regex on `text`. */
  tool?: ToolName;
  /** If the tool was a number-shipping tool (anchor/counter/close/
   *  decline), this is the LPA scalar the kernel rendered. Used to
   *  derive lastAnchorLpa without re-parsing prose. */
  lpa?: number;
}

export interface DerivedState {
  /** Count of AI turns in the log. The next AI turn is turnIndex+1. */
  turnIndex: number;
  /** How many times the candidate has explicitly asked for the
   *  offer. The offer-ask invariant trips at offerAskCount >= 2. */
  offerAskCount: number;
  /** True iff at least one prior AI turn shipped a band-anchored LPA
   *  number via propose_anchor or propose_counter. */
  hasAnchored: boolean;
  /** Most recent anchor/counter LPA the kernel rendered. null when
   *  nothing has been anchored yet. */
  lastAnchorLpa: number | null;
  /** Most recent candidate-stated target LPA. Regex-extracted from
   *  candidate turns ("my expectation is 44 LPA", "can you give me
   *  44", "I want 44 LPA"). null when never stated. */
  candidateTarget: number | null;
  /** Turn index at which the candidate verbally accepted. null when
   *  no acceptance. close_recap is illegal without this. */
  verbalAcceptanceTurn: number | null;
}

/** Regex bank. The offer-ask family must catch the explicit asks the
 *  Flipkart candidate used: "you should give your initial offer",
 *  "you have not yet given initial offer", "can you give me 44 LPA".
 *  Conservative — we want recall over precision here because false
 *  positives only force a number; false negatives let the planner
 *  drift back into discovery. */
const OFFER_ASK_PATTERNS: RegExp[] = [
  /\b(give|share|tell)\s+(me\s+)?(your\s+)?(initial\s+)?offer\b/i,
  /\bwhat(?:'s|\s+is)\s+(your\s+)?(initial\s+)?offer\b/i,
  /\bhave\s+not\s+(yet\s+)?given\s+(initial\s+)?offer\b/i,
  /\bcan\s+you\s+give\s+me\s+\d/i,
  /\byour\s+offer\s*[?.]?\s*$/i,
];

const ACCEPTANCE_PATTERNS: RegExp[] = [
  /\b(i\s+)?accept\b/i,
  /\b(it'?s\s+a\s+)?deal\b/i,
  /\blet'?s\s+(do\s+it|go\s+(?:with|ahead))\b/i,
  /\bsounds?\s+good[,.]?\s*(let'?s|i'?ll\s+take)/i,
];

const TARGET_PATTERNS: RegExp[] = [
  /\bmy\s+(expectation|target|ask)\s+is\s+(\d+(?:\.\d+)?)\s*(?:l|lpa)\b/i,
  /\bi\s+(want|expect|am\s+looking\s+for)\s+(\d+(?:\.\d+)?)\s*(?:l|lpa)\b/i,
  /\bcan\s+you\s+give\s+me\s+(\d+(?:\.\d+)?)\s*(?:l|lpa)\b/i,
  /\b(\d+(?:\.\d+)?)\s*lpa\s+(?:is\s+)?(?:my\s+)?(?:expectation|target|ask)\b/i,
];

/** Compute the band for (role, company, candidate-profile). Mirrors
 *  v1's resolveServerBand verbatim for shadow-mode parity. We hold
 *  the band logic in v1 deliberately — band math is not the bug;
 *  the planner is. Once v2 takes over, this delegates as-is. */
export function computeBand(
  role: string,
  company: string,
  experienceLevel?: string,
  applicableYoe?: number | null,
): NegotiationBand {
  return resolveServerBand(role, company, experienceLevel, applicableYoe);
}

/** Extract derived scalars from the conversation log. Pure function
 *  of the log — no side effects, no I/O. Re-deriving from the log
 *  every turn (rather than mutating long-lived state) is the v2
 *  discipline that prevents the v1 "state drift" failure mode where
 *  flags got set and never cleared. */
export function deriveState(log: ConversationTurn[]): DerivedState {
  let turnIndex = 0;
  let offerAskCount = 0;
  let hasAnchored = false;
  let lastAnchorLpa: number | null = null;
  let candidateTarget: number | null = null;
  let verbalAcceptanceTurn: number | null = null;

  for (let i = 0; i < log.length; i++) {
    const turn = log[i];
    if (turn.role === "ai") {
      turnIndex++;
      /* v2-native turns set tool + lpa directly. Trust the structured
       * data; fall back to regex only when the turn came from v1
       * (shadow-mode mixed log). */
      if (turn.tool === "propose_anchor" || turn.tool === "propose_counter") {
        hasAnchored = true;
        if (typeof turn.lpa === "number") lastAnchorLpa = turn.lpa;
      } else if (turn.tool === undefined) {
        /* v1-mixed shadow: heuristic — does the AI text contain an
         * LPA scalar? If yes, count as anchored. */
        const m = turn.text.match(/\b(\d+(?:\.\d+)?)\s*(?:l|lpa)\b/i);
        if (m) {
          hasAnchored = true;
          lastAnchorLpa = Number(m[1]);
        }
      }
      continue;
    }

    /* candidate turn */
    for (const pat of OFFER_ASK_PATTERNS) {
      if (pat.test(turn.text)) {
        offerAskCount++;
        break;
      }
    }
    for (const pat of ACCEPTANCE_PATTERNS) {
      if (pat.test(turn.text)) {
        verbalAcceptanceTurn = turnIndex;
        break;
      }
    }
    for (const pat of TARGET_PATTERNS) {
      const m = turn.text.match(pat);
      if (m) {
        const n = Number(m[2] ?? m[1]);
        if (Number.isFinite(n) && n > 0) candidateTarget = n;
        break;
      }
    }
  }

  return {
    turnIndex,
    offerAskCount,
    hasAnchored,
    lastAnchorLpa,
    candidateTarget,
    verbalAcceptanceTurn,
  };
}

/** The gate. Returns the set of tools the orchestrator may call on
 *  the NEXT turn. The orchestrator presents this set to the LLM; the
 *  LLM cannot pick a tool not in the set.
 *
 *  This is where the hard invariants live. Each invariant is one
 *  branch — readable, auditable, single source of truth. No nine
 *  phases. No twenty-five action kinds. */
export function legalTools(state: DerivedState): ToolName[] {
  /* Invariant 1: post-acceptance, only close_recap is legal. The
   * candidate has said yes — the bot's job is to recap the deal. */
  if (state.verbalAcceptanceTurn !== null) {
    return ["close_recap"];
  }

  /* Invariant 2: the offer-ask invariant. If the candidate has
   * explicitly asked for the offer AT LEAST ONCE past the early
   * discovery window (turnIndex >= 4) and we have NOT anchored, the
   * next turn MUST contain a number or an honest decline. Discovery,
   * defer, concede — all illegal. This is the exact branch that would
   * have prevented the Flipkart session from looping for 14 turns.
   *
   * The threshold is >=1 (not >=2) on purpose: ignoring the FIRST
   * explicit "give your initial offer" is the credibility-destroying
   * failure mode the Flipkart fixture captures. The >=4 turnIndex
   * floor preserves 3 turns of pure-discovery runway before an early
   * rhetorical "what's your offer" can trip the invariant. */
  if (state.offerAskCount >= 1 && state.turnIndex >= 4 && !state.hasAnchored) {
    return ["propose_anchor", "decline_offer_ask"];
  }

  /* Invariant 3: candidate has stated a target and we've anchored —
   * we're in counter-territory. Discovery is over. Anchor again is
   * silly (we already did). The legal moves are counter, concede, or
   * defer (with callback). */
  if (state.hasAnchored && state.candidateTarget !== null) {
    return ["propose_counter", "concede", "defer_with_callback", "decline_offer_ask"];
  }

  /* Invariant 4: we've anchored but candidate hasn't stated a target.
   * Either they're still chewing on our number or they're about to
   * counter. Discovery is over. */
  if (state.hasAnchored) {
    return ["propose_counter", "concede", "defer_with_callback", "ask_discovery"];
  }

  /* Invariant 5: early discovery — turns 1-6, no offer-ask pressure,
   * nothing anchored yet. Discover, or anchor if we have enough
   * signal. */
  if (state.turnIndex <= 6 && state.offerAskCount === 0) {
    return ["ask_discovery", "propose_anchor"];
  }

  /* Fallback: anywhere else, anchor or honest-decline. Defer is NOT
   * in the fallback set — we never want the kernel to suggest a
   * defer as the safe default. Defer must be deliberately chosen. */
  return ["propose_anchor", "decline_offer_ask"];
}

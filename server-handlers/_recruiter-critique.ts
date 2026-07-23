/* Recruiter-side strategy critique — Phase 23 (2026-05-13).
 * ─────────────────────────────────────────────────────────────────────
 * Phases 1–22 graded the CANDIDATE: did they anchor, push the band,
 * commit red-flag patterns. The RECRUITER AI's moves were validated
 * for legality (never above maxStretch, never below walk-away) but
 * never graded for STRATEGY. A clean run could still be a bad run —
 * "anchored at maxStretch on turn 0", "burned all four levers in two
 * turns", "asserted final-offer three times then conceded ₹3L".
 *
 * Phase 23 adds a pure critique module that reads the move history +
 * final state and returns an ordered list of strategy issues. Each
 * item has a code, a severity, a turn pointer (where it happened),
 * and a coach's-voice explanation. The UI / report layer surfaces
 * these alongside candidate metrics so a learner sees BOTH sides.
 *
 * Detectors deliberately fire on KERNEL signals only — we don't
 * re-parse text here. The kernel already records lever, total, turn
 * index, and band; that's enough to spot the major mistakes.
 *
 * Mistakes covered:
 *   1. open-too-high       — opened above midpoint of band
 *   2. open-too-low        — opened below initialOffer (shouldn't happen
 *                            via kernel, but catches direct-state corruption)
 *   3. premature-ceiling   — hit maxStretch before turn 3 (no negotiation
 *                            happened; gave away the band)
 *   4. ceiling-without-anchor — hit maxStretch before candidate ever
 *                            stated a target (negotiating against air)
 *   5. concession-without-ask — bumped offer when candidate didn't
 *                            counter or push (free money)
 *   6. lever-fatigue       — burned ≥4 distinct levers in ≤3 turns
 *                            (no pacing)
 *   7. hold-firm-then-concede — asserted hold-firm / final-offer then
 *                            bumped on a later turn (credibility hit)
 *   8. no-probe            — never used "probe" before counter-base
 *                            (didn't gather info)
 *   9. closed-without-breakup — closed acceptance without the
 *                            candidate stating a component breakdown
 *  10. walkaway-without-warning — closed walkaway with no prior
 *                            hold-firm signal (abrupt exit)
 */

import type { NegotiationState } from "./_negotiation-kernel";
import type { KernelTurnSummary } from "./_negotiation-metrics";
import { getWalkAwayThresholdMultiplier } from "./_market-mode";

export type RecruiterCritiqueCode =
  | "open-too-high"
  | "open-too-low"
  | "premature-ceiling"
  | "ceiling-without-anchor"
  | "concession-without-ask"
  | "lever-fatigue"
  | "hold-firm-then-concede"
  | "no-probe"
  | "closed-without-breakup"
  | "walkaway-without-warning"
  /* Phase 27 — bias / inappropriate question scanning across the
   * conversationLog. Fires when the recruiter AI asks personal or
   * protected-attribute questions that have no business in a comp talk. */
  | "asks-inappropriate-personal-question";

export type RecruiterCritiqueSeverity = "info" | "concern" | "blocker";

export interface RecruiterCritiqueItem {
  code: RecruiterCritiqueCode;
  severity: RecruiterCritiqueSeverity;
  /** 0-indexed turn where the issue surfaced; null for session-level. */
  turnIndex: number | null;
  /** Coach's-voice explanation of the mistake + what should have happened. */
  detail: string;
}

export interface RecruiterCritiqueInput {
  finalState: NegotiationState;
  moves: ReadonlyArray<KernelTurnSummary>;
}

/** A verbatim candidate quote tied to a specific critique issue. The
 *  text is sliced from `state.conversationLog` and MUST be a substring
 *  of an actual candidate utterance — no synthesis. */
export interface RecruiterCritiqueQuote {
  turn: number;
  text: string;
  issue: string;
}

/** A coach's "A+ rewrite" of the weakest candidate turn — synthesised
 *  in the recruiter-side critique because the recruiter-AI's mistakes
 *  often stem from a candidate prompt that left room. We expose the
 *  weakest turn (by heuristic: longest candidate utterance immediately
 *  preceding the highest-severity critique item) so coaches can show
 *  the learner how a top-tier negotiator would have shaped the same
 *  moment. */
export interface APlusRewrite {
  weakestTurn: number;
  originalText: string;
  rewrittenText: string;
  why: string;
}

export interface RecruiterCritiqueResult {
  items: RecruiterCritiqueItem[];
  quotes: RecruiterCritiqueQuote[];
  aPlusRewrite: APlusRewrite | null;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function bandMidpoint(state: NegotiationState): number {
  const { initialOffer, maxStretch } = state.band;
  return initialOffer + (maxStretch - initialOffer) / 2;
}

function firstTurnAt(moves: ReadonlyArray<KernelTurnSummary>, lpa: number): number | null {
  const m = moves.find((mv) => mv.newTotalLpa != null && mv.newTotalLpa >= lpa - 0.01);
  return m ? m.turnIndex : null;
}

/* ── Critique entrypoint ─────────────────────────────────────────── */

export function critiqueRecruiterStrategy(
  input: RecruiterCritiqueInput,
): RecruiterCritiqueItem[] {
  const { finalState, moves } = input;
  const band = finalState.band;
  const out: RecruiterCritiqueItem[] = [];

  const cashMoves = moves.filter((m) => m.newTotalLpa != null);
  const opening = cashMoves[0];

  /* 1. open-too-high — opened above midpoint, leaving little room. */
  if (opening && opening.newTotalLpa != null) {
    const mid = bandMidpoint(finalState);
    if (opening.newTotalLpa > mid + 0.01 && opening.newTotalLpa < band.maxStretch) {
      out.push({
        code: "open-too-high",
        severity: "concern",
        turnIndex: opening.turnIndex,
        detail: `Opened at ₹${opening.newTotalLpa}L vs band midpoint ₹${mid.toFixed(1)}L — left only ${(band.maxStretch - opening.newTotalLpa).toFixed(1)}L of headroom. Open closer to initialOffer (₹${band.initialOffer}L) and let the candidate earn the climb.`,
      });
    }
    /* 2. open-too-low — defensive guard for state corruption. */
    if (opening.newTotalLpa < band.initialOffer - 0.01) {
      out.push({
        code: "open-too-low",
        severity: "blocker",
        turnIndex: opening.turnIndex,
        detail: `Opened at ₹${opening.newTotalLpa}L, below band.initialOffer (₹${band.initialOffer}L). The kernel should reject this — investigate state plumbing.`,
      });
    }
  }

  /* 3. premature-ceiling — hit maxStretch before turn 3. */
  const ceilingTurn = firstTurnAt(moves, band.maxStretch);
  if (ceilingTurn != null && ceilingTurn < 3) {
    out.push({
      code: "premature-ceiling",
      severity: "concern",
      turnIndex: ceilingTurn,
      detail: `Reached band ceiling ₹${band.maxStretch}L on turn ${ceilingTurn}. With no headroom left, the rest of the conversation has nowhere to go — candidate can extract joining bonus / equity for free.`,
    });
  }

  /* 4. ceiling-without-anchor — hit max before candidate stated a target. */
  if (ceilingTurn != null) {
    const anchorMove = moves.find((m) => m.candidateTargetAtTurn != null);
    const anchorTurn = anchorMove ? anchorMove.turnIndex : null;
    if (anchorTurn == null || anchorTurn > ceilingTurn) {
      out.push({
        code: "ceiling-without-anchor",
        severity: "blocker",
        turnIndex: ceilingTurn,
        detail: `Moved to ceiling ₹${band.maxStretch}L on turn ${ceilingTurn} before the candidate ever stated a target. You're negotiating against yourself — always probe for a number first.`,
      });
    }
  }

  /* 5. concession-without-ask — recruiter bumped total without
   *    candidate pushing. Heuristic: two consecutive cash moves where
   *    candidateTargetAtTurn didn't change AND second total > first. */
  for (let i = 1; i < cashMoves.length; i++) {
    const prev = cashMoves[i - 1];
    const curr = cashMoves[i];
    if (
      prev.newTotalLpa != null &&
      curr.newTotalLpa != null &&
      curr.newTotalLpa > prev.newTotalLpa + 0.01 &&
      prev.candidateTargetAtTurn === curr.candidateTargetAtTurn
    ) {
      out.push({
        code: "concession-without-ask",
        severity: "concern",
        turnIndex: curr.turnIndex,
        detail: `Bumped ₹${prev.newTotalLpa}L → ₹${curr.newTotalLpa}L on turn ${curr.turnIndex} without the candidate raising or restating their target. Every concession should be in response to a candidate move — otherwise you've given away ₹${(curr.newTotalLpa - prev.newTotalLpa).toFixed(1)}L for nothing.`,
      });
      break; // one is enough; don't spam the report
    }
  }

  /* 6. lever-fatigue — too many distinct CONCESSION levers in too
   *    few turns. open-with-offer / probe / hold-firm are structural
   *    and don't burn trade-ables. The bad pattern is dumping multiple
   *    concession types (bonus, equity, benefits, notice-buyout) in
   *    quick succession instead of pacing them one per turn. */
  const CONCESSION_LEVERS = new Set([
    "counter-base",
    "joining-bonus",
    "equity-grant",
    "benefits-summary",
    "notice-buyout",
  ] as const);
  if (moves.length >= 4) {
    const firstFour = moves.slice(0, 4);
    const concessions = new Set(
      firstFour.filter((mv) => CONCESSION_LEVERS.has(mv.lever as never)).map((mv) => mv.lever),
    );
    if (concessions.size >= 4) {
      out.push({
        code: "lever-fatigue",
        severity: "concern",
        turnIndex: firstFour[firstFour.length - 1].turnIndex,
        detail: `Used ${concessions.size} distinct concession levers (${[...concessions].join(", ")}) in the first 4 turns. Burning concessions fast means you have nothing left to trade in the closing phase. Pace: probe → counter → joining-bonus → equity → benefits, one per turn.`,
      });
    }
  }

  /* 7. hold-firm-then-concede — asserted final-offer then bumped. */
  let holdFirmTurn: number | null = null;
  for (const m of moves) {
    if (m.lever === "hold-firm") {
      holdFirmTurn = m.turnIndex;
      continue;
    }
    if (
      holdFirmTurn != null &&
      m.turnIndex > holdFirmTurn &&
      m.newTotalLpa != null &&
      cashMoves.some(
        (c) => c.turnIndex <= holdFirmTurn! && c.newTotalLpa != null && m.newTotalLpa! > c.newTotalLpa,
      )
    ) {
      out.push({
        code: "hold-firm-then-concede",
        severity: "blocker",
        turnIndex: m.turnIndex,
        detail: `Asserted hold-firm on turn ${holdFirmTurn} then bumped the offer on turn ${m.turnIndex}. Candidates remember this — every future hold-firm is now non-credible. Either hold (and accept the walkaway risk) or don't assert.`,
      });
      break;
    }
  }
  /* Also use the kernel's finalOfferAssertedCount as a secondary signal:
   * asserted ≥2× but did not close — the assertion was empty. */
  if (
    (finalState.finalOfferAssertedCount ?? 0) >= 2 &&
    finalState.phase !== "accepted" &&
    finalState.phase !== "walked-away" &&
    !out.some((o) => o.code === "hold-firm-then-concede")
  ) {
    out.push({
      code: "hold-firm-then-concede",
      severity: "concern",
      turnIndex: null,
      detail: `Asserted "final offer" ${finalState.finalOfferAssertedCount}× without closing. Repeated final-offer language without a close trains candidates to discount it. Say it once, mean it, and be ready to walk.`,
    });
  }

  /* 8. no-probe — counter-base used without ever probing first. */
  const probeIdx = moves.findIndex((m) => m.lever === "probe");
  const firstCounterIdx = moves.findIndex((m) => m.lever === "counter-base");
  if (firstCounterIdx !== -1 && (probeIdx === -1 || probeIdx > firstCounterIdx)) {
    out.push({
      code: "no-probe",
      severity: "info",
      turnIndex: moves[firstCounterIdx].turnIndex,
      detail: `Countered on turn ${moves[firstCounterIdx].turnIndex} without probing the candidate's target first. Probing flips the anchor — you learn their number before showing yours. A turn spent on "probe" is rarely wasted.`,
    });
  }

  /* 9. closed-without-breakup — accepted but no component breakdown. */
  if (
    finalState.phase === "accepted" &&
    !finalState.candidateComponentBreakdown.hasAny
  ) {
    out.push({
      code: "closed-without-breakup",
      severity: "blocker",
      turnIndex: finalState.acceptedAtTurn,
      detail: `Closed at acceptance without a base/variable/equity breakdown on record. Verbal close turns into a written offer dispute — always lock the component split before saying "you're in."`,
    });
  }

  /* 11. Phase 27 — recruiter asked an inappropriate personal /
   *     protected-attribute question. Scans AI utterances across the
   *     conversation log for India-context patterns: marital status,
   *     children / family planning, religion / caste, age, gender, visa
   *     status absent legitimate work-authorization context. False
   *     positives here are damaging, so patterns are narrow. */
  const INAPPROPRIATE_PATTERNS: { kind: string; pattern: RegExp }[] = [
    { kind: "marital", pattern: /\b(?:are\s+you\s+married|marital\s+status|when\s+are\s+you\s+(?:getting\s+married|planning\s+to\s+marry)|your\s+(?:husband|wife|spouse)\b)/i },
    { kind: "family-planning", pattern: /\b(?:planning\s+(?:a\s+)?(?:family|kids|children|baby)|when\s+(?:are\s+you|do\s+you)\s+(?:planning|going)\s+to\s+have\s+(?:kids|children|a\s+baby)|pregnan(?:t|cy)\s+plans)\b/i },
    { kind: "children", pattern: /\b(?:do\s+you\s+have\s+(?:kids|children)|how\s+many\s+(?:kids|children)\s+do\s+you\s+have)\b/i },
    { kind: "religion", pattern: /\b(?:what(?:'s|\s+is)\s+your\s+religion|which\s+(?:caste|religion|community)|your\s+caste\b)/i },
    { kind: "age", pattern: /\b(?:how\s+old\s+are\s+you|what(?:'s|\s+is)\s+your\s+age)\b/i },
    { kind: "gender", pattern: /\b(?:we\s+(?:prefer|need|want)\s+(?:a\s+)?(?:male|female)\s+candidate|gender\s+preference)\b/i },
  ];
  if (finalState.conversationLog.length > 0) {
    const offences: { kind: string; turnIndex: number; snippet: string }[] = [];
    finalState.conversationLog.forEach((entry, idx) => {
      if (entry.speaker !== "ai") return;
      for (const { kind, pattern } of INAPPROPRIATE_PATTERNS) {
        const m = pattern.exec(entry.text);
        if (m) {
          offences.push({ kind, turnIndex: idx, snippet: m[0] });
          break;
        }
      }
    });
    if (offences.length > 0) {
      const first = offences[0];
      const kinds = [...new Set(offences.map((o) => o.kind))].join(", ");
      out.push({
        code: "asks-inappropriate-personal-question",
        severity: "blocker",
        turnIndex: first.turnIndex,
        detail: `Recruiter asked personal / protected-attribute question(s) (${kinds}) in conversation log — e.g. "${first.snippet}". These have no place in a comp talk; they expose the company to bias complaints and damage candidate trust.`,
      });
    }
  }

  /* 10. walkaway-without-warning — walkaway closure with no prior
   *     hold-firm signal. */
  if (finalState.phase === "walked-away" && holdFirmTurn == null) {
    out.push({
      code: "walkaway-without-warning",
      severity: "concern",
      turnIndex: finalState.walkedAwayAtTurn,
      detail: `Walked away without any prior hold-firm / final-offer signal. Abrupt exits damage the brand — even when the gap is real, signal twice before closing the door.`,
    });
  }

  return out;
}

/* ─── A+ rewrite + quote extraction (2026-05-14) ───────────────────
 *
 * Companion entrypoint to critiqueRecruiterStrategy that surfaces:
 *   - `quotes`: for each issue with a turnIndex, slice the candidate's
 *     verbatim utterance at that turn from the conversation log.
 *   - `aPlusRewrite`: identify the weakest candidate turn and produce
 *     a coach's rewrite showing how a top-tier negotiator would have
 *     said it.
 *
 * Pure — no LLM call. The rewrite is template-driven from the kernel
 * signal so the output is deterministic and testable. */

const SEVERITY_RANK: Record<RecruiterCritiqueSeverity, number> = {
  info: 1,
  concern: 2,
  blocker: 3,
};

/** Build a top-tier rewrite for a candidate turn given an associated
 *  critique-issue code. The phrasing is intentionally India-context
 *  natural (Naveen "you'd want to anchor first" voice). Templates are
 *  short by design — they're a coaching nudge, not a script. */
function rewriteForIssue(
  code: RecruiterCritiqueCode,
  originalText: string,
): { rewrittenText: string; why: string } {
  const trimmed = (originalText || "").trim();
  switch (code) {
    case "ceiling-without-anchor":
      return {
        rewrittenText:
          "Before I share a number, can you tell me what range you have budgeted for this role? I want to make sure we're calibrated.",
        why: "Top negotiators flip the anchor — they make the recruiter say a number first.",
      };
    case "no-probe":
      return {
        rewrittenText:
          "Got it. To frame my ask precisely, what does the typical band look like at this level — base, variable, and ESOPs?",
        why: "Probing the band before countering anchors you on data instead of guesswork.",
      };
    case "concession-without-ask":
      return {
        rewrittenText:
          "Thanks for sharing — given the scope and the alternatives I'm considering, I'd be looking at ₹X in total cash, plus a clear ESOP-vest. Where can we land?",
        why: "Tie every move to a concrete reason and a range — never a single number.",
      };
    case "hold-firm-then-concede":
      return {
        rewrittenText:
          "I hear you on the band ceiling. If base is fixed, can we look at a sign-on bonus or accelerated equity vest to bridge the gap?",
        why: "Don't fight the same lever — pivot to an adjacent one when the recruiter holds firm.",
      };
    case "open-too-high":
      return {
        rewrittenText:
          "Before I take this any further, I'd want clarity on the full structure — base, variable trigger, ESOP grant value, and refresh cycle.",
        why: "When the open is already strong, redirect to structure instead of pushing the cash number.",
      };
    case "closed-without-breakup":
      return {
        rewrittenText:
          "I'm aligned in principle — could you share the component breakdown in writing (base/variable/equity/joining) before I confirm? I want to avoid surprises in the offer letter.",
        why: "Always lock the split before saying 'yes' — verbal closes turn into letter disputes.",
      };
    case "walkaway-without-warning":
      return {
        rewrittenText:
          "I appreciate the offer, but at this number I'd need to pass. If there's any room to revisit base or joining, I'm open — otherwise I'll have to step away with respect.",
        why: "Even when walking, signal twice — one final concrete ask preserves the relationship and the door.",
      };
    case "premature-ceiling":
      return {
        rewrittenText:
          "That's a strong opening number — let me think about the wider package. What does the variable trigger look like, and is there a sign-on component on top?",
        why: "When the recruiter rushes to the ceiling, slow down and harvest the structure they've already conceded on.",
      };
    case "lever-fatigue":
      return {
        rewrittenText:
          "Let's pause and structure this. Can we tackle one lever at a time — base first, then joining, then equity — so neither of us loses the thread?",
        why: "Pacing one lever per turn prevents the recruiter from burning all concessions at once.",
      };
    default:
      return {
        rewrittenText: trimmed
          ? `Restating that more clearly: I'd want to anchor on the full package — base, variable, ESOPs, and timeline — before we converge on a number.`
          : `Before we anchor on a number, what does the full package look like — base, variable, ESOPs?`,
        why: "Top-tier negotiators reset the frame to structure when the conversation drifts.",
      };
  }
}

/**
 * Produce the structured critique bundle: items + verbatim candidate
 * quotes per issue + a single A+ rewrite of the weakest candidate
 * turn. Pure — no IO. The rewrite is template-driven so the output is
 * deterministic across runs.
 */
export function critiqueRecruiterWithQuotes(
  input: RecruiterCritiqueInput,
): RecruiterCritiqueResult {
  const items = critiqueRecruiterStrategy(input);
  const log = input.finalState.conversationLog ?? [];

  const quotes: RecruiterCritiqueQuote[] = [];
  for (const item of items) {
    if (item.turnIndex == null) continue;
    /* Find the candidate utterance closest to (and at most) the
     * issue's turnIndex. The conversationLog interleaves AI + candidate
     * entries; walk back from the issue turn until we hit the most
     * recent candidate line. */
    let candidateLine: { idx: number; text: string } | null = null;
    for (let i = Math.min(item.turnIndex, log.length - 1); i >= 0; i--) {
      const e = log[i];
      if (e && e.speaker === "candidate" && typeof e.text === "string" && e.text.trim().length > 0) {
        candidateLine = { idx: i, text: e.text };
        break;
      }
    }
    if (candidateLine) {
      quotes.push({
        turn: candidateLine.idx,
        text: candidateLine.text,
        issue: item.code,
      });
    }
  }

  /* Weakest turn = the candidate utterance tied to the highest-severity
   * critique item. Ties broken by issue order (first-fired wins). */
  let aPlus: APlusRewrite | null = null;
  if (items.length > 0) {
    const ranked = [...items].sort(
      (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
    );
    for (const top of ranked) {
      let candidateLine: { idx: number; text: string } | null = null;
      const anchor =
        top.turnIndex != null && Number.isFinite(top.turnIndex)
          ? top.turnIndex
          : log.length - 1;
      for (let i = Math.min(anchor, log.length - 1); i >= 0; i--) {
        const e = log[i];
        if (e && e.speaker === "candidate" && typeof e.text === "string" && e.text.trim().length > 0) {
          candidateLine = { idx: i, text: e.text };
          break;
        }
      }
      if (!candidateLine) continue;
      const { rewrittenText, why } = rewriteForIssue(top.code, candidateLine.text);
      aPlus = {
        weakestTurn: candidateLine.idx,
        originalText: candidateLine.text,
        rewrittenText,
        why,
      };
      break;
    }
  }

  return { items, quotes, aPlusRewrite: aPlus };
}

/* ─── recommendWalkAway (Wave-7, 2026-05-15) ────────────────────────────
 *
 * A recruiter-side coaching signal that says: "this candidate is not
 * worth closing — disengage." Distinct from the candidate-side walkAway
 * detector in the kernel (that one fires when the candidate declines).
 *
 * Fires when ANY of:
 *   1. candidate target is > 1.2× maxStretch AND they've refused to move
 *      from it across ≥3 turns (no flexibility, gap too wide).
 *   2. ≥3 turns asserted final-offer with the candidate still demanding
 *      more (no convergence, credibility burned).
 *   3. Multiple high-severity red-flag signals stack: postAcceptanceRenege
 *      + bgvAnxiety + currentCtcRefusal, or pipDisclosed + offerRescindedHistory.
 *   4. Candidate is at maxStretch AND turnIndex > 8 (negotiation has run
 *      too long without a close — opportunity cost).
 *
 * Returns {walk: false, reason: ""} when no exit signal is present. */
export function recommendWalkAway(state: NegotiationState): {
  walk: boolean;
  reason: string;
} {
  const band = state.band;
  const target = state.candidateTarget;
  const turn = state.turnIndex ?? 0;
  const profile = state.candidateProfile;

  /* F5 (2026-05-15) — market-mode-coupled walk-away threshold. The
   * "target > 1.2× maxStretch" gate is the structural walk-away trigger;
   * couple it to market mode so soft markets fire EARLIER (less tolerance
   * for over-band asks) and hot markets fire LATER (more flexibility on
   * candidate stretch). Multiplier: soft 1.05× (tolerate less), hot
   * 0.95× (tolerate more), neutral 1.0× (legacy behaviour). */
  const walkMult = getWalkAwayThresholdMultiplier(state.marketMode ?? "neutral");

  /* PDF#45 B1 (2026-05-26, audit pass 2) — universal lever-explore
   * engagement guard. Hoisted out of condition (4) into a top-level
   * gate so ALL four walk conditions respect candidate engagement.
   * The prior version only protected the "at ceiling + 8 turns"
   * cliff; conditions (1)/(2)/(3) could still walk on an engaged
   * candidate (e.g. target > 1.2× maxStretch but actively asking
   * "how about a joining bonus to bridge?"). When the candidate's
   * last utterance signals lever-explore engagement, no walk fires —
   * the planner's lever-explore cascade owns the next turn. */
  const lastCandidateText = (() => {
    const log = state.conversationLog ?? [];
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i];
      if (e && e.speaker === "candidate" && typeof e.text === "string") {
        return e.text;
      }
    }
    return "";
  })();
  /* Disengagement carve-out: phrases like "no thanks, can you add
   * anything?" or "I'm out — anything else?" combine a decline cue
   * with an engagement verb. The decline wins. Checked FIRST so a
   * decline-token within 30 chars before an engagement verb blocks
   * the engagement match. */
  const DISENGAGEMENT_PREFIX_RE =
    /\b(?:no\s+thanks|no\s+thank\s+you|i.?m\s+out|i\s+pass|i.?ll\s+pass|not\s+interested|i\s+decline|walking\s+away|i.?m\s+done|forget\s+it|nevermind|never\s+mind)\b[\s\S]{0,30}/i;
  /* Engagement detector — broadened in audit pass 2 to cover:
   *   - "how about <X>?" / "how about adding X?"
   *   - "what's the max / absolute max / ceiling / stretch"
   *   - "stretch the budget / stretch your budget"
   *   - "best you can do" / "any room"
   *   - "throw in / kick in / include" (non-cash sweeteners)
   *   - "match the gap / bridge the gap / cover the gap"
   *   - bare cash-lever nouns ("joining bonus", "sign-on", "ESOPs",
   *     "equity", "retention", "relocation") when paired with an
   *     interrogative or modal cue.
   */
  const LEVER_EXPLORE_ENGAGEMENT_RE = new RegExp(
    [
      // ask-verb + engagement object
      String.raw`what\s+(?:else|more|other)\s+can\s+you\s+(?:add|offer|do|provide|stretch|extend|include|throw\s+in|kick\s+in)`,
      String.raw`can\s+you\s+(?:add|stretch|include|throw\s+in|kick\s+in|sweeten|push|bridge|extend|match|cover|close)\s+(?:something|anything|more|additional|extra|the\s+(?:gap|offer|package|deal|fitment))`,
      String.raw`(?:add|sweeten|bridge|stretch|push|extend|match|cover|close)\s+(?:the\s+)?(?:offer|number|gap|package|deal|fitment|budget)`,
      String.raw`anything\s+else\s+(?:you\s+can\s+(?:add|offer|do)|on\s+the\s+table|in\s+the\s+(?:mix|pot))`,
      String.raw`other\s+(?:levers?|components?|knobs?|options?|line\s+items?)`,
      String.raw`what\s+more\s+(?:can\s+you|do\s+you|is\s+there)`,
      // "how about <noun>?" — re-anchor probe
      String.raw`how\s+about\s+(?:a\s+|an\s+|the\s+|some\s+|adding\s+|including\s+|throwing\s+in\s+)?\w+`,
      // ceiling / max probes
      String.raw`what.?s\s+(?:the\s+)?(?:absolute\s+)?(?:max(?:imum)?|ceiling|cap|top|best|stretch|limit)`,
      String.raw`(?:best|max|highest)\s+(?:you\s+can\s+(?:do|offer|go|stretch)|on\s+offer)`,
      String.raw`any\s+(?:room|flex(?:ibility)?|wiggle\s+room|movement|stretch|budget)`,
      // gap-bridging
      String.raw`(?:bridge|close|match|cover)\s+(?:the\s+)?gap`,
      String.raw`match\s+(?:the\s+)?(?:other|competing|existing)\s+offer`,
      // bare engagement verbs
      String.raw`something\s+more`,
      String.raw`sweeten\s+the\s+deal`,
      String.raw`non[\s-]?cash\s+(?:levers?|options?|components?)`,
      // bare lever nouns paired with interrogative / modal / hedge
      String.raw`(?:joining\s+bonus|sign[\s-]?on|relocation|esops?|stock|equity|retention|rsu|grant|variable\s+(?:component|bump))\b[^.!?]{0,40}(?:\?|can\s+you|could\s+you|is\s+(?:that|it|this)|any|possible|maybe|perhaps)`,
      String.raw`(?:\?|can\s+you|could\s+you|any|possible|maybe|perhaps)[^.!?]{0,40}\b(?:joining\s+bonus|sign[\s-]?on|relocation|esops?|equity|retention|rsu)`,
    ].join("|"),
    "i",
  );
  /* Counter-proposal / movement engagement — Bug-D fast-follow (2026-06-19).
   * LEVER_EXPLORE_ENGAGEMENT_RE only catches non-cash sweetener probes
   * ("how about a joining bonus?"). It MISSES the most common engaged move of
   * all: an in-band counter on base/fixed cash ("can we get the fixed closer
   * to 30?", "I can come down to 34", "let's meet in the middle"). The
   * candidate's recorded peak `target` stays pinned at their FIRST number
   * (40) even after they signal flexibility, so the over-band walk condition
   * (1) fired ON a constructive counter — the bot walked away mid-negotiation
   * from someone actively converging. A candidate proposing movement is the
   * antithesis of the intransigence condition (1) protects against, so this
   * counts as engagement and suppresses the deadlock walk. */
  const COUNTER_PROPOSAL_ENGAGEMENT_RE = new RegExp(
    [
      // proposing a component move toward / to a number
      String.raw`(?:fixed|base|cash|ctc|number|offer|total)\b[^.!?]{0,30}(?:closer\s+to|up\s+to|to|at|around|near)\s*₹?\s*\d`,
      String.raw`(?:closer\s+to|move\s+(?:it\s+)?(?:up\s+)?to|get\s+(?:it|the\s+\w+)\s+to|bump\s+(?:it\s+)?to|land\s+(?:it\s+)?(?:at|around))\s*₹?\s*\d`,
      // candidate conceding downward
      String.raw`(?:i\s+can|i.?d|i\s+could|happy\s+to|willing\s+to)\s+(?:come\s+down|move|flex|adjust|go)\s+(?:down\s+)?(?:to|toward)?\s*₹?\s*\d`,
      String.raw`i.?m\s+(?:comfortable|okay|fine)\s+(?:at|with|around)\s*₹?\s*\d`,
      // split-the-difference / meet-in-the-middle compromise framing
      String.raw`meet\s+(?:me\s+)?(?:in\s+the\s+middle|halfway|at\s*₹?\s*\d)`,
      String.raw`split\s+the\s+difference`,
      // "can we (get|do|make|work) ... <num>" component ask
      String.raw`can\s+we\s+(?:get|do|make|work|land|settle|land\s+on|agree\s+on)\b[^.!?]{0,30}\d`,
    ].join("|"),
    "i",
  );
  const candidateIsEngaging =
    lastCandidateText.length > 0 &&
    !DISENGAGEMENT_PREFIX_RE.test(lastCandidateText) &&
    (LEVER_EXPLORE_ENGAGEMENT_RE.test(lastCandidateText) ||
      COUNTER_PROPOSAL_ENGAGEMENT_RE.test(lastCandidateText));

  /* Bug-D (2026-06-19, live staging) — never walk away from a candidate who
   * is trying to CLOSE. The engagement carve-out above only matches lever-
   * explore probes ("how about a joining bonus?"); an outright acceptance or
   * closing signal ("that works for me, let's go ahead and close") matches
   * neither it nor the disengagement prefix, so a candidate who has relented
   * below their original (now-stale) target and is accepting the standing
   * offer still tripped the over-band / dragged-too-long walk conditions and
   * the bot walked away ON the acceptance — the cardinal failure. A candidate
   * closing is the literal opposite of one you disengage from, so suppress the
   * coaching walk and let the planner's post-anchor close branches own the
   * turn. Guarded against negated / conditional-on-an-unmet-number forms
   * ("that won't work", "only if you hit 40") so a real decline still walks. */
  const CLOSING_ACCEPTANCE_RE =
    /\b(?:that\s+works(?:\s+for\s+me)?|works\s+for\s+me|sounds?\s+good|let.?s\s+(?:go\s+ahead|close|wrap(?:\s+(?:this|it)\s+up)?|do\s+(?:it|this)|finali[sz]e|proceed|move\s+forward)|ready\s+to\s+(?:move\s+forward|proceed|sign|close|join|go\s+ahead)|happy\s+to\s+(?:proceed|move\s+forward|accept|join|close)|i.?m\s+(?:in|aligned|on\s+board|good\s+with\s+(?:that|this|it))|i\s+accept|we\s+(?:have|got)\s+a\s+deal|count\s+me\s+in)\b/i;
  const CLOSING_NEGATION_RE =
    /\b(?:not|don.?t|doesn.?t|won.?t|can.?t|cannot|isn.?t|wouldn.?t|unless|only\s+if|as\s+long\s+as)\b/i;
  const candidateIsClosing =
    lastCandidateText.length > 0 &&
    !DISENGAGEMENT_PREFIX_RE.test(lastCandidateText) &&
    !CLOSING_NEGATION_RE.test(lastCandidateText) &&
    CLOSING_ACCEPTANCE_RE.test(lastCandidateText);

  /* Combined suppression for the negotiation-deadlock walk conditions
   * (1)/(2)/(4). Condition (3) — stacked bad-actor risk — is intentionally
   * NOT suppressed: a closing signal does not reduce requisition-protection
   * risk (a renege-history candidate "accepting" is exactly the trap). */
  const suppressDeadlockWalk = candidateIsEngaging || candidateIsClosing;

  /* (1) target far above ceiling with no flex (3+ stale turns). */
  if (
    target != null &&
    band &&
    typeof band.maxStretch === "number" &&
    target > band.maxStretch * 1.2 * walkMult &&
    turn >= 3 &&
    !suppressDeadlockWalk
  ) {
    return {
      walk: true,
      reason: `Candidate target ₹${target}L is >${(20 * walkMult).toFixed(0)}% above band ceiling ₹${band.maxStretch}L after ${turn} turns. Gap too wide to close.`,
    };
  }

  /* (2) final-offer asserted thrice, candidate still hasn't moved. */
  if (
    (state.finalOfferAssertedCount ?? 0) >= 3 &&
    !state.walkAwayReturned &&
    !suppressDeadlockWalk
  ) {
    return {
      walk: true,
      reason: `Final-offer asserted ${state.finalOfferAssertedCount} times without convergence. Continuing erodes credibility.`,
    };
  }

  /* (3) stacked bad-actor signals — too risky to onboard. NOTE: this
   * condition is NOT gated by the engagement guard. Bad-actor signals
   * (postAcceptanceRenege + bgvAnxiety, or PIP + offerRescindedHistory)
   * are structural risk, not negotiation deadlock — engagement on the
   * lever surface doesn't reduce the requisition-protection risk. */
  if (profile) {
    const renegeRisk =
      profile.postAcceptanceRenege &&
      (profile.bgvAnxiety || profile.currentCtcRefusal);
    const ofRiscindRisk =
      profile.pipDisclosed && profile.offerRescindedHistory;
    if (renegeRisk || ofRiscindRisk) {
      return {
        walk: true,
        reason:
          "Stacked risk signals (renege history + BGV anxiety / CTC refusal, or PIP + prior offer rescinded). Walk to protect the requisition.",
      };
    }
  }

  /* (4) at ceiling, conversation has dragged.
   *
   * Guard: only walk if the candidate has had at least 2 turns to respond
   * AFTER the first offer was placed. When a recruiter opens at the ceiling
   * and the session hits turn 8 due to unrelated exchange (e.g. discovery
   * questions before the offer), the candidate may have had only 0–1 response
   * turns and a walk-away here is premature. firstOfferAtTurn tracks the
   * exact turn on which highestOfferMade first became > 0; two or more
   * subsequent candidate-turns must have elapsed before we call time.
   * If firstOfferAtTurn is null (legacy state or offer not yet tracked),
   * the guard is skipped — we defer to the plain turn-count gate (turn >= 8)
   * as before, so old persisted sessions continue to work correctly. */
  const candidateTurnsSinceFirstOffer =
    state.firstOfferAtTurn != null ? turn - state.firstOfferAtTurn : null;
  if (
    band &&
    typeof band.maxStretch === "number" &&
    state.highestOfferMade >= band.maxStretch - 0.01 &&
    turn >= 8 &&
    /* B3 guard: when firstOfferAtTurn is tracked, require ≥2 candidate turns
     * since first offer before declaring deadlock. Null means untracked
     * (legacy); in that case omit the guard so old behaviour is preserved. */
    (candidateTurnsSinceFirstOffer === null || candidateTurnsSinceFirstOffer >= 2) &&
    !suppressDeadlockWalk
  ) {
    return {
      walk: true,
      reason: `At ceiling ₹${band.maxStretch}L after ${turn} turns. Close-or-walk window has closed.`,
    };
  }

  return { walk: false, reason: "" };
}

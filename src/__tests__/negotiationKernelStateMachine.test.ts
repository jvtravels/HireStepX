/* Phase-4 (4.2) — Negotiation-kernel state-machine snapshot tests.
 *
 * Pins canonical phase trajectories through the 5,000-LOC kernel so a
 * silent regression on phase transitions, lever ordering, or terminal
 * resolution surfaces as a snapshot diff.
 *
 * Five paths covered:
 *   1. happy-close              — opening → counter → close-acceptance
 *   2. candidate-counter-then-close — opening → counter → counter →
 *      close-acceptance
 *   3. walk-away                — opening → walked-away
 *   4. deflect-loop-recovery    — frustration → acknowledge-and-recover
 *      → counter (uses PDF#35 Move-1 close branch)
 *   5. clarification-loop-recovery — clarification ask → recover →
 *      counter (uses PDF#34 Fix-3)
 *
 * Snapshot strategy: whitelisted projection (NOT full state dump).
 * `phaseTrajectory` is the ordered list of `state.phase` after each
 * applyAiMove / applyCandidateAnswer step. `finalShape` is a tiny
 * deterministic subset of the terminal state — phase, leversUsed,
 * verbalAcceptanceTurn, walkAwayAtTurn, candidateTargetLpa. No
 * timestamps, no ids, no large nested objects.
 *
 * Per Phase-4 rule 3: no Date.now(), no Math.random() — kernel doesn't
 * touch either and the projection strips any volatile fields.
 */

import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 28,
  walkAway: 18,
  hasEquity: false,
};

function freshState(): NegotiationState {
  return initState({
    sessionId: "snapshot-fixture",
    role: "react",
    company: "Razorpay",
    band: BAND,
  });
}

/* Canonical move + answer event log. Each entry is either an
 * `ai`-move applied via applyAiMove, or a `user` answer applied via
 * applyCandidateAnswer. Drives one deterministic trajectory. */
type Event =
  | { kind: "ai"; move: AiMove; text: string }
  | { kind: "user"; text: string };

function runTrajectory(events: Event[]): {
  phaseTrajectory: string[];
  finalShape: Record<string, unknown>;
} {
  let s = freshState();
  const phaseTrajectory: string[] = [s.phase];
  for (const e of events) {
    if (e.kind === "ai") {
      s = applyAiMove(s, e.move, e.text);
    } else {
      s = applyCandidateAnswer(s, e.text);
    }
    phaseTrajectory.push(s.phase);
  }
  return {
    phaseTrajectory,
    finalShape: projectFinalState(s),
  };
}

/* Whitelisted projection of terminal NegotiationState. Volatile fields
 * (timestamps, large nested objects, ids) intentionally excluded. The
 * snapshot stays useful when the kernel's internal bookkeeping
 * evolves — only the load-bearing shape is pinned. */
function projectFinalState(s: NegotiationState): Record<string, unknown> {
  const out: Record<string, unknown> = {
    phase: s.phase,
    leversUsed: [...s.leversUsed].sort(),
    verbalAcceptanceSet: s.verbalAcceptanceTurn != null,
    acceptedAtTurnSet: s.acceptedAtTurn != null,
    walkAwayReturned: s.walkAwayReturned === true,
  };
  if (s.candidateTarget != null) out.candidateTarget = s.candidateTarget;
  return out;
}

/* ─────────────────────────────────────────────────────────────────
 *  Path 1 — happy-close
 *  Recruiter opens, candidate anchors, recruiter counters, candidate
 *  accepts. The vanilla path; should land terminal `accepted`.
 * ───────────────────────────────────────────────────────────────── */
describe("Phase 4.2 — negotiation-kernel canonical paths", () => {
  it("happy-close: opening → counter-base → close-acceptance", () => {
    const { phaseTrajectory, finalShape } = runTrajectory([
      {
        kind: "ai",
        move: { lever: "open-with-offer", newTotalLpa: 22, rationale: "open" },
        text: "We can offer ₹22 LPA total CTC for this role.",
      },
      { kind: "user", text: "My expectation is ₹26 LPA based on my research." },
      {
        kind: "ai",
        move: { lever: "counter-base", newTotalLpa: 25, rationale: "counter" },
        text: "We can stretch to ₹25 LPA total.",
      },
      { kind: "user", text: "I accept the offer at ₹25 LPA. Please send the letter." },
      {
        kind: "ai",
        move: { lever: "close-acceptance", newTotalLpa: 25, rationale: "wrap" },
        text: "Welcome aboard.",
      },
    ]);
    expect({ phaseTrajectory, finalShape }).toMatchSnapshot();
  });

  /* Path 2 — candidate-counter-then-close
   * Two-round counter exchange before terminal accepted. */
  it("candidate-counter-then-close: open → counter → counter → accept", () => {
    const { phaseTrajectory, finalShape } = runTrajectory([
      {
        kind: "ai",
        move: { lever: "open-with-offer", newTotalLpa: 22, rationale: "open" },
        text: "We can offer ₹22 LPA total CTC.",
      },
      { kind: "user", text: "I'm targeting ₹28 LPA based on my research." },
      {
        kind: "ai",
        move: { lever: "counter-base", newTotalLpa: 24, rationale: "first counter" },
        text: "We can come up to ₹24 LPA.",
      },
      { kind: "user", text: "Can you stretch further? I have a competing offer at ₹27 LPA." },
      {
        kind: "ai",
        move: { lever: "counter-base", newTotalLpa: 26, rationale: "second counter" },
        text: "We can stretch to ₹26 LPA total.",
      },
      { kind: "user", text: "Done — I accept the offer." },
      {
        kind: "ai",
        move: { lever: "close-acceptance", newTotalLpa: 26, rationale: "wrap" },
        text: "Welcome aboard, looking forward.",
      },
    ]);
    expect({ phaseTrajectory, finalShape }).toMatchSnapshot();
  });

  /* Path 3 — walk-away
   * Candidate explicitly declines. Kernel transitions to terminal
   * `walked-away`. */
  it("walk-away: open → counter → user declines → walked-away", () => {
    const { phaseTrajectory, finalShape } = runTrajectory([
      {
        kind: "ai",
        move: { lever: "open-with-offer", newTotalLpa: 22, rationale: "open" },
        text: "We can offer ₹22 LPA total CTC.",
      },
      { kind: "user", text: "I need at least ₹30 LPA based on my research." },
      {
        kind: "ai",
        move: { lever: "counter-base", newTotalLpa: 24, rationale: "stretch counter" },
        text: "Our absolute top is ₹24 LPA.",
      },
      {
        kind: "user",
        text: "Thank you, but I will have to decline the offer. I am withdrawing from this process.",
      },
      {
        kind: "ai",
        move: { lever: "close-walkaway", newTotalLpa: null, rationale: "wrap" },
        text: "Understood — best of luck.",
      },
    ]);
    expect({ phaseTrajectory, finalShape }).toMatchSnapshot();
  });

  /* Path 4 — deflect-loop-recovery (PDF#35 Move 1 close branch)
   * Candidate signals frustration about looping; kernel emits the
   * acknowledge-and-recover lever and exits the loop cleanly into
   * counter-offer territory. */
  it("deflect-loop-recovery: frustration → acknowledge-and-recover → counter", () => {
    const { phaseTrajectory, finalShape } = runTrajectory([
      {
        kind: "ai",
        move: { lever: "open-with-offer", newTotalLpa: 22, rationale: "open" },
        text: "We can offer ₹22 LPA total CTC.",
      },
      { kind: "user", text: "I'm targeting ₹26 LPA. Current ₹20 LPA." },
      {
        kind: "ai",
        move: { lever: "probe", newTotalLpa: null, rationale: "discovery probe" },
        text: "What's most important to you in the offer?",
      },
      {
        kind: "user",
        text: "I already told you multiple times — base is the priority. Why do you keep asking the same thing?",
      },
      {
        kind: "ai",
        move: { lever: "acknowledge-and-recover", newTotalLpa: null, rationale: "PDF#35 Move-1 recovery" },
        text: "You're right, apologies for looping — let me move us forward.",
      },
      {
        kind: "ai",
        move: { lever: "counter-base", newTotalLpa: 25, rationale: "post-recovery counter" },
        text: "We can stretch to ₹25 LPA total — that's our best.",
      },
      { kind: "user", text: "OK, that works. I'll take it." },
      {
        kind: "ai",
        move: { lever: "close-acceptance", newTotalLpa: 25, rationale: "wrap" },
        text: "Welcome aboard.",
      },
    ]);
    expect({ phaseTrajectory, finalShape }).toMatchSnapshot();
  });

  /* Path 5 — clarification-loop-recovery (PDF#34 Fix-3)
   * Candidate asks "what are you offering?" — kernel routes to the
   * clarification-request branch and emits a concrete recap, then
   * continues into counter-offer. */
  it("clarification-loop-recovery: clarification ask → recap → counter → accept", () => {
    const { phaseTrajectory, finalShape } = runTrajectory([
      {
        kind: "ai",
        move: { lever: "open-with-offer", newTotalLpa: 22, rationale: "open" },
        text: "We can offer ₹22 LPA total CTC.",
      },
      {
        kind: "user",
        text: "Can you help me understand what exactly you're offering? I'd like to know the breakdown.",
      },
      {
        kind: "ai",
        move: { lever: "compensation-summary", newTotalLpa: 22, rationale: "PDF#34 Fix-3 recap" },
        text: "To be clear: ₹22 LPA total — ₹18 LPA base, ₹4 LPA variable. No equity for this level.",
      },
      { kind: "user", text: "Got it. My target is ₹26 LPA based on my research." },
      {
        kind: "ai",
        move: { lever: "counter-base", newTotalLpa: 25, rationale: "post-clarification counter" },
        text: "We can stretch to ₹25 LPA total — that's our final.",
      },
      { kind: "user", text: "I accept the offer at ₹25 LPA." },
      {
        kind: "ai",
        move: { lever: "close-acceptance", newTotalLpa: 25, rationale: "wrap" },
        text: "Welcome aboard.",
      },
    ]);
    expect({ phaseTrajectory, finalShape }).toMatchSnapshot();
  });
});

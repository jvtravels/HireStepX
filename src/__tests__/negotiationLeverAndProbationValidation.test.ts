/* Regression for two launch-blockers found in the 2026-06-17 live +
 * deterministic salary-negotiation QA pass (tracked on PRI-50):
 *
 *  Gap C — `VALID_LEVERS` (the set `validateState` checks `leversUsed`
 *  against) had drifted from the `NegotiationLever` union. `probe-
 *  justification` and `acknowledge-and-recover` were emittable by the
 *  planner (they assign `move.lever`, which `applyAiMove` appends to
 *  `leversUsed`) but were missing from the set. The first time either
 *  fired, the next turn's `deserializeState` threw `state.leversUsed`,
 *  `negotiate-turn` returned 400 "Invalid state", and the session died
 *  un-resumably in `phase:"opening"`. The fix makes the set exhaustive
 *  over the union via a compiler-enforced `Record<NegotiationLever,true>`.
 *
 *  Gap D — fresher QA Engineer band at IT-services tiers had
 *  `probationOffer > initialOffer` (the target-role clamp compressed
 *  initialOffer without re-clamping the pre-clamp probationOffer), which
 *  `validateState` rejects → 400 at session init.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  serializeState,
  deserializeState,
  type NegotiationBand,
  type NegotiationState,
  type NegotiationLever,
} from "../../server-handlers/_negotiation-kernel";
import { generateBotReply } from "../../server-handlers/_response-pipeline";
import { resolveServerBand } from "../../server-handlers/_band-resolver";

const BAND: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 32,
  walkAway: 19,
  hasEquity: true,
};

function freshState(): NegotiationState {
  return initState({
    sessionId: "lever-validation-fixture",
    role: "Senior Product Designer",
    company: "Google",
    band: BAND,
  });
}

/* The full NegotiationLever union. Kept explicit so a value silently
 * dropped from VALID_LEVERS lights up here even if the compile-time
 * Record check is bypassed. Update this list whenever the union changes. */
const ALL_LEVERS: NegotiationLever[] = [
  "open-with-offer",
  "probe",
  "probe-justification",
  "counter-base",
  "joining-bonus",
  "equity-grant",
  "notice-buyout",
  "benefits-summary",
  "compensation-summary",
  "notice-period-summary",
  "hike-context-summary",
  "hold-firm",
  "close-acceptance",
  "close-walkaway",
  "close-stalemate",
  "terminal-restate",
  "acknowledge-and-recover",
  "ctc-inflation-anchor",
];

describe("Gap C — every emittable lever survives the state round-trip", () => {
  it.each(ALL_LEVERS)("accepts leversUsed=[%s] through serialize→deserialize", (lever) => {
    const state = { ...freshState(), leversUsed: [lever] };
    expect(() => deserializeState(serializeState(state))).not.toThrow();
  });

  it("regression: the two that 400'd live (probe-justification, acknowledge-and-recover)", () => {
    for (const lever of ["probe-justification", "acknowledge-and-recover"] as NegotiationLever[]) {
      const state = { ...freshState(), leversUsed: ["probe", lever, "probe"] as NegotiationLever[] };
      expect(() => deserializeState(serializeState(state)), lever).not.toThrow();
    }
  });

  it("integration: a contradiction-callout turn produces a round-trippable state", async () => {
    /* Replays the live repro: discovery answers where a bundled RSU+notice
     * line trips a contradiction-callout (lever acknowledge-and-recover).
     * Pre-fix this state failed deserialize on the next turn. */
    const llm = async () => {
      throw new Error("LLM disabled for determinism");
    };
    let state = freshState();
    const answers = [
      "Hi, thanks for setting this up.",
      "My current fixed is about 22 LPA.",
      "Split is 18 fixed and 4 variable.",
      "RSUs worth roughly 3 LPA a year. My notice is 60 days.",
      "To clarify, total is 22, the 3 is RSU on top.",
    ];
    for (let i = 0; i < answers.length; i++) {
      if (i > 0) state = applyCandidateAnswer(state, answers[i]);
      const res = await generateBotReply(state, llm, i > 0 ? answers[i] : undefined, "ci");
      state = applyAiMove(state, res.move, res.text);
      // The client→server hop must never reject — even after a recovery lever.
      expect(() => deserializeState(serializeState(state)), `turn ${i} lever=${res.move?.lever}`).not.toThrow();
    }
  });
});

describe("Gap D — fresher probation band stays at or below initialOffer", () => {
  const SERVICE_TIERS = ["TCS", "Infosys", "Wipro"];

  it.each(SERVICE_TIERS)("QA Engineer / %s / 0y: probationOffer ≤ initialOffer and round-trips", (company) => {
    const band = resolveServerBand("QA Engineer", company, undefined, 0);
    if (band.probationOffer != null) {
      expect(band.probationOffer).toBeLessThanOrEqual(band.initialOffer);
      expect(band.probationOffer).toBeGreaterThan(0);
    }
    const state = initState({ sessionId: "probation", role: "QA Engineer", company, band });
    expect(() => deserializeState(serializeState(state))).not.toThrow();
  });

  it("1y QA Engineer at a service tier also round-trips (probation still applies)", () => {
    const band = resolveServerBand("QA Engineer", "TCS", undefined, 1);
    if (band.probationOffer != null) {
      expect(band.probationOffer).toBeLessThanOrEqual(band.initialOffer);
    }
    const state = initState({ sessionId: "probation-1y", role: "QA Engineer", company: "TCS", band });
    expect(() => deserializeState(serializeState(state))).not.toThrow();
  });
});

describe("L1 — equity figure must not overwrite currentCtc / fire spurious contradiction", () => {
  it("a bundled RSU+notice discovery answer leaves currentCtc unchanged", async () => {
    const llm = async () => {
      throw new Error("LLM disabled for determinism");
    };
    let state = freshState();
    state = applyCandidateAnswer(state, "My current fixed is 22 LPA.");
    expect(state.candidateCurrentCtc).toBe(22);
    let res = await generateBotReply(state, llm, "My current fixed is 22 LPA.", "ci");
    state = applyAiMove(state, res.move, res.text);

    // The line that used to misparse 3 (RSU) as a NEW currentCtc → contradiction-callout.
    state = applyCandidateAnswer(state, "RSUs worth roughly 3 LPA a year. My notice is 60 days.");
    expect(state.candidateCurrentCtc, "RSU figure must not overwrite currentCtc").toBe(22);
    res = await generateBotReply(state, llm, "RSUs worth roughly 3 LPA a year. My notice is 60 days.", "ci");
    expect(res.move?.lever, "no contradiction-recovery lever on a non-contradiction").not.toBe(
      "acknowledge-and-recover",
    );
    state = applyAiMove(state, res.move, res.text);
    expect(() => deserializeState(serializeState(state))).not.toThrow();
  });
});

describe("Gap B — counter escalates when the candidate's ask is reachable", () => {
  it("ships a counter-base above the opening anchor for an in-band target", async () => {
    const llm = async () => {
      throw new Error("LLM disabled for determinism");
    };
    let state = freshState();
    const answers = [
      "Hi, thanks for setting this up.",
      "My current fixed is 22 LPA.",
      "Split is 18 fixed and 4 variable.",
      "My notice is 30 days.",
      "I'm looking for 30 LPA.",
      "I have a competing offer at 29 LPA.",
      "My floor is 28, I can't go below that.",
    ];
    let counterFired = false;
    let openingAnchor: number | null = null;
    for (let i = 0; i < answers.length; i++) {
      if (i > 0) state = applyCandidateAnswer(state, answers[i]);
      const res = await generateBotReply(state, llm, i > 0 ? answers[i] : undefined, "ci");
      state = applyAiMove(state, res.move, res.text);
      if (openingAnchor == null && state.highestOfferMade > 0) openingAnchor = state.highestOfferMade;
      if (res.move?.lever === "counter-base") counterFired = true;
    }
    // candidateTarget (30) must have been parsed — without it the planner never counters.
    expect(state.candidateTarget).toBe(30);
    expect(counterFired, "a reachable in-band target must trigger counter-base").toBe(true);
    // And the offer must have escalated above the first anchor it disclosed.
    expect(openingAnchor).not.toBeNull();
    expect(state.highestOfferMade).toBeGreaterThan(openingAnchor as number);
    // Never breach the band ceiling.
    expect(state.highestOfferMade).toBeLessThanOrEqual(BAND.maxStretch);
  });
});

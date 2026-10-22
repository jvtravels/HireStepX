import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { resolveServerBand } from "../../server-handlers/_band-resolver";
import { classifyCompanyTier } from "../../server-handlers/_company-band-tiers";

describe("S49-B3 — HDFC Bank Senior Data Analyst premature termination repro", () => {
  it("should not terminate session before making any salary offer", () => {
    const tier = classifyCompanyTier("hdfc");
    console.log("HDFC tier:", tier);

    const band = resolveServerBand("Senior Data Analyst", "hdfc", "senior", 4);
    console.log("HDFC band:", band);
    console.log("target 28L vs maxStretch:", band.maxStretch, "ratio:", (28/band.maxStretch).toFixed(2));

    let s = initState({ sessionId: "s49b3", role: "data-analyst", company: "hdfc", band });
    console.log("Initial phase:", s.phase, "turnIndex:", s.turnIndex);

    // Turn 1: candidate states CTC and target
    s = applyCandidateAnswer(s, "My current CTC is ₹18L and I'm targeting around ₹28L.");
    console.log("After turn 1 - phase:", s.phase, "turnIndex:", s.turnIndex, "candidateCtc:", s.candidateCurrentCtc, "candidateTarget:", s.candidateTarget);

    const action1 = planNextAction(s) as any;
    console.log("Planned action 1:", action1?.kind, action1?._move?.lever, action1?._move?.rationale?.substring(0, 100));
    expect(action1?._move?.lever).not.toBe("close-stalemate");
    expect(action1?._move?.lever).not.toBe("close-walkaway");

    // Simulate AI responding with a probe
    s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ask about expectations" }, "That's great. What's your expected CTC?");
    console.log("After AI turn 1 - phase:", s.phase, "turnIndex:", s.turnIndex);

    // Turn 2: candidate re-states target
    s = applyCandidateAnswer(s, "I'm looking for ₹28L in total compensation.");
    console.log("After turn 2 - phase:", s.phase, "candidateTarget:", s.candidateTarget);

    const action2 = planNextAction(s) as any;
    console.log("Planned action 2:", action2?.kind, action2?._move?.lever, action2?._move?.rationale?.substring(0, 100));

    // Session should NOT terminate after 2 turns without an offer
    expect(action2?._move?.lever).not.toBe("close-stalemate");
    expect(action2?._move?.lever).not.toBe("close-walkaway");
    expect(s.highestOfferMade).toBe(0); // no offer yet
  });
});

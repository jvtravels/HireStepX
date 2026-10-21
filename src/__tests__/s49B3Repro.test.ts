import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { resolveServerBand } from "../../server-handlers/_band-resolver";

describe("S49-B3 — HDFC Bank Senior Data Analyst premature termination repro", () => {
  it("should not terminate session before making any salary offer", () => {

    const band = resolveServerBand("Senior Data Analyst", "hdfc", "senior", 4);

    let s = initState({ sessionId: "s49b3", role: "data-analyst", company: "hdfc", band });

    // Turn 1: candidate states CTC and target
    s = applyCandidateAnswer(s, "My current CTC is ₹18L and I'm targeting around ₹28L.");

    const action1 = planNextAction(s) as any;
    expect(action1?._move?.lever).not.toBe("close-stalemate");
    expect(action1?._move?.lever).not.toBe("close-walkaway");

    // Simulate AI responding with a probe
    s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ask about expectations" }, "That's great. What's your expected CTC?");

    // Turn 2: candidate re-states target
    s = applyCandidateAnswer(s, "I'm looking for ₹28L in total compensation.");

    const action2 = planNextAction(s) as any;

    // Session should NOT terminate after 2 turns without an offer
    expect(action2?._move?.lever).not.toBe("close-stalemate");
    expect(action2?._move?.lever).not.toBe("close-walkaway");
    expect(s.highestOfferMade).toBe(0); // no offer yet
  });
});

/* Memory feature (2026-05-29) — contradiction-callout tests.
 *
 * Verifies the kernel records user claims on first mention and stamps
 * `lastContradiction` when a subsequent turn restates the same claim
 * outside the ±10% tolerance band; the planner then fires the
 * contradiction-callout action.
 *
 * Coverage:
 *   1. CTC contradiction: 18 LPA → 22 LPA exceeds ±10% drift → callout fires
 *   2. Competing-offer amount contradiction (same company): callout fires
 *   3. Within tolerance (18 → 19): NO callout, claim updates silently
 *   4. Only one claim made (no prior record): NO callout
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: true,
};
const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "ccs1", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

describe("contradiction-callout — kernel claim recording + planner trigger", () => {
  it("CTC contradiction (18 → 22 LPA, ~22% drift) fires contradiction-callout", () => {
    const s0 = init();
    /* Turn A: candidate states current CTC = 18 LPA. */
    const sA = applyCandidateAnswer(s0, "My current CTC is 18 LPA.");
    expect(sA.userClaims?.currentCtc?.value).toBe(18);
    expect(sA.userClaims?.currentCtc?.firstSeenTurn).toBe(0);
    expect(sA.lastContradiction).toBeNull();

    /* Turn B (later): candidate now says 22 LPA. Drift = |22-18|/18 = 22% > 10%. */
    const sB = applyCandidateAnswer(
      { ...sA, turnIndex: 2 },
      "Actually my current CTC is 22 LPA.",
    );
    expect(sB.lastContradiction).not.toBeNull();
    expect(sB.lastContradiction?.topic).toBe("currentCtc");
    expect(sB.lastContradiction?.oldValue).toBe(18);
    expect(sB.lastContradiction?.newValue).toBe(22);

    /* Planner should now fire contradiction-callout. */
    const action = planNextAction(sB);
    expect(action.kind).toBe("contradiction-callout");
  });

  it("competing-offer amount contradiction (same company, 30 → 38) fires callout", () => {
    const s0 = init();
    const sA = applyCandidateAnswer(
      s0,
      "I have a competing offer from Flipkart at 30 LPA.",
    );
    expect(sA.userClaims?.competingOffer?.value.amount).toBe(30);
    expect(sA.userClaims?.competingOffer?.value.company.toLowerCase()).toBe("flipkart");
    expect(sA.lastContradiction).toBeNull();

    const sB = applyCandidateAnswer(
      { ...sA, turnIndex: 2 },
      "Flipkart's offer is actually 38 LPA.",
    );
    expect(sB.lastContradiction?.topic).toBe("competingOffer");
    expect(sB.lastContradiction?.oldValue).toBe(30);
    expect(sB.lastContradiction?.newValue).toBe(38);

    const action = planNextAction(sB);
    expect(action.kind).toBe("contradiction-callout");
  });

  it("within ±10% tolerance (18 → 19) does NOT fire callout — silent update", () => {
    const s0 = init();
    const sA = applyCandidateAnswer(s0, "My current CTC is 18 LPA.");
    expect(sA.userClaims?.currentCtc?.value).toBe(18);

    /* 19 vs 18 = 5.5% drift, inside ±10% tolerance. */
    const sB = applyCandidateAnswer(
      { ...sA, turnIndex: 2 },
      "Current CTC is 19 LPA.",
    );
    expect(sB.lastContradiction).toBeNull();
    /* First-seen value stays pinned at 18 (we don't overwrite within tolerance). */
    expect(sB.userClaims?.currentCtc?.value).toBe(18);
    expect(sB.userClaims?.currentCtc?.firstSeenTurn).toBe(0);

    const action = planNextAction(sB);
    expect(action.kind).not.toBe("contradiction-callout");
  });

  it("first-time mention with no prior claim does NOT fire callout", () => {
    const s0 = init();
    const sA = applyCandidateAnswer(s0, "My current CTC is 18 LPA.");
    /* Single claim recorded, no prior to contradict. */
    expect(sA.userClaims?.currentCtc?.value).toBe(18);
    expect(sA.lastContradiction).toBeNull();

    const action = planNextAction(sA);
    expect(action.kind).not.toBe("contradiction-callout");
  });
});

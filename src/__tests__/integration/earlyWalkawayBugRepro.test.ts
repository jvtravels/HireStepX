/* Repro for user-reported bug: voice STT mishears "LPA" as "LPE", the
 * fact-parser rejects the unit, the kernel sees no CTC disclosure, and
 * the planner ships a polite-close on turn 1.
 *
 * Transcript:
 *   Recruiter: "Thanks for making the time. What's your current CTC — total annual?"
 *   Candidate (voice): "my current CTC is 36 LPE"   ← STT mis-spelt "LPA"
 *   Recruiter: "Thanks for the conversation today, Jay. We'll be in touch with next steps."
 *
 * The fix tolerates "LPE" / "LPS" and other near-miss suffixes at the
 * parser layer.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";
import { parseSalaryFacts } from "../../../server-handlers/_fact-parser";

const FLIPKART_SENIOR_DESIGNER_BAND: NegotiationBand = {
  initialOffer: 32,
  maxStretch: 45,
  walkAway: 28,
  hasEquity: true,
};

describe("earlyWalkawayBugRepro — STT mishear of LPA → LPE", () => {
  it("parser MUST extract ₹36L from '36 LPE' (voice-STT typo tolerance)", () => {
    const facts = parseSalaryFacts("my current CTC is 36 LPE");
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].value).toBe(36);
  });

  it("parser tolerates other near-miss unit suffixes", () => {
    for (const text of [
      "my CTC is 36 LPS",
      "my CTC is 36 LPP",
      "my CTC is 36 lpe",
    ]) {
      const facts = parseSalaryFacts(text);
      expect(facts.length, `failed to parse: ${text}`).toBeGreaterThan(0);
      expect(facts[0].value).toBe(36);
    }
  });

  it("real, established suffixes still parse as before", () => {
    expect(parseSalaryFacts("36 LPA")[0].value).toBe(36);
    expect(parseSalaryFacts("36 lakhs")[0].value).toBe(36);
    expect(parseSalaryFacts("36L")[0].value).toBe(36);
    expect(parseSalaryFacts("1.2 crore")[0].value).toBe(120);
  });

  it("planner on turn 1 after candidate discloses CTC must NOT ship a polite close / walk-away / closing recap", () => {
    let state = initState({
      sessionId: "early-walkaway-repro",
      role: "Senior Product Designer",
      company: "Flipkart",
      band: FLIPKART_SENIOR_DESIGNER_BAND,
    });
    state = applyCandidateAnswer(state, "my current CTC is 36 LPE");
    const action = planNextAction(state);
    /* The session must continue. None of the close/walkaway shapes. */
    expect(action.kind).not.toBe("polite-walkaway");
    expect(action.kind).not.toBe("close");
    expect(action.kind).not.toBe("close-recap-formal");
    expect(action.kind).not.toBe("live-walk-away");
  });

  it("the disclosed CTC must be folded into kernel state (candidateCurrentCtc)", () => {
    let state = initState({
      sessionId: "early-walkaway-repro-state",
      role: "Senior Product Designer",
      company: "Flipkart",
      band: FLIPKART_SENIOR_DESIGNER_BAND,
    });
    state = applyCandidateAnswer(state, "my current CTC is 36 LPE");
    expect(state.candidateCurrentCtc).toBe(36);
  });
});

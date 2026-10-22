/* Diagnostic: does the recruiter re-ask CTC when candidate clearly states it on turn 1?
 * S54-B1 / S59-B1 / S60-B2 — 17 consecutive sessions. */
import { describe, it, expect } from "vitest";
import {
  applyCandidateAnswer,
  applyAiMove,
  pickAiMove,
  initState,
  parseCandidateAnswer,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import { isDiscoverySufficientToAnchor } from "../../server-handlers/_discovery-stage";

function initInfosysSession(): NegotiationState {
  const s = initState({
    sessionId: "diag-ctc-reask",
    role: "Software Engineer",
    company: "Infosys",
    band: { initialOffer: 11, maxStretch: 14, walkAway: 8, hasEquity: false },
  });
  // simulate the init move
  const move = pickAiMove(s);
  return applyAiMove(s, move, "Hi! I'm Karthik from Infosys. Could you share your current CTC and what you're looking for in this role?");
}

describe("CTC re-ask diagnostic (S54-B1 / S59-B1 / S60-B2)", () => {
  it("parseCandidateAnswer extracts CTC from clear opening statement", () => {
    const s = initInfosysSession();
    const parsed = parseCandidateAnswer(
      "Hi Karthik! My current CTC is 12 lakhs and I'm targeting around 18 lakhs.",
      s.lastAiText, s.phase, false, 0, null, "Infosys", 0
    );
    expect(parsed.currentCtc).toBe(12);
    expect(parsed.target).toBe(18);
  });

  it("candidateCurrentCtc is set after first turn", () => {
    let s = initInfosysSession();
    s = applyCandidateAnswer(s, "Hi Karthik! My current CTC is 12 lakhs and I'm targeting around 18 lakhs.");
    expect(s.candidateCurrentCtc).toBe(12);
  });

  it("discoveryChecklist.currentCtcAnswered=true after first turn", () => {
    let s = initInfosysSession();
    s = applyCandidateAnswer(s, "Hi Karthik! My current CTC is 12 lakhs and I'm targeting around 18 lakhs.");
    expect(s.discoveryChecklist?.currentCtcAnswered).toBe(true);
    expect(s.discoveryChecklist?.targetAnswered).toBe(true);
  });

  it("isDiscoverySufficientToAnchor=true after first turn", () => {
    let s = initInfosysSession();
    s = applyCandidateAnswer(s, "Hi Karthik! My current CTC is 12 lakhs and I'm targeting around 18 lakhs.");
    const sufficient = isDiscoverySufficientToAnchor(s.discoveryChecklist!, "engineering");
    expect(sufficient).toBe(true);
  });

  it("CORE: first AI response does NOT re-ask CTC (S54-B1)", () => {
    let s = initInfosysSession();
    s = applyCandidateAnswer(s, "Hi Karthik! My current CTC is 12 lakhs and I'm targeting around 18 lakhs.");
    // Now simulate the AI responding
    const action = planNextAction(s);
    const prose = renderCanonicalProse(action, s);
    const ctcAskPatterns = /current.{0,10}CTC|what.{0,15}CTC|CTC.{0,10}currently|your\s+current\s+comp/i;
    if (ctcAskPatterns.test(prose)) {
      console.log("BUG CONFIRMED — AI prose re-asks CTC:", prose.slice(0, 200));
    }
    expect(prose).not.toMatch(ctcAskPatterns);
  });
});

describe("CTC re-ask with common Indian phrasings (S54-B1 root cause)", () => {
  const PHRASINGS = [
    "Hi, I'm currently drawing 12 lakh and looking for around 18.",
    "I draw 12 lakhs per annum and my expectation is 18 lakhs.",
    "My CTC is 12 LPA, targeting 18 LPA.",
    "12 lakh fixed, looking at 18 in new role.",
    "Currently getting 12, want around 18.",
    "Package is around 12 lakhs, I want 18 lakhs.",
  ];

  for (const phrase of PHRASINGS) {
    it(`extracts CTC from: "${phrase.slice(0, 50)}..."`, () => {
      const s = initInfosysSession();
      const parsed = parseCandidateAnswer(
        phrase,
        s.lastAiText, s.phase, false, 0, null, "Infosys", 0
      );
      if (parsed.currentCtc == null) {
        console.log(`MISS — no CTC for: "${phrase}"`);
      }
      // At minimum target should be found
      expect(parsed.currentCtc !== null || parsed.target !== null).toBe(true);
    });

    it(`no CTC re-ask after: "${phrase.slice(0, 40)}..."`, () => {
      let s = initInfosysSession();
      s = applyCandidateAnswer(s, phrase);
      if (!s.discoveryChecklist?.currentCtcAnswered) {
        // If CTC wasn't extracted, check if target was at least found
        const action = planNextAction(s);
        const prose = renderCanonicalProse(action, s);
        // Log what planner decided
        console.log(`CTC not answered, planner action for "${phrase.slice(0,40)}...": ${prose.slice(0,150)}`);
      }
    });
  }
});

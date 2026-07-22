import { describe, it, expect } from "vitest";
import { detectCandidateDisclosures } from "../../server-handlers/_candidate-disclosure-tracker";
import {
  applyCandidateAnswer,
  initState,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 45,
  maxStretch: 55,
  walkAway: 40,
  hasEquity: false,
};

function makeState() {
  return initState({ sessionId: "s-s39", role: "SWE", company: "Flipkart", band: BAND });
}

describe("S39 WFH/remote/hybrid non-monetary opener", () => {
  describe("disclosure tracker — S39-B1/B2 detection", () => {
    it("'I'm looking for remote work flexibility' fires wfh-flexibility", () => {
      const entries = detectCandidateDisclosures("I'm looking for remote work flexibility");
      expect(entries.some((e) => e.kind === "wfh-flexibility")).toBe(true);
    });

    it("'I prefer a hybrid role' fires wfh-flexibility", () => {
      const entries = detectCandidateDisclosures("I prefer a hybrid role, that's important to me");
      expect(entries.some((e) => e.kind === "wfh-flexibility")).toBe(true);
    });

    it("'I want to work from home' fires wfh-flexibility", () => {
      const entries = detectCandidateDisclosures("I want to work from home at least 3 days a week");
      expect(entries.some((e) => e.kind === "wfh-flexibility")).toBe(true);
    });

    it("'I'm open to remote' fires wfh-flexibility", () => {
      const entries = detectCandidateDisclosures("I'm open to remote or hybrid, I have a home setup");
      expect(entries.some((e) => e.kind === "wfh-flexibility")).toBe(true);
    });

    it("pure salary statement does not fire wfh-flexibility", () => {
      const entries = detectCandidateDisclosures("I'm looking for 60 LPA as my target");
      expect(entries.some((e) => e.kind === "wfh-flexibility")).toBe(false);
    });
  });

  describe("kernel state write-through — S39-B3 persistence", () => {
    it("wfhFlexibilityMentioned set after WFH opener in applyCandidateAnswer", () => {
      const state = makeState();
      const next = applyCandidateAnswer(state, "I'm looking for remote work flexibility");
      expect(next.wfhFlexibilityMentioned).toBe(true);
    });

    it("wfhFlexibilityMentioned false when no WFH mention", () => {
      const state = makeState();
      const next = applyCandidateAnswer(state, "My current CTC is 42 LPA");
      expect(next.wfhFlexibilityMentioned).toBeFalsy();
    });

    it("wfhFlexibilityMentioned is monotone-up — stays true across turns", () => {
      const state = makeState();
      const s1 = applyCandidateAnswer(state, "I want a hybrid arrangement");
      expect(s1.wfhFlexibilityMentioned).toBe(true);
      const s2 = applyCandidateAnswer(s1, "My current package is 40 LPA");
      expect(s2.wfhFlexibilityMentioned).toBe(true);
    });

    it("pendingCandidateAcks includes wfh-flexibility label", () => {
      const state = makeState();
      const next = applyCandidateAnswer(state, "I'm looking for remote work flexibility");
      const acksKinds = (next.pendingCandidateAcks ?? []).map((e) => e.kind);
      expect(acksKinds).toContain("wfh-flexibility");
    });
  });
});

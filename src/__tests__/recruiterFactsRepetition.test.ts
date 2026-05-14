import { describe, it, expect } from "vitest";
import {
  RECRUITER_FACT_TOKENS,
  extractRecruiterFacts,
} from "../../server-handlers/_recruiter-facts";
import { initState, applyAiMove, type NegotiationBand } from "../../server-handlers/_negotiation-kernel";

describe("Bug 7: RECRUITER_FACT_TOKENS", () => {
  it("exports the full token set", () => {
    expect(RECRUITER_FACT_TOKENS).toContain("medical-insurance");
    expect(RECRUITER_FACT_TOKENS).toContain("pf");
    expect(RECRUITER_FACT_TOKENS).toContain("gratuity");
    expect(RECRUITER_FACT_TOKENS).toContain("hybrid-work");
    expect(RECRUITER_FACT_TOKENS).toContain("variable-component");
    expect(RECRUITER_FACT_TOKENS.length).toBeGreaterThanOrEqual(11);
  });
});

describe("Bug 7: extractRecruiterFacts", () => {
  it("extracts medical-insurance + pf + gratuity from a benefits paragraph", () => {
    const text = "Our package includes medical insurance, provident fund (PF), and gratuity.";
    const tokens = extractRecruiterFacts(text);
    expect(tokens).toContain("medical-insurance");
    expect(tokens).toContain("pf");
    expect(tokens).toContain("gratuity");
  });
  it("extracts hybrid-work", () => {
    expect(extractRecruiterFacts("3 days hybrid model on Tue/Wed/Thu")).toContain("hybrid-work");
  });
  it("extracts variable-component", () => {
    expect(extractRecruiterFacts("₹3L variable bonus annually")).toContain("variable-component");
  });
  it("returns empty array on plain text", () => {
    expect(extractRecruiterFacts("Welcome to the call.")).toEqual([]);
  });
});

describe("Bug 7: state.recruiterFactsAlreadySaid integration", () => {
  const band: NegotiationBand = { initialOffer: 22, maxStretch: 28, walkAway: 18, hasEquity: false };

  it("starts empty", () => {
    const s = initState({ sessionId: "x", role: "react", company: "Infosys", band });
    expect(s.recruiterFactsAlreadySaid).toEqual([]);
  });

  it("accumulates facts across AI moves", () => {
    let s = initState({ sessionId: "x", role: "react", company: "Infosys", band });
    s = applyAiMove(
      s,
      { lever: "benefits-summary", newTotalLpa: 22, rationale: "explain perks" },
      "Our offer includes medical insurance and provident fund.",
    );
    expect(s.recruiterFactsAlreadySaid).toContain("medical-insurance");
    expect(s.recruiterFactsAlreadySaid).toContain("pf");

    s = applyAiMove(
      s,
      { lever: "compensation-summary", newTotalLpa: 22, rationale: "comp" },
      "Variable component is 15% on top, plus gratuity.",
    );
    expect(s.recruiterFactsAlreadySaid).toContain("variable-component");
    expect(s.recruiterFactsAlreadySaid).toContain("gratuity");
  });

  it("does not duplicate tokens", () => {
    let s = initState({ sessionId: "x", role: "react", company: "Infosys", band });
    s = applyAiMove(
      s,
      { lever: "benefits-summary", newTotalLpa: 22, rationale: "x" },
      "Medical insurance covered.",
    );
    s = applyAiMove(
      s,
      { lever: "benefits-summary", newTotalLpa: 22, rationale: "x" },
      "Medical insurance is part of the package.",
    );
    const count = s.recruiterFactsAlreadySaid.filter((t) => t === "medical-insurance").length;
    expect(count).toBe(1);
  });
});

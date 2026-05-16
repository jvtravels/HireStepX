/* Polish 3 (2026-05-16) — expand market-data reference acknowledgement.
 *
 * Previously `referencedMarketData` detected AmbitionBox / Levels.fyi
 * / Glassdoor / Naukri-salary / Payscale / LinkedIn-salary / Blind
 * but the reactive followup line was hardcoded to mention
 * "AmbitionBox/Levels.fyi" regardless of what the candidate actually
 * cited. Indian candidates also cite Naukri (separately from Naukri
 * Salary), Blind India / Blind app, Glassdoor India, IIM Jobs (for
 * senior roles), Cutshort, Indeed.
 *
 * Now:
 *   - the detector recognises the full set
 *   - the planner stores the SOURCES the candidate actually named on
 *     `candidateProfile.referencedMarketDataSources`
 *   - the reactive followup names those specific sources (not a
 *     generic "market data") using the `marketDataSources` citation
 *     map
 */
import { describe, it, expect } from "vitest";
import {
  detectReferencedMarketDataSources,
  marketDataSources,
  extractCandidateProfile,
  EMPTY_CANDIDATE_PROFILE,
} from "../../server-handlers/_candidate-profile";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };

describe("detectReferencedMarketDataSources — expanded source detector", () => {
  const cases: { text: string; expected: string[] }[] = [
    { text: "I checked AmbitionBox and saw 28 LPA", expected: ["ambitionbox"] },
    { text: "ambition box numbers say 25", expected: ["ambitionbox"] },
    { text: "levels.fyi puts it at 35", expected: ["levels.fyi"] },
    { text: "levels fyi shows that range", expected: ["levels.fyi"] },
    { text: "Glassdoor India says 30", expected: ["glassdoor"] },
    { text: "Naukri listings for SDE3 show 32", expected: ["naukri"] },
    { text: "I saw it on Blind India", expected: ["blind"] },
    { text: "the Blind app salary list says", expected: ["blind"] },
    { text: "Cutshort has the band", expected: ["cutshort"] },
    { text: "IIM Jobs listed it", expected: ["iimjobs"] },
    { text: "iimjobs.com showed", expected: ["iimjobs"] },
    { text: "payscale data suggests", expected: ["payscale"] },
    { text: "indeed says 30 LPA", expected: ["indeed"] },
  ];
  for (const { text, expected } of cases) {
    it(`detects ${expected.join(",")} in "${text.slice(0, 40)}..."`, () => {
      const sources = detectReferencedMarketDataSources(text);
      for (const e of expected) expect(sources).toContain(e);
    });
  }

  it("detects multiple sources in a single utterance", () => {
    const sources = detectReferencedMarketDataSources(
      "I checked Naukri and Blind for this role",
    );
    expect(sources).toContain("naukri");
    expect(sources).toContain("blind");
  });

  it("returns [] when no source is named", () => {
    expect(detectReferencedMarketDataSources("I think 30 is fair")).toEqual([]);
  });
});

describe("marketDataSources — citation phrasing per source", () => {
  it("AmbitionBox phrasing exists and is non-empty", () => {
    expect(marketDataSources.ambitionbox).toMatch(/AmbitionBox/i);
  });
  it("Levels.fyi phrasing", () => {
    expect(marketDataSources["levels.fyi"]).toMatch(/Levels\.fyi/i);
  });
  it("Naukri phrasing", () => {
    expect(marketDataSources.naukri).toMatch(/Naukri/i);
  });
  it("Blind phrasing", () => {
    expect(marketDataSources.blind).toMatch(/Blind/i);
  });
  it("IIM Jobs phrasing", () => {
    expect(marketDataSources.iimjobs).toMatch(/IIM\s*Jobs/i);
  });
  it("Cutshort phrasing", () => {
    expect(marketDataSources.cutshort).toMatch(/Cutshort/i);
  });
});

describe("extractCandidateProfile — wires referencedMarketDataSources", () => {
  it("populates referencedMarketDataSources from text", () => {
    const p = extractCandidateProfile("I checked Naukri and Blind for this role");
    expect(p.referencedMarketData).toBe(true);
    expect(p.referencedMarketDataSources).toContain("naukri");
    expect(p.referencedMarketDataSources).toContain("blind");
  });
});

describe("planner — reactive followup names the cited sources", () => {
  it("candidate said 'I checked Naukri and Blind' → canonical mentions Naukri AND Blind", () => {
    const s: NegotiationState = {
      ...initState({ sessionId: "s-md", role: "swe", company: "acme", band: BAND }),
      phase: "lever-explore",
      highestOfferMade: 22,
      turnIndex: 4,
      candidateProfile: {
        ...EMPTY_CANDIDATE_PROFILE,
        hasAny: true,
        referencedMarketData: true,
        referencedMarketDataSources: ["naukri", "blind"],
      },
    };
    const action = planNextAction(s);
    expect(action.kind).toBe("reactive-followup");
    if (action.kind === "reactive-followup") {
      expect(action.topic).toBe("market-data-reference");
      expect(action.ask).toMatch(/Naukri/i);
      expect(action.ask).toMatch(/Blind/i);
    }
  });

  it("when no sources are cited the line falls back to the generic phrasing", () => {
    const s: NegotiationState = {
      ...initState({ sessionId: "s-md2", role: "swe", company: "acme", band: BAND }),
      phase: "lever-explore",
      highestOfferMade: 22,
      turnIndex: 4,
      candidateProfile: {
        ...EMPTY_CANDIDATE_PROFILE,
        hasAny: true,
        referencedMarketData: true,
        referencedMarketDataSources: [],
      },
    };
    const action = planNextAction(s);
    expect(action.kind).toBe("reactive-followup");
    if (action.kind === "reactive-followup") {
      expect(action.topic).toBe("market-data-reference");
      // Generic fallback still asks which source.
      expect(action.ask).toMatch(/market data/i);
    }
  });
});

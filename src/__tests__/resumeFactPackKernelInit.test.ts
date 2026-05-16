import { describe, it, expect } from "vitest";
import { initState, serializeState, deserializeState } from "../../server-handlers/_negotiation-kernel";
import type { ParsedResume } from "../../server-handlers/_resume-fact-pack";

function baseInit(extra: Record<string, unknown> = {}) {
  return {
    sessionId: "test-session",
    role: "Software Engineer",
    company: "Acme",
    band: { initialOffer: 20, maxStretch: 28, walkAway: 16, displayLabel: "", hasEquity: false },
    ...extra,
  } as Parameters<typeof initState>[0];
}

describe("kernel init — ResumeFactPack threading", () => {
  it("stores a pre-built fact pack on state", () => {
    const pack = {
      priorCompanies: [{ name: "Flipkart", tier: "unicorn" as const, tenureMonths: 24 }],
      stackTags: ["react"],
      tenurePattern: "stable" as const,
      mbaTier: null,
      leadershipClaimed: false,
      gapMonths: null,
      latestRole: { title: "SDE-2", companyName: "Flipkart", companyTier: "unicorn" },
    };
    const s = initState(baseInit({ resumeFactPack: pack }));
    expect(s.resumeFactPack).toEqual(pack);
    /* impliedPriorCtcFromResume should be derived for a unicorn latest role. */
    expect(typeof s.impliedPriorCtcFromResume).toBe("number");
    expect((s.impliedPriorCtcFromResume ?? 0)).toBeGreaterThan(0);
  });

  it("builds the pack from a raw parsed resume", () => {
    const parsedResume: ParsedResume = {
      roles: [
        { companyName: "Cognizant", title: "Programmer Analyst", startDate: "2019-06", endDate: "2022-01" },
        { companyName: "Flipkart", title: "SDE-2", startDate: "2022-02", endDate: null },
      ],
      skills: ["React", "Node.js"],
      education: [],
    };
    const s = initState(baseInit({ parsedResume }));
    expect(s.resumeFactPack).not.toBeNull();
    expect(s.resumeFactPack!.latestRole?.companyName).toBe("Flipkart");
    expect(s.resumeFactPack!.priorCompanies).toHaveLength(2);
  });

  it("defaults to null when no resume context is provided", () => {
    const s = initState(baseInit());
    expect(s.resumeFactPack ?? null).toBeNull();
    expect(s.impliedPriorCtcFromResume ?? null).toBeNull();
  });

  it("preserves the pack across serialize/deserialize", () => {
    const parsedResume: ParsedResume = {
      roles: [{ companyName: "Google", startDate: "2023-01", endDate: null, title: "SWE" }],
      skills: ["Python"],
    };
    const s1 = initState(baseInit({ parsedResume }));
    const json = serializeState(s1);
    const s2 = deserializeState(json);
    expect(s2.resumeFactPack?.latestRole?.companyName).toBe("Google");
    expect(s2.impliedPriorCtcFromResume).toBe(s1.impliedPriorCtcFromResume);
  });

  it("legacy serialized snapshots without the field deserialize to null", () => {
    const s = initState(baseInit());
    const json = serializeState(s);
    const obj = JSON.parse(json);
    delete obj.resumeFactPack;
    delete obj.impliedPriorCtcFromResume;
    const s2 = deserializeState(JSON.stringify(obj));
    expect(s2.resumeFactPack ?? null).toBeNull();
    expect(s2.impliedPriorCtcFromResume ?? null).toBeNull();
  });
});

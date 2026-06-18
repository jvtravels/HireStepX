import { describe, it, expect } from "vitest";
import { initState } from "../../server-handlers/_negotiation-kernel";
import { deriveCandidateProfileSeed, type ResumeFactPack } from "../../server-handlers/_resume-fact-pack";

function baseInit(extra: Record<string, unknown> = {}) {
  return {
    sessionId: "test-session",
    role: "Software Engineer",
    company: "Acme",
    band: { initialOffer: 20, maxStretch: 28, walkAway: 16, displayLabel: "", hasEquity: false },
    ...extra,
  } as Parameters<typeof initState>[0];
}

function makePack(over: Partial<ResumeFactPack> = {}): ResumeFactPack {
  return {
    priorCompanies: [],
    stackTags: [],
    tenurePattern: "unknown",
    mbaTier: null,
    leadershipClaimed: false,
    gapMonths: null,
    topAchievement: null,
    latestRole: null,
    ...over,
  };
}

describe("deriveCandidateProfileSeed", () => {
  it("maps frequent-switcher → tenureSignal=frequent", () => {
    const seed = deriveCandidateProfileSeed(makePack({ tenurePattern: "frequent-switcher" }));
    expect(seed.tenureSignal).toBe("frequent");
  });
  it("maps stable → tenureSignal=stable", () => {
    const seed = deriveCandidateProfileSeed(makePack({ tenurePattern: "stable" }));
    expect(seed.tenureSignal).toBe("stable");
  });
  it("leadershipClaimed → peopleManagementClaimed", () => {
    const seed = deriveCandidateProfileSeed(makePack({ leadershipClaimed: true }));
    expect(seed.peopleManagementClaimed).toBe(true);
  });
  it("top-tier-domestic MBA → domesticTopMbaAnchor", () => {
    const seed = deriveCandidateProfileSeed(makePack({ mbaTier: "top-tier-domestic" }));
    expect(seed.domesticTopMbaAnchor).toBe(true);
  });
  it("any faang/indian-product prior → mncExperience", () => {
    const seed = deriveCandidateProfileSeed(makePack({
      priorCompanies: [{ name: "Google", tier: "faang", tenureMonths: 24 }],
    }));
    expect(seed.mncExperience).toBe(true);
    const seed2 = deriveCandidateProfileSeed(makePack({
      priorCompanies: [{ name: "Freshworks", tier: "indian-product", tenureMonths: 36 }],
    }));
    expect(seed2.mncExperience).toBe(true);
  });
  it("null pack → all-false seed", () => {
    const seed = deriveCandidateProfileSeed(null);
    expect(seed).toEqual({
      tenureSignal: null,
      peopleManagementClaimed: false,
      domesticTopMbaAnchor: false,
      mncExperience: false,
    });
  });
});

describe("initState — candidateProfile pre-seed with provenance", () => {
  it("seeds tenureSignal + provenance from a frequent-switcher pack", () => {
    const s = initState(baseInit({
      resumeFactPack: makePack({ tenurePattern: "frequent-switcher" }),
    }));
    expect(s.candidateProfile.tenureSignal).toBe("frequent");
    expect(s.flagProvenance?.tenureSignal).toBe("resume");
  });

  it("seeds peopleManagementClaimed when leadershipClaimed", () => {
    const s = initState(baseInit({
      resumeFactPack: makePack({ leadershipClaimed: true }),
    }));
    expect(s.candidateProfile.peopleManagementClaimed).toBe(true);
    expect(s.flagProvenance?.peopleManagementClaimed).toBe("resume");
  });

  it("seeds domesticTopMbaAnchor for IIM-A grad", () => {
    const s = initState(baseInit({
      resumeFactPack: makePack({ mbaTier: "top-tier-domestic" }),
    }));
    expect(s.candidateProfile.domesticTopMbaAnchor).toBe(true);
    expect(s.flagProvenance?.domesticTopMbaAnchor).toBe("resume");
  });

  it("records mncExperience provenance even though no profile flag exists", () => {
    const s = initState(baseInit({
      resumeFactPack: makePack({
        priorCompanies: [{ name: "Google", tier: "faang", tenureMonths: 36 }],
      }),
    }));
    expect(s.flagProvenance?.mncExperience).toBe("resume");
  });

  it("flagProvenance is empty when no resume pack supplied", () => {
    const s = initState(baseInit());
    expect(s.flagProvenance ?? {}).toEqual({});
  });
});

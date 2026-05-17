/* ResumeFactPack track — Step 6 (2026-05-16).
 *
 * The FactPack now surfaces resume-derived facts (latestCompany, latestRole,
 * YoE range text) when the kernel was initialised with a ResumeFactPack.
 */
import { describe, it, expect } from "vitest";
import { buildFactPack } from "../../server-handlers/_fact-pack";
import {
  initState,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import type { ResumeFactPack } from "../../server-handlers/_resume-fact-pack";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: false,
};

function makePack(extras: Partial<ResumeFactPack> = {}): ResumeFactPack {
  return {
    priorCompanies: [{ name: "Flipkart", tier: "unicorn", tenureMonths: 36 }],
    stackTags: ["react"],
    tenurePattern: "stable",
    mbaTier: null,
    leadershipClaimed: false,
    gapMonths: null,
    latestRole: { title: "SDE-2", companyName: "Flipkart", companyTier: "unicorn" },
    ...extras,
  };
}

describe("FactPack — resume projection", () => {
  it("omits resume fields when no pack present", () => {
    const s = initState({ sessionId: "x", role: "swe", company: "Acme", band: BAND });
    const pack = buildFactPack(s);
    expect(pack.resumeLatestCompany).toBeUndefined();
    expect(pack.resumeLatestRole).toBeUndefined();
    expect(pack.resumeYoeRangeText).toBeUndefined();
  });

  it("projects latestRole + company + total YoE when pack present", () => {
    const s = initState({
      sessionId: "x",
      role: "swe",
      company: "Acme",
      band: BAND,
      resumeFactPack: makePack(),
    });
    const pack = buildFactPack(s);
    expect(pack.resumeLatestCompany).toBe("Flipkart");
    expect(pack.resumeLatestRole).toBe("SDE-2");
    expect(pack.resumeYoeRangeText).toMatch(/3/); // 36 months → 3 years
  });

  it("sums tenure across multiple prior companies for YoE range", () => {
    const s = initState({
      sessionId: "x",
      role: "swe",
      company: "Acme",
      band: BAND,
      resumeFactPack: makePack({
        priorCompanies: [
          { name: "Flipkart", tier: "unicorn", tenureMonths: 30 },
          { name: "Infosys", tier: "service", tenureMonths: 24 },
        ],
      }),
    });
    const pack = buildFactPack(s);
    /* 54 months → 4.5 years; floor(4.5*2)/2 = 4.5, ceil(4.5*2)/2 = 4.5 → "4.5 years" */
    expect(pack.resumeYoeRangeText).toBe("4.5 years");
  });

  it("omits resumeYoeRangeText when no tenure data", () => {
    const s = initState({
      sessionId: "x",
      role: "swe",
      company: "Acme",
      band: BAND,
      resumeFactPack: makePack({
        priorCompanies: [{ name: "Flipkart", tier: "unicorn", tenureMonths: 0 }],
      }),
    });
    const pack = buildFactPack(s);
    expect(pack.resumeYoeRangeText).toBeUndefined();
  });
});

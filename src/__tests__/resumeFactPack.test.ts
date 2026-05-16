import { describe, it, expect } from "vitest";
import {
  buildResumeFactPack,
  classifyResumeCompanyTier,
  fuzzyCompanyMatch,
  normalizeCompanyName,
  resumeConfirmsCompany,
  type ParsedResume,
} from "../../server-handlers/_resume-fact-pack";

/* Synthetic "now" — May 2026 — so date math is deterministic across CI. */
const NOW = new Date(Date.UTC(2026, 4 /* May */, 16));

function pack(p: ParsedResume) {
  return buildResumeFactPack(p, { now: NOW });
}

describe("classifyResumeCompanyTier", () => {
  it("projects big-tech band → faang", () => {
    expect(classifyResumeCompanyTier("Google")).toBe("faang");
    expect(classifyResumeCompanyTier("Microsoft India")).toBe("faang");
  });
  it("projects unicorn band → unicorn", () => {
    expect(classifyResumeCompanyTier("Flipkart")).toBe("unicorn");
    expect(classifyResumeCompanyTier("Swiggy")).toBe("unicorn");
  });
  it("projects product-india / gcc → indian-product", () => {
    expect(classifyResumeCompanyTier("Freshworks")).toBe("indian-product");
    expect(classifyResumeCompanyTier("JPMC")).toBe("indian-product");
  });
  it("projects it-services / consulting → service", () => {
    expect(classifyResumeCompanyTier("Cognizant")).toBe("service");
    expect(classifyResumeCompanyTier("McKinsey")).toBe("service");
  });
  it("returns unknown for blank / SME", () => {
    expect(classifyResumeCompanyTier("")).toBe("unknown");
    expect(classifyResumeCompanyTier(null)).toBe("unknown");
  });
});

describe("buildResumeFactPack — priorCompanies", () => {
  it("annotates each role with tier and tenureMonths", () => {
    const p = pack({
      roles: [
        { companyName: "Google", title: "SWE", startDate: "2022-01", endDate: "2024-01" },
        { companyName: "Cognizant", title: "Programmer Analyst", startDate: "2019-06", endDate: "2021-12" },
      ],
    });
    expect(p.priorCompanies).toHaveLength(2);
    expect(p.priorCompanies[0]).toEqual({ name: "Google", tier: "faang", tenureMonths: 24 });
    expect(p.priorCompanies[1]).toEqual({ name: "Cognizant", tier: "service", tenureMonths: 30 });
  });

  it("treats null endDate as ongoing (now)", () => {
    const p = pack({
      roles: [{ companyName: "Flipkart", title: "SDE-2", startDate: "2024-05", endDate: null }],
    });
    expect(p.priorCompanies[0].tier).toBe("unicorn");
    expect(p.priorCompanies[0].tenureMonths).toBe(24);
  });
});

describe("buildResumeFactPack — stackTags", () => {
  it("canonicalises a typical react/node skill list", () => {
    const p = pack({ skills: ["React.js", "Node.js", "TypeScript", "AWS", "Kubernetes"] });
    expect(p.stackTags).toEqual(expect.arrayContaining(["react", "node", "typescript", "aws", "kubernetes"]));
  });

  it("canonicalises a python/java backend skill list", () => {
    const p = pack({ skills: ["Spring Boot", "Java", "Python", "FastAPI", "PostgreSQL"] });
    expect(p.stackTags).toEqual(expect.arrayContaining(["java", "python", "postgres"]));
  });
});

describe("buildResumeFactPack — tenurePattern", () => {
  it("frequent-switcher when 3+ roles in last 24mo", () => {
    const p = pack({
      roles: [
        { companyName: "A", startDate: "2025-01", endDate: "2025-06" },
        { companyName: "B", startDate: "2025-07", endDate: "2025-12" },
        { companyName: "C", startDate: "2026-01", endDate: null },
      ],
    });
    expect(p.tenurePattern).toBe("frequent-switcher");
  });

  it("stable when a single role >= 36 months", () => {
    const p = pack({
      roles: [{ companyName: "Infosys", startDate: "2018-01", endDate: "2024-01" }],
    });
    expect(p.tenurePattern).toBe("stable");
  });
});

describe("buildResumeFactPack — mbaTier", () => {
  it("recognises IIM-A as top-tier-domestic", () => {
    const p = pack({ education: [{ degree: "MBA", institution: "IIM Ahmedabad", type: "MBA" }] });
    expect(p.mbaTier).toBe("top-tier-domestic");
  });
  it("recognises ISB as top-tier-domestic", () => {
    const p = pack({ education: [{ degree: "PGP", institution: "ISB Hyderabad", type: "PGP" }] });
    expect(p.mbaTier).toBe("top-tier-domestic");
  });
  it("recognises lesser MBA as other", () => {
    const p = pack({ education: [{ degree: "MBA", institution: "Random Business School", type: "MBA" }] });
    expect(p.mbaTier).toBe("other");
  });
  it("null when no MBA", () => {
    const p = pack({ education: [{ degree: "B.Tech", institution: "IIT Bombay", type: "B.Tech" }] });
    expect(p.mbaTier).toBeNull();
  });
});

describe("buildResumeFactPack — leadershipClaimed", () => {
  it("fires on 'led team of 8'", () => {
    const p = pack({
      roles: [{ companyName: "X", description: "Led team of 8 engineers across two product lines." }],
    });
    expect(p.leadershipClaimed).toBe(true);
  });
  it("fires on 'managed 5 direct reports'", () => {
    const p = pack({ rawText: "Managed 5 direct reports during 2023." });
    expect(p.leadershipClaimed).toBe(true);
  });
  it("does not fire for an IC description", () => {
    const p = pack({
      roles: [{ companyName: "X", description: "Built the payments microservice in Java." }],
    });
    expect(p.leadershipClaimed).toBe(false);
  });
});

describe("buildResumeFactPack — gapMonths", () => {
  it("computes longest gap between roles", () => {
    const p = pack({
      roles: [
        { companyName: "A", startDate: "2018-01", endDate: "2019-06" },
        { companyName: "B", startDate: "2020-06", endDate: "2022-01" }, // 12mo gap
        { companyName: "C", startDate: "2022-08", endDate: "2024-01" }, // 7mo gap
      ],
    });
    expect(p.gapMonths).toBe(12);
  });
  it("null when 0 or 1 role", () => {
    expect(pack({ roles: [] }).gapMonths).toBeNull();
    expect(pack({ roles: [{ companyName: "A", startDate: "2020-01", endDate: "2024-01" }] }).gapMonths).toBeNull();
  });
});

describe("buildResumeFactPack — latestRole", () => {
  it("returns the most-recent role by endDate", () => {
    const p = pack({
      roles: [
        { companyName: "Cognizant", title: "PA", startDate: "2019-06", endDate: "2021-12" },
        { companyName: "Flipkart", title: "SDE-2", startDate: "2022-01", endDate: null },
      ],
    });
    expect(p.latestRole).toEqual({
      title: "SDE-2",
      companyName: "Flipkart",
      companyTier: "unicorn",
    });
  });
  it("null when no roles", () => {
    expect(pack({ roles: [] }).latestRole).toBeNull();
  });
});

describe("fuzzyCompanyMatch / resumeConfirmsCompany", () => {
  it("matches with suffix stripped", () => {
    expect(fuzzyCompanyMatch("Flipkart Pvt Ltd", "Flipkart")).toBe(true);
    expect(fuzzyCompanyMatch("Google Inc.", "google")).toBe(true);
    expect(normalizeCompanyName("Google Inc.")).toBe("google");
  });

  it("does not match unrelated names", () => {
    expect(fuzzyCompanyMatch("Cognizant", "Google")).toBe(false);
  });

  it("resumeConfirmsCompany works against latestRole and priorCompanies", () => {
    const p = pack({
      roles: [
        { companyName: "Cognizant", startDate: "2018-01", endDate: "2021-01" },
        { companyName: "Flipkart Pvt Ltd", startDate: "2021-02", endDate: null },
      ],
    });
    expect(resumeConfirmsCompany(p, "Flipkart")).toBe(true);
    expect(resumeConfirmsCompany(p, "Cognizant")).toBe(true);
    expect(resumeConfirmsCompany(p, "Google")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { backgroundFitRow, budgetRangeLpa, buildDecisionBrief, parsePayRangeLpa, payFitRow, poolStanding, scoreReason, workModeFitRow } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/fitExtras";

const cand = (resume: Record<string, unknown> = {}): any => ({ id: "c", matchScore: 70, resume: { education: [], experience: [], industries: [], ...resume } });
const req = (o: Record<string, unknown> = {}): any => ({ budgetMin: 15, budgetMax: 20, salaryType: "per-annum", workMode: "hybrid", preferredColleges: [], targetCompanies: [], preferredIndustry: "", ...o });

describe("parsePayRangeLpa", () => {
  it("reads lakhs, ranges, rupees and crores", () => {
    expect(parsePayRangeLpa("20-26 LPA")).toEqual({ min: 20, max: 26 });
    expect(parsePayRangeLpa("₹24,00,000")).toEqual({ min: 24, max: 24 });
    expect(parsePayRangeLpa("1.2 Cr")).toEqual({ min: 120, max: 120 });
    expect(parsePayRangeLpa("18L")).toEqual({ min: 18, max: 18 });
  });
  it("returns null for nothing usable", () => {
    expect(parsePayRangeLpa("negotiable")).toBeNull();
    expect(parsePayRangeLpa(null)).toBeNull();
  });
});

describe("budgetRangeLpa", () => {
  it("converts monthly pay to yearly lakhs and skips fixed fees", () => {
    expect(budgetRangeLpa({ budgetMin: 50000, budgetMax: 100000, salaryType: "per-month" })).toEqual({ min: 6, max: 12 });
    expect(budgetRangeLpa({ budgetMin: 5000, budgetMax: 9000, salaryType: "fixed" })).toBeNull();
    expect(budgetRangeLpa({ budgetMin: null, budgetMax: null, salaryType: "per-annum" })).toBeNull();
  });
});

describe("payFitRow", () => {
  it("meets, partly meets and misses the budget", () => {
    expect(payFitRow(cand({ expectedCtc: "18 LPA" }), req())?.status).toBe("meets");
    expect(payFitRow(cand({ expectedCtcBand: "₹18–24 LPA" }), req())?.status).toBe("partial");
    expect(payFitRow(cand({ expectedCtc: "28 LPA" }), req())?.status).toBe("gap");
  });
  it("adds no row without a figure, a ceiling or a comparable budget", () => {
    expect(payFitRow(cand(), req())).toBeNull();
    expect(payFitRow(cand({ expectedCtc: "18 LPA" }), req({ budgetMax: null }))).toBeNull();
    expect(payFitRow(cand({ expectedCtc: "18 LPA" }), req({ salaryType: "fixed" }))).toBeNull();
  });
});

describe("workModeFitRow", () => {
  it("compares preference with the job", () => {
    expect(workModeFitRow(cand({ workModePref: "hybrid" }), req())?.status).toBe("meets");
    expect(workModeFitRow(cand({ workModePref: "remote" }), req({ workMode: "onsite" }))?.status).toBe("gap");
    expect(workModeFitRow(cand({ workModePref: "onsite" }), req())?.status).toBe("partial");
    expect(workModeFitRow(cand(), req())).toBeNull();
  });
});

describe("backgroundFitRow", () => {
  it("shows only matches and never a gap", () => {
    const row = backgroundFitRow(
      cand({ education: [{ school: "Indian Institute of Technology Bombay", degree: "", year: "" }], experience: [{ company: "Infosys Ltd", title: "", period: "" }], industries: ["Fintech"] }),
      req({ preferredColleges: ["Indian Institute of Technology Bombay"], targetCompanies: ["Infosys"], preferredIndustry: "Fintech" }),
    );
    expect(row?.status).toBe("meets");
    expect(row?.has).toMatch(/studied at.*worked at.*fintech/i);
    expect(backgroundFitRow(cand(), req({ preferredColleges: ["IIT"] }))).toBeNull();
  });
});

describe("poolStanding and brief", () => {
  it("needs four others to compare", () => {
    expect(poolStanding(70, [{ matchScore: 1 }, { matchScore: 2 }])).toBeNull();
    expect(poolStanding(70, [10, 20, 80, 90].map((matchScore) => ({ matchScore })))).toEqual({ below: 2, total: 4 });
  });
  it("puts gaps before near misses", () => {
    const b = buildDecisionBrief([
      { id: "a", label: "A", asked: "", has: "ok", status: "meets", reason: "", source: "resume" },
      { id: "b", label: "B", asked: "", has: "close", status: "partial", reason: "", source: "resume" },
      { id: "c", label: "C", asked: "", has: "far", status: "gap", reason: "", source: "resume" },
    ]);
    expect(b.strengths).toEqual(["A: ok"]);
    expect(b.risks.map((r) => r.gap)).toEqual([true, false]);
  });
});

describe("scoreReason", () => {
  const row = (id: string, label: string, status: string): any => ({ id, label, status, asked: "", has: "", reason: "", source: "resume" });
  it("states criteria met, gaps and the resume-only caveat", () => {
    const rows = [row("a", "Experience", "meets"), row("b", "Required skills", "gap"), row("c", "Location", "gap")];
    expect(scoreReason(rows, false)).toBe("1 of 3 criteria fully met, gaps in required skills and location. No graded practice yet, so this reflects the resume only.");
  });
  it("drops the caveat when practice exists and returns null without criteria", () => {
    expect(scoreReason([row("a", "Experience", "meets")], true)).toBe("1 of 1 criterion fully met.");
    expect(scoreReason([], true)).toBeNull();
  });
});

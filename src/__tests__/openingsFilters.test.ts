import { describe, it, expect } from "vitest";
import { departmentOf, matchesOpeningSearch, type PublicOpening } from "../../server-handlers/_public-openings-helpers";

const base: PublicOpening = {
  slug: "a", title: "Sales Development Representative", summary: "", location: "Remote (India)", workMode: "remote",
  experienceMin: 1, experienceMax: 2, skills: ["HubSpot", "Apollo"], employmentType: "full-time",
  listedAt: "2026-10-30T00:00:00.000Z", expiresAt: "2026-12-14T00:00:00.000Z",
};

describe("openings filters", () => {
  it("falls back to other when the department is missing or unknown", () => {
    expect(departmentOf(base)).toBe("other");
    expect(departmentOf({ ...base, department: "nonsense" })).toBe("other");
    expect(departmentOf({ ...base, department: "sales" })).toBe("sales");
  });
  it("matches every term across title, skills, location and department", () => {
    const o = { ...base, department: "sales" };
    expect(matchesOpeningSearch(o, "")).toBe(true);
    expect(matchesOpeningSearch(o, "hubspot remote")).toBe(true);
    expect(matchesOpeningSearch(o, "SALES india")).toBe(true);
    expect(matchesOpeningSearch(o, "hubspot python")).toBe(false);
  });
});

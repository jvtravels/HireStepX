/* REPORT-1/2 regression guard (2026-06-27).
 *
 * The report's "Level" pill previously did
 * `calibration.companyLabel.split(" ").slice(-1)[0]`, which leaked the
 * COMPANY name (or its last token) into the seniority slot — e.g. a
 * "Flipkart" calibration label rendered Level "Flipkart". The hero
 * sentence then read "For Flipkart Senior Product Designer at Flipkart".
 *
 * `deriveSeniorityLevel(role)` replaces that: it reads the seniority band
 * out of the ROLE string and returns "" when none is present (so the pill
 * and the interpolation guards drop it cleanly rather than printing junk). */
import { describe, it, expect } from "vitest";
import { deriveSeniorityLevel } from "../sessionReport/adapter";

describe("deriveSeniorityLevel", () => {
  it("returns '' for an empty/levelless role (pill is dropped)", () => {
    expect(deriveSeniorityLevel("")).toBe("");
    expect(deriveSeniorityLevel("Product Designer")).toBe("");
    expect(deriveSeniorityLevel("Software Engineer")).toBe("");
  });

  it("extracts common seniority bands from the role", () => {
    expect(deriveSeniorityLevel("Senior Product Designer")).toBe("Senior");
    expect(deriveSeniorityLevel("Sr. Backend Engineer")).toBe("Senior");
    expect(deriveSeniorityLevel("Staff Software Engineer")).toBe("Staff");
    expect(deriveSeniorityLevel("Principal Engineer")).toBe("Principal");
    expect(deriveSeniorityLevel("Engineering Manager")).toBe("Manager");
    expect(deriveSeniorityLevel("Lead Designer")).toBe("Lead");
    expect(deriveSeniorityLevel("Director of Product")).toBe("Director");
    expect(deriveSeniorityLevel("Associate Consultant")).toBe("Associate");
    expect(deriveSeniorityLevel("Junior Developer")).toBe("Junior");
    expect(deriveSeniorityLevel("Intern, Data Science")).toBe("Intern");
  });

  it("prefers the more specific band when both match", () => {
    // "Senior Manager" must not collapse to bare "Senior" or "Manager".
    expect(deriveSeniorityLevel("Senior Manager, Ops")).toBe("Senior Manager");
    // VP / SVP / EVP precedence over a bare "President"/"Manager" token.
    expect(deriveSeniorityLevel("VP of Engineering")).toBe("VP");
    expect(deriveSeniorityLevel("Senior Vice President, Sales")).toBe("SVP");
  });

  it("is case-insensitive and never leaks a company token", () => {
    expect(deriveSeniorityLevel("senior data scientist")).toBe("Senior");
    // A company-only string yields no band → "".
    expect(deriveSeniorityLevel("Flipkart")).toBe("");
  });
});

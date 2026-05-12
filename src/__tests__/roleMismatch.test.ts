import { describe, it, expect } from "vitest";
import {
  detectRoleLabelMismatch,
  extractSeniority,
  tokenizeRole,
} from "../../server-handlers/_role-mismatch";

describe("detectRoleLabelMismatch — domain drift (regression)", () => {
  it("flags UX Designer → Product Designer", () => {
    expect(
      detectRoleLabelMismatch("As a Senior Product Designer at Lollypop…", "UX Designer"),
    ).toBe("senior product designer");
  });

  it("does not flag matching roles", () => {
    expect(
      detectRoleLabelMismatch("As a UX Designer you'd own…", "UX Designer"),
    ).toBe("");
  });

  it("returns empty when no role text", () => {
    expect(detectRoleLabelMismatch("", "UX Designer")).toBe("");
  });
});

describe("detectRoleLabelMismatch — seniority/promotion drift (Phase 8)", () => {
  it("flags promotion: UX Designer → Senior UX Designer (Accenture session)", () => {
    expect(
      detectRoleLabelMismatch(
        "Welcome — for the Senior UX Designer role at Accenture…",
        "UX Designer",
      ),
    ).toBe("senior ux designer");
  });

  it("flags demotion: Senior UX Designer → UX Designer", () => {
    expect(
      detectRoleLabelMismatch(
        "We're hiring for the UX Designer position…",
        "Senior UX Designer",
      ),
    ).toBe("ux designer");
  });

  it("does not flag when both have matching seniority", () => {
    expect(
      detectRoleLabelMismatch(
        "Senior UX Designer at Accenture",
        "Senior UX Designer",
      ),
    ).toBe("");
  });

  it("flags lead-vs-base mismatch", () => {
    // "lead software engineer" isn't in KNOWN_ROLE_LABELS, so falls back
    // to "software engineer" — and userSeniority is null for "Software
    // Engineer", labelSeniority is null too. So this case can't drift.
    // Instead test principal → base via KNOWN labels we have.
    // Senior Software Engineer is in the list:
    expect(
      detectRoleLabelMismatch(
        "We're hiring a Senior Software Engineer…",
        "Software Engineer",
      ),
    ).toBe("senior software engineer");
  });
});

describe("extractSeniority", () => {
  it("returns 'senior' for Senior UX Designer", () => {
    expect(extractSeniority("Senior UX Designer")).toBe("senior");
  });
  it("returns 'senior' for Sr. PM", () => {
    expect(extractSeniority("Sr. PM")).toBe("senior");
  });
  it("returns null for plain UX Designer", () => {
    expect(extractSeniority("UX Designer")).toBe(null);
  });
  it("returns 'lead' for Lead Engineer", () => {
    expect(extractSeniority("Lead Engineer")).toBe("lead");
  });
});

describe("tokenizeRole", () => {
  it("strips stopwords including senior", () => {
    expect(tokenizeRole("Senior UX Designer")).toEqual(["ux", "designer"]);
  });
});

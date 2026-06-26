import { describe, it, expect } from "vitest";
import { formatRoleWithLevel } from "../sessionReport/roleLabel";

describe("formatRoleWithLevel", () => {
  it("drops a redundant level the role already carries (the live bug)", () => {
    expect(formatRoleWithLevel("Manager", "Engineering Manager")).toBe("Engineering Manager");
  });

  it("keeps a distinct level prefix", () => {
    expect(formatRoleWithLevel("Senior", "Product Designer")).toBe("Senior Product Designer");
  });

  it("collapses a leading-level duplicate", () => {
    expect(formatRoleWithLevel("Senior", "Senior Software Engineer")).toBe("Senior Software Engineer");
  });

  it("matches the level as a whole word, not a substring", () => {
    // "Lead" must not be considered present inside "Leadership Coach".
    expect(formatRoleWithLevel("Lead", "Leadership Coach")).toBe("Lead Leadership Coach");
    expect(formatRoleWithLevel("Lead", "Tech Lead")).toBe("Tech Lead");
  });

  it("is case-insensitive on the redundancy check", () => {
    expect(formatRoleWithLevel("manager", "Engineering MANAGER")).toBe("Engineering MANAGER");
  });

  it("handles missing level or role", () => {
    expect(formatRoleWithLevel("", "Engineering Manager")).toBe("Engineering Manager");
    expect(formatRoleWithLevel("Manager", "")).toBe("Manager");
    expect(formatRoleWithLevel(null, "Designer")).toBe("Designer");
    expect(formatRoleWithLevel("Senior", undefined)).toBe("Senior");
  });
});

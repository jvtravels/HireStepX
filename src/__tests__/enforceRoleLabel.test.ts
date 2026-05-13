import { describe, it, expect } from "vitest";
import { enforceRoleLabel } from "../../server-handlers/_role-label";

describe("enforceRoleLabel", () => {
  it("strips Senior when session role does not include it", () => {
    expect(
      enforceRoleLabel("welcome to our Senior Product Designer role", "Product Designer"),
    ).toBe("welcome to our Product Designer role");
  });

  it("keeps Senior when session role itself starts with Senior", () => {
    expect(
      enforceRoleLabel("our Senior Product Designer role", "Senior Product Designer"),
    ).toBe("our Senior Product Designer role");
  });

  it("strips Lead from prose when session role is plain", () => {
    expect(enforceRoleLabel("Lead Engineer position", "Engineer")).toBe(
      "Engineer position",
    );
  });

  it("is case-insensitive on the adjective and role", () => {
    expect(
      enforceRoleLabel("senior product designer opportunity", "Product Designer"),
    ).toBe("Product Designer opportunity");
  });

  it("leaves unrelated 'senior' prose alone when no role name follows", () => {
    expect(enforceRoleLabel("This is a senior role", "Product Designer")).toBe(
      "This is a senior role",
    );
  });

  it("replaces all occurrences within a single string", () => {
    expect(
      enforceRoleLabel(
        "The Senior Product Designer track and our Lead Product Designer track both apply.",
        "Product Designer",
      ),
    ).toBe(
      "The Product Designer track and our Product Designer track both apply.",
    );
  });

  it("returns input unchanged when sessionRole is empty", () => {
    expect(enforceRoleLabel("Senior Product Designer", "")).toBe(
      "Senior Product Designer",
    );
  });

  it("returns input unchanged when sessionRole is null/undefined-ish", () => {
    // @ts-expect-error — explicit null guard
    expect(enforceRoleLabel("Senior Product Designer", null)).toBe(
      "Senior Product Designer",
    );
    // @ts-expect-error — explicit undefined guard
    expect(enforceRoleLabel("Senior Product Designer", undefined)).toBe(
      "Senior Product Designer",
    );
  });

  it("strips other seniority prefixes (Principal, Staff, Jr., Associate)", () => {
    expect(enforceRoleLabel("Principal Engineer team", "Engineer")).toBe("Engineer team");
    expect(enforceRoleLabel("Staff Engineer team", "Engineer")).toBe("Engineer team");
    expect(enforceRoleLabel("Jr. Engineer team", "Engineer")).toBe("Engineer team");
    expect(enforceRoleLabel("Associate Engineer team", "Engineer")).toBe("Engineer team");
  });

  it("preserves session role's original casing in replacement", () => {
    expect(
      enforceRoleLabel("the senior product designer slot", "Product Designer"),
    ).toBe("the Product Designer slot");
  });
});

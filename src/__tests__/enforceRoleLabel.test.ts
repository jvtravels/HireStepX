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

  /* Bug-report 14 (2026-05-14) — the bug session had sessionRole
   * "Social Media Manager" and the LLM emitted "Senior Social Media
   * Manager". The strip pattern uses \s+ between the adjective and the
   * role, and literal (escaped) spaces inside the role, so multi-word
   * roles must still strip correctly. */
  it("strips Senior from a multi-word session role (Social Media Manager)", () => {
    expect(
      enforceRoleLabel(
        "We're hiring for our Senior Social Media Manager position.",
        "Social Media Manager",
      ),
    ).toBe("We're hiring for our Social Media Manager position.");
  });

  it("strips Lead from a multi-word session role mid-sentence", () => {
    expect(
      enforceRoleLabel(
        "The Lead Customer Success Manager will own the book.",
        "Customer Success Manager",
      ),
    ).toBe("The Customer Success Manager will own the book.");
  });

  it("idempotent on already-clean multi-word role text", () => {
    const clean = "Welcome to the Social Media Manager team.";
    expect(enforceRoleLabel(clean, "Social Media Manager")).toBe(clean);
    /* Run twice — second pass must be a no-op (idempotency contract). */
    expect(enforceRoleLabel(enforceRoleLabel(clean, "Social Media Manager"), "Social Media Manager")).toBe(clean);
  });
});

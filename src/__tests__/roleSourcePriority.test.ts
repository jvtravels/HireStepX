/* Fix 1 (2026-05-15) — Role-source priority.
 *
 * Real session: candidate selected "Customer Success Manager" but the
 * recruiter opened with "for the Senior Product Designer position…"
 * because the kernel pulled the role from the resume title. The fix:
 * session-config-selected role MUST take priority over resume title. */
import { describe, it, expect } from "vitest";
import { selectTargetRole } from "../../server-handlers/_resume-role-match";

describe("selectTargetRole — session config > resume title > default", () => {
  it("prefers session-config target role over resume title", () => {
    expect(
      selectTargetRole({
        sessionTargetRole: "Customer Success Manager",
        resumeTitle: "Senior Product Designer",
      }),
    ).toBe("Customer Success Manager");
  });

  it("falls back to resume title when session-config role is missing", () => {
    expect(
      selectTargetRole({
        sessionTargetRole: null,
        resumeTitle: "Senior Product Designer",
      }),
    ).toBe("Senior Product Designer");
  });

  it("falls back to resume title when session-config role is empty / whitespace", () => {
    expect(
      selectTargetRole({
        sessionTargetRole: "   ",
        resumeTitle: "Software Engineer",
      }),
    ).toBe("Software Engineer");
  });

  it("falls back to default when both session-config and resume are missing", () => {
    expect(
      selectTargetRole({
        sessionTargetRole: null,
        resumeTitle: null,
        defaultRole: "Backend Engineer",
      }),
    ).toBe("Backend Engineer");
  });

  it("falls back to hard-coded 'Software Engineer' when everything is missing", () => {
    expect(selectTargetRole({})).toBe("Software Engineer");
  });

  it("trims whitespace from the selected role", () => {
    expect(
      selectTargetRole({
        sessionTargetRole: "  Customer Success Manager  ",
      }),
    ).toBe("Customer Success Manager");
  });
});

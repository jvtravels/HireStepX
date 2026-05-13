/* Audit Session C — Area 10: enforceRoleLabel combinatorial coverage.
 *
 * The original enforceRoleLabel.test.ts spot-checks a handful of cases.
 * This file is the audit harness: every (seniorityAdjective × sessionRole)
 * pair is exercised in BOTH directions (strip when adj not in session role,
 * preserve when adj is part of session role). Plus negative cases that
 * must NOT be munged.
 *
 * Goal: pin the helper's contract so future regex changes can't silently
 * break either branch.
 */
import { describe, it, expect } from "vitest";
import { enforceRoleLabel } from "../../server-handlers/_role-label";

/* Seniority adjectives the helper recognises — kept in sync with
 * server-handlers/_role-label.ts SENIORITY_ADJECTIVES. */
const SENIORITY_ADJECTIVES = [
  "Senior", "Sr.", "Sr", "Lead", "Principal",
  "Staff", "Junior", "Jr.", "Jr", "Associate",
] as const;

/* Representative session-role display names. Sampled from the role-classifier
 * emit set (data/salaries.ts RoleKey union) — display names rather than
 * the dashed keys, since the helper matches free prose. */
const SESSION_ROLES = [
  "Engineer",
  "Software Engineer",
  "Product Designer",
  "Product Manager",
  "Data Scientist",
  "UX Designer",
  "Frontend Developer",
  "DevOps Engineer",
  "Mobile Developer",
  "Solutions Architect",
] as const;

describe("enforceRoleLabel — combinatorial (adjective × role)", () => {
  describe("strip: adjective NOT in session role → stripped from prose", () => {
    for (const adj of SENIORITY_ADJECTIVES) {
      for (const role of SESSION_ROLES) {
        it(`"${adj} ${role}" with session=${role} → stripped`, () => {
          const input = `For the ${adj} ${role} position, we'd like to offer 35 LPA.`;
          const out = enforceRoleLabel(input, role);
          expect(out).toContain(role);
          expect(out).not.toMatch(new RegExp(`${adj.replace(/\./g, "\\.")}\\s+${role.replace(/\s+/g, "\\s+")}`, "i"));
        });
      }
    }
  });

  describe("preserve: adjective IS part of session role → preserved", () => {
    for (const adj of SENIORITY_ADJECTIVES) {
      for (const role of SESSION_ROLES) {
        it(`"${adj} ${role}" with session="${adj} ${role}" → preserved`, () => {
          const sessionRole = `${adj} ${role}`;
          const input = `For the ${sessionRole} position, we'd like to offer 50 LPA.`;
          const out = enforceRoleLabel(input, sessionRole);
          expect(out).toContain(sessionRole);
        });
      }
    }
  });
});

describe("enforceRoleLabel — negatives that must NOT be munged", () => {
  it("'Senior management endorsed this' (session=Engineer) is unchanged", () => {
    const s = "Senior management endorsed this decision";
    expect(enforceRoleLabel(s, "Engineer")).toBe(s);
  });

  it("'This is a senior role' (no role name) is unchanged", () => {
    const s = "This is a senior role";
    expect(enforceRoleLabel(s, "Product Designer")).toBe(s);
  });

  it("'Lead the team' (Lead as verb, no role name) is unchanged", () => {
    const s = "Lead the team";
    expect(enforceRoleLabel(s, "Engineer")).toBe(s);
  });

  it("'Junior college' (session=Engineer) is unchanged — 'college' is not the session role", () => {
    const s = "Junior college admissions are competitive";
    expect(enforceRoleLabel(s, "Engineer")).toBe(s);
  });
});

describe("enforceRoleLabel — casing + multiplicity", () => {
  it("mixed casing: 'Senior product designer' (target='Product Designer') strips", () => {
    expect(enforceRoleLabel("Senior product designer", "Product Designer"))
      .toBe("Product Designer");
  });

  it("replaces every occurrence in 'Senior Engineer or Senior Engineer role'", () => {
    expect(
      enforceRoleLabel("Senior Engineer or Senior Engineer role", "Engineer"),
    ).toBe("Engineer or Engineer role");
  });
});

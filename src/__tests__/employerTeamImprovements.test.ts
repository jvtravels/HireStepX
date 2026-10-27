import { describe, it, expect } from "vitest";
import { invitesRemainingToday, INVITES_PER_DAY } from "../../server-handlers/_employer-team-helpers";
import { teamChangeCopy } from "../../server-handlers/_employer-team-emails";
import { visibleTo, typesForAudience } from "../notifications/registry";

describe("invitesRemainingToday", () => {
  const now = Date.parse("2026-01-10T12:00:00Z");
  const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();

  it("counts every invite created in the last 24h whatever its state", () => {
    expect(invitesRemainingToday([ago(1), ago(2), ago(30)], now)).toBe(INVITES_PER_DAY - 2);
  });

  it("never goes below zero", () => {
    expect(invitesRemainingToday(Array.from({ length: 40 }, () => ago(1)), now)).toBe(0);
  });
});

describe("teamChangeCopy", () => {
  it("tells a removed person plainly what happened", () => {
    const c = teamChangeCopy({ kind: "removed" }, "Acme", "Priya");
    expect(c.subject).toContain("no longer have access");
    expect(c.message).toContain("Priya removed you from Acme");
  });

  it("names the new role and what it allows", () => {
    const c = teamChangeCopy({ kind: "role_changed", role: "viewer" }, "Acme", "Priya");
    expect(c.heading).toBe("You are now Viewer");
    expect(c.message).toContain("Acme");
  });

  it("announces ownership", () => {
    expect(teamChangeCopy({ kind: "ownership_received" }, "Acme", "Priya").heading).toBe("You now own Acme");
  });
});

describe("team notification types", () => {
  it("are employer-only", () => {
    for (const t of ["team_invite_accepted"] as const) {
      expect(visibleTo(t, "employer")).toBe(true);
      expect(visibleTo(t, "candidate")).toBe(false);
      expect(typesForAudience("employer")).toContain(t);
    }
  });
});

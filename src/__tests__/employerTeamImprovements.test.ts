import { describe, it, expect } from "vitest";
import { parseEmailList, invitesRemainingToday, INVITES_PER_DAY } from "../../server-handlers/_employer-team-helpers";
import { teamChangeCopy } from "../../server-handlers/_employer-team-emails";
import { activityToCsv, type ActivityEvent } from "../employer/teamActivity";
import { visibleTo, typesForAudience } from "../notifications/registry";

describe("parseEmailList", () => {
  it("splits on commas, semicolons, spaces and newlines, lowercases and dedupes", () => {
    const r = parseEmailList("A@x.com, b@y.com;\nB@Y.com  c@z.io");
    expect(r.valid).toEqual(["a@x.com", "b@y.com", "c@z.io"]);
    expect(r.invalid).toEqual([]);
  });

  it("strips angle brackets and quotes, and reports what is not an address", () => {
    const r = parseEmailList('<a@x.com> "b@y.com" nope, c@');
    expect(r.valid).toEqual(["a@x.com", "b@y.com"]);
    expect(r.invalid).toEqual(["nope", "c@"]);
  });

  it("returns nothing for blank input", () => {
    expect(parseEmailList("  ,, \n")).toEqual({ valid: [], invalid: [] });
  });
});

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

describe("activityToCsv", () => {
  const ev = (over: Partial<ActivityEvent>): ActivityEvent => ({
    id: "1", at: "2026-01-10T09:00:00Z", action: "job.created", entityType: "job", entityId: "j1",
    meta: { title: "Senior Engineer" }, actor: { userId: "u1", name: "Priya", removed: false }, ...over,
  });

  it("writes a header and one row per event", () => {
    const lines = activityToCsv([ev({}), ev({ id: "2" })]).split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("When (UTC),Who,Area,What,Action code");
    expect(lines[1]).toContain("Priya");
    expect(lines[1].endsWith("job.created")).toBe(true);
  });

  it("quotes commas and neutralises spreadsheet formulas", () => {
    const row = activityToCsv([ev({ actor: { userId: "u1", name: '=HYPERLINK("x"), Inc', removed: false } })]).split("\r\n")[1];
    expect(row).toContain(`"'=HYPERLINK(""x""), Inc"`);
  });
});

describe("team notification types", () => {
  it("are employer-only", () => {
    for (const t of ["team_invite_accepted", "team_role_changed"] as const) {
      expect(visibleTo(t, "employer")).toBe(true);
      expect(visibleTo(t, "candidate")).toBe(false);
      expect(typesForAudience("employer")).toContain(t);
    }
  });
});

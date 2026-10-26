import { describe, it, expect } from "vitest";
import { describeEvent, groupOfAction, dayBucket, relativeTime, daysUntil } from "../employer/teamActivity";

describe("groupOfAction", () => {
  it("groups by action prefix and defaults to company", () => {
    expect(groupOfAction("member.invited")).toBe("members");
    expect(groupOfAction("job.created")).toBe("jobs");
    expect(groupOfAction("candidate.unlocked")).toBe("candidates");
    expect(groupOfAction("company.profile_updated")).toBe("company");
    expect(groupOfAction("something.else")).toBe("company");
  });
});

describe("describeEvent", () => {
  it("describes an invite with the role", () => {
    expect(describeEvent({ action: "member.invited", meta: { email: "a@b.co", role: "admin" } })).toMatchObject({
      verb: "invited", subject: "a@b.co", detail: "as admin", group: "members",
    });
  });
  it("ignores an unknown role instead of printing it", () => {
    expect(describeEvent({ action: "member.invited", meta: { email: "a@b.co", role: "root" } }).detail).toBeNull();
  });
  it("distinguishes ownership transfer from a role change", () => {
    expect(describeEvent({ action: "member.role_changed", meta: { email: "a@b.co", transfer: true } }).verb).toBe("transferred ownership to");
    expect(describeEvent({ action: "member.role_changed", meta: { email: "a@b.co", to: "viewer" } })).toMatchObject({
      verb: "changed the role of", detail: "to viewer",
    });
  });
  it("notes when a leaver deleted their account", () => {
    expect(describeEvent({ action: "member.left", meta: { accountDeleted: true } }).verb).toBe("left the team (account deleted)");
    expect(describeEvent({ action: "member.left", meta: {} }).verb).toBe("left the team");
  });
  it("falls back to 'a candidate' when the name is withheld", () => {
    expect(describeEvent({ action: "candidate.unlocked", meta: {} }).subject).toBe("a candidate");
    expect(describeEvent({ action: "candidate.unlocked", meta: { candidateName: "Rahul S." } }).subject).toBe("Rahul S.");
  });
  it("labels candidate status changes and the job they are for", () => {
    expect(describeEvent({ action: "candidate.status_changed", meta: { candidateName: "Rahul S.", to: "interviewing", jobTitle: "SDE" } })).toMatchObject({
      verb: "marked", subject: "Rahul S.", detail: "as Interviewing for SDE",
    });
    expect(describeEvent({ action: "candidate.status_changed", meta: { to: "bogus" } }).detail).toBeNull();
  });
  it("labels note edits with the candidate and job", () => {
    expect(describeEvent({ action: "candidate.note_updated", meta: { candidateName: "Rahul S.", jobTitle: "SDE" } })).toMatchObject({
      verb: "updated notes on", subject: "Rahul S.", detail: "for SDE",
    });
    expect(describeEvent({ action: "candidate.note_updated", meta: {} }).subject).toBe("a candidate");
  });
  it("labels pipeline stage moves and job lifecycle", () => {
    expect(describeEvent({ action: "job.stage_changed", meta: { stage: "hired" } }).detail).toBe("to Hired");
    expect(describeEvent({ action: "job.created", meta: { title: "SDE" } })).toMatchObject({ verb: "posted", subject: "SDE" });
    expect(describeEvent({ action: "job.archived", meta: { title: "SDE", reason: "Filled" } }).detail).toBe("Filled");
  });
  it("lists changed company fields and tolerates junk", () => {
    expect(describeEvent({ action: "company.profile_updated", meta: { changed: ["website", 3, "size"] } }).detail).toBe("website, size");
    expect(describeEvent({ action: "company.profile_updated", meta: { changed: "x" } }).detail).toBeNull();
  });
  it("shows an unknown action verbatim rather than hiding it", () => {
    expect(describeEvent({ action: "weird.thing", meta: {} })).toMatchObject({ verb: "weird.thing", group: "company" });
  });
});

describe("time helpers", () => {
  const now = new Date(2026, 9, 27, 15, 0, 0);
  it("buckets days", () => {
    expect(dayBucket(new Date(2026, 9, 27, 1).toISOString(), now)).toBe("Today");
    expect(dayBucket(new Date(2026, 9, 26, 23).toISOString(), now)).toBe("Yesterday");
    expect(dayBucket(new Date(2026, 9, 20, 9).toISOString(), now)).not.toMatch(/2026/);
    expect(dayBucket(new Date(2025, 9, 20, 9).toISOString(), now)).toMatch(/2025/);
  });
  it("formats relative time", () => {
    const t = Date.parse("2026-10-27T12:00:00Z");
    const at = (ms: number) => new Date(t - ms).toISOString();
    expect(relativeTime(null, t)).toBe("Never");
    expect(relativeTime(at(10_000), t)).toBe("Just now");
    expect(relativeTime(at(5 * 60_000), t)).toBe("5m ago");
    expect(relativeTime(at(3 * 3_600_000), t)).toBe("3h ago");
    expect(relativeTime(at(4 * 86_400_000), t)).toBe("4d ago");
    expect(relativeTime(at(90 * 86_400_000), t)).toMatch(/\d{4}/);
  });
  it("counts whole days until expiry, never negative", () => {
    const t = Date.parse("2026-10-27T12:00:00Z");
    expect(daysUntil(new Date(t + 2.2 * 86_400_000).toISOString(), t)).toBe(3);
    expect(daysUntil(new Date(t - 86_400_000).toISOString(), t)).toBe(0);
  });
});

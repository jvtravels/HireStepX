import { describe, expect, it } from "vitest";
import {
  buildListQuery, buildUnreadCountQuery, parseAudience, parseContentRange, parseCursor, planTriage, typeInList,
} from "../../server-handlers/_notifications-helpers";

const now = new Date("2026-10-10T12:00:00Z");
const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("notifications helpers", () => {
  it("only accepts known audiences", () => {
    expect(parseAudience("employer")).toBe("employer");
    expect(parseAudience("admin")).toBeNull();
  });

  it("builds audience-scoped type filters", () => {
    expect(typeInList("candidate", null)).not.toContain("strong_match_found");
    expect(typeInList("employer", "messages")).toBe("in.(candidate_responded,new_message)");
  });

  it("builds inbox, unread and done queries", () => {
    const base = { userId: "u1", audience: "candidate" as const, category: null, cursor: null, nowIso: now.toISOString() };
    const unread = buildListQuery({ ...base, filter: "unread" });
    expect(unread).toContain("read_at=is.null");
    expect(unread).toContain("archived_at=is.null");
    expect(unread).toContain("snoozed_until.lte.");
    expect(buildListQuery({ ...base, filter: "done" })).toContain("archived_at=not.is.null");
    expect(buildListQuery({ ...base, filter: "all", cursor: "2026-10-01T00:00:00.000Z" })).toContain("created_at=lt.");
    expect(buildUnreadCountQuery("u1", "candidate", base.nowIso)).toContain("select=id");
  });

  it("parses cursors and content-range", () => {
    expect(parseCursor("garbage")).toBeNull();
    expect(parseCursor("2026-10-01T00:00:00Z")).toBe("2026-10-01T00:00:00.000Z");
    expect(parseContentRange("0-0/17")).toBe(17);
    expect(parseContentRange(null)).toBe(0);
  });

  it("plans triage actions", () => {
    const done = planTriage("u1", { action: "done", id: ID }, now);
    expect(done).toMatchObject({ ok: true, patch: { archived_at: now.toISOString() } });
    expect(planTriage("u1", { action: "unread", id: ID }, now)).toMatchObject({ ok: true, patch: { read_at: null } });
    expect(planTriage("u1", { action: "read", id: "x' or 1=1" }, now).ok).toBe(false);
    expect(planTriage("u1", { action: "read_all" }, now).ok).toBe(false);
    const all = planTriage("u1", { action: "read_all", audience: "employer" }, now);
    expect(all.ok && all.filter).toContain("user_id=eq.u1");
    expect(all.ok && all.filter).not.toContain("new_message,payment_success,x");
  });

  it("validates snooze windows", () => {
    expect(planTriage("u1", { action: "snooze", id: ID, until: "2026-10-10T11:00:00Z" }, now).ok).toBe(false);
    expect(planTriage("u1", { action: "snooze", id: ID, until: "2027-03-01T00:00:00Z" }, now).ok).toBe(false);
    expect(planTriage("u1", { action: "snooze", id: ID, until: "2026-10-11T09:00:00Z" }, now).ok).toBe(true);
  });
});

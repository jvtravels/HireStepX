import { describe, expect, it } from "vitest";
import {
  attachmentKind,
  buildThreadRows,
  dayLabel,
  filterInbox,
  initialsOf,
  sortInbox,
  statusTone,
  type InboxItem,
  type ThreadMessage,
} from "../messaging/helpers";

const NOW = new Date(2026, 9, 10, 12, 0, 0);

function msg(id: string, senderRole: ThreadMessage["senderRole"], createdAt: Date): ThreadMessage {
  return { id, senderRole, body: id, attachmentPath: null, attachmentName: null, attachmentMime: null, flagged: false, createdAt: createdAt.toISOString() };
}

function item(matchId: string, over: Partial<InboxItem> = {}): InboxItem {
  return { matchId, name: "Acme", masked: false, roleTitle: "Designer", lastMessageAt: null, unread: false, statusLabel: "Shortlisted", statusTone: "indigo", ...over };
}

describe("dayLabel", () => {
  it("labels today and yesterday", () => {
    expect(dayLabel(new Date(2026, 9, 10, 1).toISOString(), NOW)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 9, 23).toISOString(), NOW)).toBe("Yesterday");
  });
});

describe("buildThreadRows", () => {
  it("adds a day separator and groups consecutive messages from one sender", () => {
    const rows = buildThreadRows([
      msg("a", "employer", new Date(2026, 9, 10, 9, 0)),
      msg("b", "employer", new Date(2026, 9, 10, 9, 2)),
      msg("c", "candidate", new Date(2026, 9, 10, 9, 3)),
    ], NOW);
    expect(rows.map((r) => r.kind)).toEqual(["day", "message", "message", "message"]);
    const flags = rows.filter((r) => r.kind === "message").map((r) => (r.kind === "message" ? r.showHeader : null));
    expect(flags).toEqual([true, false, true]);
  });

  it("starts a new group after the time window and across days", () => {
    const rows = buildThreadRows([
      msg("a", "employer", new Date(2026, 9, 9, 9, 0)),
      msg("b", "employer", new Date(2026, 9, 9, 9, 30)),
      msg("c", "employer", new Date(2026, 9, 10, 9, 31)),
    ], NOW);
    expect(rows.filter((r) => r.kind === "day")).toHaveLength(2);
    expect(rows.filter((r) => r.kind === "message").every((r) => r.kind === "message" && r.showHeader)).toBe(true);
  });

  it("renders system events as their own row and breaks grouping", () => {
    const rows = buildThreadRows([
      msg("a", "employer", new Date(2026, 9, 10, 9, 0)),
      msg("s", "system", new Date(2026, 9, 10, 9, 1)),
      msg("b", "employer", new Date(2026, 9, 10, 9, 2)),
    ], NOW);
    expect(rows.map((r) => r.kind)).toEqual(["day", "message", "system", "message"]);
    const last = rows[3];
    expect(last.kind === "message" && last.showHeader).toBe(true);
  });
});

describe("inbox ordering and filtering", () => {
  it("sorts unread first, then newest", () => {
    const sorted = sortInbox([
      item("old", { lastMessageAt: "2026-10-01T00:00:00Z" }),
      item("new", { lastMessageAt: "2026-10-05T00:00:00Z" }),
      item("unread", { unread: true, lastMessageAt: "2026-09-01T00:00:00Z" }),
    ]);
    expect(sorted.map((i) => i.matchId)).toEqual(["unread", "new", "old"]);
  });

  it("filters by unread, favorites and search text", () => {
    const items = [item("1", { unread: true, name: "Zeta Corp" }), item("2", { roleTitle: "Engineer" })];
    expect(filterInbox(items, "unread", "", new Set()).map((i) => i.matchId)).toEqual(["1"]);
    expect(filterInbox(items, "favorites", "", new Set(["2"])).map((i) => i.matchId)).toEqual(["2"]);
    expect(filterInbox(items, "all", "  engin ", new Set()).map((i) => i.matchId)).toEqual(["2"]);
    expect(filterInbox(items, "all", "zeta", new Set()).map((i) => i.matchId)).toEqual(["1"]);
  });
});

describe("small helpers", () => {
  it("derives initials", () => {
    expect(initialsOf("Jay Vyas Kumar")).toBe("JV");
    expect(initialsOf("")).toBe("?");
  });

  it("classifies attachments", () => {
    expect(attachmentKind("cv.pdf", null).label).toBe("PDF document");
    expect(attachmentKind("pic", "image/png").label).toBe("Image");
    expect(attachmentKind("a.xlsx", null).label).toBe("Spreadsheet");
    expect(attachmentKind(null, null).ext).toBe("file");
  });

  it("maps statuses to tones", () => {
    expect(statusTone("hired")).toBe("success");
    expect(statusTone("rejected")).toBe("error");
    expect(statusTone("whatever")).toBe("neutral");
  });
});

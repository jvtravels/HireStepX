import { describe, it, expect } from "vitest";
import { closedSummary, practisedLabel, previewText, timeAgoLabel, whereLabel } from "../../app/(employer)/employer/requirements/[id]/_components/requirementFormat";

const NOW = new Date("2026-10-15T12:00:00").getTime();

describe("timeAgoLabel", () => {
  it("returns null for missing or unreadable dates instead of NaN", () => {
    expect(timeAgoLabel(null, NOW)).toBeNull();
    expect(timeAgoLabel("", NOW)).toBeNull();
    expect(timeAgoLabel("not a date", NOW)).toBeNull();
  });

  it("reads minutes, hours and a future timestamp", () => {
    expect(timeAgoLabel("2026-10-15T11:59:40", NOW)).toBe("just now");
    expect(timeAgoLabel("2026-10-15T11:30:00", NOW)).toBe("30m ago");
    expect(timeAgoLabel("2026-10-15T07:00:00", NOW)).toBe("5h ago");
    expect(timeAgoLabel("2026-10-16T12:00:00", NOW)).toBe("just now");
  });

  it("treats a date-only value as whole days, never hours", () => {
    expect(timeAgoLabel("2026-10-15", NOW)).toBe("today");
    expect(timeAgoLabel("2026-10-14", NOW)).toBe("yesterday");
    expect(timeAgoLabel("2026-10-10", NOW)).toBe("5d ago");
  });

  it("rolls long spans into weeks, months and years", () => {
    expect(timeAgoLabel("2026-09-24", NOW)).toBe("3w ago");
    expect(timeAgoLabel("2026-06-15", NOW)).toBe("4mo ago");
    expect(timeAgoLabel("2024-10-01", NOW)).toBe("2y ago");
  });
});

describe("practisedLabel", () => {
  it("is null for someone who never practised", () => {
    expect(practisedLabel(-1)).toBeNull();
  });
  it("labels recency", () => {
    expect(practisedLabel(0)).toBe("Practised today");
    expect(practisedLabel(1)).toBe("Practised yesterday");
    expect(practisedLabel(12)).toBe("Practised 1w ago");
  });
});

describe("previewText", () => {
  it("leaves a short description untouched", () => {
    expect(previewText("Short text.", 240)).toEqual({ text: "Short text.", truncated: false });
  });

  it("cuts at a word boundary, never mid-word", () => {
    const out = previewText("alpha beta gamma delta epsilon zeta", 20);
    expect(out.truncated).toBe(true);
    expect(out.text).toBe("alpha beta gamma");
  });

  it("keeps paragraph breaks but caps them at four lines", () => {
    const out = previewText("a\nb\nc\nd\ne\nf", 240);
    expect(out.truncated).toBe(true);
    expect(out.text).toBe("a\nb\nc\nd");
  });

  it("hard cuts a single very long word", () => {
    const out = previewText("x".repeat(50), 20);
    expect(out.text).toBe("x".repeat(20));
  });
});

describe("closedSummary", () => {
  it("is null while the job is open", () => {
    expect(closedSummary({ status: "ready", archiveReason: null, archiveDisposition: null })).toBeNull();
  });

  it("says how a closed job ended", () => {
    expect(closedSummary({ status: "closed", archiveReason: "Role filled.", archiveDisposition: "reject_remaining" })).toBe(
      "This requirement is closed. Reason: Role filled. Open candidates were rejected when it closed. Candidate details are read-only.",
    );
    expect(closedSummary({ status: "closed", archiveReason: null, archiveDisposition: "keep_candidates" })).toContain("kept as they were");
    expect(closedSummary({ status: "closed", archiveReason: null, archiveDisposition: null })).toBe("This requirement is closed. Candidate details are read-only.");
  });
});

describe("whereLabel", () => {
  it("shows the work mode once when it is the only location", () => {
    expect(whereLabel("Remote", "Remote")).toBe("Remote");
    expect(whereLabel("remote", "Remote")).toBe("Remote");
  });
  it("combines a mode with a real place, and falls back to whichever exists", () => {
    expect(whereLabel("Bengaluru", "Hybrid")).toBe("Hybrid (Bengaluru)");
    expect(whereLabel("Pune", null)).toBe("Pune");
    expect(whereLabel(null, "Remote")).toBe("Remote");
    expect(whereLabel("", null)).toBeNull();
  });
});

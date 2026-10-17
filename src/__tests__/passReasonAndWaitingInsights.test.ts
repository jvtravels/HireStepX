import { describe, it, expect } from "vitest";
import { composeRejectNote, parseRejectReasons } from "../employer/_passReasons";
import { jobInsights, matchesInsight, passReasonCounts, waitingDays, WAITING_DAYS } from "../employer/_jobDetailHelpers";
import type { Candidate } from "../employer/mockData";

const NOW = new Date("2026-10-17T10:00:00Z").getTime();
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

function candidate(over: Partial<Candidate> = {}): Candidate {
  return { id: "m", name: "A", targetRole: "Dev", city: "Pune", matchScore: 70, rosterScore: 0, sessionsCompleted: 0, lastActiveDaysAgo: 30, skills: [], unlocked: true, candidateStatus: "shortlisted", candidateStatusNote: null, interviewScheduledAt: null, waitingSince: daysAgo(1), ...over } as Candidate;
}

const rejected = (id: string, reasons: string[], text = "") => candidate({ id, candidateStatus: "rejected", candidateStatusNote: composeRejectNote(reasons, text) ?? null });

describe("parseRejectReasons", () => {
  it("round-trips what composeRejectNote writes", () => {
    const note = composeRejectNote(["Skills gap", "Location"], "Strong, but not for this team.");
    expect(parseRejectReasons(note)).toEqual(["Skills gap", "Location"]);
  });

  it("returns nothing for free text only, empty and missing notes", () => {
    expect(parseRejectReasons("Went with someone else.")).toEqual([]);
    expect(parseRejectReasons("")).toEqual([]);
    expect(parseRejectReasons(null)).toEqual([]);
    expect(parseRejectReasons(undefined)).toEqual([]);
  });

  it("drops labels it does not know and repeated labels", () => {
    expect(parseRejectReasons("Reasons: Skills gap, Bad vibes, Skills gap.")).toEqual(["Skills gap"]);
  });

  it("ignores a Reasons phrase that is not at the start of the note", () => {
    expect(parseRejectReasons("Note. Reasons: Location.")).toEqual([]);
  });
});

describe("passReasonCounts", () => {
  it("counts reasons across passed candidates, most common first", () => {
    const list = [rejected("a", ["Location"]), rejected("b", ["Skills gap", "Location"]), rejected("c", ["Skills gap"]), rejected("d", ["Location"])];
    expect(passReasonCounts(list)).toEqual({ reasons: [["Location", 3], ["Skills gap", 2]], withReasons: 4 });
  });

  it("keeps the dialog order on ties", () => {
    const list = [rejected("a", ["Role mismatch"]), rejected("b", ["Skills gap"])];
    expect(passReasonCounts(list).reasons.map(([r]) => r)).toEqual(["Skills gap", "Role mismatch"]);
  });

  it("skips passes without reasons and candidates that were not passed", () => {
    const list = [rejected("a", [], "Free text only"), candidate({ id: "b", candidateStatusNote: composeRejectNote(["Location"], "") ?? null })];
    expect(passReasonCounts(list)).toEqual({ reasons: [], withReasons: 0 });
  });
});

describe("waitingDays", () => {
  it("measures days since the last update for unlocked shortlisted candidates", () => {
    expect(waitingDays(candidate({ waitingSince: daysAgo(6) }), NOW)).toBe(6);
    expect(waitingDays(candidate({ waitingSince: daysAgo(0) }), NOW)).toBe(0);
  });

  it("is null when locked, past the review stage, or the date is missing or bad", () => {
    expect(waitingDays(candidate({ unlocked: false, waitingSince: daysAgo(9) }), NOW)).toBeNull();
    expect(waitingDays(candidate({ candidateStatus: "interviewing", waitingSince: daysAgo(9) }), NOW)).toBeNull();
    expect(waitingDays(candidate({ waitingSince: null }), NOW)).toBeNull();
    expect(waitingDays(candidate({ waitingSince: "not a date" }), NOW)).toBeNull();
  });

  it("flags exactly at the threshold and not a day before", () => {
    const f = { kind: "waiting" } as const;
    expect(matchesInsight(candidate({ waitingSince: daysAgo(WAITING_DAYS) }), f, NOW)).toBe(true);
    expect(matchesInsight(candidate({ waitingSince: daysAgo(WAITING_DAYS - 1) }), f, NOW)).toBe(false);
  });
});

describe("pass-reason and waiting insights", () => {
  const base = { skills: [], portfolioRequired: false };

  it("filters passed candidates by the chosen reason", () => {
    const list = [rejected("a", ["Location"]), rejected("b", ["Skills gap"]), candidate({ id: "c" })];
    const f = { kind: "pass-reason", reason: "Location" } as const;
    expect(list.filter((c) => matchesInsight(c, f, NOW)).map((c) => c.id)).toEqual(["a"]);
  });

  it("shows the top pass reason only once two candidates share it", () => {
    const one = jobInsights({ ...base, candidates: [rejected("a", ["Location"]), rejected("b", ["Skills gap"])] }, NOW);
    expect(one.map((i) => i.id)).not.toContain("pass-reason");

    const two = jobInsights({ ...base, candidates: [rejected("a", ["Location"]), rejected("b", ["Location", "Skills gap"]), rejected("c", ["Skills gap"]), rejected("d", ["Notice period"]), rejected("e", ["Location"])] }, NOW);
    const pass = two.find((i) => i.id === "pass-reason");
    expect(pass?.text).toBe("Location is the top reason you passed, given for 3 of 5 candidates.");
    expect(pass?.label).toBe("Passed: location");
    expect(pass?.filter).toEqual({ kind: "pass-reason", reason: "Location" });
  });

  it("lists stalled unlocked candidates after the interview-date insight", () => {
    const overdueInterview = candidate({ id: "i", candidateStatus: "interview_invited", interviewScheduledAt: daysAgo(1) });
    const stalled = [candidate({ id: "s1", waitingSince: daysAgo(8) }), candidate({ id: "s2", waitingSince: daysAgo(5) }), candidate({ id: "fresh", waitingSince: daysAgo(2) })];
    const insights = jobInsights({ ...base, candidates: [overdueInterview, ...stalled] }, NOW);
    expect(insights.map((i) => i.id).slice(0, 2)).toEqual(["overdue", "waiting"]);
    const waiting = insights.find((i) => i.id === "waiting")!;
    expect(waiting.text).toBe("2 unlocked candidates have had no update for 5+ days. Move them forward or close them.");
    expect(stalled.concat(overdueInterview).filter((c) => matchesInsight(c, waiting.filter, NOW)).map((c) => c.id)).toEqual(["s1", "s2"]);
  });

  it("uses the singular form for one stalled candidate", () => {
    const insights = jobInsights({ ...base, candidates: [candidate({ waitingSince: daysAgo(7) })] }, NOW);
    expect(insights.find((i) => i.id === "waiting")?.text).toBe("1 unlocked candidate has had no update for 5+ days. Move them forward or close them.");
  });
});

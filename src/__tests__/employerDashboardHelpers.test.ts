import { describe, it, expect } from "vitest";
import {
  buildAuditActivity, mergeActivity,
  asDashboardRange, buildTrend, summarizeJobs, selectUpcomingInterviews, selectRecentRecommended, rankForReview,
  buildActivityFeed, activityText, candidateInitials, type DashboardMatchRow,
} from "../../server-handlers/_employer-dashboard-helpers";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-15T12:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
const ahead = (days: number) => new Date(NOW + days * DAY).toISOString();

function match(over: Partial<DashboardMatchRow> & { id: string }): DashboardMatchRow {
  return {
    requirement_id: "r1", candidate_status: "shortlisted", interview_scheduled_at: null,
    candidate_status_updated_at: null, created_at: ago(1), unlocked: false, unlocked_candidate_name: null,
    match_score: 60, ...over,
  };
}

describe("asDashboardRange", () => {
  it("accepts the supported windows and defaults to 30", () => {
    expect(asDashboardRange("7")).toBe(7);
    expect(asDashboardRange("90")).toBe(90);
    expect(asDashboardRange("45")).toBe(30);
    expect(asDashboardRange(null)).toBe(30);
  });
});

describe("buildTrend", () => {
  it("buckets the window, counts the prior window, ignores older and future rows", () => {
    const t = buildTrend([ago(0.1), ago(29), ago(31), ago(59), ago(61), ahead(1), "junk"], NOW, 30);
    expect(t.current).toBe(2);
    expect(t.previous).toBe(2);
    expect(t.series).toHaveLength(8);
    expect(t.series[7]).toBe(1);
    expect(t.series[0]).toBe(1);
  });
});

describe("summarizeJobs", () => {
  it("counts interviewing and hired and takes the newest timestamp", () => {
    const rows = summarizeJobs(
      ["r1", "r2"],
      [
        match({ id: "a", candidate_status: "interviewing", candidate_status_updated_at: ago(2) }),
        match({ id: "b", candidate_status: "interview_invited" }),
        match({ id: "c", candidate_status: "hired", candidate_status_updated_at: ago(1) }),
        match({ id: "d", requirement_id: "other", candidate_status: "hired" }),
      ],
      new Map([["r1", ago(5)]]),
      new Map([["r1", ago(10)], ["r2", ago(9)]]),
    );
    expect(rows[0]).toMatchObject({ requirementId: "r1", interviewing: 2, hired: 1, lastUpdatedAt: ago(1) });
    expect(rows[1]).toMatchObject({ requirementId: "r2", interviewing: 0, hired: 0, lastUpdatedAt: ago(9) });
  });
});

describe("selectUpcomingInterviews", () => {
  it("keeps future scheduled interviews, soonest first, masked until unlock", () => {
    const out = selectUpcomingInterviews(
      [
        match({ id: "aaaaaa11", candidate_status: "interviewing", interview_scheduled_at: ahead(3) }),
        match({ id: "bbbbbb22", candidate_status: "interview_invited", interview_scheduled_at: ahead(1), unlocked: true, unlocked_candidate_name: "Riya Shah" }),
        match({ id: "cccccc33", candidate_status: "interviewing", interview_scheduled_at: ago(1) }),
        match({ id: "dddddd44", candidate_status: "shortlisted", interview_scheduled_at: ahead(2) }),
      ],
      new Map([["r1", "Backend Engineer"]]), NOW,
    );
    expect(out.map((i) => i.matchId)).toEqual(["bbbbbb22", "aaaaaa11"]);
    expect(out[0]).toMatchObject({ candidateName: "Riya Shah", initials: "RS", roleTitle: "Backend Engineer" });
    expect(out[1].candidateName).toBe("Candidate #aaaaaa");
    expect(out[1].initials).toBe("AA");
  });
});

describe("selectRecentRecommended", () => {
  it("keeps shortlisted matches at or above the threshold, newest first", () => {
    const out = selectRecentRecommended([
      match({ id: "old", created_at: ago(9), match_score: 70 }),
      match({ id: "new", created_at: ago(1), match_score: 45 }),
      match({ id: "weak", match_score: 10 }),
      match({ id: "moved", candidate_status: "interviewing", match_score: 90 }),
    ], 40);
    expect(out.map((m) => m.matchId)).toEqual(["new", "old"]);
  });
});

describe("rankForReview", () => {
  it("puts the best score first and the longest-waiting first on ties", () => {
    const ref = (matchId: string, matchScore: number, createdAt: string) => ({ matchId, requirementId: "r1", matchScore, createdAt });
    const out = rankForReview([
      ref("low", 50, "2026-10-01T00:00:00Z"),
      ref("tie-new", 80, "2026-10-10T00:00:00Z"),
      ref("tie-old", 80, "2026-10-02T00:00:00Z"),
      ref("top", 91, "2026-10-12T00:00:00Z"),
    ]);
    expect(out.map((r) => r.matchId)).toEqual(["top", "tie-old", "tie-new", "low"]);
  });
});

describe("activity feed", () => {
  it("phrases employer and candidate events and drops unknown matches", () => {
    expect(activityText("employer", "Riya", "interviewing")).toBe("You moved Riya to Interviewing");
    expect(activityText("employer", "Riya", "interview_invited")).toBe("You invited Riya to interview");
    expect(activityText("candidate", "Riya", "interviewing")).toBe("Riya is now Interviewing");
    expect(activityText("employer", "Riya", "bogus")).toBeNull();

    const m = match({ id: "abcdef12" });
    const feed = buildActivityFeed(
      [
        { match_id: "abcdef12", requirement_id: "r1", to_status: "hired", actor: "employer", note: null, created_at: ago(1) },
        { match_id: "gone", requirement_id: "r1", to_status: "hired", actor: "employer", note: null, created_at: ago(2) },
        { match_id: null, requirement_id: "r1", to_status: "hired", actor: "system", note: null, created_at: ago(3) },
      ],
      new Map([["abcdef12", m]]),
    );
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({ actor: "You", text: "You marked Candidate #abcdef as Hired", href: "/employer/requirements/r1/candidates/abcdef12" });
  });

  it("derives initials from a real name or the match id", () => {
    expect(candidateInitials("Adarsh Kori", "x")).toBe("AK");
    expect(candidateInitials("Candidate #a1b2c3", "a1b2c3d4")).toBe("A1");
  });
});

describe("team activity on the dashboard feed", () => {
  const row = (id: string, action: string, actor: string, email: string, at: string, meta: Record<string, unknown> = {}) =>
    ({ id, actor_user_id: actor, actor_email: email, action, meta, created_at: at });

  it("words each team action and says You for the viewer", () => {
    const items = buildAuditActivity([
      row("1", "candidate.reviewed", "me", "me@x.com", "2026-10-30T10:00:00Z", { candidateName: "Asha K." }),
      row("2", "member.invited", "u2", "priya@x.com", "2026-10-30T09:00:00Z", { email: "ravi@x.com" }),
      row("3", "job.created", "u2", "priya@x.com", "2026-10-30T08:00:00Z", { title: "Designer" }),
      row("4", "company.profile_updated", "me", "me@x.com", "2026-10-30T07:00:00Z"),
    ], "me");
    expect(items.map((i) => i.text)).toEqual([
      "You reviewed Asha K.",
      "priya invited ravi@x.com to the team",
      "priya posted Designer",
    ]);
    expect(items.map((i) => i.actor)).toEqual(["You", "Team", "Team"]);
  });

  it("merges with status moves newest first and trims to the limit", () => {
    const a = [{ id: "s1", actor: "You" as const, text: "old", createdAt: "2026-10-01T00:00:00Z", href: null }];
    const b = [{ id: "t1", actor: "Team" as const, text: "new", createdAt: "2026-10-02T00:00:00Z", href: null }];
    expect(mergeActivity(a, b, 1).map((i) => i.id)).toEqual(["t1"]);
    expect(mergeActivity(a, b).map((i) => i.id)).toEqual(["t1", "s1"]);
  });
});

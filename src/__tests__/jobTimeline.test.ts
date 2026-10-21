import { describe, expect, it } from "vitest";
import { buildJobTimeline, jobStatusBadge } from "../jobTimeline";
import { answeredRequests, fitStanding } from "../../server-handlers/_job-feedback";
import type { JobMatch } from "../DashboardJobs";
import type { CandidateRequestRow } from "../../server-handlers/_candidate-request-helpers";

const base = { id: "m1", matchedAt: "2026-10-01T10:00:00Z", unlocked: false, unlockedAt: null } as JobMatch;
const job = (over: Partial<JobMatch> = {}): JobMatch => ({ ...base, ...over });
const open = { closed: false, invited: false };

describe("buildJobTimeline", () => {
  it("starts with the match and waits for a first look", () => {
    const steps = buildJobTimeline(job(), open);
    expect(steps.map((s) => [s.key, s.state])).toEqual([["matched", "done"], ["wait-view", "waiting"]]);
  });

  it("records the employer view and then waits on the contact decision", () => {
    const steps = buildJobTimeline(job({ profileViewedAt: "2026-10-02T10:00:00Z" }), open);
    expect(steps.map((s) => s.key)).toEqual(["matched", "viewed", "wait-unlock"]);
  });

  it("orders answered requests and the unlock by time", () => {
    const steps = buildJobTimeline(job({
      profileViewedAt: "2026-10-02T10:00:00Z",
      unlocked: true,
      unlockedAt: "2026-10-05T10:00:00Z",
      answeredRequests: [{ id: "r1", kind: "practice", headline: "Practise a HR Round interview", outcome: "fulfilled", at: "2026-10-03T10:00:00Z" }],
    }), open);
    expect(steps.map((s) => s.key)).toEqual(["matched", "viewed", "answered-r1", "unlocked", "reply"]);
    expect(steps[2].label).toBe("You answered: Practise a HR Round interview");
  });

  it("shows pending requests as actions and does not also say waiting", () => {
    const steps = buildJobTimeline(job({ requests: [{ id: "r2", kind: "document", headline: "Share a work sample", note: null, createdAt: "2026-10-04T10:00:00Z" }] }), open);
    expect(steps.at(-1)).toMatchObject({ key: "asked-r2", state: "action" });
    expect(steps.some((s) => s.state === "waiting")).toBe(false);
  });

  it("does not ask an invited candidate to reply", () => {
    const steps = buildJobTimeline(job({ unlocked: true, unlockedAt: "2026-10-02T10:00:00Z" }), { closed: false, invited: true });
    expect(steps.some((s) => s.key === "reply")).toBe(false);
  });

  it("stops at history for a closed role", () => {
    const steps = buildJobTimeline(job({ requests: [{ id: "r3", kind: "contact", headline: "x", note: null, createdAt: "2026-10-04T10:00:00Z" }] }), { closed: true, invited: false });
    expect(steps.map((s) => s.key)).toEqual(["matched"]);
  });

  it("includes the candidate's response and a positive stage", () => {
    const steps = buildJobTimeline(job({ unlocked: true, unlockedAt: "2026-10-02T10:00:00Z", candidateResponse: "interested", candidateStatus: "interview_invited" }), open);
    expect(steps.map((s) => s.key)).toEqual(["matched", "unlocked", "response", "stage"]);
  });

  it("never surfaces a rejection as a step", () => {
    const steps = buildJobTimeline(job({ unlocked: true, unlockedAt: "2026-10-02T10:00:00Z", candidateStatus: "rejected" }), open);
    expect(steps.some((s) => s.key === "stage")).toBe(false);
  });
});

describe("fitStanding", () => {
  it("is hidden for small pools", () => {
    expect(fitStanding(80, [80, 70, 60, 50])).toBeNull();
  });
  it("reports the share of others beaten", () => {
    expect(fitStanding(80, [80, 70, 60, 50, 90])).toEqual({ pool: 5, beatenPct: 75 });
  });
  it("returns null when the own score is not in the pool", () => {
    expect(fitStanding(77, [80, 70, 60, 50, 90])).toBeNull();
  });
  it("does not count ties as beaten", () => {
    expect(fitStanding(70, [70, 70, 70, 70, 70])).toEqual({ pool: 5, beatenPct: 0 });
  });
});

describe("answeredRequests", () => {
  const row = (id: string, status: CandidateRequestRow["status"], at: string | null): CandidateRequestRow => ({
    id, match_id: "m1", kind: "document", topic: null, fields: null, note: null, status, response_note: null, created_at: "2026-10-01T00:00:00Z", resolved_at: at,
  });
  it("keeps only resolved rows, newest first", () => {
    const out = answeredRequests([row("a", "pending", null), row("b", "fulfilled", "2026-10-02T00:00:00Z"), row("c", "declined", "2026-10-03T00:00:00Z"), row("d", "cancelled", "2026-10-04T00:00:00Z")], (r) => r.id);
    expect(out.map((r) => r.id)).toEqual(["c", "b"]);
    expect(out[0].outcome).toBe("declined");
  });
});

describe("response step ordering", () => {
  it("sorts a timestamped response into the story", () => {
    const steps = buildJobTimeline(job({
      unlocked: true,
      unlockedAt: "2026-10-02T10:00:00Z",
      candidateResponse: "interested",
      candidateRespondedAt: "2026-10-03T10:00:00Z",
      candidateStatus: "interview_invited",
    }), open);
    expect(steps.map((s) => s.key)).toEqual(["matched", "unlocked", "response", "stage"]);
  });

  it("trails an undated response after the dated steps", () => {
    const steps = buildJobTimeline(job({ unlocked: true, unlockedAt: "2026-10-02T10:00:00Z", candidateResponse: "interested" }), open);
    expect(steps.map((s) => s.key).slice(0, 3)).toEqual(["matched", "unlocked", "response"]);
  });
});

describe("jobStatusBadge", () => {
  it("defaults to Matched", () => expect(jobStatusBadge(job(), false).label).toBe("Matched"));
  it("shows Employer interested once unlocked", () => expect(jobStatusBadge(job({ unlocked: true }), false).label).toBe("Employer interested"));
  it("shows You declined after a decline", () => {
    expect(jobStatusBadge(job({ unlocked: true, candidateResponse: "declined" }), false).label).toBe("You declined");
  });
  it("prefers the interview stage over earlier steps", () => {
    expect(jobStatusBadge(job({ unlocked: true, candidateStatus: "interview_invited" }), false).label).toBe("Interview invited");
    expect(jobStatusBadge(job({ interviewScheduledAt: "2026-11-01T10:00:00Z" }), false).label).toBe("Interview stage");
  });
  it("shows Role closed above everything", () => expect(jobStatusBadge(job({ candidateStatus: "hired" }), true).label).toBe("Role closed"));
});

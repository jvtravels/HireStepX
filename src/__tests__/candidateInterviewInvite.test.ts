import { describe, it, expect } from "vitest";
import { generateICS } from "../dashboardHelpers";
import { inviteEvent, invitePracticeHref, isInterviewInvite, inviteJobDescription } from "../interviewInvite";

describe("isInterviewInvite", () => {
  it("is true for invited and interviewing", () => {
    expect(isInterviewInvite({ candidateStatus: "interview_invited", candidateResponse: "none" })).toBe(true);
    expect(isInterviewInvite({ candidateStatus: "interviewing", candidateResponse: null })).toBe(true);
  });
  it("is false for other stages or after the candidate declined", () => {
    expect(isInterviewInvite({ candidateStatus: "shortlisted" })).toBe(false);
    expect(isInterviewInvite({})).toBe(false);
    expect(isInterviewInvite({ candidateStatus: "interview_invited", candidateResponse: "declined" })).toBe(false);
  });
});

describe("inviteEvent", () => {
  const job = { id: "m1", roleTitle: "Backend Engineer", companyName: "Acme", interviewScheduledAt: "2026-11-02T09:30:00.000Z" };
  it("builds an event that renders to ics at the exact instant", () => {
    const ics = generateICS(inviteEvent(job)!);
    expect(ics).toContain("DTSTART:20261102T093000Z");
    expect(ics).toContain("UID:invite-m1@hirestepx.com");
    expect(ics).toContain("Backend Engineer");
  });
  it("returns null without a valid time", () => {
    expect(inviteEvent({ ...job, interviewScheduledAt: null })).toBeNull();
    expect(inviteEvent({ ...job, interviewScheduledAt: "nope" })).toBeNull();
  });
});

describe("invitePracticeHref", () => {
  it("includes the company only once revealed", () => {
    expect(invitePracticeHref({ id: "m1", roleTitle: "SDE II", companyName: "Acme", unlocked: true })).toBe("/session/new?role=SDE+II&invite=m1&company=Acme");
    expect(invitePracticeHref({ id: "m1", roleTitle: "SDE II", companyName: "Confidential company", unlocked: false })).toBe("/session/new?role=SDE+II&invite=m1");
  });
});

describe("inviteJobDescription", () => {
  it("joins skills, description and responsibilities and caps the length", () => {
    const text = inviteJobDescription({ roleTitle: "SDE II", skills: ["React", "SQL"], description: "Build  things.\nFast.", responsibilities: "Own the roadmap" });
    expect(text).toBe("Key skills: React, SQL. Build things. Fast. Responsibilities: Own the roadmap");
    expect(inviteJobDescription({ roleTitle: "x", skills: [], description: "a".repeat(5000), responsibilities: null }).length).toBe(1200);
  });
  it("is empty when the posting has nothing to tailor to", () => {
    expect(inviteJobDescription({ roleTitle: "x", skills: [], description: null, responsibilities: null })).toBe("");
  });
});

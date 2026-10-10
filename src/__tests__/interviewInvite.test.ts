import { describe, it, expect } from "vitest";
import { canInviteToInterview, statusErrorCopy } from "../employer/InterviewInviteDialog";
import type { CandidateStatus } from "../employer/mockData";

describe("canInviteToInterview", () => {
  it("only offers the invite from the shortlisted stage", () => {
    expect(canInviteToInterview("shortlisted")).toBe(true);
    const others: CandidateStatus[] = ["interview_invited", "interviewing", "hired", "rejected", "not_a_fit", "no_response"];
    for (const s of others) expect(canInviteToInterview(s)).toBe(false);
  });
});

describe("statusErrorCopy", () => {
  it("maps the structured status-endpoint failures to next-step copy", () => {
    expect(statusErrorCopy({ error: "x", status: 402 })).toMatch(/Unlock/);
    expect(statusErrorCopy({ error: "x", code: "unlock_required" })).toMatch(/Unlock/);
    expect(statusErrorCopy({ error: "x", status: 409 })).toMatch(/declined/);
    expect(statusErrorCopy({ error: "x", status: 404 })).toMatch(/no longer available/);
    expect(statusErrorCopy({ error: "x", status: 403 })).toMatch(/suspended/);
    expect(statusErrorCopy({ error: "x", code: "suspended" })).toMatch(/suspended/);
  });

  it("falls back to the server message, then generic copy", () => {
    expect(statusErrorCopy({ error: "Rate limited", status: 429 })).toBe("Rate limited");
    expect(statusErrorCopy({ error: "" })).toMatch(/try again/);
  });
});

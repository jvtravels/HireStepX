import { describe, it, expect, vi } from "vitest";
import { hasInterviewStartIntent } from "../interviewStartIntent";

describe("hasInterviewStartIntent", () => {
  const noDraft = () => null;

  it("accepts an explicit new session", () => {
    expect(hasInterviewStartIntent("?type=behavioral&new=1", noDraft, "u1")).toBe(true);
  });

  it("accepts an explicit resume", () => {
    expect(hasInterviewStartIntent("?resume=true", noDraft, "u1")).toBe(true);
  });

  it("accepts a refresh when a draft exists for this user", () => {
    const read = vi.fn((k: string) => (k === "hirestepx_interview_draft_u1" ? "{}" : null));
    expect(hasInterviewStartIntent("?type=behavioral", read, "u1")).toBe(true);
    expect(read).toHaveBeenCalledWith("hirestepx_interview_draft_u1");
  });

  it("falls back to the anon draft key without a user id", () => {
    const read = vi.fn((k: string) => (k === "hirestepx_interview_draft_anon" ? "{}" : null));
    expect(hasInterviewStartIntent("", read, undefined)).toBe(true);
  });

  it("rejects a bare entry with no intent and no draft", () => {
    expect(hasInterviewStartIntent("?type=behavioral", noDraft, "u1")).toBe(false);
    expect(hasInterviewStartIntent("?new=0", noDraft, "u1")).toBe(false);
  });

  it("treats unreadable storage as no draft", () => {
    const throwing = () => { throw new Error("blocked"); };
    expect(hasInterviewStartIntent("", throwing, "u1")).toBe(false);
  });
});

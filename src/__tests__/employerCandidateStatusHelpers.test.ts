import { describe, it, expect } from "vitest";
import {
  asCandidateStatus,
  asCandidateStatusNote,
  asInterviewScheduledAt,
  isValidCandidateStatusTransition,
  CANDIDATE_STATUSES,
} from "../../server-handlers/_employer-candidate-status-helpers";

describe("asCandidateStatus", () => {
  it("accepts every known status", () => {
    for (const status of CANDIDATE_STATUSES) {
      expect(asCandidateStatus(status)).toBe(status);
    }
  });

  it("rejects an unknown string", () => {
    expect(asCandidateStatus("ghosted")).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(asCandidateStatus(42)).toBeNull();
    expect(asCandidateStatus(null)).toBeNull();
    expect(asCandidateStatus(undefined)).toBeNull();
    expect(asCandidateStatus({ status: "hired" })).toBeNull();
  });
});

describe("asCandidateStatusNote", () => {
  it("trims and passes through a short note", () => {
    expect(asCandidateStatusNote("  Great communicator  ")).toBe("Great communicator");
  });

  it("truncates a note longer than 2000 chars", () => {
    const long = "a".repeat(2100);
    expect(asCandidateStatusNote(long)?.length).toBe(2000);
  });

  it("returns null when not supplied, so a status-only update doesn't clobber an existing note", () => {
    expect(asCandidateStatusNote(undefined)).toBeNull();
    expect(asCandidateStatusNote(null)).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(asCandidateStatusNote(42)).toBeNull();
  });
});

describe("asInterviewScheduledAt", () => {
  it("normalizes a valid date string to ISO", () => {
    const result = asInterviewScheduledAt("2026-10-05T10:00:00Z");
    expect(result).toBe(new Date("2026-10-05T10:00:00Z").toISOString());
  });

  it("returns null for an unparseable string", () => {
    expect(asInterviewScheduledAt("not-a-date")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(asInterviewScheduledAt("")).toBeNull();
    expect(asInterviewScheduledAt("   ")).toBeNull();
  });

  it("returns null when not supplied", () => {
    expect(asInterviewScheduledAt(undefined)).toBeNull();
    expect(asInterviewScheduledAt(null)).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(asInterviewScheduledAt(1700000000000)).toBeNull();
  });
});

describe("isValidCandidateStatusTransition", () => {
  it("allows the happy-path forward pipeline", () => {
    expect(isValidCandidateStatusTransition("shortlisted", "interview_invited")).toBe(true);
    expect(isValidCandidateStatusTransition("interview_invited", "interviewing")).toBe(true);
    expect(isValidCandidateStatusTransition("interviewing", "hired")).toBe(true);
  });

  it("allows moving to a negative outcome from any non-terminal stage", () => {
    expect(isValidCandidateStatusTransition("shortlisted", "rejected")).toBe(true);
    expect(isValidCandidateStatusTransition("shortlisted", "not_a_fit")).toBe(true);
    expect(isValidCandidateStatusTransition("interview_invited", "no_response")).toBe(true);
    expect(isValidCandidateStatusTransition("interviewing", "no_response")).toBe(true);
  });

  it("rejects skipping stages", () => {
    expect(isValidCandidateStatusTransition("shortlisted", "interviewing")).toBe(false);
    expect(isValidCandidateStatusTransition("shortlisted", "hired")).toBe(false);
    expect(isValidCandidateStatusTransition("interview_invited", "hired")).toBe(false);
  });

  it("rejects moving backwards", () => {
    expect(isValidCandidateStatusTransition("interviewing", "shortlisted")).toBe(false);
    expect(isValidCandidateStatusTransition("hired", "interviewing")).toBe(false);
  });

  it("rejects any transition out of a terminal status", () => {
    for (const terminal of ["hired", "rejected", "not_a_fit", "no_response"] as const) {
      for (const target of CANDIDATE_STATUSES) {
        if (target === terminal) continue;
        expect(isValidCandidateStatusTransition(terminal, target)).toBe(false);
      }
    }
  });

  it("allows a same-status update (note/interview-time only change)", () => {
    for (const status of CANDIDATE_STATUSES) {
      expect(isValidCandidateStatusTransition(status, status)).toBe(true);
    }
  });
});

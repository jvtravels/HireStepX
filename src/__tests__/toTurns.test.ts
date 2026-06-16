import { describe, it, expect } from "vitest";
import { toTurns } from "../sessionReport/SessionReport";

/**
 * Regression guard for a silent, high-impact bug: the evaluate-session
 * report request maps engine transcript turns to interviewer/candidate
 * roles. Engine turns are tagged speaker "ai" | "user" | "system" — never
 * "interviewer". A `speaker === "interviewer"` check was therefore
 * dead-always-false, so EVERY turn (the AI's questions included) collapsed
 * to "candidate" and the evaluator received a transcript where it could not
 * tell questions from answers. Verified live in production via the
 * /api/evaluate-session request body (all turns role:"candidate").
 */
describe("toTurns", () => {
  it("maps speaker 'ai' to interviewer and 'user' to candidate", () => {
    const out = toTurns([
      { speaker: "ai", text: "Tell me about a conflict you resolved." },
      { speaker: "user", text: "At my last role I mediated a scope dispute…" },
    ]);
    expect(out).toEqual([
      { role: "interviewer", text: "Tell me about a conflict you resolved." },
      { role: "candidate", text: "At my last role I mediated a scope dispute…" },
    ]);
  });

  it("does NOT collapse every turn to candidate (the original bug)", () => {
    const out = toTurns([
      { speaker: "ai", text: "Q1" },
      { speaker: "user", text: "A1" },
      { speaker: "ai", text: "Q2" },
      { speaker: "user", text: "A2" },
    ]);
    expect(out.filter((t) => t.role === "interviewer")).toHaveLength(2);
    expect(out.filter((t) => t.role === "candidate")).toHaveLength(2);
  });

  it("treats non-ai speakers (system) as candidate, not interviewer", () => {
    const out = toTurns([{ speaker: "system", text: "[reconnected]" }]);
    expect(out[0].role).toBe("candidate");
  });

  it("drops empty / whitespace-only turns", () => {
    const out = toTurns([
      { speaker: "ai", text: "  " },
      { speaker: "user", text: "" },
      { speaker: "ai", text: "Real question" },
    ]);
    expect(out).toEqual([{ role: "interviewer", text: "Real question" }]);
  });

  it("handles null/undefined transcript", () => {
    expect(toTurns(undefined as unknown as { speaker: string; text: string }[])).toEqual([]);
  });
});

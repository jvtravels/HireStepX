import { describe, it, expect } from "vitest";
import { checkQuestionQuality, normalizeQuestion } from "../_question-quality";

/* Pins the question-quality post-filter, with focus on the dedup fix.

   Live bug (staging, LLM down → static-bank path): the filter downgraded
   several distinct questions to the SAME canned fallback string, so a
   candidate got the identical "disagreed with a teammate…" question
   twice and three conflict questions in a row. Two root causes:
     A. buildFallback returned one fixed string per (focus, position)
        bucket with no awareness of what it had already emitted.
     B. the curated static bank was being run through an LLM-output
        filter at all.
   These tests pin A (dedup-aware fallback). B is enforced at the call
   site in interviewAPI.ts (static fallback skips the filter entirely). */

describe("normalizeQuestion", () => {
  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeQuestion("Tell me about a TIME you   failed.")).toBe("tell me about a time you failed");
    expect(normalizeQuestion("  Why this role? ")).toBe("why this role");
  });

  it("treats punctuation-only differences as identical", () => {
    const a = normalizeQuestion("Where did it land?");
    const b = normalizeQuestion("where did it land");
    expect(a).toBe(b);
  });

  it("is defensive about empty / nullish input", () => {
    expect(normalizeQuestion("")).toBe("");
    // @ts-expect-error — exercising the runtime guard
    expect(normalizeQuestion(undefined)).toBe("");
  });
});

describe("checkQuestionQuality", () => {
  it("passes a well-formed, anchored behavioural question", () => {
    const res = checkQuestionQuality(
      { type: "main", aiText: "Tell me about a project where you owned a tricky stakeholder conflict and how you shipped the outcome.", idx: 3, total: 7 },
      "behavioral",
      "Senior Product Designer",
    );
    expect(res.ok).toBe(true);
  });

  it("flags a too-short question and supplies a fallback", () => {
    const res = checkQuestionQuality(
      { type: "main", aiText: "Tell me about a time you failed.", idx: 3, total: 8 },
      "behavioral",
      "Senior Product Designer",
    );
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.rule === "too-short")).toBe(true);
    expect(res.fallback.length).toBeGreaterThan(20);
  });

  it("does NOT collapse two failing mid-session steps onto the same fallback (dedup fix)", () => {
    const used = new Set<string>();

    // First mid-session step fails the quality check.
    const r1 = checkQuestionQuality(
      { type: "main", aiText: "Too short.", idx: 3, total: 8 },
      "behavioral",
      "Senior Product Designer",
      used,
    );
    expect(r1.ok).toBe(false);
    used.add(normalizeQuestion(r1.fallback));

    // Second mid-session step also fails — must get a DIFFERENT fallback.
    const r2 = checkQuestionQuality(
      { type: "main", aiText: "Too short.", idx: 4, total: 8 },
      "behavioral",
      "Senior Product Designer",
      used,
    );
    expect(r2.ok).toBe(false);
    expect(normalizeQuestion(r2.fallback)).not.toBe(normalizeQuestion(r1.fallback));
  });

  it("avoids reusing a fallback that already matches an existing script question", () => {
    // Seed `used` with the canonical first behavioural mid-session
    // fallback, simulating a kept question identical to pool[0].
    const seed = "Tell me about a time you disagreed with a teammate or stakeholder on something that mattered. How did you raise it, and where did it land?";
    const used = new Set<string>([normalizeQuestion(seed)]);

    const res = checkQuestionQuality(
      { type: "main", aiText: "Too short.", idx: 3, total: 8 },
      "behavioral",
      "Senior Product Designer",
      used,
    );
    expect(res.ok).toBe(false);
    expect(normalizeQuestion(res.fallback)).not.toBe(normalizeQuestion(seed));
  });

  it("dedups across a multi-step technical script the way the caller drives it", () => {
    const scriptFails = [
      { type: "main", aiText: "Short one.", idx: 2, total: 9 },
      { type: "main", aiText: "Short two.", idx: 3, total: 9 },
      { type: "main", aiText: "Short three.", idx: 4, total: 9 },
    ];
    const used = new Set<string>();
    const chosen: string[] = [];
    for (const step of scriptFails) {
      const res = checkQuestionQuality(step, "technical", "Backend Engineer", used);
      expect(res.ok).toBe(false);
      used.add(normalizeQuestion(res.fallback));
      chosen.push(normalizeQuestion(res.fallback));
    }
    // All three substituted questions are distinct.
    expect(new Set(chosen).size).toBe(chosen.length);
  });
});

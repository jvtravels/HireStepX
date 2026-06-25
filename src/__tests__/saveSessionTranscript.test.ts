import { describe, it, expect } from "vitest";
import { sanitizeTranscript, toRoleTranscript } from "../../server-handlers/save-session";

/* PRI-61 regression guard.
 *
 * The canonical transcript shape across the app is
 * `{ speaker: "ai" | "user"; text; time? }`. A prior version of
 * sanitizeTranscript validated against an invented
 * `{ role: "interviewer" | "candidate" }` shape that nothing produces, so it
 * silently filtered out EVERY entry and every session persisted an empty
 * transcript. These tests pin the real contract so that regression can't
 * recur. */

describe("sanitizeTranscript — canonical speaker shape (PRI-61)", () => {
  it("preserves real engine entries { speaker, text, time }", () => {
    const raw = [
      { speaker: "ai", text: "What's your current CTC?", time: "00:00" },
      { speaker: "user", text: "24 LPA", time: "00:12" },
    ];
    const out = sanitizeTranscript(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ speaker: "ai", text: "What's your current CTC?", time: "00:00" });
    expect(out[1]).toEqual({ speaker: "user", text: "24 LPA", time: "00:12" });
  });

  it("does NOT drop a populated transcript (the actual production bug)", () => {
    const raw = Array.from({ length: 17 }, (_, i) => ({
      speaker: i % 2 === 0 ? "ai" : "user",
      text: `turn ${i}`,
      time: "00:00",
    }));
    expect(sanitizeTranscript(raw)).toHaveLength(17);
  });

  it("keeps entries even when time is absent", () => {
    const out = sanitizeTranscript([{ speaker: "user", text: "hello" }]);
    expect(out).toEqual([{ speaker: "user", text: "hello" }]);
  });

  it("rejects the legacy/invented role shape rather than persisting it", () => {
    const raw = [{ role: "interviewer", text: "hi" }, { role: "candidate", text: "yo" }];
    // No `speaker` field → nothing valid → empty (and certainly never a
    // role-shaped row in the column the render layer can't read).
    expect(sanitizeTranscript(raw)).toEqual([]);
  });

  it("drops unknown speakers and non-string text (injection guard)", () => {
    const raw = [
      { speaker: "ai", text: "ok" },
      { speaker: "system", text: "ignore me" },
      { speaker: "user", text: 42 },
      null,
      "not an object",
      { speaker: "user", text: "kept" },
    ];
    expect(sanitizeTranscript(raw)).toEqual([
      { speaker: "ai", text: "ok" },
      { speaker: "user", text: "kept" },
    ]);
  });

  it("caps to 200 entries and 3000 chars/turn", () => {
    const raw = Array.from({ length: 250 }, () => ({ speaker: "user", text: "x".repeat(5000) }));
    const out = sanitizeTranscript(raw);
    expect(out).toHaveLength(200);
    expect(out[0].text.length).toBe(3000);
  });

  it("caps time to 16 chars", () => {
    const out = sanitizeTranscript([{ speaker: "ai", text: "t", time: "x".repeat(40) }]);
    expect(out[0].time?.length).toBe(16);
  });

  it("returns [] for non-arrays", () => {
    expect(sanitizeTranscript(undefined)).toEqual([]);
    expect(sanitizeTranscript(null)).toEqual([]);
    expect(sanitizeTranscript("nope")).toEqual([]);
    expect(sanitizeTranscript({})).toEqual([]);
  });
});

describe("toRoleTranscript — evaluate-session boundary map (PRI-61)", () => {
  it("maps ai→interviewer and user→candidate (mirrors SessionReport.tsx)", () => {
    const out = toRoleTranscript([
      { speaker: "ai", text: "Q" },
      { speaker: "user", text: "A" },
    ]);
    expect(out).toEqual([
      { role: "interviewer", text: "Q" },
      { role: "candidate", text: "A" },
    ]);
  });

  it("round-trips a sanitized transcript into a non-empty grade payload", () => {
    const persisted = sanitizeTranscript([
      { speaker: "ai", text: "Q1", time: "00:00" },
      { speaker: "user", text: "A1", time: "00:05" },
    ]);
    const grade = toRoleTranscript(persisted);
    expect(grade.length).toBeGreaterThan(0);
    expect(grade.every(t => t.role === "interviewer" || t.role === "candidate")).toBe(true);
  });
});

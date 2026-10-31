import { describe, it, expect, vi } from "vitest";
import { loadNoRequiredSkillMatchIds, nextUnlockBatchQuote } from "../../server-handlers/_employer-matching-helpers";

const m = (id: string, cand: string, score: number, unlocked = false) => ({
  id, candidate_user_id: cand, match_score: score, unlocked, candidate_status: "shortlisted",
});

const profiles = (rows: Array<{ id: string; target_role: string; resume_data: unknown }>) =>
  vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 })) as unknown as typeof fetch;

describe("loadNoRequiredSkillMatchIds", () => {
  const ranked = [m("m1", "c1", 80), m("m2", "c2", 70), m("m3", "c3", 60, true), m("m4", "c4", 10)];
  const rows = [
    { id: "c1", target_role: "Designer", resume_data: { skills: ["Figma"] } },
    { id: "c2", target_role: "Accountant", resume_data: { skills: ["Tally"] } },
  ];

  it("flags only locked, shortlisted, above-bar rows that list none of the required skills", async () => {
    const ids = await loadNoRequiredSkillMatchIds("http://x", {}, ranked, ["Figma"], profiles(rows));
    expect([...ids]).toEqual(["m2"]);
  });

  it("does nothing when the job lists no skills, and never calls the database", async () => {
    const f = profiles(rows);
    expect((await loadNoRequiredSkillMatchIds("http://x", {}, ranked, [], f)).size).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });

  it("falls back to an empty set when the read fails", async () => {
    const f = vi.fn(async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    expect((await loadNoRequiredSkillMatchIds("http://x", {}, ranked, ["Figma"], f)).size).toBe(0);
  });
});

describe("nextUnlockBatchQuote with the skills rule", () => {
  it("skips rows the list hides so the batch is not paid for them", () => {
    const rows = Array.from({ length: 11 }, (_, i) => m(`m${i}`, `c${i}`, 90 - i));
    const q = nextUnlockBatchQuote(rows, new Set(["m0", "m1"]))!;
    expect(q.matchIds).not.toContain("m0");
    expect(q.matchIds).toHaveLength(9);
    expect(q.start).toBe(1);
  });
});

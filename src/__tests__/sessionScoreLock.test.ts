import { describe, it, expect, vi } from "vitest";
import { fetchSessionOwner, isServerGraded, withoutGradedFields } from "../../server-handlers/_session-score-lock";

const res = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe("isServerGraded", () => {
  it("is true only when the report timestamp is set", () => {
    expect(isServerGraded({ report_generated_at: "2026-10-01T00:00:00Z" })).toBe(true);
    expect(isServerGraded({ report_generated_at: null })).toBe(false);
    expect(isServerGraded({})).toBe(false);
    expect(isServerGraded(null)).toBe(false);
  });
});

describe("withoutGradedFields", () => {
  const row = { id: "s1", score: 99, skill_scores: { a: 1 }, transcript: "t" };
  it("drops score and skill_scores for a graded session and keeps the rest", () => {
    expect(withoutGradedFields(row, true)).toEqual({ id: "s1", transcript: "t" });
  });
  it("leaves an ungraded row untouched", () => {
    expect(withoutGradedFields(row, false)).toBe(row);
  });
  it("does not mutate its input", () => {
    withoutGradedFields(row, true);
    expect(row.score).toBe(99);
  });
});

describe("fetchSessionOwner", () => {
  it("returns the owner row and graded flag", async () => {
    const f = vi.fn().mockResolvedValue(res(200, [{ user_id: "u1", report_generated_at: "2026-10-01" }]));
    const out = await fetchSessionOwner("s1", "https://x", "k", f);
    expect(out).toEqual({ ok: true, row: { user_id: "u1", report_generated_at: "2026-10-01" } });
  });
  it("falls back to owner only when the column does not exist", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(400, {})).mockResolvedValueOnce(res(200, [{ user_id: "u1" }]));
    const out = await fetchSessionOwner("s1", "https://x", "k", f);
    expect(out).toEqual({ ok: true, row: { user_id: "u1" } });
    expect(f.mock.calls[1][0]).toContain("select=user_id");
    expect(f.mock.calls[1][0]).not.toContain("report_generated_at");
  });
  it("returns a null row when the session does not exist", async () => {
    const f = vi.fn().mockResolvedValue(res(200, []));
    expect(await fetchSessionOwner("s1", "https://x", "k", f)).toEqual({ ok: true, row: null });
  });
  it("reports failure on a server error", async () => {
    const f = vi.fn().mockResolvedValue(res(500, {}));
    expect(await fetchSessionOwner("s1", "https://x", "k", f)).toEqual({ ok: false });
  });
});

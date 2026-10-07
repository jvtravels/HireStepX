import { describe, it, expect, vi } from "vitest";
import { extractEvidenceSkills, latestSessionByUser, isNegotiationSession, claimProfileView } from "../../server-handlers/_employer-candidate-evidence-helpers";

describe("extractEvidenceSkills", () => {
  it("extracts name + score pairs from a real report_json shape", () => {
    const report = { skills: [{ name: "Communication", score: 78, weight: 1 }, { name: "STAR structure", score: 64 }] };
    expect(extractEvidenceSkills(report)).toEqual([
      { name: "Communication", score: 78 },
      { name: "STAR structure", score: 64 },
    ]);
  });

  it("drops the internal weight field rather than surfacing it", () => {
    const report = { skills: [{ name: "Clarity", score: 50, weight: 0.4 }] };
    const [skill] = extractEvidenceSkills(report);
    expect(skill).not.toHaveProperty("weight");
  });

  it("skips malformed entries instead of fabricating placeholders", () => {
    const report = { skills: [{ name: "", score: 10 }, { name: "Ok", score: "not-a-number" }, { score: 5 }, null, "junk"] };
    expect(extractEvidenceSkills(report)).toEqual([]);
  });

  it("returns an empty array when skills is missing", () => {
    expect(extractEvidenceSkills({})).toEqual([]);
  });

  it("returns an empty array for null/non-object input", () => {
    expect(extractEvidenceSkills(null)).toEqual([]);
    expect(extractEvidenceSkills(undefined)).toEqual([]);
    expect(extractEvidenceSkills("string")).toEqual([]);
  });

  it("returns an empty array when skills is not an array", () => {
    expect(extractEvidenceSkills({ skills: "nope" })).toEqual([]);
  });
});

describe("latestSessionByUser", () => {
  it("picks the most recent row per user id regardless of input order", () => {
    const rows = [
      { user_id: "u1", created_at: "2026-01-01T00:00:00Z", report_json: { skills: [{ name: "Old", score: 40 }] } },
      { user_id: "u1", created_at: "2026-03-01T00:00:00Z", report_json: { skills: [{ name: "A", score: 1 }] } },
    ];
    const latest = latestSessionByUser(rows);
    expect(latest.get("u1")?.created_at).toBe("2026-03-01T00:00:00Z");
  });

  it("returns an empty map for no rows", () => {
    expect(latestSessionByUser([]).size).toBe(0);
  });

  it("skips a newer abandoned/incomplete session (no report_json skills) in favor of an older completed one", () => {
    // B-EMP?: an in-progress or abandoned session gets a `sessions` row but
    // never a scored report_json, so picking strictly by created_at would
    // surface "no evidence" for a candidate who actually has a completed,
    // scored session sitting further back in their history.
    const rows = [
      { user_id: "u1", created_at: "2026-03-01T00:00:00Z", report_json: {} },
      { user_id: "u1", created_at: "2026-01-01T00:00:00Z", report_json: { skills: [{ name: "STAR structure", score: 70 }] } },
    ];
    const latest = latestSessionByUser(rows);
    expect(latest.get("u1")?.created_at).toBe("2026-01-01T00:00:00Z");
  });

  it("returns no session for a user when every row lacks scored skills", () => {
    const rows = [
      { user_id: "u2", created_at: "2026-02-01T00:00:00Z", report_json: {} },
      { user_id: "u2", created_at: "2026-01-01T00:00:00Z", report_json: null },
    ];
    expect(latestSessionByUser(rows).has("u2")).toBe(false);
  });

  it("skips a newer salary-negotiation session in favor of an older interview session", () => {
    const rows = [
      { user_id: "u1", created_at: "2026-03-01T00:00:00Z", report_json: { skills: [{ name: "Anchoring", score: 90 }] }, type: "salary-negotiation" },
      { user_id: "u1", created_at: "2026-01-01T00:00:00Z", report_json: { skills: [{ name: "STAR structure", score: 70 }] }, type: "behavioral" },
    ];
    const latest = latestSessionByUser(rows);
    expect(latest.get("u1")?.created_at).toBe("2026-01-01T00:00:00Z");
  });

  it("returns no session for a user when every row is negotiation-family", () => {
    const rows = [
      { user_id: "u1", created_at: "2026-03-01T00:00:00Z", report_json: {}, type: "Salary Negotiation" },
      { user_id: "u1", created_at: "2026-01-01T00:00:00Z", report_json: {}, type: "salary-negotiation" },
    ];
    expect(latestSessionByUser(rows).has("u1")).toBe(false);
  });
});

describe("isNegotiationSession", () => {
  it("matches negotiation-family type strings case-insensitively", () => {
    expect(isNegotiationSession("salary-negotiation")).toBe(true);
    expect(isNegotiationSession("Salary Negotiation")).toBe(true);
  });

  it("does not match interview-family or missing types", () => {
    expect(isNegotiationSession("behavioral")).toBe(false);
    expect(isNegotiationSession(undefined)).toBe(false);
    expect(isNegotiationSession("")).toBe(false);
  });
});

describe("claimProfileView", () => {
  it("returns true when the PATCH flips exactly one row (first view)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: "m1" }] });
    const claimed = await claimProfileView("https://x.supabase.co", { apikey: "k" }, "m1", "2026-01-01T00:00:00Z", fetchImpl as unknown as typeof fetch);
    expect(claimed).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain("requirement_matches?id=eq.m1&profile_viewed_at=is.null");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ profile_viewed_at: "2026-01-01T00:00:00Z" });
  });

  it("returns false when the row was already viewed (zero rows back)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    const claimed = await claimProfileView("https://x.supabase.co", { apikey: "k" }, "m1", "2026-01-01T00:00:00Z", fetchImpl as unknown as typeof fetch);
    expect(claimed).toBe(false);
  });

  it("returns false when the request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => [] });
    const claimed = await claimProfileView("https://x.supabase.co", { apikey: "k" }, "m1", "2026-01-01T00:00:00Z", fetchImpl as unknown as typeof fetch);
    expect(claimed).toBe(false);
  });

  it("returns false and does not throw when fetch rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const claimed = await claimProfileView("https://x.supabase.co", { apikey: "k" }, "m1", "2026-01-01T00:00:00Z", fetchImpl as unknown as typeof fetch);
    expect(claimed).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { extractEvidenceSkills, latestSessionByUser, isNegotiationSession } from "../../server-handlers/_employer-candidate-evidence-helpers";

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
      { user_id: "u1", created_at: "2026-01-01T00:00:00Z", report_json: { skills: [] } },
      { user_id: "u1", created_at: "2026-03-01T00:00:00Z", report_json: { skills: [{ name: "A", score: 1 }] } },
      { user_id: "u2", created_at: "2026-02-01T00:00:00Z", report_json: {} },
    ];
    const latest = latestSessionByUser(rows);
    expect(latest.get("u1")?.created_at).toBe("2026-03-01T00:00:00Z");
    expect(latest.get("u2")?.created_at).toBe("2026-02-01T00:00:00Z");
  });

  it("returns an empty map for no rows", () => {
    expect(latestSessionByUser([]).size).toBe(0);
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

import { describe, it, expect, vi } from "vitest";
import {
  extractEvidenceSkills,
  extractReadinessBand,
  extractSessionTrend,
  extractQuestionBreakdown,
  extractDeliveryMetrics,
  latestSessionByUser,
  isNegotiationSession,
  roleTokens,
  roleMatches,
  selectSessionsForRole,
  claimProfileView,
  computeVerifiedCapabilitiesForCandidate,
  scrubLockedQuestions,
  scrubLockedQuotes,
  toThirdPerson,
  type SessionRow,
} from "../../server-handlers/_employer-candidate-evidence-helpers";

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

describe("computeVerifiedCapabilitiesForCandidate", () => {
  function row(overrides: Partial<SessionRow>): SessionRow {
    return {
      user_id: "u1",
      created_at: "2026-01-01T00:00:00Z",
      report_json: {},
      score: 75,
      ...overrides,
    };
  }

  it("ignores skill_scores on sessions whose server-graded overall is below the plausibility floor", () => {
    const rows = [
      row({ created_at: "2026-01-01T00:00:00Z", score: 30, skill_scores: { communication: 95 } }),
      row({ created_at: "2026-02-01T00:00:00Z", score: 30, skill_scores: { communication: 95 } }),
    ];
    expect(computeVerifiedCapabilitiesForCandidate(rows, "u1").find((c) => c.key === "communication")?.verified).toBe(false);
  });

  it("returns all four capabilities unverified when the candidate has no sessions", () => {
    const result = computeVerifiedCapabilitiesForCandidate([], "u1");
    expect(result).toHaveLength(4);
    expect(result.every((c) => !c.verified)).toBe(true);
  });

  it("requires 2+ qualifying sessions at 70+, same bar as the candidate dashboard", () => {
    const oneHit = [row({ skill_scores: { communication: 85 } })];
    expect(computeVerifiedCapabilitiesForCandidate(oneHit, "u1").find((c) => c.key === "communication")?.verified).toBe(false);

    const twoHits = [
      row({ created_at: "2026-01-01T00:00:00Z", skill_scores: { communication: 85 } }),
      row({ created_at: "2026-02-01T00:00:00Z", skill_scores: { communication: 72 } }),
    ];
    const verified = computeVerifiedCapabilitiesForCandidate(twoHits, "u1").find((c) => c.key === "communication");
    expect(verified?.verified).toBe(true);
    expect(verified?.verifiedDateLabel).toBe("1 Feb");
  });

  it("scopes to only the requested candidate's rows, ignoring other users in the same batch", () => {
    const rows = [
      row({ user_id: "u1", skill_scores: { leadership: 90 } }),
      row({ user_id: "u2", created_at: "2026-02-01T00:00:00Z", skill_scores: { leadership: 90 } }),
      row({ user_id: "u2", created_at: "2026-03-01T00:00:00Z", skill_scores: { leadership: 90 } }),
    ];
    expect(computeVerifiedCapabilitiesForCandidate(rows, "u1").find((c) => c.key === "leadership")?.verified).toBe(false);
    expect(computeVerifiedCapabilitiesForCandidate(rows, "u2").find((c) => c.key === "leadership")?.verified).toBe(true);
  });

  it("matches Salary Negotiation by focus + overall score, not skill_scores, and does not drop negotiation rows", () => {
    const rows = [
      row({ created_at: "2026-01-01T00:00:00Z", focus: "salary-negotiation", score: 90 }),
      row({ created_at: "2026-02-01T00:00:00Z", focus: "salary-negotiation", score: 75 }),
    ];
    expect(computeVerifiedCapabilitiesForCandidate(rows, "u1").find((c) => c.key === "salary-negotiation")?.verified).toBe(true);
  });

  it("treats a missing score column as 0 rather than throwing", () => {
    const rows = [row({ score: undefined })];
    expect(() => computeVerifiedCapabilitiesForCandidate(rows, "u1")).not.toThrow();
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

describe("extractSessionTrend", () => {
  const row = (created_at: string, score?: number, focus?: string, type?: string): SessionRow => ({ user_id: "u", created_at, report_json: null, score, focus, type });

  it("returns scored sessions oldest first, clamped and rounded", () => {
    const out = extractSessionTrend([row("2026-03-02", 140), row("2026-01-01", 61.6, "  Behavioral  "), row("2026-02-01", 0), row("2026-02-15")]);
    expect(out).toEqual([
      { date: "2026-01-01", score: 62, focus: "Behavioral", type: null },
      { date: "2026-03-02", score: 100, focus: null, type: null },
    ]);
  });

  it("skips negotiation sessions and keeps only the latest `limit`", () => {
    const rows = [row("2026-01-01", 50, undefined, "negotiation"), row("2026-01-02", 60), row("2026-01-03", 70), row("2026-01-04", 80)];
    expect(extractSessionTrend(rows, 2).map((p) => p.score)).toEqual([70, 80]);
  });
});

describe("extractQuestionBreakdown", () => {
  const q = (over: Record<string, unknown> = {}) => ({
    idx: 0,
    question: "Tell me about a time you led a migration.",
    answerText: "At Acme Corp I led the move to Postgres.",
    explanation: "Good ownership at Acme Corp, thin on results.",
    verdict: "complete",
    score: 72.4,
    difficulty: "standard",
    starPresence: { S: true, T: false, A: true, R: true, L: false },
    lengthVerdict: { verdict: "right", wordCount: 180.2, targetRange: "120-240 words", note: "ok" },
    ...over,
  });

  it("omits answers and grader notes unless asked", () => {
    const [row] = extractQuestionBreakdown({ perQuestion: [q()] }, false);
    expect(row).not.toHaveProperty("answerText");
    expect(row).not.toHaveProperty("explanation");
    expect(row.question).toBe("Tell me about a time you led a migration.");
  });

  it("includes the answer and grader note when asked", () => {
    const [row] = extractQuestionBreakdown({ perQuestion: [q()] }, true);
    expect(row.answerText).toContain("Acme Corp");
    expect(row.explanation).toContain("ownership");
  });

  it("normalises score, STAR and length", () => {
    const [row] = extractQuestionBreakdown({ perQuestion: [q()] }, false);
    expect(row).toMatchObject({ score: 72, verdict: "complete", difficulty: "standard", star: { S: true, T: false, A: true, R: true }, length: { verdict: "right", wordCount: 180 } });
  });

  it("returns rows in interview order and skips malformed ones", () => {
    const out = extractQuestionBreakdown({ perQuestion: [q({ idx: 2, question: "Third" }), q({ idx: 1, question: "Second" }), q({ question: "" }), q({ verdict: "bogus" }), q({ score: "x" }), null] }, false);
    expect(out.map((r) => r.question)).toEqual(["Second", "Third"]);
  });

  it("leaves optional blocks null when absent and handles bad input", () => {
    const [row] = extractQuestionBreakdown({ perQuestion: [q({ starPresence: undefined, lengthVerdict: null, difficulty: "weird" })] }, false);
    expect(row).toMatchObject({ star: null, length: null, difficulty: null });
    expect(extractQuestionBreakdown(null, true)).toEqual([]);
    expect(extractQuestionBreakdown({}, true)).toEqual([]);
  });

  it("caps the number of rows", () => {
    const many = Array.from({ length: 30 }, (_, i) => q({ idx: i, question: `Q${i}` }));
    expect(extractQuestionBreakdown({ perQuestion: many }, false)).toHaveLength(12);
  });
});

describe("extractDeliveryMetrics", () => {
  it("reads pace, fillers, pauses, response time and hedging", () => {
    const out = extractDeliveryMetrics({
      coreMetrics: { paceWpm: 142.6, fillerPerMin: 2.34, silenceRatio: 8, energy: 70 },
      advancedDelivery: { medianLatencyMs: 2400, hedgingPerMin: 1.26 },
    });
    expect(out).toEqual({ paceWpm: 143, fillersPerMin: 2.3, pausePct: 8, responseSec: 2.4, hedgesPerMin: 1.3 });
  });

  it("treats the evaluator's all-zero default as not measured", () => {
    expect(extractDeliveryMetrics({ coreMetrics: { paceWpm: 0, fillerPerMin: 0, silenceRatio: 0, energy: 0 } })).toBeNull();
    expect(extractDeliveryMetrics({})).toBeNull();
    expect(extractDeliveryMetrics(null)).toBeNull();
  });

  it("keeps a real zero for fillers but drops an unmeasured response gap", () => {
    const out = extractDeliveryMetrics({ coreMetrics: { paceWpm: 120, fillerPerMin: 0, silenceRatio: 0 }, advancedDelivery: { medianLatencyMs: 0 } });
    expect(out).toMatchObject({ fillersPerMin: 0, pausePct: 0, responseSec: null, hedgesPerMin: null });
  });
});

describe("locked evidence scrubbing", () => {
  it("strips the name from questions and masks it in answers, keeping employers", () => {
    const [out] = scrubLockedQuestions(
      [{ question: "Priya, what did you ship at Acme?", answerText: "I'm Priya Sharma. At Acme I mail priya@acme.in.", explanation: "Priya showed ownership." }],
      "Priya Sharma",
    );
    expect(out.question).toBe("what did you ship at Acme?");
    expect(out.answerText).toBe("I'm [name]. At Acme I mail [redacted].");
    expect(out.explanation).toBe("[name] showed ownership.");
  });

  it("leaves generic questions untouched", () => {
    const [out] = scrubLockedQuestions([{ question: "Describe a project you are proud of." }], "Priya Sharma");
    expect(out.question).toBe("Describe a project you are proud of.");
  });

  it("scrubs the name and contact details out of quotes", () => {
    const [out] = scrubLockedQuotes([{ kind: "win", text: "Priya led it", quote: "Call me on +91 98765 43210, Priya here" }], "Priya Sharma");
    expect(JSON.stringify(out)).not.toMatch(/Priya|98765/);
  });
});

describe("toThirdPerson", () => {
  it("recasts grader notes written to the candidate", () => {
    expect(toThirdPerson("You gave a concrete timeline and your trade-offs were clear.")).toBe("They gave a concrete timeline and their trade-offs were clear.");
    expect(toThirdPerson("You're specific, but the team told you to slow down.")).toBe("They're specific, but the team told them to slow down.");
    expect(toThirdPerson("Shipped it when you had to.")).toBe("Shipped it when they had to.");
  });

  it("leaves text without second person untouched", () => {
    expect(toThirdPerson("Clear ownership of the migration.")).toBe("Clear ownership of the migration.");
  });
});

describe("roleTokens / roleMatches", () => {
  it("drops seniority filler and normalises synonyms", () => {
    expect([...roleTokens("Senior Product Designer")]).toEqual(["product", "designer"]);
    expect(roleTokens("SDE II")).toEqual(new Set(["software", "engineer"]));
    expect(roleTokens("Backend Developer")).toEqual(new Set(["backend", "engineer"]));
    expect(roleTokens(null).size).toBe(0);
  });

  it("matches seniority variants of the same role", () => {
    expect(roleMatches("Product Designer", "Senior Product Designer")).toBe("yes");
    expect(roleMatches("Senior Product Designer", "Product Designer")).toBe("yes");
    expect(roleMatches("Senior Engineer", "Software Engineer")).toBe("yes");
    expect(roleMatches("SDE", "Software Engineer")).toBe("yes");
  });

  it("matches a long profile headline that contains the role", () => {
    expect(roleMatches("Aspiring Software Engineer | BCA Honours Student", "Software Engineer")).toBe("yes");
  });

  it("rejects a different role", () => {
    expect(roleMatches("Product Designer", "Software Engineer")).toBe("no");
    expect(roleMatches("Engineering Manager", "Product Designer")).toBe("no");
  });

  it("is unknown when either side has no usable role text", () => {
    expect(roleMatches("", "Software Engineer")).toBe("unknown");
    expect(roleMatches("Software Engineer", null)).toBe("unknown");
    expect(roleMatches("Senior", "Software Engineer")).toBe("unknown");
  });
});

describe("selectSessionsForRole", () => {
  const scored = { skills: [{ name: "Clarity", score: 70 }] };
  const row = (over: Partial<SessionRow>): SessionRow => ({ user_id: "u1", created_at: "2026-03-01T00:00:00Z", report_json: scored, target_role: "Software Engineer", ...over });

  it("is matched and keeps only the requirement's role when sessions exist for it", () => {
    const rows = [
      row({ created_at: "2026-03-01T00:00:00Z", target_role: "Software Engineer" }),
      row({ created_at: "2026-02-01T00:00:00Z", target_role: "Senior Product Designer" }),
    ];
    const out = selectSessionsForRole(rows, "Product Designer");
    expect(out.fit.status).toBe("matched");
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].target_role).toBe("Senior Product Designer");
  });

  it("is a mismatch, with no evidence rows, when the candidate only practised another role", () => {
    const out = selectSessionsForRole([row({ target_role: "Software Engineer" })], "Product Designer");
    expect(out.rows).toHaveLength(0);
    expect(out.fit).toEqual({ status: "mismatch", practicedFor: "Software Engineer", practicedAt: "2026-03-01T00:00:00Z" });
  });

  it("keeps sessions with no recorded role instead of calling them a mismatch", () => {
    const out = selectSessionsForRole([row({ target_role: null })], "Product Designer");
    expect(out.fit.status).toBe("matched");
    expect(out.rows).toHaveLength(1);
  });

  it("is none when there is no interview evidence at all", () => {
    expect(selectSessionsForRole([], "Product Designer").fit.status).toBe("none");
    const negotiationOnly = row({ type: "salary-negotiation", target_role: "Software Engineer" });
    expect(selectSessionsForRole([negotiationOnly], "Product Designer").fit.status).toBe("none");
  });
});

describe("extractReadinessBand", () => {
  it("reports the band the session scored in, not the band the forecast aims for", () => {
    const report = { band: "leanHire", scoreConfidence: 0.9, readiness: { targetBand: "hire", confidence: "high" } };
    expect(extractReadinessBand(report)).toEqual({ band: "leanHire", confidence: "high" });
  });

  it("buckets score confidence the same way the session report does", () => {
    expect(extractReadinessBand({ band: "hire", scoreConfidence: 0.75 })?.confidence).toBe("medium");
    expect(extractReadinessBand({ band: "hire", scoreConfidence: 0.5 })?.confidence).toBe("low");
    expect(extractReadinessBand({ band: "hire" })?.confidence).toBe("low");
  });

  it("returns null below Lean hire so no readiness is claimed", () => {
    expect(extractReadinessBand({ band: "noHire", readiness: { targetBand: "leanHire" } })).toBeNull();
    expect(extractReadinessBand({ band: "strongNoHire" })).toBeNull();
  });

  it("derives the band from the score and calibration on older reports without one", () => {
    const bands = { strongHire: 85, hire: 70, leanHire: 55, noHire: 40 };
    expect(extractReadinessBand({ overallScore: 72, calibration: { bands } })?.band).toBe("hire");
    expect(extractReadinessBand({ overallScore: 30, calibration: { bands } })).toBeNull();
  });

  it("ignores reports it cannot read", () => {
    expect(extractReadinessBand(null)).toBeNull();
    expect(extractReadinessBand({ readiness: { targetBand: "hire" } })).toBeNull();
  });
});

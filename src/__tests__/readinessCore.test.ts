import { describe, it, expect } from "vitest";
import {
  computeReadiness,
  rangeSlice,
  rangeSliceDated,
  rangeStartIndex,
  RANGE_LABEL,
  type RawSession,
  type RIReport,
  type ReadinessInput,
} from "../../server-handlers/_readiness-core";

/* Fixed clock so every assertion is deterministic. 2026-06-13. */
const NOW = Date.UTC(2026, 5, 13, 12, 0, 0);
const DAY = 86_400_000;
const daysAgo = (d: number): string => new Date(NOW - d * DAY).toISOString();

function star(s = true, t = true, a = true, r = true, l = true) {
  return { S: s, T: t, A: a, R: r, L: l };
}

function report(over: Partial<RIReport> = {}): RIReport {
  return {
    overallScore: 70,
    band: "hire",
    skills: [
      { name: "Product Sense", score: 80, weight: 1 },
      { name: "Analytical", score: 62, weight: 1 },
    ],
    coreMetrics: { fillerPerMin: 4, silenceRatio: 12, paceWpm: 140, energy: 72 },
    advancedDelivery: { hedgingPerMin: 2, lexicalDiversity: 0.55, firstPersonRatio: 0.7, medianLatencyMs: 1800, selfCorrectionRate: 1 },
    perQuestion: [
      { idx: 0, question: "Tell me about a launch.", verdict: "complete", score: 72, difficulty: "standard", frequencyPct: 60, starPresence: star(), lengthVerdict: { verdict: "right" }, culturalRegister: { hedgedDisagreement: false, indirectFailureFraming: false, relationalFraming: true, calendarAnchored: false, deferentialGratitude: true, pedigreeRecital: false }, likelyFollowUp: { question: "What was the guardrail metric?", why: "No counter-metric stated." } },
    ],
    thoughtBubble: [
      { startMs: 0, endMs: 30_000, state: "tracking", note: "Clear setup." },
      { startMs: 60_000, endMs: 90_000, state: "impressed", note: "Strong result." },
    ],
    calibration: { companyLabel: "Razorpay", note: "", bands: { strongHire: 86, hire: 72, leanHire: 56, noHire: 40 } },
    crossSessionInsights: [{ kind: "improvement", text: "Pace settled.", metric: "Pace", delta: -10 }],
    blindSpots: [{ competency: "Conflict", frequencyPct: 68, note: "Untested." }],
    storyReuseFindings: [{ storyLabel: "Catalyst launch", questionIndices: [0, 1], concern: "Thin portfolio." }],
    readiness: { targetBand: "hire", estimatedHours: 4, estimatedSessions: 3, confidence: "medium", rationale: "Close the gap." },
    resumeGrounding: { score: 70, rationale: "Anchored in real projects." },
    reverseInterview: { counts: { green: 3, yellow: 1, red: 0 }, verdict: "strong" },
    coaching: { strength: { headline: "Customer-led", meaning: "Opens from a user problem." }, gap: { headline: "Quantify", meaning: "Stops before the result.", example: "Say 31 to 44 percent." } },
    focusMetrics: [{ label: "STAR coverage", value: "82%", tone: "good" }],
    redFlags: [{ type: "missing_result", severity: "high", title: "Missing Result", explanation: "No metric.", quote: "and that is roughly what we did." }],
    wins: [],
    fixes: [{ text: "State the outcome with a number.", questionIdx: 0, quote: "it worked out okay" }],
    ...over,
  };
}

function session(over: Partial<RawSession> = {}): RawSession {
  return {
    id: over.id || "s",
    createdAt: over.createdAt || daysAgo(1),
    focus: over.focus ?? "behavioral",
    type: over.type ?? "behavioral",
    difficulty: over.difficulty ?? "standard",
    duration: over.duration ?? 1800,
    score: over.score ?? 70,
    questions: over.questions ?? 6,
    company: over.company,
    negotiationMetrics: over.negotiationMetrics ?? null,
    report: over.report !== undefined ? over.report : report(),
  };
}

function input(sessions: RawSession[], profileOver = {}): ReadinessInput {
  return {
    sessions,
    profile: { targetRole: "Senior PM", targetCompany: "Razorpay", experienceLevel: "senior", interviewDate: "2026-06-27", practiceTimestamps: [], ...profileOver },
    nowMs: NOW,
  };
}

describe("computeReadiness — shape & guards", () => {
  it("returns null for no sessions", () => {
    expect(computeReadiness(input([]))).toBeNull();
  });

  it("returns a full payload for one session", () => {
    const p = computeReadiness(input([session({ id: "a", createdAt: daysAgo(2) })]))!;
    expect(p).not.toBeNull();
    expect(p.sessions).toBe(1);
    expect(p.pillars).toHaveLength(5);
    expect(p.pillarLabels).toEqual(["Competence", "Consistency", "Coverage", "Currency", "Composure"]);
    expect(p.meta.sparse).toBe(true);
  });

  it("RI is a 0-100 weighted composite of the five pillars", () => {
    const p = computeReadiness(input([session({ id: "a" })]))!;
    const w = { competence: 0.34, consistency: 0.18, coverage: 0.18, currency: 0.12, composure: 0.18 };
    const expected = Math.round(p.pillars.reduce((acc, pl) => acc + pl.score * w[pl.key], 0));
    expect(p.ri).toBe(expected);
    expect(p.ri).toBeGreaterThanOrEqual(0);
    expect(p.ri).toBeLessThanOrEqual(100);
  });

  it("pillar weights sum to 1", () => {
    const p = computeReadiness(input([session()]))!;
    const sum = p.pillars.reduce((a, pl) => a + pl.weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe("computeReadiness — pillars from data", () => {
  it("competence is the weighted average of latest skill scores", () => {
    const p = computeReadiness(input([session({ id: "a" })]))!;
    const comp = p.pillars.find((x) => x.key === "competence")!;
    // (80 + 62) / 2 = 71
    expect(comp.score).toBe(71);
  });

  it("consistency falls when session scores vary widely", () => {
    const tight = computeReadiness(input([
      session({ id: "a", createdAt: daysAgo(20), score: 70, report: report({ overallScore: 70 }) }),
      session({ id: "b", createdAt: daysAgo(10), score: 72, report: report({ overallScore: 72 }) }),
      session({ id: "c", createdAt: daysAgo(2), score: 71, report: report({ overallScore: 71 }) }),
    ]))!;
    const swingy = computeReadiness(input([
      session({ id: "a", createdAt: daysAgo(20), score: 45, report: report({ overallScore: 45 }) }),
      session({ id: "b", createdAt: daysAgo(10), score: 82, report: report({ overallScore: 82 }) }),
      session({ id: "c", createdAt: daysAgo(2), score: 50, report: report({ overallScore: 50 }) }),
    ]))!;
    const tc = tight.pillars.find((x) => x.key === "consistency")!.score;
    const sc = swingy.pillars.find((x) => x.key === "consistency")!.score;
    expect(tc).toBeGreaterThan(sc);
  });

  it("coverage rises with breadth of round types", () => {
    const narrow = computeReadiness(input([
      session({ id: "a", focus: "behavioral", type: "behavioral" }),
      session({ id: "b", focus: "behavioral", type: "behavioral" }),
    ]))!;
    const broad = computeReadiness(input([
      session({ id: "a", focus: "behavioral", type: "behavioral" }),
      session({ id: "b", focus: "system design", type: "system design" }),
      session({ id: "c", focus: "case study", type: "case" }),
      session({ id: "d", focus: "product sense", type: "product" }),
    ]))!;
    expect(broad.coverage.focusDone).toBeGreaterThan(narrow.coverage.focusDone);
    expect(broad.coverage.focusTotal).toBe(8);
    expect(broad.pillars.find((x) => x.key === "coverage")!.score)
      .toBeGreaterThan(narrow.pillars.find((x) => x.key === "coverage")!.score);
  });

  it("currency decays and populates the refresh queue for idle skills", () => {
    const p = computeReadiness(input([
      session({ id: "a", createdAt: daysAgo(30), report: report({ skills: [{ name: "Influencing", score: 70 }] }) }),
    ]))!;
    expect(p.refresh.length).toBeGreaterThanOrEqual(1);
    expect(p.refresh[0].skill).toBe("Influencing");
    expect(p.refresh[0].days).toBeGreaterThan(7);
    expect(p.refresh[0].decay).toBeLessThan(0);
  });

  it("composure scores delivery against comfort bands (fast pace + high fillers score lower)", () => {
    const calm = computeReadiness(input([session({ id: "a", report: report({ coreMetrics: { fillerPerMin: 3, silenceRatio: 10, paceWpm: 140, energy: 75 } }) })]))!;
    const hot = computeReadiness(input([session({ id: "a", report: report({ coreMetrics: { fillerPerMin: 9, silenceRatio: 22, paceWpm: 178, energy: 60 } }) })]))!;
    expect(calm.pillars.find((x) => x.key === "composure")!.score)
      .toBeGreaterThan(hot.pillars.find((x) => x.key === "composure")!.score);
  });
});

describe("computeReadiness — trajectory, threshold, band", () => {
  it("builds a per-session trajectory and a baseline from the first session", () => {
    const p = computeReadiness(input([
      session({ id: "a", createdAt: daysAgo(30) }),
      session({ id: "b", createdAt: daysAgo(15) }),
      session({ id: "c", createdAt: daysAgo(2) }),
    ]))!;
    expect(p.trajectory).toHaveLength(3);
    expect(p.baseline.ri).toBe(p.trajectory[0]);
  });

  it("threshold uses the calibrated company hire band when present", () => {
    const p = computeReadiness(input([session({ id: "a" })]))!;
    expect(p.threshold).toBe(72); // from calibration.bands.hire
    expect(p.cohort.ri).toBe(72);
  });

  it("falls back to the tier hire bar when no calibration", () => {
    const p = computeReadiness(input([session({ id: "a", report: report({ calibration: undefined }) })], { targetCompany: "Google" }))!;
    expect(p.threshold).toBe(78); // faang tier bar
  });

  it("band reflects RI vs threshold", () => {
    const ready = computeReadiness(input([session({ id: "a", report: report({ overallScore: 90, skills: [{ name: "x", score: 90 }] }) })]))!;
    expect(["ready", "almost"]).toContain(ready.band);
  });
});

describe("computeReadiness — aggregations", () => {
  it("builds a band histogram across sessions", () => {
    const p = computeReadiness(input([
      session({ id: "a", report: report({ band: "hire" }) }),
      session({ id: "b", report: report({ band: "leanHire" }) }),
      session({ id: "c", report: report({ band: "hire" }) }),
    ]))!;
    const hire = p.bandMix.find((b) => b.band === "hire")!;
    const lean = p.bandMix.find((b) => b.band === "leanHire")!;
    expect(hire.n).toBe(2);
    expect(lean.n).toBe(1);
  });

  it("aggregates red flags by type with hits, of, and a quote", () => {
    const p = computeReadiness(input([
      session({ id: "a" }),
      session({ id: "b" }),
    ]))!;
    const flag = p.redFlags.find((f) => f.type === "missing_result")!;
    expect(flag.hits).toBe(2);
    expect(flag.of).toBe(2);
    expect(flag.quote.length).toBeGreaterThan(0);
  });

  it("derives cultural-register rates with the right tone", () => {
    const p = computeReadiness(input([session({ id: "a" })]))!;
    const rel = p.cultural.find((c) => c.key === "relationalFraming");
    expect(rel?.tone).toBe("asset");
    expect(rel?.ratePct).toBe(100);
  });

  it("builds answer-craft verdict mix, ownership and quantified share", () => {
    const p = computeReadiness(input([session({ id: "a" })]))!;
    expect(p.answerCraft.ownershipPct).toBe(70); // firstPersonRatio 0.7
    expect(p.answerCraft.verdictMix.find((v) => v.label === "Complete")!.n).toBe(1);
    expect(p.answerCraft.quantifiedPct).toBeGreaterThanOrEqual(0);
    // With real answers in hand, the quantified share is observed, not a
    // modelled estimate, so it must NOT carry the caveat marker.
    expect(p.meta.modelled).not.toContain("answerCraft.quantifiedPct");
  });

  it("maps the latest thoughtBubble to an attention timeline in percent", () => {
    const p = computeReadiness(input([session({ id: "a", duration: 90 })]))!;
    expect(p.attention.length).toBe(2);
    expect(p.attention[0].atPct).toBe(0);
    expect(p.attention[0].state).toBe("tracking");
    p.attention.forEach((a) => { expect(a.atPct).toBeGreaterThanOrEqual(0); expect(a.atPct).toBeLessThanOrEqual(100); });
  });

  it("dedupes follow-ups and keeps the highest frequency", () => {
    const p = computeReadiness(input([session({ id: "a" }), session({ id: "b" })]))!;
    expect(p.followUps.length).toBe(1);
    expect(p.followUps[0].question).toContain("guardrail");
    expect(p.followUps[0].freqPct).toBe(60);
  });

  it("reads negotiation metrics from a negotiation-focus session", () => {
    // Producer (save-session.ts) persists `bandTraversal` on a 0-1 scale and
    // never writes a free-text archetype, so the fixture mirrors that exactly.
    const p = computeReadiness(input([
      session({ id: "a" }),
      session({ id: "n", focus: "salary-negotiation", type: "salary-negotiation", negotiationMetrics: { score: 72, outcome: "accepted", anchorTurn: 1, lpaGained: 6.5, bandTraversal: 0.68, leverDiversity: 4 } }),
    ]))!;
    expect(p.negotiation).not.toBeNull();
    expect(p.negotiation!.outcome).toBe("accepted");
    expect(p.negotiation!.lpaGained).toBe(6.5);
    // bandTraversal 0.68 → 68%, not the 0 it pinned to when reading a
    // non-existent bandTraversalPct key.
    expect(p.negotiation!.bandTraversalPct).toBe(68);
    // archetype is derived: 4 levers crossing 68% of the band → multi-lever.
    expect(p.negotiation!.archetype).toContain("Multi-lever");
  });

  it("returns null negotiation when no negotiation session exists", () => {
    const p = computeReadiness(input([session({ id: "a" })]))!;
    expect(p.negotiation).toBeNull();
  });

  it("builds a 28-day cadence heatmap from practice timestamps", () => {
    const stamps = [daysAgo(1), daysAgo(1), daysAgo(5), daysAgo(20)];
    const p = computeReadiness(input([session({ id: "a", createdAt: daysAgo(1) })], { practiceTimestamps: stamps }))!;
    expect(p.cadence.heat).toHaveLength(28);
    expect(p.cadence.heat.reduce((a, b) => a + b, 0)).toBe(4);
    expect(p.cadence.weeks).toBe(4);
  });

  it("builds a resume-grounding trend or null", () => {
    const p = computeReadiness(input([
      session({ id: "a", report: report({ resumeGrounding: { score: 60, rationale: "x" } }) }),
      session({ id: "b", report: report({ resumeGrounding: { score: 76, rationale: "better" } }) }),
    ]))!;
    expect(p.resume).not.toBeNull();
    expect(p.resume!.trend).toEqual([60, 76]);
    expect(p.resume!.score).toBe(76);

    const none = computeReadiness(input([session({ id: "a", report: report({ resumeGrounding: null }) })]))!;
    expect(none.resume).toBeNull();
  });

  it("maps reverse-interview verdict and counts", () => {
    const p = computeReadiness(input([session({ id: "a" })]))!;
    expect(p.reverse.green).toBe(3);
    expect(p.reverse.verdict).toBe("strong");
  });

  it("aggregates skills with delta and a modelled percentile", () => {
    const p = computeReadiness(input([
      session({ id: "a", createdAt: daysAgo(20), report: report({ skills: [{ name: "Product Sense", score: 70 }] }) }),
      session({ id: "b", createdAt: daysAgo(2), report: report({ skills: [{ name: "Product Sense", score: 80 }] }) }),
    ]))!;
    const ps = p.skills.find((s) => s.name === "Product Sense")!;
    expect(ps.score).toBe(80);
    expect(ps.delta).toBe(10);
    expect(ps.percentile).toBeGreaterThanOrEqual(2);
    expect(ps.percentile).toBeLessThanOrEqual(99);
    expect(p.meta.modelled).toContain("percentile");
  });
});

describe("target company resolution", () => {
  it("uses the profile target company when set", () => {
    const p = computeReadiness(input([session({ id: "a", company: "Stripe" })], { targetCompany: "Razorpay" }))!;
    expect(p.target.company).toBe("Razorpay");
    expect(p.target.hasCompany).toBe(true);
  });

  it("does NOT borrow a company from sessions when the profile is blank (holistic view)", () => {
    const sessions = [
      session({ id: "a", createdAt: daysAgo(3), company: "Flipkart" }),
      session({ id: "b", createdAt: daysAgo(1), company: "Razorpay" }),
    ];
    const p = computeReadiness(input(sessions, { targetCompany: "" }))!;
    // No profile company → stay holistic, never peg the view to a session's company.
    expect(p.target.company).toBe("");
    expect(p.target.hasCompany).toBe(false);
    expect(p.cohort.label).not.toContain("Flipkart");
    expect(p.cohort.label).not.toContain("Razorpay");
  });

  it("uses a role-level cohort label when the profile company is blank", () => {
    const sessions = [session({ id: "a", company: "Flipkart" })];
    const p = computeReadiness(input(sessions, { targetCompany: "", targetRole: "Senior PM" }))!;
    expect(p.cohort.label).toBe("Senior PM hire bar");
    expect(p.cohort.label).not.toContain("Flipkart");
  });

  it("never leaks a placeholder company — stays empty and flags holistic when nothing is set", () => {
    const p = computeReadiness(input([session({ id: "a", company: undefined })], { targetCompany: "" }))!;
    // Empty + hasCompany=false is the contract the UI keys on to drop the
    // company chip and switch to strong-hire-bar / role-level phrasing.
    expect(p.target.company).toBe("");
    expect(p.target.hasCompany).toBe(false);
  });
});

describe("rangeSlice helper", () => {
  it("returns all for 'all' or short series", () => {
    expect(rangeSlice([1, 2], "7d")).toEqual([1, 2]);
    expect(rangeSlice([1, 2, 3, 4, 5], "all")).toEqual([1, 2, 3, 4, 5]);
  });
  it("keeps the last 7 for '7d' and last 30 for '1m'", () => {
    const s = Array.from({ length: 40 }, (_, i) => i + 1);
    expect(rangeSlice(s, "7d")).toEqual([34, 35, 36, 37, 38, 39, 40]);
    expect(rangeSlice(s, "1m")).toEqual(s.slice(10));
  });
  it("exposes range labels", () => {
    expect(RANGE_LABEL["7d"]).toBe("7 days");
    expect(RANGE_LABEL.all).toBe("all time");
  });
});

/* The client bundle re-implements rangeSlice/RANGE_LABEL in readinessIndex/
   types.ts so it pulls no server-handler runtime. That duplication is only
   safe while the two copies stay byte-for-byte equivalent in behaviour. */
describe("rangeSlice / RANGE_LABEL core-vs-client parity", () => {
  it("produces identical labels and slices across both copies", async () => {
    const client = await import("../readinessIndex/types");
    const ranges = ["7d", "1m", "all"] as const;
    for (const r of ranges) expect(client.RANGE_LABEL[r]).toBe(RANGE_LABEL[r]);
    const series = Array.from({ length: 40 }, (_, i) => i + 1);
    const cases: number[][] = [[], [1], [1, 2], [1, 2, 3, 4, 5], series];
    for (const s of cases) for (const r of ranges) {
      expect(client.rangeSlice(s, r)).toEqual(rangeSlice(s, r));
    }
    // Dated variants must also stay byte-for-byte equivalent.
    const day = 86_400_000;
    const stampCases = series.map((_, i) => NOW - (series.length - 1 - i) * day);
    for (const r of ranges) {
      expect(client.rangeSliceDated(series, stampCases, r, NOW)).toEqual(rangeSliceDated(series, stampCases, r, NOW));
      expect(client.rangeStartIndex(stampCases, r, NOW)).toBe(rangeStartIndex(stampCases, r, NOW));
    }
  });
});

describe("rangeSliceDated date-windowing", () => {
  const day = 86_400_000;
  it("returns the full series for 'all' regardless of stamps", () => {
    const s = [1, 2, 3];
    expect(rangeSliceDated(s, [NOW - 100 * day, NOW - 50 * day, NOW], "all", NOW)).toEqual(s);
  });
  it("drops points older than the window cutoff", () => {
    const s = [10, 20, 30, 40];
    const stamps = [NOW - 40 * day, NOW - 20 * day, NOW - 5 * day, NOW - day];
    expect(rangeSliceDated(s, stamps, "7d", NOW)).toEqual([30, 40]);
    expect(rangeSliceDated(s, stamps, "1m", NOW)).toEqual([20, 30, 40]);
  });
  it("falls back to the full series when stamps and series misalign", () => {
    expect(rangeSliceDated([1, 2, 3], [NOW], "7d", NOW)).toEqual([1, 2, 3]);
  });
  it("keeps the last point when every stamp predates the window", () => {
    const s = [1, 2, 3];
    const stamps = [NOW - 100 * day, NOW - 90 * day, NOW - 80 * day];
    expect(rangeSliceDated(s, stamps, "7d", NOW)).toEqual([3]);
  });
  it("emits one trajectory stamp per session, ascending", () => {
    const r = computeReadiness(input([
      session({ id: "a", createdAt: daysAgo(40) }),
      session({ id: "b", createdAt: daysAgo(20) }),
      session({ id: "c", createdAt: daysAgo(5) }),
      session({ id: "d", createdAt: daysAgo(1) }),
    ]))!;
    expect(r.trajectoryStamps.length).toBe(r.trajectory.length);
    for (let i = 1; i < r.trajectoryStamps.length; i++) {
      expect(r.trajectoryStamps[i]).toBeGreaterThanOrEqual(r.trajectoryStamps[i - 1]);
    }
  });
});

import { describe, it, expect } from "vitest";
import {
  applyBands,
  resolveCompanyProfile,
  computeCoreMetrics,
  computeAdvancedDelivery,
  filterGroundedItems,
  filterGroundedRedFlags,
  validateReportShape,
  computeBlendedOverall,
  normalizeThoughtBubble,
  normalizeScoreConfidence,
  normalizeStoryReuse,
  normalizeBlindSpots,
  normalizeReadiness,
  normalizeCoaching,
  normalizeCrossSessionInsights,
  normalizeFocusMetrics,
  DEFAULT_BANDS,
  type TranscriptTurn,
  type WinOrFix,
  type RedFlag,
} from "../../server-handlers/_evaluate-session-helpers";

/**
 * evaluate-session is the core scoring path — a bug here ships wrong
 * scores to candidates. Pure helpers extracted into _evaluate-session-helpers.ts
 * so we can verify the score blend, calibration, and grounding guards
 * without needing the LLM or HTTP harness.
 */

describe("applyBands", () => {
  it("classifies into all five bands at boundary scores", () => {
    expect(applyBands(95, DEFAULT_BANDS)).toBe("strongHire");
    expect(applyBands(85, DEFAULT_BANDS)).toBe("strongHire"); // inclusive
    expect(applyBands(84, DEFAULT_BANDS)).toBe("hire");
    expect(applyBands(70, DEFAULT_BANDS)).toBe("hire");
    expect(applyBands(69, DEFAULT_BANDS)).toBe("leanHire");
    expect(applyBands(55, DEFAULT_BANDS)).toBe("leanHire");
    expect(applyBands(40, DEFAULT_BANDS)).toBe("noHire");
    expect(applyBands(39, DEFAULT_BANDS)).toBe("strongNoHire");
    expect(applyBands(0, DEFAULT_BANDS)).toBe("strongNoHire");
  });

  it("respects company-specific bands (Amazon stricter than default)", () => {
    const amazon = resolveCompanyProfile("Amazon")!;
    // 87 would be strongHire on default but only "hire" at Amazon (strongHire=90)
    expect(applyBands(87, DEFAULT_BANDS)).toBe("strongHire");
    expect(applyBands(87, amazon.bands)).toBe("hire");
  });
});

describe("resolveCompanyProfile", () => {
  it("returns null for empty/null/undefined", () => {
    expect(resolveCompanyProfile(null)).toBeNull();
    expect(resolveCompanyProfile(undefined)).toBeNull();
    expect(resolveCompanyProfile("")).toBeNull();
  });

  it("matches direct keys case-insensitively and strips punctuation", () => {
    expect(resolveCompanyProfile("Amazon")?.label).toBe("Amazon");
    expect(resolveCompanyProfile("AMAZON")?.label).toBe("Amazon");
    expect(resolveCompanyProfile("amazon!")?.label).toBe("Amazon");
  });

  it("resolves common aliases (aws → amazon, fb → meta)", () => {
    expect(resolveCompanyProfile("aws")?.label).toBe("Amazon");
    expect(resolveCompanyProfile("fb")?.label).toBe("Meta");
    expect(resolveCompanyProfile("msft")?.label).toBe("Microsoft");
  });

  it("falls back to substring match for compound names", () => {
    // "google india" → contains "google"
    expect(resolveCompanyProfile("google india")?.label).toBe("Google");
  });

  it("returns null for unknown company", () => {
    expect(resolveCompanyProfile("acme-co-i-just-made-up")).toBeNull();
  });
});

describe("computeCoreMetrics", () => {
  it("counts fillers per minute against the candidate corpus only", () => {
    const transcript: TranscriptTurn[] = [
      { role: "interviewer", text: "Tell me about yourself, like, in detail" },
      { role: "candidate", text: "Um, like, basically I am, you know, a developer" },
    ];
    const m = computeCoreMetrics(transcript, 60);
    // 5 fillers in candidate text only ("Um", "like", "basically", "you know", and "I" not included)
    // Interviewer's "like" must NOT count.
    expect(m.fillerPerMin).toBeGreaterThan(0);
    expect(m.paceWpm).toBeGreaterThan(0);
  });

  it("returns zero metrics for empty transcript", () => {
    const m = computeCoreMetrics([], 60);
    expect(m.fillerPerMin).toBe(0);
    expect(m.paceWpm).toBe(0);
    expect(m.silenceRatio).toBe(0);
  });

  it("clamps silenceRatio to 0..100", () => {
    const transcript: TranscriptTurn[] = [
      { role: "candidate", text: "first", startMs: 0, endMs: 1000 },
      { role: "candidate", text: "second", startMs: 999_999, endMs: 1_000_000 },
    ];
    const m = computeCoreMetrics(transcript, 10);
    expect(m.silenceRatio).toBeLessThanOrEqual(100);
    expect(m.silenceRatio).toBeGreaterThanOrEqual(0);
  });

  it("ignores inter-turn gaps under the 1500ms threshold", () => {
    const transcript: TranscriptTurn[] = [
      { role: "candidate", text: "a", startMs: 0, endMs: 1000 },
      { role: "candidate", text: "b", startMs: 1500, endMs: 2000 }, // 500ms gap < 1500
    ];
    const m = computeCoreMetrics(transcript, 60);
    expect(m.silenceRatio).toBe(0);
  });
});

describe("computeAdvancedDelivery", () => {
  it("computes firstPersonRatio with I vs we", () => {
    const transcript: TranscriptTurn[] = [
      { role: "candidate", text: "I led the project. I owned the rollout. We shipped it." },
    ];
    const d = computeAdvancedDelivery(transcript, 60);
    // 2x I, 1x we → 2/3 ≈ 0.67
    expect(d.firstPersonRatio).toBeCloseTo(0.67, 1);
  });

  it("returns 0.5 firstPersonRatio when neither I nor we appear", () => {
    const transcript: TranscriptTurn[] = [{ role: "candidate", text: "the team built it" }];
    const d = computeAdvancedDelivery(transcript, 60);
    expect(d.firstPersonRatio).toBe(0.5);
  });

  it("computes median latency from interviewer→candidate gaps only", () => {
    const transcript: TranscriptTurn[] = [
      { role: "interviewer", text: "q1", startMs: 0, endMs: 1000 },
      { role: "candidate", text: "a1", startMs: 2000, endMs: 5000 }, // 1000ms gap
      { role: "interviewer", text: "q2", startMs: 5000, endMs: 6000 },
      { role: "candidate", text: "a2", startMs: 8000, endMs: 9000 }, // 2000ms gap
    ];
    const d = computeAdvancedDelivery(transcript, 60);
    // median of [1000, 2000] → element at floor(2/2)=1 → 2000
    expect(d.medianLatencyMs).toBe(2000);
  });

  it("clamps lexical diversity to 0 for very short answers (<20 words)", () => {
    const transcript: TranscriptTurn[] = [
      { role: "candidate", text: "yes good answer" },
    ];
    const d = computeAdvancedDelivery(transcript, 60);
    expect(d.lexicalDiversity).toBe(0);
  });
});

describe("filterGroundedItems", () => {
  const corpus = "I led the migration to Postgres last year, shipping in three months";

  it("drops items whose quote isn't in the candidate corpus", () => {
    const items: WinOrFix[] = [
      { text: "Strong ownership", questionIdx: 0, quote: "I led the migration" },
      { text: "Hallucinated", questionIdx: 0, quote: "I single-handedly invented Kubernetes" },
    ];
    const out = filterGroundedItems(items, corpus);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("Strong ownership");
  });

  it("allows cross-cutting items (questionIdx=-1) without a quote", () => {
    const items: WinOrFix[] = [
      { text: "Pace was fast", questionIdx: -1, quote: "" },
    ];
    expect(filterGroundedItems(items, corpus)).toHaveLength(1);
  });

  it("caps at 3 items even if more pass the grounding check", () => {
    const items: WinOrFix[] = Array(6).fill({ text: "ok", questionIdx: -1, quote: "" });
    expect(filterGroundedItems(items, corpus)).toHaveLength(3);
  });

  it("returns [] for non-array input", () => {
    expect(filterGroundedItems(undefined, corpus)).toEqual([]);
  });
});

describe("filterGroundedRedFlags", () => {
  const corpus = "we improved performance";

  it("drops red flags with unknown type or severity", () => {
    const flags = [
      { type: "blame", severity: "high", title: "Blamed teammate", explanation: "x", questionIdx: -1, quote: "" },
      { type: "made_up", severity: "high", title: "x", explanation: "x", questionIdx: -1, quote: "" },
      { type: "vague", severity: "extreme", title: "x", explanation: "x", questionIdx: -1, quote: "" },
    ] as unknown as RedFlag[];
    const out = filterGroundedRedFlags(flags, corpus);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("blame");
  });

  it("drops red flags whose quote isn't in corpus when not cross-cutting", () => {
    const flags: RedFlag[] = [
      { type: "vague", severity: "medium", title: "Vague", explanation: "x", questionIdx: 1, quote: "fabricated quote" },
      { type: "vague", severity: "medium", title: "Vague", explanation: "x", questionIdx: 1, quote: "we improved" },
    ];
    const out = filterGroundedRedFlags(flags, corpus);
    expect(out).toHaveLength(1);
  });

  it("caps at 4 flags", () => {
    const f: RedFlag = { type: "vague", severity: "low", title: "v", explanation: "x", questionIdx: -1, quote: "" };
    expect(filterGroundedRedFlags(Array(10).fill(f), corpus)).toHaveLength(4);
  });
});

describe("validateReportShape", () => {
  const transcript: TranscriptTurn[] = [{ role: "candidate", text: "hello world" }];

  it("rejects non-object / missing perQuestion", () => {
    expect(validateReportShape(null, transcript)).toBe(false);
    expect(validateReportShape({ overallScore: 50 }, transcript)).toBe(false);
  });

  it("rejects out-of-range overallScore", () => {
    expect(validateReportShape({ overallScore: 101, perQuestion: [] }, transcript)).toBe(false);
    expect(validateReportShape({ overallScore: -1, perQuestion: [] }, transcript)).toBe(false);
  });

  it("rejects citations whose offsets exceed the corpus length", () => {
    const report = {
      overallScore: 75,
      perQuestion: [
        { restructured: { citations: [{ sourceStart: 0, sourceEnd: 999 }] } },
      ],
    };
    expect(validateReportShape(report, transcript)).toBe(false);
  });

  it("accepts citations within corpus bounds", () => {
    const report = {
      overallScore: 75,
      perQuestion: [{ restructured: { citations: [{ sourceStart: 0, sourceEnd: 5 }] } }],
    };
    expect(validateReportShape(report, transcript)).toBe(true);
  });
});

describe("computeBlendedOverall", () => {
  it("clamps result to 0..100", () => {
    const out = computeBlendedOverall(
      [{ name: "X", score: 200 }],
      {},
      150,
    );
    expect(out.overallScore).toBeLessThanOrEqual(100);
  });

  it("falls back to llmOverall when skill list is empty", () => {
    const out = computeBlendedOverall([], {}, 72);
    // composite=llmOverall=72, blend=0.6*72+0.4*72=72
    expect(out.overallScore).toBe(72);
    expect(out.weightedSkills).toEqual([]);
  });

  it("applies skillWeights to composite — Amazon's ownership weight bumps score", () => {
    const skills = [
      { name: "Ownership", score: 90 },
      { name: "Communication", score: 50 },
    ];
    // Without weights: composite=70 (avg)
    const flat = computeBlendedOverall(skills, {}, 70);
    // With ownership weighted 1.3, composite skews toward 90
    const weighted = computeBlendedOverall(skills, { Ownership: 1.3 }, 70);
    expect(weighted.overallScore).toBeGreaterThan(flat.overallScore);
  });

  it("rounds skill weights to 2 decimals and defaults missing to 1.0", () => {
    const out = computeBlendedOverall(
      [{ name: "A", score: 80 }, { name: "B", score: 60 }],
      { A: 1.234567 },
      70,
    );
    expect(out.weightedSkills[0].weight).toBe(1.23);
    expect(out.weightedSkills[1].weight).toBe(1);
  });

  it("uses 60/40 LLM blend (composite-heavy but LLM-influenced)", () => {
    // composite=90, llm=50 → 0.6*90 + 0.4*50 = 74
    const out = computeBlendedOverall([{ name: "X", score: 90 }], {}, 50);
    expect(out.overallScore).toBe(74);
  });
});

describe("normalizeThoughtBubble", () => {
  it("filters out unknown states and clamps timestamps", () => {
    const raw = [
      { startMs: -100, endMs: 500, state: "tracking", note: "ok" },
      { startMs: 500, endMs: 200, state: "tracking", note: "endBeforeStart" }, // dropped
      { startMs: 0, endMs: 500, state: "elated", note: "bad state" }, // dropped
      { startMs: 0, endMs: 500, state: "tracking", note: "x".repeat(200) }, // note truncated
    ];
    const out = normalizeThoughtBubble(raw);
    expect(out).toHaveLength(2);
    expect(out[0].startMs).toBe(0); // negative clamped
    expect(out[1].note.length).toBe(100);
  });

  it("caps to 8 segments", () => {
    const seg = { startMs: 0, endMs: 1, state: "tracking", note: "x" };
    expect(normalizeThoughtBubble(Array(20).fill(seg))).toHaveLength(8);
  });

  it("returns [] for non-array input", () => {
    expect(normalizeThoughtBubble("not an array")).toEqual([]);
  });
});

describe("normalizeScoreConfidence", () => {
  it("defaults to 0.8 for non-numeric input", () => {
    expect(normalizeScoreConfidence(undefined)).toBe(0.8);
    expect(normalizeScoreConfidence("high")).toBe(0.8);
    expect(normalizeScoreConfidence(NaN)).toBe(0.8);
  });

  it("clamps to 0..1 range", () => {
    expect(normalizeScoreConfidence(1.5)).toBe(1);
    expect(normalizeScoreConfidence(-0.2)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(normalizeScoreConfidence(0.876543)).toBe(0.88);
  });
});

describe("normalizeStoryReuse", () => {
  it("requires at least 2 question indices", () => {
    const raw = [
      { storyLabel: "Project X", questionIndices: [1], concern: "reuse" }, // dropped
      { storyLabel: "Project Y", questionIndices: [1, 2], concern: "reuse" },
    ];
    expect(normalizeStoryReuse(raw)).toHaveLength(1);
  });

  it("filters out non-numeric indices", () => {
    const raw = [
      { storyLabel: "X", questionIndices: [1, "two", 3, -1], concern: "x" },
    ];
    const out = normalizeStoryReuse(raw);
    // After filter: [1, 3] (both valid >= 0 numbers) — should keep
    expect(out[0].questionIndices).toEqual([1, 3]);
  });
});

describe("normalizeBlindSpots", () => {
  it("clamps frequencyPct to 0..100 or null when out of range", () => {
    const raw = [
      { competency: "A", frequencyPct: 50, note: "x" },
      { competency: "B", frequencyPct: 150, note: "x" },
      { competency: "C", frequencyPct: "high", note: "x" },
    ];
    const out = normalizeBlindSpots(raw);
    expect(out[0].frequencyPct).toBe(50);
    expect(out[1].frequencyPct).toBeNull();
    expect(out[2].frequencyPct).toBeNull();
  });

  it("caps to 5 entries", () => {
    const e = { competency: "X", frequencyPct: 50, note: "x" };
    expect(normalizeBlindSpots(Array(10).fill(e))).toHaveLength(5);
  });
});

describe("normalizeReadiness", () => {
  it("returns null on invalid targetBand", () => {
    expect(normalizeReadiness({ targetBand: "amazingHire", estimatedHours: 10 })).toBeNull();
  });

  it("clamps estimatedHours to 0..500", () => {
    const r = normalizeReadiness({
      targetBand: "hire",
      estimatedHours: 9999,
      estimatedSessions: 5,
      confidence: "medium",
      rationale: "ok",
    });
    expect(r?.estimatedHours).toBe(500);
  });

  it("defaults invalid confidence to medium", () => {
    const r = normalizeReadiness({
      targetBand: "hire",
      estimatedHours: 10,
      estimatedSessions: 1,
      confidence: "extremely-high",
      rationale: "x",
    });
    expect(r?.confidence).toBe("medium");
  });
});

describe("normalizeCoaching", () => {
  it("returns null on non-object input", () => {
    expect(normalizeCoaching(null)).toBeNull();
    expect(normalizeCoaching("nope")).toBeNull();
    expect(normalizeCoaching(undefined)).toBeNull();
  });

  it("returns null when strength or gap is missing", () => {
    expect(normalizeCoaching({ strength: { headline: "x", meaning: "y" } })).toBeNull();
    expect(normalizeCoaching({ gap: { headline: "x", meaning: "y", example: "z" } })).toBeNull();
  });

  it("returns null when either headline is empty (partial coaching is worse than fallback)", () => {
    expect(normalizeCoaching({
      strength: { headline: "", meaning: "y" },
      gap: { headline: "x", meaning: "y", example: "z" },
    })).toBeNull();
    expect(normalizeCoaching({
      strength: { headline: "x", meaning: "y" },
      gap: { headline: "   ", meaning: "y", example: "z" },
    })).toBeNull();
  });

  it("accepts a valid coaching object and trims strings", () => {
    const r = normalizeCoaching({
      strength: { headline: "Clear, structured answers", meaning: "STAR shape in every story" },
      gap: { headline: "Add numbers to results", meaning: "You said improved performance", example: "Try: cut time 40%" },
    });
    expect(r).toEqual({
      strength: { headline: "Clear, structured answers", meaning: "STAR shape in every story" },
      gap: { headline: "Add numbers to results", meaning: "You said improved performance", example: "Try: cut time 40%" },
    });
  });

  it("coerces non-strings to empty strings without crashing", () => {
    const r = normalizeCoaching({
      strength: { headline: "ok", meaning: 42 },
      gap: { headline: "ok", meaning: null, example: undefined },
    });
    expect(r?.strength.meaning).toBe("");
    expect(r?.gap.meaning).toBe("");
    expect(r?.gap.example).toBe("");
  });

  it("caps long strings so malformed LLM output can't blow up the payload", () => {
    const long = "x".repeat(500);
    const r = normalizeCoaching({
      strength: { headline: long, meaning: long },
      gap: { headline: long, meaning: long, example: long },
    });
    expect(r?.strength.headline.length).toBeLessThanOrEqual(60);
    expect(r?.strength.meaning.length).toBeLessThanOrEqual(160);
    expect(r?.gap.headline.length).toBeLessThanOrEqual(60);
    expect(r?.gap.meaning.length).toBeLessThanOrEqual(160);
    expect(r?.gap.example.length).toBeLessThanOrEqual(160);
  });
});

describe("normalizeCrossSessionInsights", () => {
  it("returns [] when priorSessionCount=0 even if LLM produced items", () => {
    const raw = [{ kind: "improvement", text: "you got faster" }];
    expect(normalizeCrossSessionInsights(raw, 0)).toEqual([]);
  });

  it("filters unknown kinds when prior data is present", () => {
    const raw = [
      { kind: "improvement", text: "ok" },
      { kind: "regression", text: "ok" },
      { kind: "miracle", text: "ok" }, // dropped
      { kind: "persistent", text: "" }, // empty text dropped
    ];
    expect(normalizeCrossSessionInsights(raw, 2)).toHaveLength(2);
  });

  it("rounds delta to one decimal", () => {
    const raw = [{ kind: "improvement", text: "ok", delta: -3.456 }];
    const out = normalizeCrossSessionInsights(raw, 1);
    expect(out[0].delta).toBe(-3.5);
  });
});

describe("normalizeFocusMetrics", () => {
  it("returns empty for a non-array, missing type, or unknown type", () => {
    expect(normalizeFocusMetrics("nope", "behavioral")).toEqual([]);
    expect(normalizeFocusMetrics([{ label: "STAR coverage", value: "88%" }], undefined)).toEqual([]);
    expect(normalizeFocusMetrics([{ label: "STAR coverage", value: "88%" }], "no-such-focus")).toEqual([]);
  });

  it("keeps only metrics whose label matches a pinned spec, in canonical order", () => {
    const raw = [
      { label: "First-person", value: "71%", tone: "watch" },
      { label: "STAR coverage", value: "88%", tone: "good" },
      { label: "Conflict balance", value: "1 / 1", tone: "neutral" },
    ];
    const out = normalizeFocusMetrics(raw, "behavioral");
    expect(out.map((m) => m.label)).toEqual(["STAR coverage", "First-person", "Conflict balance"]);
  });

  it("drops drift labels the card does not expect", () => {
    const raw = [
      { label: "STAR coverage", value: "88%", tone: "good" },
      { label: "Vibe score", value: "100", tone: "good" },
    ];
    const out = normalizeFocusMetrics(raw, "behavioral");
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("STAR coverage");
  });

  it("uses the pinned label spelling, not the model's echoed casing", () => {
    const out = normalizeFocusMetrics([{ label: "star COVERAGE", value: "90%", tone: "good" }], "behavioral");
    expect(out[0].label).toBe("STAR coverage");
  });

  it("clamps an invalid tone to neutral and caps value length", () => {
    const out = normalizeFocusMetrics(
      [{ label: "STAR coverage", value: "x".repeat(40), tone: "amazing" }],
      "behavioral",
    );
    expect(out[0].tone).toBe("neutral");
    expect(out[0].value).toHaveLength(18);
  });

  it("skips entries missing a label or value, and dedups by label (first wins)", () => {
    const raw = [
      { label: "STAR coverage", value: "" },
      { label: "STAR coverage", value: "88%", tone: "good" },
      { label: "STAR coverage", value: "50%", tone: "miss" },
    ];
    const out = normalizeFocusMetrics(raw, "behavioral");
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe("88%");
  });

  it("resolves the managerial alias to the management spec", () => {
    const out = normalizeFocusMetrics([{ label: "People scope", value: "8", tone: "good" }], "managerial");
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("People scope");
  });
});

import { describe, it, expect } from "vitest";
import {
  applyBands,
  resolveCompanyProfile,
  resolveCalibrationLabel,
  computeCoreMetrics,
  computeAdvancedDelivery,
  filterGroundedItems,
  filterGroundedRedFlags,
  validateReportShape,
  computeBlendedOverall,
  computeStructuralAnchor,
  normalizeThoughtBubble,
  normalizeScoreConfidence,
  normalizeStoryReuse,
  normalizeBlindSpots,
  normalizeReadiness,
  normalizeCoaching,
  normalizeCrossSessionInsights,
  normalizeFocusMetrics,
  resolveSkillAxes,
  isStarShapedFocus,
  deriveSkillWeightsFromRubric,
  canonicalizeAxisName,
  reconcileSkillAxisNames,
  selectCanonicalHrSkills,
  skillsCoverAxes,
  isUsableEvalReport,
  normalizeHrReport,
  isGenericMotivation,
  coerceNoticeDays,
  NEGOTIATION_SKILL_AXES,
  HR_ROUND_SKILL_AXES,
  CAMPUS_SKILL_AXES,
  ROLE_SKILLS,
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

describe("resolveSkillAxes (#99 negotiation taxonomy)", () => {
  it("returns negotiation craft axes for a salary-negotiation focus, regardless of role family", () => {
    // A PM negotiating must be graded on anchoring/leverage, not product sense.
    const axes = resolveSkillAxes("salary-negotiation", "pm");
    expect(axes).toEqual([...NEGOTIATION_SKILL_AXES]);
    expect(axes).toContain("Anchor strength");
    expect(axes).toContain("Walk-away discipline");
    // No generic role-family proxy should leak in.
    expect(axes).not.toContain("Product Sense");
  });

  it("ignores role family for negotiation even when roleFamily is swe/em/data", () => {
    for (const fam of ["swe", "em", "data", "behavioral", undefined]) {
      expect(resolveSkillAxes("salary-negotiation", fam)).toEqual([
        ...NEGOTIATION_SKILL_AXES,
      ]);
    }
  });

  it("returns the 8 HR-round axes for an hr-round focus", () => {
    expect(resolveSkillAxes("hr-round", "pm")).toEqual([...HR_ROUND_SKILL_AXES]);
  });

  it("falls back to role-family competencies for ordinary focuses", () => {
    expect(resolveSkillAxes("behavioral", "pm")).toEqual(ROLE_SKILLS.pm);
    expect(resolveSkillAxes(undefined, "swe")).toEqual(ROLE_SKILLS.swe);
  });

  it("falls back to behavioral axes for an unknown role family", () => {
    expect(resolveSkillAxes(undefined, "marketing")).toEqual(
      ROLE_SKILLS.behavioral,
    );
    expect(resolveSkillAxes(undefined, undefined)).toEqual(
      ROLE_SKILLS.behavioral,
    );
  });

  it("returns a fresh array (mutating the result never corrupts the constants)", () => {
    const axes = resolveSkillAxes("salary-negotiation", "pm");
    axes.push("tampered");
    expect(NEGOTIATION_SKILL_AXES).not.toContain("tampered");
    expect(NEGOTIATION_SKILL_AXES).toHaveLength(6);
  });

  it("returns campus skill axes when focus is campus-placement, regardless of type or role family", () => {
    expect(resolveSkillAxes("behavioral", "swe", "campus-placement")).toEqual([...CAMPUS_SKILL_AXES]);
    expect(resolveSkillAxes(undefined, "pm", "campus-placement")).toEqual([...CAMPUS_SKILL_AXES]);
    expect(resolveSkillAxes("behavioral", undefined, "campus-placement")).toEqual([...CAMPUS_SKILL_AXES]);
    expect(resolveSkillAxes("behavioral", "behavioral", "campus-placement")).toContain("Technical Knowledge");
    expect(resolveSkillAxes("behavioral", "swe", "campus-placement")).not.toContain("Trade-off Reasoning");
  });

  it("type wins over focus: hr-round beats campus-placement focus", () => {
    expect(resolveSkillAxes("hr-round", "swe", "campus-placement")).toEqual([...HR_ROUND_SKILL_AXES]);
  });

  it("campus axes are a fresh array (mutation does not corrupt constant)", () => {
    const axes = resolveSkillAxes("behavioral", "swe", "campus-placement");
    axes.push("tampered");
    expect(CAMPUS_SKILL_AXES).not.toContain("tampered");
    expect(CAMPUS_SKILL_AXES).toHaveLength(5);
  });
});

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

describe("resolveCalibrationLabel", () => {
  it("uses the tuned profile's label/note when one exists", () => {
    const profile = resolveCompanyProfile("Amazon")!;
    const r = resolveCalibrationLabel("Amazon", profile, "none");
    expect(r.companyLabel).toBe("Amazon");
    expect(r.companyNote).toBe(profile.note);
  });

  it("keeps the generic prompt when no company is set", () => {
    const r = resolveCalibrationLabel(null, null, "none");
    expect(r.companyLabel).toBe("Generic");
    expect(r.companyNote).toMatch(/set a target company/i);
  });

  it("shows the company back (not 'Generic') when one is set but untuned", () => {
    const r = resolveCalibrationLabel("HDFC Bank", null, "bfsi");
    expect(r.companyLabel).toBe("HDFC Bank");
    expect(r.companyNote).toMatch(/BFSI/);
    expect(r.companyNote).not.toMatch(/set a target company/i);
  });

  it("describes the sector calibration applied for each HR sector", () => {
    expect(resolveCalibrationLabel("TCS", null, "services-tier1").companyNote).toMatch(/IT services/i);
    expect(resolveCalibrationLabel("Razorpay", null, "product-unicorn").companyNote).toMatch(/unicorn/i);
  });

  it("falls back to a general-bar note for a named company with no sector", () => {
    const r = resolveCalibrationLabel("Acme Corp", null, "none");
    expect(r.companyLabel).toBe("Acme Corp");
    expect(r.companyNote).toMatch(/general senior bar/i);
    expect(r.companyNote).not.toMatch(/set a target company/i);
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

  it("anchor param is backward-compatible — omitting it leaves the pure blend unchanged", () => {
    const noAnchor = computeBlendedOverall([{ name: "X", score: 90 }], {}, 50);
    expect(noAnchor.overallScore).toBe(74); // identical to the 60/40 case above
  });

  it("clamps the final score to within ±18 of the structural anchor (kills outliers)", () => {
    // Skills + LLM blend to 90, but the transcript only supports an anchor of 50.
    const out = computeBlendedOverall([{ name: "X", score: 90 }], {}, 90, 50);
    expect(out.overallScore).toBeLessThanOrEqual(50 + 18);
    expect(out.overallScore).toBeGreaterThanOrEqual(50 - 18);
  });

  it("compresses run-to-run variance — identical anchor halves an LLM swing", () => {
    // Same transcript (same anchor=60), two LLM runs that disagree by 30 pts.
    const anchor = 60;
    const lowRun = computeBlendedOverall([{ name: "X", score: 45 }], {}, 45, anchor);
    const highRun = computeBlendedOverall([{ name: "X", score: 75 }], {}, 75, anchor);
    const rawSpread = 75 - 45; // 30
    const anchoredSpread = highRun.overallScore - lowRun.overallScore;
    // The 0.35 anchor pull must shrink the spread, not preserve it.
    expect(anchoredSpread).toBeLessThan(rawSpread);
    expect(anchoredSpread).toBeLessThanOrEqual(Math.round(rawSpread * (1 - 0.35)) + 1);
  });

  /* PRI-36 — anchorClamped / anchorDelta telemetry signal. */
  it("reports anchorClamped=true with a signed delta when the LLM disagrees by >18", () => {
    // blend 90 vs anchor 50 → delta +40, well past the ±18 band → clamp fires.
    const out = computeBlendedOverall([{ name: "X", score: 90 }], {}, 90, 50);
    expect(out.anchorClamped).toBe(true);
    expect(out.anchorDelta).toBeGreaterThan(18);
  });

  it("reports anchorClamped=false when the blend sits inside the ±18 band", () => {
    // blend ~58 vs anchor 60 → delta tiny → no clamp.
    const out = computeBlendedOverall([{ name: "X", score: 58 }], {}, 58, 60);
    expect(out.anchorClamped).toBe(false);
    expect(Math.abs(out.anchorDelta)).toBeLessThanOrEqual(18);
  });

  it("reports anchorClamped=false and zero delta when no anchor is supplied", () => {
    const out = computeBlendedOverall([{ name: "X", score: 90 }], {}, 90);
    expect(out.anchorClamped).toBe(false);
    expect(out.anchorDelta).toBe(0);
  });
});

describe("computeStructuralAnchor", () => {
  const turn = (role: TranscriptTurn["role"], text: string): TranscriptTurn => ({ role, text });

  it("returns a neutral 50 when there are no substantive candidate answers", () => {
    expect(computeStructuralAnchor([])).toBe(50);
    expect(computeStructuralAnchor([turn("candidate", "too short")])).toBe(50);
    expect(computeStructuralAnchor([turn("candidate", "[SKIPPED] " + "word ".repeat(40))])).toBe(50);
  });

  it("is deterministic — identical transcript yields the identical anchor every call", () => {
    const t = [
      turn("interviewer", "Tell me about a hard project."),
      turn(
        "candidate",
        "At my last company we were migrating a legacy payments system. The goal was to cut latency. I designed a new caching layer and I led the rollout, which led to a 40% drop in p99. I learned to de-risk migrations in stages.",
      ),
    ];
    const a = computeStructuralAnchor(t);
    const b = computeStructuralAnchor(t);
    expect(a).toBe(b);
  });

  it("scores a full STAR+metrics+learning answer well above a one-pillar fragment", () => {
    const strong = [
      turn(
        "candidate",
        "At my last company the goal was to reduce churn. I built a re-engagement flow and I shipped it, which led to a 25% lift in retention. I learned that onboarding is the highest-leverage surface to invest in going forward.",
      ),
    ];
    const weak = [
      turn(
        "candidate",
        "I think it was a good project and we did some stuff and it turned out fine overall and people seemed pretty happy with what we ended up building together as a team.",
      ),
    ];
    expect(computeStructuralAnchor(strong)).toBeGreaterThan(computeStructuralAnchor(weak));
    expect(computeStructuralAnchor(strong)).toBeGreaterThanOrEqual(70);
  });
});

describe("isStarShapedFocus (P0 #2 — anchor gating)", () => {
  it("excludes HR-round and salary-negotiation (non-STAR rubrics)", () => {
    expect(isStarShapedFocus("hr-round")).toBe(false);
    expect(isStarShapedFocus("salary-negotiation")).toBe(false);
  });

  it("includes behavioral / role-family / undefined focuses", () => {
    for (const f of ["behavioral", "case-study", "system-design", "leadership", undefined]) {
      expect(isStarShapedFocus(f)).toBe(true);
    }
  });
});

describe("isUsableEvalReport (fallback truncation guard — never serve empty reports)", () => {
  it("rejects null / non-object", () => {
    expect(isUsableEvalReport(null)).toBe(false);
    expect(isUsableEvalReport(undefined)).toBe(false);
  });

  it("rejects a parsed object with missing or empty skills (the truncation symptom)", () => {
    expect(isUsableEvalReport({})).toBe(false);
    expect(isUsableEvalReport({ skills: [] })).toBe(false);
    expect(isUsableEvalReport({ skills: "nope" as unknown })).toBe(false);
  });

  it("accepts a non-HR report with a non-empty skills array", () => {
    expect(isUsableEvalReport({ skills: [{ name: "Ownership", score: 80 }] }, "behavioral")).toBe(true);
  });

  it("requires the hrReport block for hr-round even when skills are present", () => {
    const skills = HR_ROUND_SKILL_AXES.map((name) => ({ name, score: 70 }));
    // This is exactly the observed BFSI/Gemini failure: skills filled but no hrReport.
    expect(isUsableEvalReport({ skills }, "hr-round")).toBe(false);
    expect(isUsableEvalReport({ skills, hrReport: null }, "hr-round")).toBe(false);
    expect(isUsableEvalReport({ skills, hrReport: [] }, "hr-round")).toBe(false);
    expect(isUsableEvalReport({ skills, hrReport: { noticeDays: 90 } }, "hr-round")).toBe(true);
  });

  it("rejects an hr-round report missing any of the 8 rubric dimensions", () => {
    // Drop the most-weighted BFSI axis — a partial rubric must NOT render.
    const partial = HR_ROUND_SKILL_AXES.filter((n) => n !== "Compliance readiness").map(
      (name) => ({ name, score: 70 }),
    );
    expect(isUsableEvalReport({ skills: partial, hrReport: { noticeDays: 90 } }, "hr-round")).toBe(false);
  });

  it("accepts an hr-round report whose axis names drifted but cover all 8 (tolerant match)", () => {
    // LLM paraphrased spacing/punctuation/casing — still semantically complete.
    const drifted = [
      { name: "logistics-clarity", score: 70 },
      { name: "Comp Transparency", score: 70 },
      { name: "switch rationale honesty", score: 70 },
      { name: "Compliance  Readiness", score: 70 },
      { name: "Commitment signal", score: 70 },
      { name: "Benefits/Policy Literacy", score: 70 },
      { name: "self awareness", score: 70 },
      { name: "Motivation Specificity", score: 70 },
    ];
    expect(isUsableEvalReport({ skills: drifted, hrReport: { noticeDays: 90 } }, "hr-round")).toBe(true);
  });

  it("does not require hrReport for non-hr focuses", () => {
    const skills = [{ name: "Impact", score: 75 }];
    expect(isUsableEvalReport({ skills }, "salary-negotiation")).toBe(true);
    expect(isUsableEvalReport({ skills }, undefined)).toBe(true);
  });
});

describe("deriveSkillWeightsFromRubric (P0 #1 — live HR overlay weights)", () => {
  it("maps each rubric dimension to its weight", () => {
    const w = deriveSkillWeightsFromRubric([
      { dimension: "Comp transparency", weight: 0.25 },
      { dimension: "Commitment signal", weight: 0.4 },
    ]);
    expect(w).toEqual({ "Comp transparency": 0.25, "Commitment signal": 0.4 });
  });

  it("returns {} for empty/undefined input (callers fall back to equal weights)", () => {
    expect(deriveSkillWeightsFromRubric(undefined)).toEqual({});
    expect(deriveSkillWeightsFromRubric([])).toEqual({});
  });

  it("drops non-positive / non-finite weights", () => {
    const w = deriveSkillWeightsFromRubric([
      { dimension: "A", weight: 0 },
      { dimension: "B", weight: -0.2 },
      { dimension: "C", weight: NaN },
      { dimension: "D", weight: 0.3 },
    ]);
    expect(w).toEqual({ D: 0.3 });
  });

  it("derived HR weights actually move the composite (overlay no longer dead)", () => {
    // Two axes: one strong, one weak. Up-weighting the strong axis must raise
    // the composite vs. equal weighting — proving the overlay reaches the score.
    const skills = [
      { name: "Comp transparency", score: 80 },
      { name: "Commitment signal", score: 40 },
    ];
    const equal = computeBlendedOverall(skills, {}, 60);
    const weights = deriveSkillWeightsFromRubric([
      { dimension: "Comp transparency", weight: 0.8 },
      { dimension: "Commitment signal", weight: 0.2 },
    ]);
    const weighted = computeBlendedOverall(skills, weights, 60);
    expect(weighted.overallScore).toBeGreaterThan(equal.overallScore);
  });
});

describe("skill-name reconciliation (P1 — overlay weights survive LLM name drift)", () => {
  it("canonicalizeAxisName collapses case/spacing/punctuation", () => {
    expect(canonicalizeAxisName("Logistics clarity")).toBe("logisticsclarity");
    expect(canonicalizeAxisName("logistics-clarity")).toBe("logisticsclarity");
    expect(canonicalizeAxisName("Logistics  Clarity")).toBe("logisticsclarity");
    expect(canonicalizeAxisName("Benefits/policy literacy")).toBe("benefitspolicyliteracy");
    expect(canonicalizeAxisName("")).toBe("");
  });

  it("renames drifted skill names back to the canonical axis spelling", () => {
    const drifted = [
      { name: "logistics-clarity", score: 70 },
      { name: "Comp Transparency", score: 65 },
    ];
    const out = reconcileSkillAxisNames(drifted, HR_ROUND_SKILL_AXES);
    expect(out.map((s) => s.name)).toEqual(["Logistics clarity", "Comp transparency"]);
    // scores preserved verbatim
    expect(out.map((s) => s.score)).toEqual([70, 65]);
  });

  it("leaves unknown skills untouched and preserves order", () => {
    const mixed = [
      { name: "Comp Transparency", score: 50 },
      { name: "Made-up axis", score: 90 },
    ];
    const out = reconcileSkillAxisNames(mixed, HR_ROUND_SKILL_AXES);
    expect(out.map((s) => s.name)).toEqual(["Comp transparency", "Made-up axis"]);
  });

  it("reconciliation lets the overlay weight reach a drifted axis (the actual bug)", () => {
    // "logistics-clarity" drifted; without reconcile, skillWeights lookup misses
    // and the axis is weighted at the 1.0 fallback instead of its tuned 0.4 —
    // silently discarding the calibration. Reconcile must restore the tuned
    // weight AND the canonical label.
    const drifted = [
      { name: "logistics-clarity", score: 85 },
      { name: "Commitment signal", score: 40 },
    ];
    const weights = { "Logistics clarity": 0.4, "Commitment signal": 0.2 };
    const withoutReconcile = computeBlendedOverall(drifted, weights, 60);
    // Bug reproduced: drifted name missed its weight, got the 1.0 fallback.
    expect(withoutReconcile.weightedSkills[0].weight).toBe(1.0);
    const reconciled = reconcileSkillAxisNames(drifted, HR_ROUND_SKILL_AXES);
    const withReconcile = computeBlendedOverall(reconciled, weights, 60);
    // Fixed: tuned 0.4 weight now applies, and the label is canonical.
    expect(withReconcile.weightedSkills[0].weight).toBe(0.4);
    expect(withReconcile.weightedSkills[0].name).toBe("Logistics clarity");
    // The composite differs from the mis-weighted one (calibration now lands).
    expect(withReconcile.overallScore).not.toBe(withoutReconcile.overallScore);
  });

  it("skillsCoverAxes is true only when every canonical axis is present", () => {
    const full = HR_ROUND_SKILL_AXES.map((name) => ({ name }));
    expect(skillsCoverAxes(full, HR_ROUND_SKILL_AXES)).toBe(true);
    // tolerant: drifted spellings still count as covered
    const drifted = HR_ROUND_SKILL_AXES.map((name) => ({ name: name.toUpperCase() }));
    expect(skillsCoverAxes(drifted, HR_ROUND_SKILL_AXES)).toBe(true);
    // missing one axis → not covered
    const partial = HR_ROUND_SKILL_AXES.slice(0, 7).map((name) => ({ name }));
    expect(skillsCoverAxes(partial, HR_ROUND_SKILL_AXES)).toBe(false);
    // non-string names are ignored, not crashed on
    expect(skillsCoverAxes([{ name: 123 as unknown }], HR_ROUND_SKILL_AXES)).toBe(false);
  });
});

describe("selectCanonicalHrSkills (A2 — project onto axes before slice, no axis drop)", () => {
  it("keeps all 8 canonical axes when a junk row precedes a real axis at index >= 8", () => {
    // LLM disobeyed the prompt: 4 junk rows first, then the 8 canonical axes.
    // A blind slice(0,8) would keep the junk and drop the last 4 real axes —
    // even though coverage validated on the full array. Projection keeps all 8.
    const junk = [
      { name: "Filler A", score: 10 },
      { name: "Filler B", score: 20 },
      { name: "Filler C", score: 30 },
      { name: "Filler D", score: 40 },
    ];
    const real = HR_ROUND_SKILL_AXES.map((name, i) => ({ name, score: 50 + i }));
    const out = selectCanonicalHrSkills([...junk, ...real], HR_ROUND_SKILL_AXES);
    expect(out.map((s) => s.name)).toEqual([...HR_ROUND_SKILL_AXES]);
    // scores carried from the real rows, not the junk
    expect(out[0].score).toBe(50);
  });

  it("emits axes in canonical rubric order regardless of LLM order", () => {
    const shuffled = [...HR_ROUND_SKILL_AXES]
      .slice()
      .reverse()
      .map((name) => ({ name, score: 60 }));
    const out = selectCanonicalHrSkills(shuffled, HR_ROUND_SKILL_AXES);
    expect(out.map((s) => s.name)).toEqual([...HR_ROUND_SKILL_AXES]);
  });

  it("reconciles drifted spellings before projecting", () => {
    const drifted = HR_ROUND_SKILL_AXES.map((name) => ({
      name: name.toLowerCase().replace(/\s+/g, "-"),
      score: 70,
    }));
    const out = selectCanonicalHrSkills(drifted, HR_ROUND_SKILL_AXES);
    expect(out.map((s) => s.name)).toEqual([...HR_ROUND_SKILL_AXES]);
  });

  it("dedupes a duplicated axis, keeping the first occurrence", () => {
    const dup = [
      { name: "Logistics clarity", score: 80 },
      { name: "logistics-clarity", score: 99 },
      ...HR_ROUND_SKILL_AXES.slice(1).map((name) => ({ name, score: 60 })),
    ];
    const out = selectCanonicalHrSkills(dup, HR_ROUND_SKILL_AXES);
    expect(out).toHaveLength(HR_ROUND_SKILL_AXES.length);
    expect(out[0].score).toBe(80); // first wins
  });

  it("drops non-canonical rows entirely", () => {
    const out = selectCanonicalHrSkills(
      [{ name: "Logistics clarity", score: 70 }, { name: "Totally made up", score: 90 }],
      HR_ROUND_SKILL_AXES,
    );
    expect(out.map((s) => s.name)).toEqual(["Logistics clarity"]);
  });
});

describe("coerceNoticeDays (P1 #5 — verbal notice coercion)", () => {
  it("passes a valid number of days through", () => {
    expect(coerceNoticeDays(60)).toBe(60);
    expect(coerceNoticeDays(90.4)).toBe(90);
  });
  it("coerces verbal strings to days", () => {
    expect(coerceNoticeDays("2 months")).toBe(60);
    expect(coerceNoticeDays("3 mo")).toBe(90);
    expect(coerceNoticeDays("60 days")).toBe(60);
    expect(coerceNoticeDays("2-month")).toBe(60);
    expect(coerceNoticeDays("4 weeks")).toBe(28);
    expect(coerceNoticeDays("45")).toBe(45);
  });
  it("returns null for out-of-range or unparseable values", () => {
    expect(coerceNoticeDays(0)).toBeNull();
    expect(coerceNoticeDays(400)).toBeNull();
    expect(coerceNoticeDays("13 months")).toBeNull();
    expect(coerceNoticeDays("soon")).toBeNull();
    expect(coerceNoticeDays(null)).toBeNull();
  });
});

describe("isGenericMotivation (P1 #8 — filler backstop)", () => {
  it("flags résumé-padding clichés", () => {
    expect(isGenericMotivation("This role will help me achieve my career goals")).toBe(true);
    expect(isGenericMotivation("I love the great culture here")).toBe(true);
    expect(isGenericMotivation("excited about the opportunity")).toBe(true);
    expect(isGenericMotivation("I want to learn and grow")).toBe(true);
  });
  it("passes a concrete, company-specific rewrite", () => {
    expect(
      isGenericMotivation(
        "Razorpay's move into lending with RazorpayX is exactly the kind of payments-infra problem I shipped at my last fintech.",
      ),
    ).toBe(false);
  });
});

describe("normalizeHrReport (P0 #6 / P1 #7 / #8 grounding)", () => {
  const base = {
    motivationBefore: "I like the brand",
    motivationAfter: "PhonePe's UPI-lending stack maps to the credit-risk models I built at Slice.",
    noticeDays: 60,
    noticeFlexibility: "buyout-possible",
    compExpected: "35-42L",
    counterOfferRisk: "low",
    bgvGaps: ["Missing relieving letter from prior employer"],
  };

  it("defaults counterOfferRisk to not-assessed (never 'med') when invalid/absent", () => {
    const r = normalizeHrReport({ ...base, counterOfferRisk: undefined });
    expect(r?.counterOfferRisk).toBe("not-assessed");
  });

  it("forces counterOfferRisk to not-assessed when the topic never came up in the corpus", () => {
    const corpus = "Tell me about your notice period. I serve 60 days. What's your expected CTC?";
    const r = normalizeHrReport({ ...base, counterOfferRisk: "low" }, corpus);
    expect(r?.counterOfferRisk).toBe("not-assessed");
  });

  it("keeps a graded counterOfferRisk when the topic WAS discussed", () => {
    const corpus = "If your current employer makes a counter-offer, would you take it? No, I've decided.";
    const r = normalizeHrReport({ ...base, counterOfferRisk: "low" }, corpus);
    expect(r?.counterOfferRisk).toBe("low");
  });

  it("drops ungrounded bgvGaps when BGV/documents were never discussed", () => {
    const corpus = "Why do you want this role? Because of the product. What is your notice period?";
    const r = normalizeHrReport(base, corpus);
    expect(r?.bgvGaps).toEqual([]);
  });

  it("keeps bgvGaps when the BGV/document topic was raised", () => {
    const corpus = "Do you have your relieving letter from your last employer ready for BGV?";
    const r = normalizeHrReport(base, corpus);
    expect(r?.bgvGaps).toEqual(["Missing relieving letter from prior employer"]);
  });

  it("drops ungrounded noticeDays + noticeFlexibility when notice never came up", () => {
    const corpus = "Why do you want this role? Because of the product mission. What excites you?";
    const r = normalizeHrReport(base, corpus);
    expect(r?.noticeDays).toBeNull();
    expect(r?.noticeFlexibility).toBe("not-stated");
  });

  it("keeps noticeDays + noticeFlexibility when notice WAS discussed", () => {
    const corpus = "What's your notice period? I serve 60 days but a buyout is possible.";
    const r = normalizeHrReport(base, corpus);
    expect(r?.noticeDays).toBe(60);
    expect(r?.noticeFlexibility).toBe("buyout-possible");
  });

  it("recognizes joining-timeline phrasing as notice grounding", () => {
    const corpus = "When can you join if we move ahead with an offer?";
    const r = normalizeHrReport(base, corpus);
    expect(r?.noticeDays).toBe(60);
  });

  it("drops ungrounded compExpected when comp never came up", () => {
    const corpus = "What's your notice period? Sixty days. Tell me about a conflict you handled.";
    const r = normalizeHrReport(base, corpus);
    expect(r?.compExpected).toBeNull();
  });

  it("keeps compExpected when CTC/comp WAS discussed", () => {
    const corpus = "What's your expected CTC for this role? I'm looking at 35-42L.";
    const r = normalizeHrReport(base, corpus);
    expect(r?.compExpected).toBe("35-42L");
  });

  it("does NOT gate notice/comp when no corpus is supplied (back-compat)", () => {
    const r = normalizeHrReport(base);
    expect(r?.noticeDays).toBe(60);
    expect(r?.compExpected).toBe("35-42L");
    expect(r?.noticeFlexibility).toBe("buyout-possible");
  });

  it("blanks a generic motivationAfter (filler backstop)", () => {
    const r = normalizeHrReport({ ...base, motivationAfter: "I want to grow my career here" });
    expect(r?.motivationAfter).toBe("");
  });

  it("coerces a verbal noticeDays string", () => {
    const r = normalizeHrReport({ ...base, noticeDays: "2 months" });
    expect(r?.noticeDays).toBe(60);
  });

  it("returns null when both motivation fields are empty after guards", () => {
    const r = normalizeHrReport({ motivationBefore: "", motivationAfter: "I want to grow my career" });
    expect(r).toBeNull();
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

  it("bumps targetBand to the next band up when the LLM echoes the current band", () => {
    // current band = hire, LLM also returned "hire" → must become strongHire
    const r = normalizeReadiness(
      { targetBand: "hire", estimatedHours: 20, estimatedSessions: 3, confidence: "medium", rationale: "x" },
      "hire",
    );
    expect(r?.targetBand).toBe("strongHire");
  });

  it("bumps a too-low targetBand above the current band", () => {
    // current band = hire, LLM returned a LOWER target → must climb to strongHire
    const r = normalizeReadiness(
      { targetBand: "leanHire", estimatedHours: 10, estimatedSessions: 2, confidence: "low", rationale: "x" },
      "hire",
    );
    expect(r?.targetBand).toBe("strongHire");
  });

  it("keeps a valid forecast that already points up", () => {
    const r = normalizeReadiness(
      { targetBand: "hire", estimatedHours: 15, estimatedSessions: 2, confidence: "high", rationale: "x" },
      "leanHire",
    );
    expect(r?.targetBand).toBe("hire");
  });

  it("drops the forecast when the candidate is already at the top band", () => {
    const r = normalizeReadiness(
      { targetBand: "strongHire", estimatedHours: 5, estimatedSessions: 1, confidence: "high", rationale: "x" },
      "strongHire",
    );
    expect(r).toBeNull();
  });

  it("leaves the forecast unchanged when no current band is supplied", () => {
    const r = normalizeReadiness({
      targetBand: "hire",
      estimatedHours: 10,
      estimatedSessions: 1,
      confidence: "medium",
      rationale: "x",
    });
    expect(r?.targetBand).toBe("hire");
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

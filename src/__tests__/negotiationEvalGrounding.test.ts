import { describe, it, expect } from "vitest";
import {
  buildNegotiationOfferFactsBlock,
  extractTacticsFromTranscript,
  validateVerdictCoherence,
  normalizeCrossSessionInsights,
} from "../../server-handlers/_evaluate-session-helpers";

type Turn = { role: string; text: string };

/* ─── I-6 — offer-facts block only cites facts present in the transcript ─── */
describe("buildNegotiationOfferFactsBlock (I-6)", () => {
  it("returns '' for an empty transcript", () => {
    expect(buildNegotiationOfferFactsBlock([])).toBe("");
    expect(buildNegotiationOfferFactsBlock([{ role: "candidate", text: "   " }])).toBe("");
  });

  it("surfaces only comp components actually stated — no invented structure", () => {
    const transcript: Turn[] = [
      { role: "interviewer", text: "We can offer a base of 28 LPA with a 4 LPA variable." },
      { role: "candidate", text: "Thanks, that's helpful to know the split." },
    ];
    const block = buildNegotiationOfferFactsBlock(transcript);
    expect(block).toContain("Base / fixed: 28 LPA");
    expect(block).toContain("Variable / bonus: 4 LPA");
    // Nothing was said about equity — it must not appear.
    expect(block).not.toContain("Equity");
  });

  it("emits an explicit no-breakdown line when the transcript never states comp structure", () => {
    const transcript: Turn[] = [
      { role: "interviewer", text: "Where are you on comp expectations?" },
      { role: "candidate", text: "I'd like us to find something that works for both sides." },
    ];
    const block = buildNegotiationOfferFactsBlock(transcript);
    expect(block).toContain("No structured compensation breakdown was stated");
    // No fabricated percentages / splits / band limits.
    expect(block).not.toMatch(/\d+% (?:fixed|variable)/);
  });

  it("carries the CRITICAL grounding rule forbidding invented comp structure and tactics", () => {
    const block = buildNegotiationOfferFactsBlock([
      { role: "candidate", text: "My target is 40 LPA based on market rate." },
    ]);
    expect(block).toContain("do NOT invent comp structure");
    expect(block).toContain("do not credit tactics not listed");
  });
});

/* ─── I-9A — tactics come from the candidate's actual words ─── */
describe("extractTacticsFromTranscript (I-9A)", () => {
  it("returns [] when the candidate used no recognizable tactic", () => {
    const transcript: Turn[] = [
      { role: "interviewer", text: "We're offering 25 LPA." },
      { role: "candidate", text: "Okay, let me think about it and get back to you." },
    ];
    expect(extractTacticsFromTranscript(transcript)).toEqual([]);
  });

  it("detects anchoring + market-data when the candidate actually used them", () => {
    const transcript: Turn[] = [
      { role: "candidate", text: "I'm targeting 42 LPA — that's the market rate for this role per levels.fyi." },
    ];
    const tactics = extractTacticsFromTranscript(transcript);
    expect(tactics.some((t) => t.startsWith("Anchoring"))).toBe(true);
    expect(tactics.some((t) => t.startsWith("Market-data"))).toBe(true);
  });

  it("does NOT credit the candidate for a tactic only the interviewer named", () => {
    const transcript: Turn[] = [
      { role: "interviewer", text: "Do you have a competing offer or another offer on the table?" },
      { role: "candidate", text: "No, I'm only interviewing with you." },
    ];
    // "competing offer" appears only in the interviewer turn.
    expect(extractTacticsFromTranscript(transcript)).toEqual([]);
  });

  it("detects a competing offer when the candidate cites one", () => {
    const transcript: Turn[] = [
      { role: "candidate", text: "To be transparent, I have another offer at 45, so I'd need you to match." },
    ];
    const tactics = extractTacticsFromTranscript(transcript);
    expect(tactics.some((t) => t.startsWith("Competing offer"))).toBe(true);
  });
});

/* ─── I-9B — cross-session insight deltas clamped; unknown skills dropped ─── */
describe("normalizeCrossSessionInsights delta clamp + unknown-skill rejection (I-9B)", () => {
  it("clamps a hallucinated +80 delta into the ±30 band", () => {
    const raw = [{ kind: "improvement", text: "huge jump", metric: "pace", delta: 80 }];
    const out = normalizeCrossSessionInsights(raw, 2);
    expect(out).toHaveLength(1);
    expect(out[0].delta).toBe(30);
  });

  it("clamps a hallucinated -99 delta to -30", () => {
    const raw = [{ kind: "regression", text: "collapse", metric: "fillers", delta: -99 }];
    expect(normalizeCrossSessionInsights(raw, 1)[0].delta).toBe(-30);
  });

  it("leaves an in-range delta untouched (still rounded to one decimal)", () => {
    const raw = [{ kind: "improvement", text: "ok", metric: "pace", delta: 12.34 }];
    expect(normalizeCrossSessionInsights(raw, 1)[0].delta).toBe(12.3);
  });

  it("drops an insight whose metric is not a recognized skill/axis", () => {
    const raw = [
      { kind: "improvement", text: "real skill", metric: "Anchor strength", delta: 5 },
      { kind: "regression", text: "made-up axis", metric: "Vibe mastery", delta: 4 },
    ];
    const out = normalizeCrossSessionInsights(raw, 2);
    expect(out).toHaveLength(1);
    expect(out[0].metric).toBe("Anchor strength");
  });

  it("keeps prose-only insights that carry no metric", () => {
    const raw = [
      { kind: "persistent", text: "You still rush your closes." },
      { kind: "improvement", text: "Stronger openers this time." },
    ];
    expect(normalizeCrossSessionInsights(raw, 2)).toHaveLength(2);
  });
});

/* ─── I-12 — verdict coherence with numeric scores ─── */
describe("validateVerdictCoherence (I-12)", () => {
  const strongSkills = [
    { name: "Anchor strength", score: 82 },
    { name: "Counter-offer judgement", score: 78 },
  ];
  const weakSkills = [
    { name: "Anchor strength", score: 38 },
    { name: "Counter-offer judgement", score: 41 },
  ];

  it("passes a positive verdict through when the score supports it", () => {
    const v = "Strong negotiation — you anchored high and held your ground.";
    expect(validateVerdictCoherence(v, 84, strongSkills)).toBe(v);
  });

  it("replaces a positive verdict that contradicts a low score", () => {
    const v = "Strong showing — impressive command of the negotiation.";
    const out = validateVerdictCoherence(v, 46, weakSkills);
    expect(out).not.toBe(v);
    expect(out).toContain("46/100");
  });

  it("replaces a negative verdict when no skill is actually low", () => {
    const v = "A weak result with a major gap in your approach.";
    const out = validateVerdictCoherence(v, 76, strongSkills);
    expect(out).not.toBe(v);
    expect(out).toContain("76/100");
  });

  it("passes a negative verdict through when the scores back it up", () => {
    const v = "Weak overall — you struggled to anchor and gave ground early.";
    expect(validateVerdictCoherence(v, 44, weakSkills)).toBe(v);
  });

  it("returns an empty verdict unchanged (caller handles the empty case)", () => {
    expect(validateVerdictCoherence("", 50, strongSkills)).toBe("");
  });
});

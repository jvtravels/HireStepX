import { describe, it, expect } from "vitest";
import { extractAccentMarkup, pickAccent } from "../_accent-parser";

/* ─── extractAccentMarkup — LLM-marked path ─── */
describe("extractAccentMarkup", () => {
  it("extracts a single-word accent and strips the markup", () => {
    const r = extractAccentMarkup("Tell me about a *time* you led without authority.");
    expect(r.cleaned).toBe("Tell me about a time you led without authority.");
    expect(r.accentSplit).toEqual({
      before: "Tell me about a",
      accent: "time",
      after: "you led without authority",
    });
  });

  it("preserves a leading [Persona] tag in cleaned text and accentSplit.before", () => {
    const r = extractAccentMarkup("[Hiring Manager] How would you *size* the market for groceries?");
    expect(r.cleaned).toBe("[Hiring Manager] How would you size the market for groceries?");
    expect(r.accentSplit?.before).toBe("[Hiring Manager] How would you");
    expect(r.accentSplit?.accent).toBe("size");
  });

  it("returns no accentSplit when LLM emits no markup", () => {
    const r = extractAccentMarkup("Tell me about your last role.");
    expect(r.cleaned).toBe("Tell me about your last role.");
    expect(r.accentSplit).toBeUndefined();
  });

  it("rejects stopword accents", () => {
    const r = extractAccentMarkup("Tell *me* about a time you led.");
    expect(r.cleaned).toBe("Tell me about a time you led.");
    expect(r.accentSplit).toBeUndefined();
  });

  it("rejects multi-word accents", () => {
    const r = extractAccentMarkup("Tell me about *a time* you led.");
    expect(r.accentSplit).toBeUndefined();
  });

  it("strips trailing punctuation from after-segment", () => {
    const r = extractAccentMarkup("Walk me through a *project* where you led.");
    expect(r.accentSplit?.after).toBe("where you led");
  });

  it("strips stray asterisks defensively when no valid marker is found", () => {
    const r = extractAccentMarkup("Tell me ** about your role.");
    expect(r.cleaned).toBe("Tell me  about your role.");
    expect(r.accentSplit).toBeUndefined();
  });

  it("only takes the FIRST accent if LLM emits multiple", () => {
    const r = extractAccentMarkup("Tell me about a *time* you *led* a team.");
    expect(r.accentSplit?.accent).toBe("time");
    expect(r.cleaned).not.toContain("*");
  });

  it("handles empty input", () => {
    const r = extractAccentMarkup("");
    expect(r.cleaned).toBe("");
    expect(r.accentSplit).toBeUndefined();
  });

  it("rejects accents longer than 24 characters", () => {
    const r = extractAccentMarkup("Tell me about a *supercalifragilisticexpialidocious* moment.");
    expect(r.accentSplit).toBeUndefined();
  });
});

/* ─── pickAccent — heuristic fallback ─── */
describe("pickAccent", () => {
  it("matches the 'Tell me about a TIME' pattern", () => {
    const r = pickAccent("Tell me about a time you led without authority.");
    expect(r).toEqual({
      before: "Tell me about a",
      accent: "time",
      after: "you led without authority",
    });
  });

  it("matches the 'Walk me through a PROJECT' pattern", () => {
    const r = pickAccent("Walk me through a project where you had to convince a senior leader.");
    expect(r?.accent).toBe("project");
  });

  it("matches 'How would you SIZE' technical-case pattern", () => {
    const r = pickAccent("How would you size the market for groceries delivery in India?");
    expect(r?.accent).toBe("size");
  });

  it("matches 'What's the BIGGEST' self-reflective pattern", () => {
    const r = pickAccent("What's the biggest mistake you've made?");
    expect(r?.accent).toBe("biggest");
  });

  it("matches 'Why' question-head pattern", () => {
    const r = pickAccent("Why this company, and why now?");
    expect(r?.accent).toBe("Why");
  });

  it("falls back to heuristic when no pattern matches", () => {
    const r = pickAccent("Could you discuss the rebuild you owned?");
    // 'rebuild' is in ACTION_VERBS — should win over 'discuss' (stopword)
    expect(r?.accent).toBe("rebuild");
  });

  it("avoids picking proper nouns mid-sentence", () => {
    const r = pickAccent("Tell us about your last role at Flipkart, please.");
    // 'Flipkart' is mid-sentence proper noun — should NOT win
    expect(r?.accent).not.toBe("Flipkart");
  });

  it("strips bracketed persona prefix before scanning", () => {
    const r = pickAccent("[Technical Lead] Walk me through a migration you owned.");
    expect(r?.accent).toBe("migration");
  });

  it("returns null on empty input", () => {
    expect(pickAccent("")).toBeNull();
  });

  it("returns null when text is too short for a meaningful accent", () => {
    expect(pickAccent("Hi.")).toBeNull();
  });

  it("strips trailing punctuation from after-segment", () => {
    const r = pickAccent("Tell me about a time you led without authority.");
    expect(r?.after).toBe("you led without authority");
    expect(r?.after.endsWith(".")).toBe(false);
  });
});

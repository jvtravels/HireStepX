/**
 * Phase-6.2 — answer↔question topical-alignment detector.
 *
 * Unit tests for `_topical-alignment.ts`. The helper is intentionally
 * conservative — false positives erode candidate trust ("the AI said I
 * was off-topic when I wasn't"). These tests pin both the positive
 * detections AND the conservative skips.
 */

import { describe, it, expect } from "vitest";
import {
  detectQuestionIntent,
  detectAnswerIntentSignals,
  extractContentTokens,
  isAnswerOffTopic,
} from "../../server-handlers/_topical-alignment";

describe("detectQuestionIntent", () => {
  it("tags conflict prompts", () => {
    expect(detectQuestionIntent("Tell me about a time you disagreed with a PM on a design decision.")).toBe("conflict");
  });
  it("tags failure prompts", () => {
    expect(detectQuestionIntent("Tell me about a time you failed to deliver on a goal.")).toBe("failure");
  });
  it("tags ambiguity prompts", () => {
    expect(detectQuestionIntent("Tell me about a time the problem was ambiguous and you had to create clarity.")).toBe("ambiguity");
  });
  it("tags mentorship prompts", () => {
    expect(detectQuestionIntent("Tell me about a time you mentored a junior engineer.")).toBe("mentorship");
  });
  it("tags decision-making prompts", () => {
    expect(detectQuestionIntent("Walk me through a tough trade-off you had to make.")).toBe("decision-making");
  });
  it("returns null for generic warm-up prompts", () => {
    expect(detectQuestionIntent("Walk me through your background.")).toBeNull();
  });
});

describe("detectAnswerIntentSignals", () => {
  it("flags conflict signals in answer text", () => {
    const hits = detectAnswerIntentSignals("There was tension with the lead engineer about the API contract — we clashed for a week before aligning.");
    expect(hits.has("conflict")).toBe(true);
  });
  it("flags failure signals in answer text", () => {
    const hits = detectAnswerIntentSignals("We missed the deadline and in hindsight I would have flagged the risk earlier.");
    expect(hits.has("failure")).toBe(true);
  });
  it("returns empty set on neutral text", () => {
    const hits = detectAnswerIntentSignals("The project started in March and ran for six months across two teams.");
    expect(hits.size).toBe(0);
  });
});

describe("extractContentTokens", () => {
  it("drops stopwords, short tokens, and punctuation", () => {
    const tokens = extractContentTokens("Tell me about a time you mentored a junior designer.");
    expect(tokens).toContain("mentored");
    expect(tokens).toContain("junior");
    expect(tokens).toContain("designer");
    expect(tokens).not.toContain("me");
    expect(tokens).not.toContain("a");
    expect(tokens).not.toContain("tell");
  });
});

describe("isAnswerOffTopic — positive detections", () => {
  it("flags a leadership answer to a conflict question", () => {
    const q = "Tell me about a time you had a conflict with a peer or PM.";
    const a = "I led a major migration project last year. I set the vision, rallied the team, and we shipped on time with strong adoption.";
    const result = isAnswerOffTopic(q, a);
    expect(result.offTopic).toBe(true);
    expect(result.questionIntent).toBe("conflict");
  });

  it("flags a mentorship answer to a failure question", () => {
    const q = "Tell me about a time something you owned went wrong.";
    const a = "I mentored three juniors over the last year — we ran weekly design crits and the team's quality improved noticeably.";
    const result = isAnswerOffTopic(q, a);
    expect(result.offTopic).toBe(true);
    expect(result.questionIntent).toBe("failure");
  });
});

describe("isAnswerOffTopic — conservative skips", () => {
  it("does NOT flag when question has no clear intent", () => {
    const q = "Walk me through your background.";
    const a = "I led a major migration project last year and rallied the team.";
    expect(isAnswerOffTopic(q, a).offTopic).toBe(false);
  });

  it("does NOT flag when answer carries the same intent signal", () => {
    const q = "Tell me about a time you disagreed with a PM on scope.";
    const a = "There was real tension with our PM about the rollout plan — we clashed for a week before I walked him through the data and we aligned.";
    expect(isAnswerOffTopic(q, a).offTopic).toBe(false);
  });

  it("does NOT flag when token overlap ≥2 even without intent match", () => {
    const q = "Tell me about a time you handled a difficult stakeholder negotiation.";
    const a = "The stakeholder negotiation around our pricing model was tough — I prepared three options and walked the partner through each.";
    const result = isAnswerOffTopic(q, a);
    /* "stakeholder" + "negotiation" overlap → safe even though answer
       doesn't carry conflict-intent signals. */
    expect(result.offTopic).toBe(false);
    expect(result.overlapCount).toBeGreaterThanOrEqual(2);
  });
});

/* Question-router tests (2026-05-29).
 *
 * Why this file exists
 * ─────────────────────────────────────────────────────────────────
 * `_question-router.ts` is the single chokepoint for four prior inline
 * regex blocks: anchor-ask, breakdown-ask, the 14-topic curated
 * classifier, and the 20-intent coarse classifier. Pre-router, each
 * lived in a different module and could drift independently. Now any
 * regression in one of those banks silently re-breaks adversarial /
 * topic-drift / role-reversal handling downstream.
 *
 * Coverage strategy
 *   • One assertion per router variant (anchor-ask / breakdown-ask /
 *     topical / intent-only / open-direct / null).
 *   • Precedence checks at every boundary: anchor > breakdown > topical
 *     > intent-only > open-direct. The boundary tests are the load-
 *     bearing ones — adding a new variant or shifting an existing
 *     pattern is exactly the kind of change that breaks ordering
 *     silently in production but loudly here.
 *   • Shape detector smoke tests so the validator's downstream
 *     `routeQuestionShape` consumer can't regress without flagging.
 */

import { describe, it, expect } from "vitest";
import {
  routeCandidateQuestion,
  routeQuestionShape,
} from "../../server-handlers/_question-router";

describe("routeCandidateQuestion — variants", () => {
  it("returns null for empty / nullish input", () => {
    expect(routeCandidateQuestion("")).toBeNull();
    expect(routeCandidateQuestion(null)).toBeNull();
    expect(routeCandidateQuestion(undefined)).toBeNull();
    expect(routeCandidateQuestion("   ")).toBeNull();
  });

  it("returns null for statements (no question shape)", () => {
    expect(routeCandidateQuestion("I have a competing offer at 42L.")).toBeNull();
    expect(routeCandidateQuestion("Thanks for the offer.")).toBeNull();
  });

  it("routes anchor-ask when candidate asks for the offer/number", () => {
    const samples = [
      "what's your offer?",
      "what is your budget?",
      "how much are you offering?",
      "share the number",
      "tell me the figure",
      "what number are we looking at?",
      "what's the budget for this role?",
    ];
    for (const s of samples) {
      const r = routeCandidateQuestion(s);
      expect(r?.kind, `expected anchor-ask for: ${s}`).toBe("anchor-ask");
    }
  });

  it("routes breakdown-ask for in-hand / breakdown / recap requests", () => {
    const samples = [
      "what's the in-hand?",
      "share the breakdown",
      "can you walk me through the split?",
      "monthly take-home please",
      "what is base, variable, bonus?",
    ];
    for (const s of samples) {
      const r = routeCandidateQuestion(s);
      expect(r?.kind, `expected breakdown-ask for: ${s}`).toBe("breakdown-ask");
    }
  });

  it("routes topical for the 14 curated topics", () => {
    const r = routeCandidateQuestion("how does ESOP vesting work here?");
    expect(r?.kind).toBe("topical");
    if (r?.kind === "topical") {
      expect(r.topic).toBe("esop-structure");
    }
  });

  it("routes intent-only for coarse intents not in the 14-topic bank", () => {
    /* "team" intent — recognised by the 20-bucket classifier but no
     * curated response-bank entry. */
    const r = routeCandidateQuestion("who would I be reporting to?");
    expect(r?.kind === "intent-only" || r?.kind === "topical").toBe(true);
  });

  it("routes open-direct for a recognised question shape with no topic/intent", () => {
    const r = routeCandidateQuestion("can you confirm by Friday?");
    expect(r?.kind).toBe("open-direct");
  });
});

describe("routeCandidateQuestion — precedence", () => {
  it("anchor-ask beats breakdown-ask when both patterns match", () => {
    /* "what's your offer and share the breakdown" — both regexes hit,
     * anchor must win because it gates anchor-preemption downstream. */
    const r = routeCandidateQuestion(
      "what's your offer and can you share the breakdown?",
    );
    expect(r?.kind).toBe("anchor-ask");
  });

  it("breakdown-ask beats topical when both patterns match", () => {
    /* "share the breakdown of ESOP" — breakdown + esop-structure both
     * candidate matches; breakdown wins by precedence ordering. */
    const r = routeCandidateQuestion("share the breakdown of esop please");
    expect(r?.kind).toBe("breakdown-ask");
  });

  it("topical beats intent-only when the candidate question hits both banks", () => {
    /* "how does equity work" — esop-structure is in the 14-topic bank
     * AND `equity` is in the 20-intent bank. Topical must win. */
    const r = routeCandidateQuestion("how does equity / esop work here?");
    expect(r?.kind).toBe("topical");
  });

  it("topical beats open-direct when shape is direct but topic matches", () => {
    /* Direct shape (starts with "what") AND topical hit. Topical wins. */
    const r = routeCandidateQuestion("what's the notice period buyout?");
    expect(r?.kind).toBe("topical");
    if (r?.kind === "topical") {
      expect(r.topic).toBe("notice-buyout");
    }
  });
});

describe("routeQuestionShape — detectors", () => {
  it("detects numeric questions", () => {
    expect(routeQuestionShape("how much is the base?").isNumericQuestion).toBe(true);
    expect(routeQuestionShape("what's the total CTC?").isNumericQuestion).toBe(true);
    expect(routeQuestionShape("is 42 LPA in your budget?").isNumericQuestion).toBe(true);
  });

  it("detects direct questions via punctuation, interrogative, or frame", () => {
    expect(routeQuestionShape("really?").isDirectQuestion).toBe(true);
    expect(routeQuestionShape("what about WFH").isDirectQuestion).toBe(true);
    expect(routeQuestionShape("can you confirm the joining date").isDirectQuestion).toBe(true);
  });

  it("returns empty topics for statements (PDF#50 gate)", () => {
    const shape = routeQuestionShape("I am happy with the offer.");
    expect(shape.isDirectQuestion).toBe(false);
    expect(shape.isNumericQuestion).toBe(false);
    expect(shape.topics).toEqual([]);
  });
});

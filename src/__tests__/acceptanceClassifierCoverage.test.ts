/**
 * Session B (2026-05-14) — Area 5 audit.
 *
 * Corpus coverage for classifyAcceptance in
 * server-handlers/_acceptance-classifier.ts.
 *
 * The classifier's rule-tier precedence (veto → performative →
 * split-clause → soft-alignment → idiom+offer-ref → idiom+gate) is
 * respected. New patterns are surgically added to STRONG_PERFORMATIVE_
 * PATTERNS / COMMITMENT_IDIOM_PATTERNS / SPLIT_CLAUSE_ACCEPTANCE_
 * PATTERNS rather than the classifier being rewritten.
 *
 * `offerOnTable: true` is passed for the strong-acceptance cases so
 * commitment-idiom-only forms (e.g. "deal", "sold") aren't vetoed by
 * the phase-gate. Ambiguous and walked-away cases pass no context so
 * default behavior is exercised.
 */

import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const onTable = { offerOnTable: true };

describe("acceptance classifier — strong acceptance forms", () => {
  const cases = [
    "I accept",
    "deal",
    "done",
    "sold",
    "let's go",
    "I'll join",
    "I'm in",
    "works for me",
    "yes I'll take it",
    "okay let's proceed",
    "alright I'll sign",
  ];
  for (const input of cases) {
    it(`"${input}" → accepted`, () => {
      const r = classifyAcceptance(input, onTable);
      expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(true);
    });
  }
});

describe("acceptance classifier — strong acceptance + follow-up question", () => {
  /* Each acceptance form is followed by an info-seeking question that
   * must NOT veto the acceptance. The split-clause detector + info-
   * seeking-but exception keep these as accepted. */
  const accepts = ["I accept", "I'll join", "I'm in", "deal", "done", "sold", "let's go", "I'll take it", "okay let's proceed"];
  const followUps = [
    "can you tell me about benefits?",
    "do I get RSUs?",
    "when's the start date?",
  ];
  for (const accept of accepts) {
    for (const fu of followUps) {
      const input = `${accept}. ${fu}`;
      it(`"${input}" → accepted (with follow-up)`, () => {
        const r = classifyAcceptance(input, onTable);
        expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(true);
      });
    }
  }
});

describe("acceptance classifier — negation / hesitation must not accept", () => {
  const cases = [
    "I won't take it",
    "not at this number",
    "not yet",
    "I'll think about it",
    "let me check",
    "give me time",
    "hmm, not sure",
  ];
  for (const input of cases) {
    it(`"${input}" → NOT accepted`, () => {
      const r = classifyAcceptance(input, onTable);
      expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(false);
    });
  }
});

describe("acceptance classifier — ambiguous fillers (without offer on table) must NOT accept", () => {
  /* The phase-gate fires when offerOnTable === false. Bare "okay" /
   * "alright" / "fine" must not promote to acceptance in that path. */
  const cases = ["okay", "I see", "got it", "alright", "fine"];
  for (const input of cases) {
    it(`"${input}" (no offer) → NOT accepted`, () => {
      const r = classifyAcceptance(input, { offerOnTable: false });
      expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(false);
    });
  }
});

describe("acceptance classifier — walked-away signals must NOT accept", () => {
  const cases = ["I'm out", "I'll pass", "no thank you", "not interested"];
  for (const input of cases) {
    it(`"${input}" → NOT accepted`, () => {
      const r = classifyAcceptance(input, onTable);
      expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(false);
    });
  }
});

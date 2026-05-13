/* Corpus-driven regression — Phase 19 (2026-05-13).
 *
 * Exercises the kernel's text-side detectors against the distilled
 * (Candidate_Answer, Red_Flags) pairs from the 1,850-row HireStepX
 * Salary Negotiation Training Set. For each row, we map the dataset's
 * free-text red-flag string to the corresponding kernel signal and
 * assert it fires.
 *
 * This is a coverage audit, not a unit test: when a row fails, the
 * fix is to extend the underlying parser, not to weaken the
 * assertion. If a row has a flag the kernel deliberately does not
 * cover (e.g. "missing context" — a meta-flag for follow-up rows),
 * we map it to NO_SIGNAL and skip.
 *
 * Corpus snapshot lives at `corpus/red-flag-distilled.json` so this
 * test is reproducible without the xlsx source. */

import { describe, it, expect } from "vitest";
import distilled from "./corpus/red-flag-distilled.json" with { type: "json" };
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import { extractCandidateStance } from "../../server-handlers/_candidate-stance";
import { detectRedFlags } from "../../server-handlers/_red-flags";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };

/* Map dataset red-flag tokens to expected kernel signals. A row passes
 * if AT LEAST ONE of the listed signals fires.
 *
 * Each entry is either:
 *   - { stance: <key> }  — checks state.candidateStance[key]
 *   - { redFlag: <code> } — checks detectRedFlags output
 *   - "skip"              — meta-flag we deliberately don't cover */
type Expectation =
  | { kind: "stance"; key: string }
  | { kind: "redFlag"; code: string }
  | { kind: "skip" };

const FLAG_MAP: Record<string, Expectation[]> = {
  "generic market claim": [
    { kind: "stance", key: "marketReferenceVague" },
  ],
  "too desperate": [{ kind: "stance", key: "soundsDesperate" }],
  "does not know salary breakup": [{ kind: "redFlag", code: "no-fixed-variable-breakup" }],
  "too rigid": [
    { kind: "stance", key: "flexibilityPosture" },
    { kind: "redFlag", code: "demands-no-flex" },
  ],
  "personal expense justification": [
    { kind: "stance", key: "personalExpenseJustification" },
    { kind: "redFlag", code: "personal-expense-justification" },
  ],
  "offer-shopping risk": [
    { kind: "stance", key: "offerShoppingDemand" },
    { kind: "redFlag", code: "offer-shopping" },
  ],
  "treats ESOP as cash": [
    { kind: "stance", key: "treatsEquityAsCash" },
    { kind: "redFlag", code: "treats-equity-as-cash" },
  ],
  "ignores variable risk": [
    { kind: "stance", key: "dismissesVariableRisk" },
    { kind: "redFlag", code: "ignores-variable-risk" },
  ],
  "overpromises joining": [
    { kind: "stance", key: "overpromisesJoining" },
    { kind: "redFlag", code: "overcommits-joining" },
  ],
  "avoids salary anchor": [
    { kind: "stance", key: "avoidsAnchor" },
    { kind: "redFlag", code: "avoids-anchor" },
  ],
  "limited justification": [
    /* Row pattern: "I'm flexible depending on the role and company" —
     * fires marketReferenceVague when "market standards" appears, or
     * flexibilityPosture=flexible otherwise. Either is acceptable. */
    { kind: "stance", key: "flexibilityPosture" },
    { kind: "stance", key: "marketReferenceVague" },
    { kind: "stance", key: "avoidsAnchor" },
  ],
  "vague / unsupported": [
    { kind: "stance", key: "avoidsAnchor" },
    { kind: "stance", key: "dismissesVariableRisk" },
    { kind: "redFlag", code: "no-fixed-variable-breakup" },
  ],
  "generic; no anchor": [
    { kind: "stance", key: "marketReferenceVague" },
    { kind: "stance", key: "avoidsAnchor" },
  ],
  "offer risk; overcommitment": [
    { kind: "stance", key: "offerShoppingDemand" },
    { kind: "redFlag", code: "offer-shopping" },
    { kind: "stance", key: "overpromisesJoining" },
  ],
  /* Meta-flags — we deliberately don't cover these as text signals. */
  "missing context": [{ kind: "skip" }],
  "scenario-specific risk": [{ kind: "skip" }],
};

type DistilledRow = {
  Candidate_Answer: string;
  Red_Flags: string;
  Scenario: string;
  Answer_Label: string;
};

function checkExpectation(row: DistilledRow, exp: Expectation): boolean {
  const text = row.Candidate_Answer;
  const stance = extractCandidateStance(text);
  if (exp.kind === "skip") return true;
  if (exp.kind === "stance") {
    const v = (stance as unknown as Record<string, unknown>)[exp.key];
    return v != null && v !== false;
  }
  /* redFlag — build a minimal state with currentCtc + target set if the
   * answer states them, so structural detectors have something to chew. */
  let state = initState({ sessionId: "corpus", role: "swe", company: "acme", band: BAND });
  state = applyCandidateAnswer(state, text);
  const flags = detectRedFlags({ state, stance, utterance: text });
  return flags.some((f) => f.code === exp.code);
}

describe("corpus regression — distilled red-flag rows", () => {
  /* Generate one test per (Candidate_Answer, Red_Flags) pair. The
   * dataset has 31 distilled rows; failures here mean a real coverage
   * gap, not a flaky regex. */
  for (const row of distilled as DistilledRow[]) {
    /* FLAG_MAP keys may contain ';' (e.g. "generic; no anchor"), so we
     * try the full string first and only split as fallback. */
    const full = row.Red_Flags.trim();
    const flags = FLAG_MAP[full]
      ? [full]
      : row.Red_Flags.split(";").map((s) => s.trim()).filter(Boolean);
    const title = `[${row.Red_Flags}] "${row.Candidate_Answer.slice(0, 70)}…"`;
    it(title, () => {
      /* Pass if EVERY flag listed by the dataset has at least one
       * mapped expectation that fires. */
      for (const flag of flags) {
        const expectations = FLAG_MAP[flag];
        if (!expectations) {
          throw new Error(`Unmapped corpus flag: "${flag}". Add to FLAG_MAP.`);
        }
        if (expectations.length === 1 && expectations[0].kind === "skip") continue;
        const anyFires = expectations.some((exp) => checkExpectation(row, exp));
        expect(
          anyFires,
          `Flag "${flag}" on row "${row.Candidate_Answer.slice(0, 80)}…" did not fire any expected signal: ${expectations.map((e) => (e.kind === "stance" ? `stance.${e.key}` : e.kind === "redFlag" ? `redflag.${e.code}` : "skip")).join(", ")}`,
        ).toBe(true);
      }
    });
  }
});

describe("corpus regression — strong-answer false positive guard", () => {
  /* Strong answers should NOT trigger our heaviest red flags:
   * desperate, badmouth, avoids-anchor, offer-shopping. These are the
   * "do no harm" guards — if a polished candidate response gets
   * flagged, the parsers are over-fitting. */
  const guardKeys = ["soundsDesperate", "badmouthsCurrent", "offerShoppingDemand", "treatsEquityAsCash"] as const;
  const strongExamples = [
    "My current CTC is ₹4L, with approximately ₹3.3L fixed and ₹0.7L variable. For this role, I am looking at ₹7L–₹10L based on the role scope and my experience.",
    "I appreciate the budget context. I am open to understanding the full structure—fixed pay, variable, joining bonus, benefits, and review cycle—before deciding.",
    "I do have another offer, but I am evaluating opportunities based on role fit, growth, team, company direction, and compensation structure.",
    "My ideal expectation is around ₹36L, depending on the structure. Practically, I would be comfortable discussing ₹33L–₹36L if the fixed component, role scope, and growth path are strong.",
  ];
  for (const text of strongExamples) {
    it(`no false positives: "${text.slice(0, 60)}…"`, () => {
      const stance = extractCandidateStance(text);
      for (const k of guardKeys) {
        expect((stance as unknown as Record<string, unknown>)[k]).toBeFalsy();
      }
    });
  }
});

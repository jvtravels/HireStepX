/* PDF#32 BUG G regression (2026-05-18) — component-probe restyle drifts
 * from interrogative ASK into a fabricated-disclosure STATEMENT.
 *
 * Symptom (PDF#32, Meesho/Prita T17): bot uttered
 *   "Thanks for that — ESOPs do kick in, but there's a vesting cliff
 *    as per company policy."
 * vs canonical: "ESOPs in play? Any vesting cliff or accelerator?"
 *
 * The canonical is an ASK (question shape, requesting candidate
 * disclosure). The LLM-restyle:
 *   1. Dropped the question mark.
 *   2. Pivoted to a STATEMENT asserting ESOPs DO exist with a cliff.
 *   3. Paired it with "Thanks for that —" which reads as
 *      acknowledgement of the candidate's prior turn — but the
 *      candidate's prior turn was unparseable noise (PDF#32 BUG H).
 * Net effect: recruiter fabricated a disclosure on the candidate's
 * behalf, then thanked them for it.
 *
 * The prior contract had `requiredTokens: [/esops?|rsus?|equity|.../]`
 * which passed because "ESOPs"/"vesting" tokens are still present.
 * Token presence is not enough — the SPEECH ACT must remain a
 * question. Two new gates layered into the component-probe validator:
 *   (a) restyle must carry `?`
 *   (b) restyle must not match the fabricated-disclosure regex
 *       (`<equity-token> do/does/will kick/vest/exist`).
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { validateRestyle } from "../../../server-handlers/_response-pipeline";
import { type NextAction } from "../../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 30,
  maxStretch: 45,
  walkAway: 25,
  hasEquity: true,
};

const newState = (): NegotiationState =>
  initState({
    sessionId: "pdf32-bugG",
    role: "Senior Product Designer",
    company: "Meesho",
    band: BAND,
  });

const ESOP_PROBE: NextAction = {
  kind: "component-probe",
  component: "esop",
  topic: "currentCtcEsop",
} as unknown as NextAction;

const CANONICAL_ESOP_PROBE = "ESOPs in play? Any vesting cliff or accelerator?";

describe("PDF#32 BUG G — component-probe shape invariant", () => {
  it("rejects the exact PDF#32 T17 fabricated-disclosure statement", () => {
    const state = newState();
    const t17 =
      "Thanks for that — ESOPs do kick in, but there's a vesting cliff as per company policy.";
    const result = validateRestyle(CANONICAL_ESOP_PROBE, t17, state, ESOP_PROBE);
    expect(result.valid).toBe(false);
    /* Either gate is acceptable — order matters: the `?` gate fires
     * first because T17 dropped the question mark. */
    expect(result.reason).toMatch(
      /contract-shape-not-interrogative|contract-fabricated-disclosure/,
    );
  });

  it("rejects statement-form restyle even when `?` slips in elsewhere", () => {
    /* Hostile case: LLM keeps a question mark at the end of an unrelated
     * clause but still asserts ESOPs DO kick in. The fabricated-disclosure
     * regex must catch the assertion regardless of overall shape. */
    const state = newState();
    const hostile =
      "ESOPs do kick in here, by the way — make sense?";
    const result = validateRestyle(CANONICAL_ESOP_PROBE, hostile, state, ESOP_PROBE);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/contract-fabricated-disclosure/);
  });

  it("rejects RSUs/equity statement-form drift symmetrically", () => {
    const state = newState();
    const variants = [
      "RSUs do vest annually — what's your view?",
      "Equity does vest with a one-year cliff, right?",
      "ESOPs will kick in after probation — fair enough?",
    ];
    for (const v of variants) {
      const result = validateRestyle(CANONICAL_ESOP_PROBE, v, state, ESOP_PROBE);
      expect(result.valid).toBe(false);
    }
  });

  it("rejects question-mark-less restyle that drops the speech act", () => {
    const state = newState();
    const dropped = "Right, on equity — vesting follows the standard schedule.";
    const result = validateRestyle(CANONICAL_ESOP_PROBE, dropped, state, ESOP_PROBE);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/contract-shape-not-interrogative/);
  });

  it("accepts legitimate interrogative restyles of the esop probe", () => {
    const state = newState();
    const safe = [
      "ESOPs in play? Any cliff or accelerator?",
      "How does the equity piece look — any vesting cliff?",
      "On the equity side — how are RSUs structured, and is there a cliff?",
      "Quick one on ESOPs — vesting schedule and cliff?",
    ];
    for (const s of safe) {
      const result = validateRestyle(CANONICAL_ESOP_PROBE, s, state, ESOP_PROBE);
      expect(result.valid).toBe(true);
    }
  });

  it("base & variable probes also require interrogative shape", () => {
    const state = newState();
    /* The shape gate runs for every component, not just esop. */
    const baseProbe: NextAction = {
      kind: "component-probe",
      component: "base",
      topic: "currentCtcBase",
    } as unknown as NextAction;
    const declarative = "Your base is the larger slice of total comp.";
    const result = validateRestyle(
      "What's the base split?",
      declarative,
      state,
      baseProbe,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/contract-shape-not-interrogative/);
  });
});

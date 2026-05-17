/* AR2 / Audit Pass 4 (PDF#27, 2026-05-17) — turn-pair coherence.
 *
 * Dev-only diagnostic. Four fixtures:
 *   (a) silent dodge — prev probe, non-trivial answer, state still null,
 *       next turn re-probes the same topic → silent-dodge warning.
 *   (b) ack without disclosure — prev probe, non-trivial answer, state
 *       still null, next turn advances → ack-without-disclosure.
 *   (c) topic regress — counter-offer turn dropping back to discovery
 *       without phase reset → topic-regress.
 *   (d) clean turn — prev probe, candidate disclosed, state populated,
 *       next turn advances → no warnings.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  validateTurnCoherence,
  clearCoherenceWarnings,
  getCoherenceWarnings,
} from "../../server-handlers/_response-pipeline";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

function mkState(): NegotiationState {
  return initState({ sessionId: "ar2", role: "swe", company: "acme", band: BAND });
}

const PROBE_CURRENT: NextAction = {
  kind: "discovery-probe",
  item: "currentCtc",
  ask: "what's your current ctc?",
} as NextAction;

const PROBE_TARGET: NextAction = {
  kind: "discovery-probe",
  item: "expectedCtc",
  ask: "what's your expected?",
} as NextAction;

const COUNTER: NextAction = {
  kind: "counter-offer",
  counterTotalLpa: 26,
} as NextAction;

describe("AR2 — validateTurnCoherence", () => {
  beforeEach(() => {
    clearCoherenceWarnings();
  });

  it("(a) silent dodge — re-probes same topic when state still null", () => {
    const state = mkState();
    /* state.candidateCurrentCtc remains null */
    const surfaced = validateTurnCoherence(
      PROBE_CURRENT,
      "I would rather not say right now",
      PROBE_CURRENT,
      state,
    );
    expect(surfaced.length).toBeGreaterThan(0);
    expect(surfaced.some((w) => w.kind === "silent-dodge")).toBe(true);
    expect(getCoherenceWarnings().some((w) => w.kind === "silent-dodge")).toBe(true);
  });

  it("(b) ack without disclosure — advances past topic without state being populated", () => {
    const state = mkState();
    /* state.candidateCurrentCtc remains null but planner advanced */
    const surfaced = validateTurnCoherence(
      PROBE_CURRENT,
      "I think the package is fairly competitive",
      PROBE_TARGET,
      state,
    );
    expect(surfaced.some((w) => w.kind === "ack-without-disclosure")).toBe(true);
  });

  it("(c) topic regress — counter-offer dropping back to discovery", () => {
    const state = mkState();
    const surfaced = validateTurnCoherence(
      COUNTER,
      "I need to think about it",
      PROBE_TARGET,
      state,
    );
    expect(surfaced.some((w) => w.kind === "topic-regress")).toBe(true);
  });

  it("(d) clean turn — state populated and planner advanced → no warning", () => {
    const state = mkState();
    state.candidateCurrentCtc = 18;
    const surfaced = validateTurnCoherence(
      PROBE_CURRENT,
      "current ctc is 18 LPA",
      PROBE_TARGET,
      state,
    );
    expect(surfaced.length).toBe(0);
    expect(getCoherenceWarnings().length).toBe(0);
  });
});

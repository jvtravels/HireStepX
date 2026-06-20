/* Fixed-scoped conditional close — scope-aware decline (live-staging, #105).
 *
 * The defect: a candidate who conditionally closes on a FIXED number
 * ("if you can do ₹38L fixed, I'll sign today") names a base-component term,
 * not a total. `totalScopedCounter()` deliberately returns null for a fixed
 * counter (the units-mismatch class, #58/#104) — but BOTH near-offer close
 * gates carried a `?? state.lastCandidateCounterLpa` fallback that re-admitted
 * the raw fixed figure and compared it against the standing TOTAL offer. When
 * the band could not deliver that fixed term, the planner then closed at the
 * standing total and framed it "we're in the same range" — a stealth
 * under-close that never acknowledged the unmet fixed condition. Users read
 * that as a bait-and-switch.
 *
 * Structural fix locked here:
 *   - `fixedScopedCloseTotal()` converts a fixed close-signal to its IMPLIED
 *     total (fixed + band variable headroom) ONLY when the band can deliver it
 *     (fixed ≤ baseStretch AND implied total ≤ maxStretch); otherwise null.
 *   - `undeliverableFixedConditionAsk()` flags the undeliverable case.
 *   - `nearOfferCloseNumber()` is scope-aware: a fixed signal routes through
 *     `fixedScopedCloseTotal`, never the raw fixed number.
 *   - The trial-close gate and the #94 conditional-close gate DECLINE (fall
 *     through to the fixed-counter cascade) when the fixed ask is
 *     undeliverable — instead of a "same range" stealth close. A DELIVERABLE
 *     fixed ask still closes, at its implied total. The non-cash conditional
 *     (no number) and the total-scoped near-offer close are unchanged.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
  actionToLever,
  nearOfferCloseNumber,
  fixedScopedCloseTotal,
  undeliverableFixedConditionAsk,
} from "../../server-handlers/_next-action-planner";

/* baseStretch 30 (fixed-component ceiling), variableMax 6, maxStretch 40. */
const band: NegotiationBand = {
  initialOffer: 33,
  maxStretch: 40,
  walkAway: 28,
  hasEquity: false,
  baseStretch: 30,
  variableMax: 6,
};

/* Minimal state for the pure-helper unit tests. */
function fixedState(overrides: Partial<NegotiationState>): NegotiationState {
  return {
    ...initState({ sessionId: "fc105u", role: "product", company: "Razorpay", band }),
    highestOfferMade: 33,
    ...overrides,
  };
}

describe("#105 — fixedScopedCloseTotal (deliverability gate)", () => {
  it("returns null when the signal is NOT fixed-scoped", () => {
    expect(
      fixedScopedCloseTotal(fixedState({ lastCounterComponent: "total", lastCandidateCounterLpa: 34 })),
    ).toBeNull();
  });

  it("converts a DELIVERABLE fixed ask to its implied total (fixed + variableMax)", () => {
    // fixed 28 ≤ baseStretch 30; implied total 28+6=34 ≤ maxStretch 40.
    expect(
      fixedScopedCloseTotal(fixedState({ lastCounterComponent: "fixed", candidateTargetFixed: 28 })),
    ).toBe(34);
  });

  it("returns null when the fixed component exceeds the base ceiling", () => {
    // fixed 38 > baseStretch 30 → undeliverable as a fixed component.
    expect(
      fixedScopedCloseTotal(fixedState({ lastCounterComponent: "fixed", candidateTargetFixed: 38 })),
    ).toBeNull();
  });

  it("returns null when the implied total exceeds the band ceiling", () => {
    // fixed 30 ≤ base, but implied total 30 + variableMax 15 = 45 > maxStretch 40.
    const wideVar: NegotiationBand = { ...band, variableMax: 15 };
    const s = fixedState({ lastCounterComponent: "fixed", candidateTargetFixed: 30 });
    expect(fixedScopedCloseTotal({ ...s, band: wideVar })).toBeNull();
  });

  it("falls back to lastCandidateCounterLpa when candidateTargetFixed is absent", () => {
    expect(
      fixedScopedCloseTotal(
        fixedState({ lastCounterComponent: "fixed", candidateTargetFixed: null, lastCandidateCounterLpa: 28 }),
      ),
    ).toBe(34);
  });
});

describe("#105 — undeliverableFixedConditionAsk", () => {
  it("is null for a non-fixed signal", () => {
    expect(
      undeliverableFixedConditionAsk(fixedState({ lastCounterComponent: "total", lastCandidateCounterLpa: 34 })),
    ).toBeNull();
  });

  it("returns the raw fixed figure when the band cannot deliver it", () => {
    expect(
      undeliverableFixedConditionAsk(fixedState({ lastCounterComponent: "fixed", candidateTargetFixed: 38 })),
    ).toBe(38);
  });

  it("is null when the fixed ask is deliverable", () => {
    expect(
      undeliverableFixedConditionAsk(fixedState({ lastCounterComponent: "fixed", candidateTargetFixed: 28 })),
    ).toBeNull();
  });
});

describe("#105 — nearOfferCloseNumber is scope-aware", () => {
  it("never treats an UNDELIVERABLE fixed number as a total (offer stands)", () => {
    // fixed 38 is undeliverable; must NOT close above the 33 offer on it.
    const s = fixedState({ lastCounterComponent: "fixed", candidateTargetFixed: 38, lastCandidateCounterLpa: 38 });
    expect(nearOfferCloseNumber(s)).toBe(33);
  });

  it("honors a DELIVERABLE fixed ask at its implied total within the gap", () => {
    const s = fixedState({ lastCounterComponent: "fixed", candidateTargetFixed: 28, lastCandidateCounterLpa: 28 });
    // implied total 34, offer 33, gap max(2, 1.98)=2 → close at 34.
    expect(nearOfferCloseNumber(s)).toBe(34);
  });

  it("leaves total-scoped near-offer behavior unchanged", () => {
    const s = fixedState({ lastCounterComponent: "total", lastCandidateCounterLpa: 34 });
    expect(nearOfferCloseNumber(s)).toBe(34);
  });
});

/* ── Planner gate integration ── */

function anchoredAt33(): NegotiationState {
  let s = initState({ sessionId: "fc105", role: "product", company: "Razorpay", band });
  s = { ...s, minTurnsBeforeClose: 0 };
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ctc" }, "What's your current CTC?");
  s = applyCandidateAnswer(s, "my current ctc is 28 LPA");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "target" }, "What are you targeting?");
  s = applyCandidateAnswer(s, "I'm targeting 38 LPA");
  s = applyAiMove(s, { lever: "open-with-offer", newTotalLpa: 33, rationale: "anchor" }, "For this grade we can do ₹33 LPA.");
  s = applyCandidateAnswer(s, "let me think about the structure");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "structure" }, "Sure — what specifically?");
  return s;
}

function withConditional(overrides: Partial<NegotiationState>): NegotiationState {
  const base = anchoredAt33();
  return {
    ...base,
    decisionDeadline: { ...base.decisionDeadline, conditionalAcceptance: true },
    ...overrides,
  };
}

describe("#105 — conditional-close gate declines an undeliverable fixed ask", () => {
  it("does NOT close (no stealth 'same range') when the fixed ask exceeds the base ceiling", () => {
    const s = withConditional({
      candidateTargetFixed: 38,
      lastCandidateCounterLpa: 38,
      lastCounterComponent: "fixed",
    });
    const action = planNextAction(s);
    // The core of the bug: must not silently close on lower total terms.
    expect(action.kind).not.toBe("close");
    expect(action.kind).not.toBe("auto-accept");
  });

  it("DOES close at the implied total for a DELIVERABLE fixed conditional ask", () => {
    const s = withConditional({
      candidateTargetFixed: 28,
      lastCandidateCounterLpa: 28,
      lastCounterComponent: "fixed",
    });
    const action = planNextAction(s);
    expect(action.kind === "close" || action.kind === "auto-accept").toBe(true);
    const move = actionToLever(action, s);
    expect(move.lever).toBe("close-acceptance");
    expect(move.newTotalLpa).toBe(34); // 28 fixed + 6 variable headroom
  });

  it("still closes at the standing offer for a non-cash conditional yes (regression)", () => {
    const s = withConditional({
      candidateTargetFixed: null,
      lastCandidateCounterLpa: null,
      lastCounterComponent: null,
    });
    const action = planNextAction(s);
    expect(action.kind === "close" || action.kind === "auto-accept").toBe(true);
    expect(actionToLever(action, s).newTotalLpa).toBe(33);
  });
});

describe("#105 — trial-close gate declines an undeliverable fixed ask", () => {
  type ExtState = NegotiationState & { candidateSignaledClose?: boolean; closeFired?: boolean };

  it("does NOT close when a signaled close rests on an undeliverable fixed ask", () => {
    const s: ExtState = {
      ...anchoredAt33(),
      candidateSignaledClose: true,
      candidateTargetFixed: 38,
      lastCandidateCounterLpa: 38,
      lastCounterComponent: "fixed",
    };
    const action = planNextAction(s);
    expect(action.kind).not.toBe("close");
  });

  it("closes at the implied total when the signaled-close fixed ask is deliverable", () => {
    const s: ExtState = {
      ...anchoredAt33(),
      candidateSignaledClose: true,
      candidateTargetFixed: 28,
      lastCandidateCounterLpa: 28,
      lastCounterComponent: "fixed",
    };
    const action = planNextAction(s);
    expect(action.kind).toBe("close");
    expect(actionToLever(action, s).newTotalLpa).toBe(34);
  });
});

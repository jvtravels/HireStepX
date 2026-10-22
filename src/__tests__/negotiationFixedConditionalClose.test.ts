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
  fixedConditionBlocksClose,
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

/* ── Live production shape (the reported #105 reproduction) ──
 * A fixed conditional close ("if you can do ₹40L fixed, I'll sign") is recorded
 * by the live classifier as `candidateTargetFixed` with `lastCounterComponent`
 * left null and NO `lastCandidateCounterLpa`. Production bands also frequently
 * carry NO `baseStretch`/`variableMax` (base cap defaults to maxStretch,
 * variable headroom defaults to 0). The v1 fix keyed everything on
 * `lastCounterComponent === "fixed"`, so it never engaged for this shape and
 * the planner still stealth-closed at the standing offer. */
const prodBand: NegotiationBand = {
  initialOffer: 33,
  maxStretch: 45.1,
  walkAway: 28,
  hasEquity: false,
  // no baseStretch / variableMax — matches live bands
};

function prodFixedState(overrides: Partial<NegotiationState>): NegotiationState {
  return {
    ...initState({ sessionId: "fc105p", role: "product", company: "Razorpay", band: prodBand }),
    highestOfferMade: 34.5,
    ...overrides,
  };
}

describe("#105 — live shape: candidateTargetFixed with lastCounterComponent null", () => {
  it("resolveFixedCloseAsk path: a deliverable-as-a-number fixed ask a REAL gap above the offer blocks the close", () => {
    // 40 ≤ maxStretch 45.1 (deliverable as a number), but 40-34.5 = 5.5 ≫ gap 2.07.
    const s = prodFixedState({ candidateTargetFixed: 40, lastCounterComponent: null });
    expect(fixedConditionBlocksClose(s)).toBe(true);
  });

  it("undeliverable fixed ask (above the band ceiling) blocks the close", () => {
    // 48 > maxStretch 45.1 → delivered null.
    const s = prodFixedState({ candidateTargetFixed: 48, lastCounterComponent: null });
    expect(fixedScopedCloseTotal(s)).toBeNull();
    expect(fixedConditionBlocksClose(s)).toBe(true);
  });

  it("a fixed ask AT/NEAR the offer (within the gap) does NOT block — close honors it", () => {
    // 36 ≤ 45.1, 36-34.5 = 1.5 ≤ gap 2.07 → deliverable and near → close.
    const s = prodFixedState({ candidateTargetFixed: 36, lastCounterComponent: null });
    expect(fixedConditionBlocksClose(s)).toBe(false);
    expect(fixedScopedCloseTotal(s)).toBe(36);
  });

  it("conditional-close gate does NOT stealth-close the live ₹40L-fixed case", () => {
    let s = initState({ sessionId: "fc105live", role: "product", company: "Razorpay", band: prodBand });
    s = { ...s, minTurnsBeforeClose: 0, highestOfferMade: 34.5 };
    s = {
      ...s,
      decisionDeadline: { ...s.decisionDeadline, conditionalAcceptance: true },
      candidateTargetFixed: 40,
      lastCounterComponent: null,
      lastCandidateCounterLpa: null,
    };
    const action = planNextAction(s);
    expect(action.kind).not.toBe("close");
    expect(action.kind).not.toBe("auto-accept");
  });

  it("conditional-close gate does NOT stealth-close the live ₹48L-fixed (undeliverable) case", () => {
    let s = initState({ sessionId: "fc105live48", role: "product", company: "Razorpay", band: prodBand });
    s = { ...s, minTurnsBeforeClose: 0, highestOfferMade: 34.5 };
    s = {
      ...s,
      decisionDeadline: { ...s.decisionDeadline, conditionalAcceptance: true },
      candidateTargetFixed: 48,
      lastCounterComponent: null,
      lastCandidateCounterLpa: null,
    };
    const action = planNextAction(s);
    expect(action.kind).not.toBe("close");
    expect(action.kind).not.toBe("auto-accept");
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

  it("S73-B1: bumps to implied total (counter-offer) and waits for candidate confirmation when fixed ask is deliverable", () => {
    /* Pre-S73-B1 this returned kind="close" (close-acceptance), which immediately
     * stamped phase=accepted and blocked the candidate's next turn. The fix changes
     * the candidateSignaledClose branch to emit counter-base at the implied total
     * so the recruiter says "₹34L — confirmed?" and the candidate gets one turn to
     * explicitly accept before the proper close sequence fires. */
    const s: ExtState = {
      ...anchoredAt33(),
      candidateSignaledClose: true,
      candidateTargetFixed: 28,
      lastCandidateCounterLpa: 28,
      lastCounterComponent: "fixed",
    };
    const action = planNextAction(s);
    expect(action.kind).toBe("counter-offer");
    expect(actionToLever(action, s).lever).toBe("counter-base");
    expect(actionToLever(action, s).newTotalLpa).toBe(34);
  });
});

/* PRI-55 (2026-06-22, product call: "concede toward it, then close") — a
 * DELIVERABLE in-band fixed-scoped conditional acceptance that sits ABOVE the
 * near-offer instant-close gap must route through the concession engine so the
 * cash anchor steps UP toward the agreed figure, NOT stall at the standing
 * floor. Before the fix the planner hit the justify-probe → acknowledge-recover
 * → floor close (a ₹6L stealth under-close on a ₹28L floor vs a 34-fixed ask).
 * Guard: the bot must visibly concede above its opening floor and close at the
 * negotiated figure. The gate requires a genuine conditionalAcceptance, so a
 * pure stonewall (no committed number) can never trip the concession (#123). */
describe("PRI-55 — fixed-scoped conditional accept concedes above floor", () => {
  it("steps the offer up toward the in-band fixed ask instead of closing at the floor", async () => {
    const { runConversation } = await import("./_negotiationSim");
    const wideBand: NegotiationBand = {
      initialOffer: 28,
      maxStretch: 42,
      walkAway: 24,
      hasEquity: false,
    };
    /* PRI-55 (2026-07-24): first turn must NOT disclose CTC=30. With CTC=30 ≥
     * band floor=28 the pay-cut guard fires `anchor-with-offer` at 35 (above
     * the candidate's 34 ask) which skips the counter-base path entirely. The
     * test is meant to exercise inBandConditionalConverge → counter-base. */
    const { transcript, finalState } = runConversation({
      band: wideBand,
      role: "Engineering Manager",
      company: "Flipkart",
      turns: [
        "I want 34 fixed.",
        "What can you do?",
        "If you can do 34 fixed, I'll sign.",
        "Yes, 34 fixed works for me.",
        "I accept. Please send the letter.",
        "Confirmed, I'll sign today.",
      ],
    });
    /* The bot must concede: at least one counter-offer above the ₹28L floor. */
    const conceded = transcript.some(
      (t) => t.kind === "counter-offer" && t.highestOfferMade > 28,
    );
    expect(conceded).toBe(true);
    /* And it must reach a real close ABOVE the floor — never the stealth
     * floor-close the candidate never agreed to. */
    expect(finalState.phase).toBe("accepted");
    expect(finalState.highestOfferMade).toBeGreaterThan(28);
    /* Never invents above the ceiling. */
    expect(finalState.highestOfferMade).toBeLessThanOrEqual(42);
  });
});

/* S73-B1 end-to-end close sequence (2026-07-25) — candidateSignaledClose
 * fires counter-base (NOT close-acceptance), candidate confirms, proper
 * close-recap-formal sequence follows. */
describe("S73-B1 end-to-end: trial-close → counter-base → candidate confirms → close sequence", () => {
  it("close-confirmation pushed to reactiveFollowupsFired after counter-base, gate does not re-fire", () => {
    /* Simulate: bot asked trial-close → candidate replied "yes" → candidateSignaledClose=true.
     * After the S73-B1 fix the planner fires counter-base (not close-acceptance).
     * applyAiMove pushes askedTopic "close-confirmation" to reactiveFollowupsFired.
     * On the next planNextAction call the gate must be blocked (closeFiredAlready=true). */
    let s = anchoredAt33() as NegotiationState & { candidateSignaledClose?: boolean };
    /* Inject candidateSignaledClose (normally set by applyCandidateAnswer when
     * bot prior turn had a trial-close ask). */
    s = { ...s, candidateSignaledClose: true } as typeof s;

    /* Step 1: planner should emit counter-base, not close-acceptance. */
    const action1 = planNextAction(s);
    expect(action1.kind).toBe("counter-offer");
    const move1 = actionToLever(action1, s);
    expect(move1.lever).toBe("counter-base");

    /* Step 2: bot applies the counter-base move. askedTopic "close-confirmation"
     * must be pushed to reactiveFollowupsFired. closeFired must remain false. */
    s = applyAiMove(s, move1, `We can do ₹${move1.newTotalLpa}L — does that work for you?`);
    expect(s.reactiveFollowupsFired).toContain("close-confirmation");
    expect((s as typeof s & { closeFired?: boolean }).closeFired).toBeFalsy();

    /* Step 3: candidate explicitly accepts. verbalAcceptanceTurn must be stamped. */
    s = applyCandidateAnswer(s, "Yes, ₹34L works perfectly. I accept.");
    expect(s.verbalAcceptanceTurn).not.toBeNull();
    expect(s.phase).toBe("accepted");

    /* Step 4: planner must return close-recap-formal, not re-fire counter-base. */
    const action2 = planNextAction(s);
    expect(action2.kind).toBe("close-recap-formal");
  });

  it("candidateSignaledClose gate does not loop: second planNextAction after counter-base returns close-recap-formal", () => {
    /* Full sequence: anchoredAt33 → inject candidateSignaledClose → counter-base
     * fires → candidate accepts → close-recap-formal. Verifies no infinite loop. */
    let s = anchoredAt33() as NegotiationState & { candidateSignaledClose?: boolean };
    s = { ...s, candidateSignaledClose: true } as typeof s;

    const move = actionToLever(planNextAction(s), s);
    expect(move.lever).toBe("counter-base");
    s = applyAiMove(s, move, `We can do ₹${move.newTotalLpa}L — confirmed?`);
    s = applyCandidateAnswer(s, "Yes, confirmed. I will sign today.");
    expect(s.phase).toBe("accepted");

    const recap = planNextAction(s);
    expect(recap.kind).toBe("close-recap-formal");
  });
});

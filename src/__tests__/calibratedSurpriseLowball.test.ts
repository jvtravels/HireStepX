/* Calibrated-surprise lowball feature (2026-05-29) — tests.
 *
 * Covers:
 *   - Threshold gating (at/above floor, 5-19% under, ≥20% under)
 *   - Affinity gate (≤ -2 suppresses)
 *   - Single-fire across 30 turns
 *   - All 10 sector prose variants render + echo the candidate number
 *   - Branch A (double-down): triggers accept-lowball-quiet, sets
 *     acceptedLowball, affinity -1
 *   - Branch B (revise up): updates userClaims.expectedCtc, affinity +1
 *   - Branch C (ask why): no flag mutation, doesn't refire
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
  actionToLever,
} from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import { buildLowballEvent } from "../../server-handlers/_negotiation-metrics";
import { renderLowballEventText } from "../sessionReport/panels/UnaskedLeversPanel";
import type { RecruiterSectorPersona } from "../../server-handlers/_indian-recruiter-personas";

const BAND: NegotiationBand = {
  initialOffer: 28,
  maxStretch: 32,
  walkAway: 25, /* band floor — 20% under = 20 */
  hasEquity: true,
};

const baseState = (
  overrides: Partial<NegotiationState> = {},
): NegotiationState => {
  const s = initState({
    sessionId: overrides.sessionId ?? "cs-1",
    role: "Senior Engineer",
    company: "acme",
    band: BAND,
    recruiterSectorPersona:
      (overrides.recruiterSectorPersona as RecruiterSectorPersona | undefined) ??
      "indian-unicorn",
  });
  return {
    ...s,
    /* Move past discovery so the calibrated-surprise gate isn't pre-
     * empted by routine discovery probes. */
    turnIndex: 3,
    phase: "probe-expectations",
    candidateCurrentCtc: 16,
    ...overrides,
  };
};

const withAnchor = (
  s: NegotiationState,
  ask: number,
  firstSeen = 2,
): NegotiationState => ({
  ...s,
  candidateTarget: ask,
  userClaims: {
    ...(s.userClaims ?? {}),
    expectedCtc: { value: ask, firstSeenTurn: firstSeen },
  },
});

describe("calibrated-surprise-lowball — threshold gate", () => {
  it("does NOT fire when anchor is at or above band floor", () => {
    const s = withAnchor(baseState(), 25); /* exactly at floor */
    const action = planNextAction(s);
    expect(action.kind).not.toBe("calibrated-surprise-lowball");
  });

  it("does NOT fire when anchor is 5% below floor (optimistic anchoring)", () => {
    const s = withAnchor(baseState(), 23.75); /* 5% under 25 */
    const action = planNextAction(s);
    expect(action.kind).not.toBe("calibrated-surprise-lowball");
  });

  it("does NOT fire when anchor is 19% below floor (still not lowball)", () => {
    const s = withAnchor(baseState(), 20.25); /* 19% under 25 */
    const action = planNextAction(s);
    expect(action.kind).not.toBe("calibrated-surprise-lowball");
  });

  it("FIRES when anchor is 20% below floor", () => {
    const s = withAnchor(baseState(), 18); /* 28% under 25 — well past 20% */
    const action = planNextAction(s);
    expect(action.kind).toBe("calibrated-surprise-lowball");
    if (action.kind === "calibrated-surprise-lowball") {
      expect(action.candidateAnchor).toBe(18);
      expect(action.bandFloor).toBe(25);
      expect(action.gapPct).toBeGreaterThan(0.2);
    }
  });
});

describe("calibrated-surprise-lowball — affinity gate", () => {
  it("does NOT fire when recruiterAffinity is -2", () => {
    const s = withAnchor(
      { ...baseState(), recruiterAffinity: -2 },
      18,
    );
    const action = planNextAction(s);
    expect(action.kind).not.toBe("calibrated-surprise-lowball");
  });

  it("DOES fire when recruiterAffinity is -1 (boundary)", () => {
    const s = withAnchor(
      { ...baseState(), recruiterAffinity: -1 },
      18,
    );
    const action = planNextAction(s);
    expect(action.kind).toBe("calibrated-surprise-lowball");
  });
});

describe("calibrated-surprise-lowball — single fire", () => {
  it("fires at most ONCE across 30 simulated turns", () => {
    let s = withAnchor(baseState({ sessionId: "cs-once" }), 18);
    let fires = 0;
    for (let i = 0; i < 30; i++) {
      const action = planNextAction(s);
      if (action.kind === "calibrated-surprise-lowball") {
        fires++;
        /* Simulate AI shipping the move (would set
         * calibratedSurpriseFired). */
        const move = actionToLever(action, s);
        s = applyAiMove(s, move, "calibrated-surprise");
      }
      s = { ...s, turnIndex: s.turnIndex + 1 };
    }
    expect(fires).toBe(1);
  });
});

describe("calibrated-surprise-lowball — prose variants", () => {
  const SECTORS: RecruiterSectorPersona[] = [
    "bfsi",
    "early-startup",
    "consulting-mbb",
    "indian-unicorn",
    "it-services",
    "gcc",
    "psu",
    "consulting-big4",
    "fmcg-management",
    "edtech",
  ];

  for (const sector of SECTORS) {
    it(`renders ${sector} prose and echoes the candidate number`, () => {
      const s = withAnchor(
        baseState({
          sessionId: `cs-prose-${sector}`,
          recruiterSectorPersona: sector,
        }),
        18,
      );
      const action = planNextAction(s);
      expect(action.kind).toBe("calibrated-surprise-lowball");
      const prose = renderCanonicalProse(action, s);
      /* Echoes the candidate's stated number. */
      expect(prose).toMatch(/18/);
      /* Ends with an open question (ends with "?" and not yes/no marker). */
      expect(prose.trim().endsWith("?")).toBe(true);
      /* Doesn't disclose the precise band floor number (25). */
      expect(prose).not.toMatch(/\b25\b/);
    });
  }
});

describe("calibrated-surprise-lowball — Branch A (double-down)", () => {
  it("classifies a flat affirmation as Branch A", () => {
    let s = withAnchor(baseState({ sessionId: "cs-A" }), 18);
    const action = planNextAction(s);
    expect(action.kind).toBe("calibrated-surprise-lowball");
    const move = actionToLever(action, s);
    s = applyAiMove(s, move, "calibrated-surprise");
    expect(s.calibratedSurpriseFired).toBe(true);
    expect(s.calibratedSurpriseContext).not.toBeNull();
    /* Candidate doubles down. */
    s = applyCandidateAnswer(s, "Yes, that's my number. I'm comfortable with that.");
    expect(s.acceptedLowball).toBe(true);
    /* Affinity ledger gained a wasted-time -1. */
    const lastLedger = (s.affinityLedger ?? []).slice(-1)[0];
    expect(lastLedger?.reason).toBe("wasted-time");
    expect(lastLedger?.delta).toBe(-1);
    /* Next planner emits accept-lowball-quiet. */
    const next = planNextAction(s);
    expect(next.kind).toBe("accept-lowball-quiet");
    if (next.kind === "accept-lowball-quiet") {
      const prose = renderCanonicalProse(next, s);
      expect(prose).toMatch(/18/);
    }
  });
});

describe("calibrated-surprise-lowball — Branch B (revise up)", () => {
  it("updates userClaims.expectedCtc and gives +1 transparency", () => {
    let s = withAnchor(baseState({ sessionId: "cs-B" }), 18);
    const action = planNextAction(s);
    const move = actionToLever(action, s);
    s = applyAiMove(s, move, "calibrated-surprise");
    /* Candidate revises up. */
    s = applyCandidateAnswer(
      s,
      "Actually, on reflection, ₹28L would be closer to what I'm thinking.",
    );
    expect(s.acceptedLowball).toBe(false);
    expect(s.userClaims?.expectedCtc?.value).toBe(28);
    expect(s.candidateTarget).toBe(28);
    const lastLedger = (s.affinityLedger ?? []).slice(-1)[0];
    expect(lastLedger?.reason).toBe("transparency");
    expect(lastLedger?.delta).toBe(1);
    /* Next planner does NOT emit accept-lowball-quiet. */
    const next = planNextAction(s);
    expect(next.kind).not.toBe("accept-lowball-quiet");
  });
});

describe("calibrated-surprise-lowball — Branch C (ask why)", () => {
  it("does not mutate flags and does not refire", () => {
    let s = withAnchor(baseState({ sessionId: "cs-C" }), 18);
    const action = planNextAction(s);
    const move = actionToLever(action, s);
    s = applyAiMove(s, move, "calibrated-surprise");
    const ledgerLenBefore = (s.affinityLedger ?? []).length;
    s = applyCandidateAnswer(s, "Why do you say that? What's the band?");
    expect(s.acceptedLowball).toBe(false);
    expect(s.userClaims?.expectedCtc?.value).toBe(18); /* unchanged */
    expect((s.affinityLedger ?? []).length).toBe(ledgerLenBefore);
    /* calibratedSurpriseFired stays true so it doesn't refire. */
    expect(s.calibratedSurpriseFired).toBe(true);
    const next = planNextAction(s);
    expect(next.kind).not.toBe("calibrated-surprise-lowball");
  });
});

describe("calibrated-surprise-lowball — report outcome integration", () => {
  it("populates lowballEvent on the outcome when surprise fires + candidate holds", () => {
    let s = withAnchor(baseState({ sessionId: "cs-report-A" }), 18);
    const action = planNextAction(s);
    expect(action.kind).toBe("calibrated-surprise-lowball");
    const move = actionToLever(action, s);
    s = applyAiMove(s, move, "calibrated-surprise");
    s = applyCandidateAnswer(s, "Yes, that's my number. I'm comfortable with that.");
    expect(s.acceptedLowball).toBe(true);

    const ev = buildLowballEvent(s);
    expect(ev).toBeDefined();
    expect(ev!.candidateAnchor).toBe(18);
    expect(ev!.bandFloor).toBe(25);
    expect(ev!.gapPct).toBeCloseTo(0.28, 2);
    expect(ev!.recruiterProbed).toBe(true);
    expect(ev!.candidateHeld).toBe(true);

    /* The rendered coaching note quotes the candidate's anchor and uses
     * the "most expensive moment" framing for the held branch. */
    const text = renderLowballEventText(ev!);
    expect(text.headline).toMatch(/₹18L/);
    expect(text.gapLine).toMatch(/below the band floor/);
    expect(text.candidateLine).toMatch(/held the lowball/i);
    expect(text.takeaway).toMatch(/most expensive moment/i);
  });

  it("populates lowballEvent with candidateHeld:false when candidate revises up", () => {
    let s = withAnchor(baseState({ sessionId: "cs-report-B" }), 18);
    const action = planNextAction(s);
    const move = actionToLever(action, s);
    s = applyAiMove(s, move, "calibrated-surprise");
    s = applyCandidateAnswer(
      s,
      "Actually, on reflection, ₹28L would be closer to what I'm thinking.",
    );
    expect(s.acceptedLowball).toBe(false);

    const ev = buildLowballEvent(s);
    expect(ev).toBeDefined();
    expect(ev!.recruiterProbed).toBe(true);
    expect(ev!.candidateHeld).toBe(false);
    /* Kernel clears calibratedSurpriseContext after Branch B (revise-up)
     * lands. Builder falls back to live state, so the anchor now reads
     * the revised number (28). The probe-fired marker remains sticky,
     * which is what gates rendering. */
    expect(ev!.candidateAnchor).toBe(28);
    expect(ev!.bandFloor).toBe(25);

    const text = renderLowballEventText(ev!);
    expect(text.candidateLine).toMatch(/revised up/i);
    expect(text.takeaway).toMatch(/good recovery/i);
    expect(text.takeaway).toMatch(/anchor higher/i);
  });

  it("does NOT populate lowballEvent when no surprise was triggered", () => {
    /* Candidate anchors safely above the floor — probe never fires. */
    const s = withAnchor(baseState({ sessionId: "cs-report-none" }), 26);
    const action = planNextAction(s);
    expect(action.kind).not.toBe("calibrated-surprise-lowball");
    expect(s.calibratedSurpriseFired).toBeFalsy();

    const ev = buildLowballEvent(s);
    expect(ev).toBeUndefined();
  });
});

describe("calibrated-surprise-lowball — baseline invariance", () => {
  it("does NOT fire when no anchor disclosed (no Branch effect on state)", () => {
    const s = baseState({ sessionId: "cs-baseline" });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("calibrated-surprise-lowball");
    /* Ingest a non-anchor utterance; state-flag invariants hold. */
    const s1 = applyCandidateAnswer(s, "Tell me about the team structure.");
    expect(s1.calibratedSurpriseFired).toBe(false);
    expect(s1.acceptedLowball).toBe(false);
    expect(s1.calibratedSurpriseContext).toBeNull();
  });
});

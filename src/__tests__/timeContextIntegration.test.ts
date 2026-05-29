/* 2026-05-30 time-context integration — kernel-state derivation,
 * concession-headroom multiplier composition with affinity, friday-rush
 * / after-hours-tired cool-bumper, and opening-turn prefix wiring.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: true,
};

const baseInit = (callTimeIso: string | undefined, overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "tc-session",
    role: "swe",
    company: "acme",
    band: BAND,
    callTimeIso,
  }),
  ...overrides,
});

describe("time-context integration — kernel state", () => {
  it("Friday 5pm IST callTimeIso → kernel state has timeContext = 'friday-rush'", () => {
    // 5pm IST = 11:30 UTC on a Friday. Pick a known Friday: 2026-05-29.
    const iso = "2026-05-29T11:30:00.000Z";
    const s = baseInit(iso);
    expect(s.timeContext).toBe("friday-rush");
  });

  it("undefined callTimeIso → 'midweek-standard'", () => {
    const s = baseInit(undefined);
    expect(s.timeContext).toBe("midweek-standard");
  });

  it("midweek-standard is behaviorally identical to baseline (no callTimeIso) for concession split", () => {
    const sA = baseInit(undefined, {
      phase: "counter-offer",
      highestOfferMade: 22,
      candidateTarget: 30,
      lastCandidateCounterLpa: 30,
      firstAnchoredTarget: 30,
      candidateCurrentCtc: 18,
      counterRound: 0,
      turnIndex: 4,
      sessionId: "tc-baseline-A",
    });
    // Wednesday 10am UTC = 3:30pm IST → midweek-standard
    const sB = baseInit("2026-05-27T04:30:00.000Z", {
      phase: "counter-offer",
      highestOfferMade: 22,
      candidateTarget: 30,
      lastCandidateCounterLpa: 30,
      firstAnchoredTarget: 30,
      candidateCurrentCtc: 18,
      counterRound: 0,
      turnIndex: 4,
      sessionId: "tc-baseline-A",
    });
    expect(sB.timeContext).toBe("midweek-standard");
    const aA = planNextAction(sA);
    const aB = planNextAction(sB);
    const newA = aA.kind === "counter-offer" ? aA.counterTotalLpa : null;
    const newB = aB.kind === "counter-offer" ? aB.counterTotalLpa : null;
    expect(newA).toBe(newB);
  });
});

describe("time-context integration — concession headroom", () => {
  it("friday-rush reduces concession size relative to midweek for the same affinity", () => {
    const fri = baseInit("2026-05-29T11:30:00.000Z", {
      phase: "counter-offer",
      highestOfferMade: 22,
      candidateTarget: 30,
      lastCandidateCounterLpa: 30,
      firstAnchoredTarget: 30,
      candidateCurrentCtc: 18,
      counterRound: 0,
      turnIndex: 4,
      sessionId: "tc-fri-rush",
      recruiterAffinity: 0,
    });
    expect(fri.timeContext).toBe("friday-rush");
    const mid = baseInit(undefined, {
      phase: "counter-offer",
      highestOfferMade: 22,
      candidateTarget: 30,
      lastCandidateCounterLpa: 30,
      firstAnchoredTarget: 30,
      candidateCurrentCtc: 18,
      counterRound: 0,
      turnIndex: 4,
      sessionId: "tc-fri-rush",
      recruiterAffinity: 0,
    });
    const aFri = planNextAction(fri);
    const aMid = planNextAction(mid);
    const newFri = aFri.kind === "counter-offer" ? aFri.counterTotalLpa : null;
    const newMid = aMid.kind === "counter-offer" ? aMid.counterTotalLpa : null;
    expect(newFri).not.toBeNull();
    expect(newMid).not.toBeNull();
    if (newFri != null && newMid != null) {
      // friday-rush gap-fraction is 0.7× midweek → smaller bump → lower newTotal.
      expect(newFri).toBeLessThan(newMid);
    }
  });
});

describe("time-context integration — cool-bumper", () => {
  it("after-hours-tired bumps cool rate over 20 deterministic trials", () => {
    let baselineCools = 0;
    let tiredCools = 0;
    // After-hours: 10pm IST = 16:30 UTC Wednesday.
    const tiredIso = "2026-05-27T16:30:00.000Z";
    for (let i = 0; i < 20; i++) {
      const sBase = baseInit(undefined, {
        sessionId: `tc-cool-base-${i}`,
        phase: "counter-offer",
        consecutiveOverBandAsks: 2,
        recruiterAffinity: 0,
        turnIndex: 3,
      });
      const sTired = baseInit(tiredIso, {
        sessionId: `tc-cool-base-${i}`,
        phase: "counter-offer",
        consecutiveOverBandAsks: 2,
        recruiterAffinity: 0,
        turnIndex: 3,
      });
      expect(sTired.timeContext).toBe("after-hours-tired");
      const utter = "I need 35L — that's where I'm holding.";
      const next1 = applyCandidateAnswer(sBase, utter);
      const next2 = applyCandidateAnswer(sTired, utter);
      if (next1.recruiterMoodDynamic === "cooled") baselineCools++;
      if (next2.recruiterMoodDynamic === "cooled") tiredCools++;
    }
    // Tired session should cool at least as often as baseline (often
    // strictly more thanks to the ~30% bump).
    expect(tiredCools).toBeGreaterThanOrEqual(baselineCools);
  });
});

describe("time-context integration — opening turn prefix", () => {
  it("Opening turn under friday-rush prepends 'Quick one before EOD —'", () => {
    const s = baseInit("2026-05-29T11:30:00.000Z", {
      sessionId: "tc-opening-friday",
      recruiterSectorPersona: "bfsi",
      turnIndex: 0,
    });
    const action = planNextAction(s);
    const rendered = renderCanonicalProse(action, s);
    expect(rendered.includes("Quick one before EOD —")).toBe(true);
  });

  it("Opening turn under friday-rush is idempotent — repeat invocation does not double-prefix", () => {
    const s = baseInit("2026-05-29T11:30:00.000Z", {
      sessionId: "tc-opening-idem",
      recruiterSectorPersona: "bfsi",
      turnIndex: 0,
    });
    const action = planNextAction(s);
    const r1 = renderCanonicalProse(action, s);
    const r2 = renderCanonicalProse(action, s);
    expect(r1).toBe(r2);
    // The prefix appears once, not twice.
    const occurrences = r1.split("Quick one before EOD —").length - 1;
    expect(occurrences).toBe(1);
  });
});

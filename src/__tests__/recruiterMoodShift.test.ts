/* 2026-05-29 mood-shift-pass tests.
 *
 * Real recruiters' mood SHIFTS during a call. Before this pass, the
 * kernel seeded `recruiterMood` once at init and never touched it again
 * — the bot was tonally locked. This file pins the dynamic-mood
 * overlay machinery: trigger detection in the kernel + cold-line /
 * rewarm-prefix decoration in the humanizer.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  pickAiMove,
  applyAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  humanizeRecruiterProse,
  pickColdLine,
} from "../../server-handlers/_recruiter-prose-realism";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const baseState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "mood-1", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

const BASE_PROSE = "Our range for this band sits at 28 to 34 LPA.";

describe("recruiterMoodDynamic — kernel transitions", () => {
  it("cooled triggers on user confrontation phrase", () => {
    const s0 = baseState({ phase: "counter-offer" });
    expect(s0.recruiterMoodDynamic).toBe("baseline");
    const s1 = applyCandidateAnswer(s0, "That's ridiculous, you're lowballing me.");
    expect(s1.recruiterMoodDynamic).toBe("cooled");
    expect(s1.recruiterMoodDynamicEnteredAtTurn).toBe(s0.turnIndex);
  });

  it("cooled triggers after 3+ consecutive over-band asks", () => {
    let s = baseState({ phase: "counter-offer" });
    /* maxStretch is 28; ask 32, 33, 34 — each over-band. */
    s = applyCandidateAnswer(s, "I want 32 LPA.");
    expect(s.recruiterMoodDynamic).toBe("baseline");
    expect(s.consecutiveOverBandAsks).toBe(1);
    s = applyCandidateAnswer(s, "My target is 33 LPA.");
    expect(s.recruiterMoodDynamic).toBe("baseline");
    expect(s.consecutiveOverBandAsks).toBe(2);
    s = applyCandidateAnswer(s, "I'm expecting 34 LPA total.");
    expect(s.consecutiveOverBandAsks).toBe(3);
    expect(s.recruiterMoodDynamic).toBe("cooled");
  });

  it("rewarms after concession (≥10% drop) when previously cooled", () => {
    let s = baseState({ phase: "counter-offer" });
    /* Cool via confrontation while logging a peak ask. */
    s = applyCandidateAnswer(s, "I want 40 LPA — that's ridiculous if you can't match.");
    expect(s.recruiterMoodDynamic).toBe("cooled");
    expect(s.recruiterMoodPeakCandidateAskLpa).toBe(40);
    /* Concede to 30 LPA: 30 ≤ 0.9 * 40 = 36 → concession. */
    s = applyCandidateAnswer(s, "My target is 30 LPA now.");
    expect(s.recruiterMoodDynamic).toBe("rewarmed");
  });

  it("baseline is not shifted by soft, in-band conversation", () => {
    let s = baseState({ phase: "counter-offer" });
    s = applyCandidateAnswer(s, "I'm thinking around 25 LPA, what do you think?");
    expect(s.recruiterMoodDynamic).toBe("baseline");
    s = applyCandidateAnswer(s, "Could we explore 26 LPA?");
    expect(s.recruiterMoodDynamic).toBe("baseline");
    expect(s.consecutiveOverBandAsks).toBe(0);
  });

  /* Regression (2026-06-20, live staging): the cold-line single-fire latch
   * `recruiterMoodColdLineFiredAtTurn` was declared/serialized/read but
   * never STAMPED, so the gate (`!= null`) was permanently false and the
   * "Look, I've given you my best…" tail repeated on every cooled turn
   * (observed verbatim on turns 5/6/7). The kernel must stamp the latch the
   * first cooled turn, hold it across consecutive cooled turns, and clear it
   * on leaving the cooled state so a later episode re-fires exactly once. */
  it("stamps the cold-line latch once per cooling episode, holds it, then clears", () => {
    /* Drive FULL turns (candidate answer + AI move) so turnIndex actually
     * advances between exchanges — turnIndex is bumped in applyAiMove, not
     * applyCandidateAnswer, so the production 3x-repeat only reproduces
     * across real AI turns. */
    const fullTurn = (st: NegotiationState, ans: string): NegotiationState => {
      const answered = applyCandidateAnswer(st, ans);
      const move = pickAiMove(answered);
      return applyAiMove(answered, move, "ack");
    };

    let s = baseState({ phase: "counter-offer" });
    expect(s.recruiterMoodColdLineFiredAtTurn ?? null).toBeNull();

    /* Enter cooled with a peak ask — latch stamps to the firing turn so the
     * prose emits the cold line exactly once, here. */
    s = applyCandidateAnswer(s, "I want 40 LPA — that's ridiculous if you can't match.");
    expect(s.recruiterMoodDynamic).toBe("cooled");
    const firstCooledTurn = s.recruiterMoodColdLineFiredAtTurn;
    expect(firstCooledTurn).toBe(s.turnIndex);
    /* Advance the AI turn so turnIndex moves past the firing turn. */
    s = applyAiMove(s, pickAiMove(s), "ack");
    expect(s.turnIndex).toBeGreaterThan(firstCooledTurn as number);

    /* Stay cooled via another over-band confrontation on a LATER turn —
     * latch must NOT advance (re-cool resets enteredAt every turn, but the
     * cold line is once-per-episode), so latch < turnIndex → the gate
     * (`latch === turnIndex`) is false → prose suppresses the line. This is
     * the exact 3x-consecutive-repeat bug from live staging (turns 5/6/7). */
    s = fullTurn(s, "Still 39 LPA, that's insulting — you can do better.");
    expect(s.recruiterMoodDynamic).toBe("cooled");
    expect(s.recruiterMoodColdLineFiredAtTurn).toBe(firstCooledTurn);
    expect(s.recruiterMoodColdLineFiredAtTurn).not.toBe(s.turnIndex);

    /* Concede ≥10% below peak → rewarmed: the cold-line latch clears
     * (episode ended) and the rewarm latch stamps to the rewarm turn. */
    s = applyCandidateAnswer(s, "My target is 30 LPA now.");
    expect(s.recruiterMoodDynamic).toBe("rewarmed");
    expect(s.recruiterMoodColdLineFiredAtTurn ?? null).toBeNull();
    expect(s.recruiterMoodRewarmLineFiredAtTurn).toBe(s.turnIndex);
  });
});

describe("recruiterMoodDynamic — humanizer decoration", () => {
  it("byte-identical to prior behaviour when moodDynamic is 'baseline'", () => {
    const ctx = {
      sector: "consulting-big4" as const,
      sessionId: "byte-id-A",
      turnIndex: 3,
      mood: "warm" as const,
    };
    const before = humanizeRecruiterProse(BASE_PROSE, ctx);
    const after = humanizeRecruiterProse(BASE_PROSE, { ...ctx, moodDynamic: "baseline" });
    expect(after).toBe(before);
  });

  it("appends ONE deterministic cold line per session, NOT every turn", () => {
    const sessionId = "cold-fire-1";
    const ctx = {
      sector: "gcc" as const,
      sessionId,
      turnIndex: 4,
      mood: "warm" as const,
      moodDynamic: "cooled" as const,
    };
    /* First turn: cold line fires (coldLineAlreadyFired = false). */
    const firstFire = humanizeRecruiterProse(BASE_PROSE, ctx);
    const expectedLine = pickColdLine(sessionId);
    expect(firstFire).toContain(expectedLine);
    /* Same line picked deterministically. */
    expect(pickColdLine(sessionId)).toBe(expectedLine);
    /* Second turn while still cooled but kernel has stamped fired → no
     * second cold-line emit (line is once-per-session). */
    const secondTurn = humanizeRecruiterProse(BASE_PROSE, {
      ...ctx,
      turnIndex: 5,
      coldLineAlreadyFired: true,
    });
    expect(secondTurn).not.toContain(expectedLine);
  });

  it("rewarm prefix fires once after cool→rewarm shift", () => {
    const ctx = {
      sector: "indian-unicorn" as const,
      sessionId: "rewarm-1",
      turnIndex: 7,
      mood: "warm" as const,
      moodDynamic: "rewarmed" as const,
    };
    const out = humanizeRecruiterProse(BASE_PROSE, ctx);
    expect(out.startsWith("Okay good")).toBe(true);
    const suppressed = humanizeRecruiterProse(BASE_PROSE, {
      ...ctx,
      rewarmLineAlreadyFired: true,
    });
    expect(suppressed.startsWith("Okay good")).toBe(false);
  });
});

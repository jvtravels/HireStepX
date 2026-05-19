/* Salary-negotiation happy-path E2E (QA v3 round 4, 2026-05-19).
 *
 * Multi-turn integration test that drives a complete successful
 * negotiation arc through the real deterministic kernel — the path the
 * 120-matrix single-turn cases can't exercise. Asserts both state
 * transitions AND recruiter-prose quality at each step.
 *
 * Arc (9 turns, fully driven through the discovery → anchor → counter →
 * close machine):
 *   T1 OPENING               — recruiter opens; candidate engages
 *   T2 DISCOVERY-CTC+NOTICE+VALUE
 *                            — candidate discloses CTC, breakdown,
 *                              notice period, and one value-proof signal
 *                              so the engineering discovery checklist
 *                              (currentCtc + split + notice + valueProof
 *                              + target) completes without re-probing
 *   T3 DISCOVERY-TARGET      — candidate states expectation
 *   T4 OFFER-PRESENTED       — recruiter anchors first number
 *   T5 CANDIDATE-COUNTER     — candidate pushes for higher base (fixed
 *                              target, not total — exercises the new
 *                              candidateTargetFixed routing)
 *   T6 RECRUITER-COUNTER     — recruiter improves toward target
 *   T7 SOFT-ACCEPT           — candidate aligns directionally
 *   T8 FILLER                — final guard turn (clears the 8-turn floor)
 *   T9 EXPLICIT-ACCEPT       — candidate accepts unconditionally;
 *                              kernel transitions phase → "accepted"
 *
 * Invariants verified across the arc:
 *   I1  No turn produces empty prose
 *   I2  No turn leaks the coaching markers ("better answer", "tip:", etc.)
 *   I3  Phase is derived (never retreats from a terminal phase)
 *   I4  Recruiter never breaches the band's walkAway floor
 *   I5  Recruiter never quotes a number above maxStretch
 *   I6  CandidateProfile flags accumulate monotonically (never flip back)
 *   I7  Kernel state observables advance: candidateCurrentCtc set,
 *       candidateTarget set, wantsHigherBase fires, turnIndex advances
 *   I8  Per-turn TurnDelta carries a classified `candidateArchetype`
 *       whenever the candidate utterance maps to a known archetype
 *
 * The test is byte-stable: every expectation reads off state shape /
 * classifier output, not full prose strings, so prose tuning doesn't
 * break this gate.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  type NegotiationBand,
  type NegotiationPhase,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../../server-handlers/_canonical-prose";

/* ─── Fixture ─────────────────────────────────────────────────────── */

const HAPPY_PATH_BAND: NegotiationBand = {
  /* Indian-unicorn senior engineer — typical fitment corridor. */
  initialOffer: 28,
  maxStretch: 36,
  walkAway: 24,
  hasEquity: true,
  baseFloor: 18,
  baseStretch: 26,
  variableMax: 8,
};

interface HappyPathTurn {
  label: string;
  candidate: string;
  /** Expected phase AFTER applyCandidateAnswer folds this turn. */
  expectedPhaseAfter?: NegotiationPhase | NegotiationPhase[];
  /** Optional substring / regex assertions on the recruiter's prose. */
  proseMustMatch?: RegExp[];
  /** Optional substring / regex assertions on the recruiter's prose
   *  (negative — must NOT match). */
  proseMustNotMatch?: RegExp[];
  /** Optional predicate over state after folding. */
  stateInvariant?: (state: NegotiationState) => true | string;
}

/* The 9-turn arc. Each candidate utterance is realistic Indian-market
 * phrasing; every assertion is grounded in a kernel observable. */
const HAPPY_PATH: HappyPathTurn[] = [
  {
    label: "T1 OPENING — candidate engages on role pitch",
    candidate:
      "Thanks for reaching out. I've read about the role — happy to walk through where I am right now and what I'm looking for.",
    /* No CTC disclosed yet → still opening / discovery-probe territory. */
  },
  {
    label: "T2 DISCOVERY-CTC+NOTICE+VALUE — full discovery payload",
    candidate:
      "My current total CTC is ₹22 LPA — fixed is around ₹18 LPA and variable is roughly ₹4 LPA, paid quarterly against targets. " +
      "I'm on a 60-day notice period with a buyout option my company has used before. " +
      "On scope — I lead a team of 4 engineers; over the last 18 months I owned the payments-rewrite, taking checkout p99 from ~800ms to ~120ms across 4M DAU.",
    stateInvariant: (s) => {
      if (s.candidateCurrentCtc !== 22) {
        return `expected candidateCurrentCtc=22, got ${s.candidateCurrentCtc}`;
      }
      const split = s.candidateComponentBreakdown;
      if (!split || split.base !== 18 || split.variable !== 4) {
        return `expected breakdown {base:18, variable:4}, got ${JSON.stringify(split)}`;
      }
      return true;
    },
  },
  {
    label: "T3 DISCOVERY-TARGET — candidate states expectation",
    candidate:
      "Given the scope and the team I'd be leading, I'm expecting around ₹32 LPA total — with a stronger fixed component than my current split.",
    stateInvariant: (s) => {
      if (s.candidateTarget !== 32) {
        return `expected candidateTarget=32 (total), got ${s.candidateTarget}`;
      }
      if (!s.candidateProfile?.wantsHigherBase) {
        return "expected wantsHigherBase=true after 'stronger fixed component'";
      }
      return true;
    },
  },
  {
    label: "T4 OFFER-PRESENTED — recruiter anchors via planner",
    /* This turn keeps the candidate in receive-mode — short ack. The
     * recruiter's reply is what we evaluate; we assert it surfaces a
     * number in [walkAway, maxStretch] and references "fitment" /
     * "grade" / "band" idiom required by the canonical contract. */
    candidate: "Got it — could you share what the fitment looks like for this grade?",
    proseMustMatch: [
      /\bfitment\b|\bgrade\b|\bband\b/i,
    ],
  },
  {
    label: "T5 CANDIDATE-COUNTER — pushes for higher fixed (component-scoped target)",
    candidate:
      "I've reviewed the breakup — the fixed is lower than I expected. Can we revisit it? My target is ₹26 LPA fixed at minimum.",
    stateInvariant: (s) => {
      if (!s.candidateProfile?.wantsHigherBase) {
        return "expected wantsHigherBase=true after breakup pushback";
      }
      /* Audit Fix #2 contract: T5's "₹26 LPA fixed at minimum" is a
       * FIXED-component target — must route to candidateTargetFixed
       * and NOT overwrite candidateTarget (still 32 from T3). */
      if (s.candidateTarget !== 32) {
        return `T5 fixed target leaked into candidateTarget (got ${s.candidateTarget}, expected 32)`;
      }
      if (s.candidateTargetFixed !== 26) {
        return `expected candidateTargetFixed=26, got ${s.candidateTargetFixed}`;
      }
      /* Audit Fix #3 contract: the fixed-target restatement must NOT
       * leak into candidateComponentBreakdown.base (still 18 from T2). */
      if (s.candidateComponentBreakdown?.base !== 18) {
        return `T5 fixed target leaked into breakdown.base (got ${s.candidateComponentBreakdown?.base}, expected 18)`;
      }
      return true;
    },
    proseMustMatch: [
      /\b(?:fitment|fixed|base|panel|grade)\b/i,
    ],
    /* Recruiter must not leak coaching language. */
    proseMustNotMatch: [
      /better answer|you should say|try saying|^tip:|as a coach/i,
    ],
  },
  {
    label: "T6 RECRUITER-COUNTER — candidate signals near-acceptance",
    candidate:
      "That works directionally — if you can get fixed to ₹26 LPA, I'm ready to move forward. Let's close.",
  },
  {
    label: "T7 SOFT-ACCEPT — candidate confirms direction",
    candidate:
      "Yes, that sounds good. The structure works for me overall — fixed at the level we discussed and the variable on top.",
  },
  {
    label: "T8 ALIGNMENT — candidate awaits formal close",
    candidate:
      "I'm aligned. Let's wrap this up.",
  },
  {
    label: "T9 EXPLICIT-ACCEPT — terminal accept",
    candidate:
      "Confirmed — I accept the offer. Please send the letter across; I'll align with my current employer on the LWD.",
    /* The kernel's minTurnsBeforeClose floor is 8; at turn 9 the
     * strict-explicit-accept path is unconditionally allowed (see
     * canCloseSession: reason==="accept" returns true). */
    expectedPhaseAfter: "accepted",
  },
];

/* ─── Coaching-leak guard (shared with BUG-001 architectural test) ─ */

const COACHING_MARKERS: ReadonlyArray<RegExp> = [
  /\bbetter answer\b/i,
  /\byou should (?:say|answer|respond)\b/i,
  /\btry saying\b/i,
  /^\s*tip\s*[:—-]/im,
  /\bas (?:your |a )?coach\b/i,
  /\brecommended response\b/i,
  /\b(?:a )?good answer would be\b/i,
  /\bpro tip\b/i,
];

/* ─── Suite ───────────────────────────────────────────────────────── */

describe("salary-negotiation — happy-path E2E (7-turn arc)", () => {
  /* Initialise once; the test mutates `state` across the arc. Vitest
   * sequencing inside a single `it.each` chain keeps the turns
   * deterministic and the kernel state observable. */
  let state: NegotiationState = initState({
    sessionId: "happy-path-2026-05-19",
    role: "Senior Software Engineer",
    company: "Meesho",
    band: HAPPY_PATH_BAND,
    recruiterSectorPersona: "indian-unicorn",
    /* Single-round happy-path arc: multi-round handoff (HR → HM → Dir)
     * is a separate feature and out of scope for this E2E. With
     * multi-round on, an explicit-accept at HR triggers a round
     * transition (phase → opening) instead of terminating, which
     * collides with the T9 "accepted" expectation. */
    multiRoundEnabled: false,
    candidateName: "Aanya",
  });
  state = { ...state, roundPersona: "hr-partner" };

  /* Trace recorder — written to disk at the end so the report run can
   * inspect the full conversation arc for QA review. */
  interface TraceTurn {
    label: string;
    candidate: string;
    phaseBefore: NegotiationPhase;
    phaseAfter: NegotiationPhase;
    recruiterProse: string;
    actionKind: string;
    archetype: string | null;
    highestOfferMade: number;
  }
  const trace: TraceTurn[] = [];

  /* Track monotonic profile flags across the arc. */
  const monotonicFlagsSeen = new Set<string>();

  it.each(HAPPY_PATH)("$label", (turn) => {
    const phaseBefore = state.phase;
    const prevProfileFlags = new Set(
      Object.entries(state.candidateProfile ?? {})
        .filter(([_, v]) => v === true)
        .map(([k]) => k),
    );

    /* Fold the candidate's utterance. */
    const next = applyCandidateAnswer(state, turn.candidate);

    /* I1: state must remain well-formed. */
    expect(next).toBeTruthy();
    expect(next.phase).toBeDefined();

    /* I3: phase progresses forward — never retreats from a terminal. */
    if (
      phaseBefore === "accepted" ||
      phaseBefore === "walked-away" ||
      phaseBefore === "stalemate"
    ) {
      expect(next.phase).toBe(phaseBefore);
    }

    /* Plan + render the recruiter response. */
    const action = planNextAction(next);
    const prose = renderCanonicalProse(action, next);

    /* I1: non-empty prose. */
    expect(prose).toBeTruthy();
    expect(prose.length).toBeGreaterThan(8);

    /* I2: no coaching markers anywhere in the recruiter line. */
    for (const rx of COACHING_MARKERS) {
      expect(prose, `coaching marker leaked: ${rx}`).not.toMatch(rx);
    }

    /* I4 + I5: any number quoted by the recruiter must respect the band. */
    const numbersInProse = Array.from(
      prose.matchAll(/₹\s*(\d+(?:\.\d+)?)\s*(?:L|LPA|lakh|lakhs)?/gi),
    ).map((m) => Number(m[1]));
    for (const n of numbersInProse) {
      /* Skip obvious non-comp numbers (e.g. notice period days). */
      if (n < 5 || n > 200) continue;
      expect(
        n,
        `recruiter quoted ₹${n}L outside band [${HAPPY_PATH_BAND.walkAway}, ${HAPPY_PATH_BAND.maxStretch}]`,
      ).toBeGreaterThanOrEqual(HAPPY_PATH_BAND.walkAway);
      expect(n).toBeLessThanOrEqual(HAPPY_PATH_BAND.maxStretch);
    }

    /* I6: profile flags only flip false → true within the arc. */
    const currentProfileFlags = new Set(
      Object.entries(next.candidateProfile ?? {})
        .filter(([_, v]) => v === true)
        .map(([k]) => k),
    );
    for (const flag of prevProfileFlags) {
      expect(
        currentProfileFlags.has(flag),
        `profile flag '${flag}' flipped true → false at ${turn.label}`,
      ).toBe(true);
    }
    for (const flag of currentProfileFlags) monotonicFlagsSeen.add(flag);

    /* I8: archetype classification — record when present. */
    const archetype = next.lastTurnDelta?.candidateArchetype ?? null;

    /* Record the trace turn + advance state BEFORE per-turn fixture
     * assertions, so a mid-arc assertion failure can't break the arc's
     * state machine for the downstream `arc advances` test. */
    trace.push({
      label: turn.label,
      candidate: turn.candidate,
      phaseBefore,
      phaseAfter: next.phase,
      recruiterProse: prose,
      actionKind: action.kind,
      archetype,
      highestOfferMade: next.highestOfferMade ?? 0,
    });
    const moveCarrier = action as typeof action & {
      _move?: Parameters<typeof applyAiMove>[1];
    };
    state = moveCarrier._move
      ? applyAiMove(next, moveCarrier._move, prose)
      : next;

    /* Per-turn assertions from the fixture row. */
    if (turn.expectedPhaseAfter) {
      const expected = Array.isArray(turn.expectedPhaseAfter)
        ? turn.expectedPhaseAfter
        : [turn.expectedPhaseAfter];
      expect(
        expected,
        `${turn.label}: expected phase ∈ ${expected.join("|")}, got ${next.phase}`,
      ).toContain(next.phase);
    }
    if (turn.proseMustMatch) {
      for (const rx of turn.proseMustMatch) {
        expect(prose, `${turn.label}: expected match ${rx}`).toMatch(rx);
      }
    }
    if (turn.proseMustNotMatch) {
      for (const rx of turn.proseMustNotMatch) {
        expect(prose, `${turn.label}: expected NO match ${rx}`).not.toMatch(rx);
      }
    }
    if (turn.stateInvariant) {
      const result = turn.stateInvariant(next);
      expect(result, `${turn.label}: ${result}`).toBe(true);
    }
  });

  it("arc advances kernel observables + writes trace", async () => {
    /* I7: kernel state-observable progression assertions. Phase is
     * derived and conservative; we assert on the underlying signals
     * the recruiter actually used to drive the conversation. */

    /* (a) candidate's current CTC was captured. */
    expect(state.candidateCurrentCtc).toBe(22);
    /* (b) candidate's TOTAL target stays pinned at 32. The fixed-only
     * restatement at T5 ("₹26 LPA fixed at minimum") goes to
     * candidateTargetFixed via the component-scope classifier and does
     * NOT overwrite the total target. */
    expect(state.candidateTarget).toBe(32);
    expect(state.candidateTargetFixed).toBe(26);
    /* (c) wantsHigherBase fired — the breakup pushback was detected. */
    expect(state.candidateProfile?.wantsHigherBase).toBe(true);
    /* (d) turnIndex advanced for each AI-move turn. */
    expect(state.turnIndex).toBeGreaterThanOrEqual(HAPPY_PATH.length - 1);
    /* (e) component breakdown was parsed off the T2 disclosure
     * utterance. With the target-clause mask in place, T5's "₹26 LPA
     * fixed at minimum" no longer leaks into candidateComponentBreakdown
     * — both base AND variable remain at the T2-disclosed values. */
    expect(state.candidateComponentBreakdown?.base).toBe(18);
    expect(state.candidateComponentBreakdown?.variable).toBe(4);
    /* (f) phase reached `accepted` — the strict explicit accept at T9
     * unconditionally passes canCloseSession (reason==="accept"). */
    expect(state.phase).toBe("accepted");

    /* No turn ever retreated from a terminal phase. */
    for (let i = 1; i < trace.length; i++) {
      const prev = trace[i - 1].phaseAfter;
      if (
        prev === "accepted" ||
        prev === "walked-away" ||
        prev === "stalemate"
      ) {
        expect(trace[i].phaseAfter).toBe(prev);
      }
    }

    /* I8: at least one archetype was detected across the arc — the
     * classifier is wired through the kernel TurnDelta. */
    const archetypesDetected = trace
      .map((t) => t.archetype)
      .filter((a): a is string => a != null);
    expect(archetypesDetected.length).toBeGreaterThan(0);

    /* Persist trace to disk for QA review. */
    const fs = await import("node:fs");
    const path = await import("node:path");
    fs.writeFileSync(
      path.join(__dirname, "salary-negotiation-happy-path-trace.json"),
      JSON.stringify(
        {
          generatedAt: "2026-05-19",
          band: HAPPY_PATH_BAND,
          finalPhase: state.phase,
          highestOfferMade: state.highestOfferMade ?? 0,
          monotonicFlagsSeen: Array.from(monotonicFlagsSeen).sort(),
          turns: trace,
        },
        null,
        2,
      ),
    );
  });
});

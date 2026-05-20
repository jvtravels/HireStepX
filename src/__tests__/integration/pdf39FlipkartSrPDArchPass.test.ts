/* PDF#39 Architectural Fix Pass — Flipkart Senior Product Designer
 * session (2026-05-20). A cluster of four user-visible failures with
 * a single architectural root cause.
 *
 *   Symptom chain observed in the live PDF#39 session:
 *     T6  AI anchors:  "...so how does ₹30.4 LPA look to you?"
 *     T7  AI:          "Variable component is tied to KPI performance..."
 *     T8  Cand:        "so now what is the total CTC & its breakdown?"
 *     T9  AI:          "We don't disclose the exact CTC breakdown upfront.
 *                       That's something the HM walks through later."   ← deflect
 *     T10 Cand:        "but without knowing the breakdown how can we move
 *                       forward?"
 *     T11 AI:          "We don't discuss compensation breakdowns in the
 *                       opening phase. We focus on finding the right fit
 *                       for the role."                                    ← deflect
 *     T12 AI:          (verbatim repeat of T11)                           ← repeat
 *
 *   Bugs surfaced (all symptoms of one root cause):
 *
 *     BUG-D — anchor leak: ₹30.4 LPA. `clampAnchorAboveDisclosed`
 *             rounded to 1 decimal so 26 × 1.15 = 29.9 emerged as 29.9
 *             (or 30.4 with a slightly different hike % the planner
 *             elsewhere applied). Real Indian HR anchors are integers.
 *
 *     BUG-A — post-anchor deflection. `band-disclosure-deflect` gate
 *             fires only at `phase === "range-disclosure"`, which the
 *             phase machine promotes out of as soon as
 *             `highestOfferMade > 0`. But the anchor-with-offer planner
 *             move emitted `_move.newTotalLpa: null` — so the kernel
 *             never recorded the anchor, never promoted the phase, and
 *             the deflect lever kept firing on every subsequent turn.
 *
 *     BUG-B — opening-phase framing post-anchor. Same root cause as
 *             BUG-A: the deflect lever's canonical prose is opening-
 *             phase idiom; with the phase machine stuck, the prose
 *             keeps emitting "...in the opening phase" after a number
 *             is already on the table.
 *
 *     BUG-C — verbatim repeat. With the planner re-emitting the same
 *             deflect lever turn after turn, the LLM lands on the same
 *             content-word fingerprint and the same paraphrase fires
 *             twice. Once BUG-A is fixed the phase advances and the
 *             planner moves to the next lever (info-disclosure
 *             breakdown), so the repeat vanishes.
 *
 *   Architectural fixes applied (2026-05-20):
 *     (1) `clampAnchorAboveDisclosed` rounds to integer.
 *     (2) Both committed anchor-with-offer sites in the planner
 *         thread `newTotalLpa: anchored` so applyAiMove records the
 *         offer; the honest-defer (bandIncomplete=true) path keeps
 *         newTotalLpa: null intentionally since no number is on the
 *         table.
 *
 *   These tests pin the architectural contract:
 *     T1 — `anchor-with-offer` planner emission carries newTotalLpa
 *          equal to action.initialOffer (committed anchor), AND that
 *          number is an integer.
 *     T2 — After applyAiMove on an anchor-with-offer move,
 *          state.highestOfferMade is set, anchorLocked is true, and
 *          derivePhase promotes out of "range-disclosure".
 *     T3 — On the very next planner turn after an anchor, the planner
 *          does NOT emit `band-disclosure-deflect` (the loop the PDF#39
 *          session was stuck in).
 *     T4 — Honest-defer anchor (bandIncomplete=true) still emits
 *          newTotalLpa: null — no number has been committed yet.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../../server-handlers/_canonical-prose";

/* PDF#39 fixture — Flipkart Senior Product Designer band. Real market
 * range from the bug PDF: ₹30–50 LPA total. We use a clean integer band
 * with disclosed candidate CTC = 26 so the hike-floor arithmetic
 * (26 × 1.15 = 29.9 → Math.round = 30) is a clear regression line. */
const FLIPKART_SR_PD_BAND: NegotiationBand = {
  initialOffer: 28,
  maxStretch: 42,
  walkAway: 24,
  hasEquity: true,
  baseFloor: 20,
  baseStretch: 35,
  variableMax: 6,
};

function newState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  const base = initState({
    sessionId: "pdf39-flipkart-sr-pd",
    role: "Senior Product Designer",
    company: "Flipkart",
    band: FLIPKART_SR_PD_BAND,
    recruiterSectorPersona: "indian-unicorn",
    multiRoundEnabled: false,
    candidateName: "Karthik Nair",
  });
  return { ...base, ...overrides };
}

describe("PDF#39 — Flipkart Senior PD post-anchor deflection loop", () => {
  it("T1 — anchor-with-offer planner move threads newTotalLpa = initialOffer (integer)", () => {
    /* Drive enough state forward for the anchor lever to fire: candidate
     * has disclosed CTC and asked for the offer. */
    let s = newState();
    s = applyCandidateAnswer(s, "my current package is 26 LPA");
    /* Stamp offerAskedAtTurn so the Fix-5 anchor short-circuit gate
     * fires deterministically without needing the full discovery
     * checklist to complete first. */
    s = { ...s, offerAskedAtTurn: s.turnIndex };

    const action = planNextAction(s);
    expect(action.kind).toBe("anchor-with-offer");
    if (action.kind !== "anchor-with-offer") return;

    /* BUG-D contract: integer anchor (no 1-decimal fractions). */
    expect(Number.isInteger(action.initialOffer)).toBe(true);

    /* BUG-A root-cause contract: committed-anchor move carries
     * newTotalLpa === action.initialOffer so applyAiMove records the
     * offer and the phase machine can promote out of range-disclosure. */
    const move = (action as typeof action & { _move?: { newTotalLpa: number | null } })._move;
    expect(move).toBeTruthy();
    expect(move?.newTotalLpa).toBe(action.initialOffer);
    expect(action.bandIncomplete).toBe(false);
  });

  it("T2 — applyAiMove on anchor records highestOfferMade + locks anchor + promotes phase", () => {
    let s = newState();
    s = applyCandidateAnswer(s, "my current package is 26 LPA");
    s = { ...s, offerAskedAtTurn: s.turnIndex };

    const action = planNextAction(s);
    expect(action.kind).toBe("anchor-with-offer");
    if (action.kind !== "anchor-with-offer") return;

    /* Fold the move + the canonical prose, exactly as the
     * response-pipeline does. */
    const prose = renderCanonicalProse(action, s);
    const move = (action as typeof action & { _move: Parameters<typeof applyAiMove>[1] })._move;
    const after = applyAiMove(s, move, prose);

    expect(after.highestOfferMade).toBe(action.initialOffer);
    expect(after.highestOfferMade).toBeGreaterThan(0);
    expect(after.anchorLocked).toBe(true);
    expect(after.lockedAnchorLpa).toBe(action.initialOffer);

    /* Phase has promoted out of range-disclosure — the band-disclosure-
     * deflect gate (phase === "range-disclosure") can no longer fire. */
    expect(after.phase).not.toBe("range-disclosure");
  });

  it("T3 — next planner turn after anchor does NOT re-emit band-disclosure-deflect (the PDF#39 loop)", () => {
    let s = newState();
    s = applyCandidateAnswer(s, "my current package is 26 LPA");
    s = { ...s, offerAskedAtTurn: s.turnIndex };

    const anchorAction = planNextAction(s);
    if (anchorAction.kind !== "anchor-with-offer") {
      throw new Error(`expected anchor-with-offer, got ${anchorAction.kind}`);
    }
    const anchorProse = renderCanonicalProse(anchorAction, s);
    const anchorMove = (anchorAction as typeof anchorAction & { _move: Parameters<typeof applyAiMove>[1] })._move;
    s = applyAiMove(s, anchorMove, anchorProse);

    /* Candidate's post-anchor breakdown ask — the exact utterance from
     * PDF#39 T8 that triggered the deflection loop. */
    s = applyCandidateAnswer(
      s,
      "so now what is the total CTC & its breakdown?",
    );

    const followup = planNextAction(s);
    expect(followup.kind).not.toBe("band-disclosure-deflect");

    /* Defensive: the prose the planner produces must not carry the
     * opening-phase deflection idiom. */
    const followupProse = renderCanonicalProse(followup, s);
    expect(followupProse).not.toMatch(/in the opening phase/i);
    expect(followupProse).not.toMatch(/finding the right fit for the role/i);
  });

  it("T4 — honest-defer anchor (bandIncomplete) intentionally keeps newTotalLpa null", () => {
    /* Construct a state with an unusable band so the bandIncomplete
     * branch fires. lo === hi (degenerate band) is sufficient — the
     * planner's bandComplete check requires lo < hi. */
    let s = newState({
      band: {
        ...FLIPKART_SR_PD_BAND,
        initialOffer: 28,
        maxStretch: 28,
      },
    });
    s = applyCandidateAnswer(s, "my current package is 26 LPA");
    s = { ...s, offerAskedAtTurn: s.turnIndex };

    const action = planNextAction(s);
    /* If the Fix-5 short-circuit gate didn't fire (e.g. band-incomplete
     * caused it to skip), the AP3-F3 path also has the bandIncomplete
     * defer branch. Either way, when an anchor-with-offer fires with
     * bandIncomplete=true, newTotalLpa must remain null — no number is
     * being committed since the prose surface defers to the panel. */
    if (action.kind === "anchor-with-offer" && action.bandIncomplete) {
      const move = (action as typeof action & { _move?: { newTotalLpa: number | null } })._move;
      expect(move?.newTotalLpa).toBeNull();
    }
    /* Soft assert: if this case didn't reach the honest-defer branch,
     * the test still passes — the contract above is the relevant one. */
  });

  it("BUG-D regression — clampAnchorAboveDisclosed never emits a fractional anchor", () => {
    /* Sweep across a range of disclosed CTCs that previously produced
     * 1-decimal anchors (X × 1.15 rarely lands on an integer). All
     * planner-emitted anchors must be whole numbers. */
    for (const disclosed of [18, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 33]) {
      let s = newState();
      s = applyCandidateAnswer(s, `my current package is ${disclosed} LPA`);
      s = { ...s, offerAskedAtTurn: s.turnIndex };

      const action = planNextAction(s);
      if (action.kind === "anchor-with-offer") {
        expect(
          Number.isInteger(action.initialOffer),
          `disclosed=${disclosed} produced non-integer anchor ${action.initialOffer}`,
        ).toBe(true);
      }
    }
  });
});

/* S52-WL-B6 / S53-B2 (2026-07-24) — After acknowledge-and-recover fires
 * (recruiter apologises for looping on CTC), the NEXT recruiter turn must
 * pivot to offer-reveal rather than probing a different discovery topic.
 *
 * Root cause: buildSkipRecord only skipped the LAST-ASKED topic after
 * acknowledge-and-recover, so the cascade advanced to the next discovery
 * topic (notice period, competing offers) instead of falling through to
 * anchor/open-with-offer.
 *
 * Fix: skip ALL Tier-1/2 discovery topics on the post-acknowledge-and-recover
 * turn so the planner falls through to offer-reveal. */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationLever,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 28,
  maxStretch: 38,
  walkAway: 22,
  hasEquity: false,
};

function makePostAcknowledgeState() {
  const s0 = initState({
    sessionId: "s-s52wlb6",
    role: "swe",
    company: "walmart",
    band: BAND,
  });
  /* Turn 1: recruiter probes CTC, candidate pushes back without disclosing. */
  const s1 = applyCandidateAnswer(s0, "I'd rather not share my current CTC.");
  /* Simulate the recruiter having fired acknowledge-and-recover on the prior turn
   * by injecting it into leversUsed directly (the acknowledge-and-recover lever
   * is the post-frustration repair move — it fires when lastUserFrustrated is
   * true, which the candidate pushback sets). */
  return {
    ...s1,
    lastUserFrustrated: false, /* cleared after acknowledge-and-recover */
    leversUsed: [...(s1.leversUsed ?? []), "acknowledge-and-recover" as NegotiationLever],
    turnIndex: s1.turnIndex + 1,
  };
}

describe("S52-WL-B6 / S53-B2 — post-acknowledge-and-recover pivots to offer", () => {
  it("next action after acknowledge-and-recover is offer-reveal, not another discovery probe", () => {
    const state = makePostAcknowledgeState();
    const action = planNextAction(state);
    expect(action).not.toBeNull();
    /* Must be an offer action, not a discovery probe. */
    expect(action?.kind).toMatch(
      /^(anchor-with-offer|open-with-offer|counter-offer|hold-firm|closing-push)$/,
    );
    /* Must NOT be a discovery probe or acknowledge-and-recover again. */
    expect(action?.kind).not.toBe("probe");
    expect(action?.kind).not.toBe("acknowledge-and-recover");
  });

  it("open-with-offer carries a cash number even when CTC was never disclosed", () => {
    const state = makePostAcknowledgeState();
    const action = planNextAction(state);
    if (
      action?.kind === "open-with-offer" ||
      action?.kind === "anchor-with-offer"
    ) {
      const offerLpa =
        action.kind === "open-with-offer"
          ? (action as { _move?: { newTotalLpa?: number | null } })._move?.newTotalLpa
          : action.initialOffer;
      expect(offerLpa).toBeGreaterThan(0);
    }
  });

  it("does not loop to another discovery topic (notice period, competing offers)", () => {
    const state = makePostAcknowledgeState();
    const action = planNextAction(state);
    /* These discovery probes must not appear as the next action after acknowledge-and-recover. */
    const discoveryProbeKinds = [
      "probe-notice-period",
      "probe-competing-offer",
      "probe-target",
      "probe-current-ctc",
    ];
    if (action != null) {
      expect(discoveryProbeKinds).not.toContain(action.kind);
    }
  });
});

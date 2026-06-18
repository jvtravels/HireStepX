/* Hinglish negotiation must parse + close (2026-06-18, live-staging finding).
 *
 * An objective adversarial battery surfaced a Hinglish scenario that
 * stalled: the candidate stated current comp as "Abhi main 24 LPA pe
 * hoon" (right now I'm at 24) and accepted with "Theek hai, accept karta
 * hoon" (okay, I accept). Two structural gaps:
 *
 *   1. The number-role classifier only recognised ENGLISH current-comp
 *      frames ("my current ...", "I'm at ..."). The Hinglish present-
 *      state markers ("abhi main ... pe hoon", "filhaal ... le raha
 *      hoon") never bound, so currentCtc stayed null, discovery never
 *      completed the currentCtc item, and the bot re-probed forever.
 *   2. The acceptance classifier recognised English performatives
 *      ("I accept") and bare Hindi affirmatives ("theek hai" — gated on
 *      an offer being on the table) but NOT the explicit Hinglish
 *      performative "accept karta/karti/karunga hoon". A pure-Hinglish
 *      acceptance fell through to no-match and the close was lost.
 *
 * These tests lock both: the Hinglish current-comp utterance binds to
 * currentCtc, the Hinglish performative is detected as a strong accept,
 * and a full Hinglish transcript reaches phase "accepted" — a real
 * close, never a stall. */
import { describe, it, expect } from "vitest";
import { classifyNumberRoles } from "../../server-handlers/_number-role-classifier";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";
import {
  applyCandidateAnswer,
  applyAiMove,
  pickAiMove,
  initState,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";

describe("Hinglish current-comp parsing", () => {
  it("binds 'Abhi main 24 LPA pe hoon' to currentCtc", () => {
    const r = classifyNumberRoles("Abhi main 24 LPA pe hoon.");
    expect(r.currentCtc).toBe(24);
    expect(r.target).toBeNull();
  });

  it("binds 'filhaal 22 LPA le raha hoon' to currentCtc", () => {
    const r = classifyNumberRoles("Filhaal 22 LPA le raha hoon.");
    expect(r.currentCtc).toBe(22);
  });

  it("still routes 'Mujhe 32 LPA fixed chahiye' to a fixed-scoped target (not current)", () => {
    const r = classifyNumberRoles("Mujhe 32 LPA fixed chahiye.");
    expect(r.target).toBe(32);
    expect(r.targetComponent).toBe("fixed");
    expect(r.currentCtc).toBeNull();
  });
});

describe("Hinglish performative acceptance", () => {
  const POSITIVES = [
    "accept karta hoon",
    "Theek hai, accept karta hoon.",
    "Main accept karti hoon.",
    "Accept kar raha hoon.",
    "Accept karunga.",
    "Accept kar lunga.",
    "Accept kar liya.",
  ];
  for (const text of POSITIVES) {
    it(`detects acceptance: ${text}`, () => {
      const r = classifyAcceptance(text, { offerOnTable: true });
      expect(r.accepted).toBe(true);
    });
  }

  it("does NOT treat a bare Hindi affirmative as accept before an offer exists", () => {
    // "theek hai" alone (no explicit performative) stays gated on an
    // offer being on the table — you can't accept what hasn't been
    // offered. This guards against the over-broad fix.
    const r = classifyAcceptance("Theek hai.", { offerOnTable: false });
    expect(r.accepted).toBe(false);
  });
});

describe("full Hinglish transcript reaches a real close", () => {
  function aiTurn(s: NegotiationState): NegotiationState {
    const action = planNextAction(s);
    const move = pickAiMove(s);
    const text = renderCanonicalProse(action, s);
    return applyAiMove(s, move, text);
  }

  it("anchors, counters, and accepts — phase ends 'accepted', never stalls at hom=0", () => {
    let s: NegotiationState = initState({
      sessionId: "s-hinglish-close",
      role: "swe",
      company: "Acme",
      band: { initialOffer: 26, maxStretch: 34, walkAway: 20, hasEquity: true },
    });
    const answers = [
      "Abhi main 24 LPA pe hoon, fixed 20 variable 4.",
      "Notice period 60 din hai, buyout ho sakta hai.",
      "Maine pichle saal poora payments system rebuild kiya tha.",
      "Mujhe 32 LPA fixed chahiye.",
      "Theek hai, accept karta hoon.",
    ];
    for (const ans of answers) {
      s = applyCandidateAnswer(s, ans);
      s = aiTurn(s);
    }
    // currentCtc was parsed from the Hinglish opener.
    expect(s.candidateCurrentCtc).toBe(24);
    // A concrete number landed (no stall).
    expect(s.highestOfferMade).toBeGreaterThan(0);
    // The Hinglish acceptance closed the deal.
    expect(s.phase).toBe("accepted");
  });
});

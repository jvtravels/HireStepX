/* PRI-70 (2026-07-08, offline hostile close battery) — four FALSE-CLOSE classes
 * surfaced by a fresh adversarial probe against classifyAcceptance, each the
 * worst failure mode (finalizing a deal the candidate has NOT unconditionally
 * agreed to). All fixed structurally at the single source of truth
 * (_acceptance-classifier), shared between the medium gate (classifyAcceptance)
 * and the strict gate (detectExplicitAcceptance) so both reject in lockstep.
 *
 *   A. GRANT_THEN_CLOSE — a non-numeric sweetener demand welded to a close idiom
 *      by and/then/&: "Throw in relocation and we've got a deal", "Add a joining
 *      bonus and I'll sign". Every prior demand veto needs a NUMBER or a beat/
 *      match verb; PRI-63's grant veto owns only the LEADING "if you throw in…".
 *   B. RHETORICAL over "take N"/"sign" — "You really think I'll take 40?". The
 *      disbelief/inversion vetoes governed only "accept", so step-2.4's accept-
 *      at-or-below fired on the take-frame.
 *   C. CONSULT_FIRST — a fronted consultation: "Let me run it past my spouse and
 *      I'll sign". CONSULT_DEFERRAL owns only the trailing after/once/when head.
 *   D. CONDITIONAL_DEFERRAL org-actor subject — "I'll sign once payroll confirms
 *      the base". The subject slot lacked payroll/hr/finance/legal/…
 *
 * Every GUARD asserts a genuine unconditional accept still closes — the fixes are
 * scoped (sweetener noun required; commit-verb governors; "let me sign" spared;
 * settlement verb still required) so none over-veto. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance, detectExplicitAcceptance } from "../../server-handlers/_acceptance-classifier";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction, actionToLever } from "../../server-handlers/_next-action-planner";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

describe("PRI-70 A — grant-then-close (sweetener demand + close idiom)", () => {
  it("'Throw in relocation and we've got a deal.' → NOT accepted", () => {
    expect(acc("Throw in relocation and we've got a deal.")).toBe(false);
  });
  it("'Add a joining bonus and I'll sign.' → NOT accepted", () => {
    expect(acc("Add a joining bonus and I'll sign.")).toBe(false);
  });
  it("'Cover my notice buyout and it's a deal.' → NOT accepted", () => {
    expect(acc("Cover my notice buyout and it's a deal.")).toBe(false);
  });
  it("'Include equity and I'm in.' → NOT accepted", () => {
    expect(acc("Include equity and I'm in.")).toBe(false);
  });
  it("'Sort out the ESOP and count me in.' → NOT accepted", () => {
    expect(acc("Sort out the ESOP and count me in.")).toBe(false);
  });
  it("strict gate rejects it too (lockstep)", () => {
    expect(detectExplicitAcceptance("Add a joining bonus and I'll sign.").accepted).toBe(false);
  });
  it("GUARD: no-sweetener 'add me and I'll sign' still accepts", () => {
    expect(acc("Add me and I'll sign.")).toBe(true);
  });
  it("GUARD: acknowledging a GRANTED sweetener 'you covered relocation and I'm in' still accepts", () => {
    expect(acc("You covered relocation and I'm in.")).toBe(true);
  });
});

describe("PRI-70 B — rhetorical over take/sign", () => {
  it("'You really think I'll take 40?' → NOT accepted", () => {
    expect(acc("You really think I'll take 40?")).toBe(false);
  });
  it("'Why would I sign this?' → NOT accepted", () => {
    expect(acc("Why would I sign this?")).toBe(false);
  });
  it("'No way I'm taking 40.' → NOT accepted", () => {
    expect(acc("No way I'm taking 40.")).toBe(false);
  });
  it("GUARD: 'I'll take 40.' still accepts", () => {
    expect(acc("I'll take 40.")).toBe(true);
  });
  it("GUARD: 'I'll sign.' still accepts", () => {
    expect(acc("I'll sign.")).toBe(true);
  });
});

describe("PRI-70 C — fronted consult", () => {
  it("'Let me run it past my spouse and I'll sign.' → NOT accepted", () => {
    expect(acc("Let me run it past my spouse and I'll sign.")).toBe(false);
  });
  it("'Let me sleep on it and it's a deal.' → NOT accepted", () => {
    expect(acc("Let me sleep on it and it's a deal.")).toBe(false);
  });
  it("'Let me check with my manager, then deal.' → NOT accepted", () => {
    expect(acc("Let me check with my manager, then deal.")).toBe(false);
  });
  it("GUARD: 'Let me sign.' (performative commit) still accepts", () => {
    expect(acc("Let me sign.")).toBe(true);
  });
});

describe("PRI-70 D — deferral gated on an org actor", () => {
  it("'I'll sign once payroll confirms the base.' → NOT accepted", () => {
    expect(acc("I'll sign once payroll confirms the base.")).toBe(false);
  });
  it("'Count me in when finance signs off.' → NOT accepted", () => {
    expect(acc("Count me in when finance signs off.")).toBe(false);
  });
  it("strict gate rejects the org-actor deferral too (lockstep)", () => {
    expect(detectExplicitAcceptance("I'll sign once payroll confirms the base.").accepted).toBe(false);
  });
  it("GUARD: benign 'I'll sign, and payroll has my details' still accepts", () => {
    // no settlement verb after the org actor → not a deferral
    expect(acc("I'll sign, and payroll has my details.")).toBe(true);
  });
});

/* End-to-end: the grant-then-close must NOT auto-accept through the kernel — the
 * planner should keep negotiating (a lever/counter), never route to a close at
 * the un-sweetened offer. */
const band: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 52,
  walkAway: 34,
  hasEquity: true,
  variableMax: 8,
};

function offeredAt(offer: number): NegotiationState {
  let s = initState({ sessionId: "pri70", role: "engineering", company: "Flipkart", band });
  s = { ...s, minTurnsBeforeClose: 0 };
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ctc" }, "Current CTC?");
  s = applyCandidateAnswer(s, "my current ctc is 38 LPA");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "target" }, "Target?");
  s = applyCandidateAnswer(s, "I'm targeting 50 LPA");
  s = applyAiMove(s, { lever: "open-with-offer", newTotalLpa: offer, rationale: "anchor" }, `We can do ₹${offer} LPA.`);
  s = applyCandidateAnswer(s, "let me think");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "x" }, "What's on your mind?");
  return s;
}

/* PRI-70 batch 2 (2026-07-08) — a second adversarial probe surfaced two more
 * FALSE-CLOSES and two NO-CLOSES (genuine accepts the bot would have ignored):
 *   E. GRANT_THEN_CLOSE sweetener list missed bare "bonus" ("Guarantee the bonus
 *      and I'm in").
 *   F. SARCASTIC_REFUSAL — a close idiom welded to a stock dismissive ("Deal?
 *      Only in your dreams").
 *   G. "works for me" recall beyond the whole-utterance anchor ("fine, works
 *      for me").
 *   H. gate drift — "let's move forward with this offer" was strict-only, so the
 *      medium classifier missed it ("done, let's move forward with this offer").
 */
describe("PRI-70 batch 2 — more FALSE-CLOSES fixed", () => {
  it("'Guarantee the bonus and I'm in.' → NOT accepted", () => {
    expect(acc("Guarantee the bonus and I'm in.")).toBe(false);
  });
  it("'Deal? Only in your dreams.' → NOT accepted", () => {
    expect(acc("Deal? Only in your dreams.")).toBe(false);
  });
  it("'I'll sign — dream on.' → NOT accepted", () => {
    expect(acc("I'll sign — dream on.")).toBe(false);
  });
  it("strict gate rejects the sarcasm too (lockstep)", () => {
    expect(detectExplicitAcceptance("Deal? Only in your dreams.").accepted).toBe(false);
  });
});

describe("PRI-70 batch 2 — genuine accepts no longer dropped (NO-CLOSE fixes)", () => {
  it("'fine, works for me.' → accepted", () => {
    expect(acc("fine, works for me.")).toBe(true);
  });
  it("'done, let's move forward with this offer.' → accepted (was strict-only)", () => {
    expect(acc("done, let's move forward with this offer.")).toBe(true);
  });
  it("strict gate also accepts 'let's move forward with this offer' (lockstep)", () => {
    expect(detectExplicitAcceptance("done, let's move forward with this offer.").accepted).toBe(true);
  });
  it("GUARD: 'this doesn't work for me' still NOT accepted", () => {
    expect(acc("this doesn't work for me.")).toBe(false);
  });
  it("GUARD: 'works for me but I want more' still NOT accepted", () => {
    expect(acc("works for me but I want more.")).toBe(false);
  });
});

describe("PRI-70 end-to-end — grant-then-close never DROPS the demanded sweetener", () => {
  it("'Add a joining bonus and I'll sign' → if it closes, the JB is GRANTED (never a bare ₹40L)", () => {
    const s = applyCandidateAnswer(offeredAt(40), "Add a joining bonus and I'll sign.");
    const action = planNextAction(s);
    const lever = actionToLever(action, s);
    const closed = /^(close|auto-accept)/.test(action.kind);
    // The classifier veto stops a naive medium/strict auto-accept; the kernel's
    // conditional-close path (PRI-63) may still legitimately CLOSE — but only by
    // GRANTING the demanded joining bonus, never by silently dropping it. The one
    // outcome that must never happen: a flat ₹40L close with no bonus.
    const silentlyDropped =
      closed && lever.newTotalLpa === 40 && !(Number(lever.joiningBonusAmount) > 0);
    expect(silentlyDropped).toBe(false);
  });
});

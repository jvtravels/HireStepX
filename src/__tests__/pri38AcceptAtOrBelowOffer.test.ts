/* §11 (2026-07-08) — accept frame naming a number AT or BELOW the standing offer.
 *
 * Live/offline defect: with ₹40L on the table, "I'll take 40" and "Fine, I'll
 * take 38" were classified as NON-acceptance (no commitment idiom, and the bare
 * number "40"/"38" isn't a performative-verb frame). The planner then read the
 * lone number as a fresh counter and — because the near-offer close gate only
 * clamps UP — bumped the recruiter's own line to 43. A candidate conceding at or
 * under the offer was answered with a self-defeating raise.
 *
 * Fix (single source of truth): classifyAcceptance now takes the numeric offer
 * (context.offerLpa, threaded from state.highestOfferMade through
 * parseCandidateAnswer) and, via ACCEPT_FRAME_NUMBER_PATTERN, reads an accept
 * frame quoting a number ≤ offer as a strong acceptance. A number ABOVE the
 * offer stays a counter (must NOT false-close), and non-cash trailing units
 * (minutes, %, people) are excluded by negative lookahead.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction, actionToLever } from "../../server-handlers/_next-action-planner";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const band: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 52,
  walkAway: 34,
  hasEquity: true,
  variableMax: 8,
};

function offeredAt(offer: number): NegotiationState {
  let s = initState({ sessionId: "pri38", role: "engineering", company: "Flipkart", band });
  s = { ...s, minTurnsBeforeClose: 0 };
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ctc" }, "Current CTC?");
  s = applyCandidateAnswer(s, "my current ctc is 38 LPA");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "target" }, "Target?");
  s = applyCandidateAnswer(s, "I'm targeting 50 LPA");
  s = applyAiMove(
    s,
    { lever: "open-with-offer", newTotalLpa: offer, rationale: "anchor" },
    `We can do ₹${offer} LPA.`,
  );
  s = applyCandidateAnswer(s, "let me think");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "x" }, "What's on your mind?");
  return s;
}

/** Drive one candidate utterance against a ₹40L offer, return the planned
 *  action kind and the figure the recruiter would speak. */
function outcome(utter: string): { kind: string; fig: number | null } {
  const s = applyCandidateAnswer(offeredAt(40), utter);
  const action = planNextAction(s);
  const lever = actionToLever(action, s);
  return { kind: action.kind, fig: lever.newTotalLpa };
}

describe("§11 classifyAcceptance — accept frame ≤ offer (unit layer)", () => {
  const at = (t: string) => classifyAcceptance(t, { offerLpa: 40, offerOnTable: true });

  it("'I'll take 40' (exactly at offer) → accepted", () => {
    const r = at("I'll take 40.");
    expect(r.accepted).toBe(true);
    expect(r.reasons).toContain("accept-at-or-below-offer");
  });
  it("'Fine, I'll take 38' (below offer) → accepted", () => {
    expect(at("Fine, I'll take 38.").accepted).toBe(true);
  });
  it("'happy with 38' → accepted", () => {
    expect(at("I'm happy with 38, send the letter.").accepted).toBe(true);
  });
  it("'let's go with 40' → accepted", () => {
    expect(at("Let's go with 40.").accepted).toBe(true);
  });
  it("GUARD 'I'll take 45' (ABOVE offer) → NOT an at/below accept", () => {
    const r = at("I'll take 45.");
    expect(r.reasons).not.toContain("accept-at-or-below-offer");
  });
  it("GUARD 'I'll take 40 minutes' (time, not cash) → not accepted", () => {
    expect(at("I'll take 40 minutes to decide.").accepted).toBe(false);
  });
  it("GUARD 'I'll take a 5% bump' (percent, not cash) → not an at/below accept", () => {
    expect(at("I'll take a 5 percent bump.").reasons).not.toContain("accept-at-or-below-offer");
  });
  it("without offerLpa in context, the numbered frame is inert (back-compat)", () => {
    const r = classifyAcceptance("I'll take 40.", { offerOnTable: true });
    expect(r.reasons).not.toContain("accept-at-or-below-offer");
  });
});

describe("§11 end-to-end — accept ≤ offer closes, does NOT counter up", () => {
  it("'I'll take 40' → CLOSES at 40 (not a counter to 43)", () => {
    const { kind, fig } = outcome("I'll take 40.");
    expect(kind).toMatch(/^(close|auto-accept)/);
    expect(fig).toBe(40);
  });
  it("'Fine, I'll take 38' (lowball) → CLOSES at 40, never below floor and never up", () => {
    const { kind, fig } = outcome("Fine, I'll take 38.");
    expect(kind).toMatch(/^(close|auto-accept)/);
    expect(fig).toBe(40);
  });
  it("'happy with 38' → CLOSES at 40", () => {
    const { kind, fig } = outcome("I'm happy with 38, send the letter.");
    expect(kind).toMatch(/^(close|auto-accept)/);
    expect(fig).toBe(40);
  });
  it("GUARD 'I'll take 45' (above offer) → does NOT close at 45 (no false raise)", () => {
    const { fig } = outcome("I'll take 45.");
    // Either it stays a counter or holds at the offer — the one thing it must
    // never do is hand the candidate 45 for merely naming it.
    expect(fig).not.toBe(45);
  });
});

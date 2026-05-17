/* Phase 2 Indian-HR redesign (2026-05-17) — change-5 integration tests.
 *
 * Locks the three behavioural invariants from the PDF#27 follow-up:
 *
 *   1. Phase-2 anchor emits a SINGLE LPA point-offer (no en-dash / em-
 *      dash / hyphen / "to" range, no internal-band leak).
 *   2. When the candidate asks "what's your band/range/budget?" the
 *      planner emits `band-disclosure-deflect` whose canonical prose
 *      restates the table offer + routes the candidate's expectation to
 *      the panel, and never leaks the internal band lo/hi numbers.
 *   3. Once `verbalAcceptanceTurn` is stamped and `close-recap-formal`
 *      has fired, the planner emits exactly ONE
 *      `post-acceptance-document-request` action (single-fire via
 *      `state.postAcceptanceDocsRequestedAtTurn`).
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../../server-handlers/_canonical-prose";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

const mk = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "phase2-redesign",
    role: "Product Designer",
    company: "Flipkart",
    band: BAND,
  }),
  ...overrides,
});

describe("Phase 2 Indian-HR redesign — single-number anchor invariant", () => {
  it("anchor-with-offer prose carries SINGLE LPA point-offer (no range dash, no 'to' range)", () => {
    const s = mk({
      phase: "opening",
      candidateCurrentCtc: 8,
      candidateTarget: null,
      candidateApplicableYoe: 1,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("anchor-with-offer");
    if (action.kind !== "anchor-with-offer") return;
    /* The point-offer is the band floor; the band ceiling MUST NOT
     * appear in the canonical prose. */
    expect(action.initialOffer).toBe(BAND.initialOffer);
    const prose = renderCanonicalProse(action, s);
    /* No two adjacent numbers separated by a dash / en-dash / em-dash
     * / hyphen — the prior `anchor-with-band` variant emitted ranges
     * like "22-30 LPA" which leaked the internal band. */
    expect(prose).not.toMatch(/\d+\s*[\u2013\u2014-]\s*\d/);
    /* No "to"-style ranges either ("22 to 30 LPA"). */
    expect(prose).not.toMatch(/\d+\s+to\s+\d/);
    /* The band ceiling must NEVER surface. */
    expect(prose).not.toContain(`${BAND.maxStretch}`);
    /* But the point-offer must. */
    expect(prose).toContain(`${BAND.initialOffer}`);
  });
});

describe("Phase 2 Indian-HR redesign — band-disclosure-deflect on 'what's your band?'", () => {
  it("range-disclosure phase → band-disclosure-deflect with NO lo/hi leak", () => {
    /* The state machine moves into `phase=range-disclosure` when the
     * candidate has asked for the internal band/range/budget. The
     * planner gate at _next-action-planner.ts emits a
     * band-disclosure-deflect for this phase. */
    const s = mk({
      phase: "range-disclosure",
      turnIndex: 3,
      highestOfferMade: BAND.initialOffer,
      candidateCurrentCtc: 14,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("band-disclosure-deflect");
    const prose = renderCanonicalProse(action, s);
    /* The deflect must NOT contain a numeric range. */
    expect(prose).not.toMatch(/\d+\s*[\u2013\u2014-]\s*\d/);
    /* The deflect must NOT leak the maxStretch ceiling. */
    expect(prose).not.toContain(`${BAND.maxStretch}`);
    /* Walk-away is internal — also forbidden. */
    expect(prose).not.toContain(`${BAND.walkAway}`);
    /* Must route to the panel + restate the table offer. */
    expect(prose).toMatch(/panel/i);
  });
});

describe("Phase 2 Indian-HR redesign — post-acceptance-document-request single-fire", () => {
  it("verbal acceptance + close-recap-formal fired → exactly ONE post-acceptance-document-request", () => {
    /* Build a state simulating: candidate verbally accepted (turn 6)
     * and the formal close recap has already fired (recorded in
     * reactiveFollowupsFired). Planner should now emit the docs
     * request lever. */
    let s = mk({
      phase: "closing-push",
      turnIndex: 7,
      verbalAcceptanceTurn: 6,
      reactiveFollowupsFired: ["close-recap-formal"],
      postAcceptanceDocsRequestedAtTurn: null,
    } as Partial<NegotiationState>);

    const first = planNextAction(s);
    expect(first.kind).toBe("post-acceptance-document-request");
    const prose = renderCanonicalProse(first, s);
    /* Prose should reference PAN + Aadhaar (offer-letter-stage docs only)
     * and BGV as the deferred next step. Heavy docs (Form 16, payslips,
     * bank statements, relieving letters) intentionally out of scope here —
     * they belong to a separate later BGV workflow. */
    expect(prose).toMatch(/PAN/);
    expect(prose).toMatch(/Aadhaar/);
    expect(prose).toMatch(/BGV|background|verification/i);
    expect(prose).not.toMatch(/Form 16|payslip|bank statement|relieving/i);

    /* Simulate applyAiMove stamping the single-fire field. */
    s = { ...s, postAcceptanceDocsRequestedAtTurn: s.turnIndex };

    const second = planNextAction(s);
    expect(second.kind).not.toBe("post-acceptance-document-request");
  });
});

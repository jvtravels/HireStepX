/* AP3-F2 + AP3-F3 (2026-05-17) — component-aware discovery + band-
 * disclosure lever tests.
 *
 * Fix 1 (AP3-F2) — after currentCtc is satisfied AND the candidate has
 * a senior comp profile (applicableYoe >= 4 OR role matches
 * /senior|lead|principal|staff/i), the planner queues component probes
 * in order base → variable → esop BEFORE the target probe. Entry /
 * junior profiles fall straight through to the anchor-with-band or
 * target probe without component disclosure.
 *
 * Fix 2 (AP3-F3) — after currentCtc is disclosed AND component probes
 * have either fired or been skipped (entry/junior), the planner fires
 * anchor-with-band ONCE per session, gated on band completeness (lo +
 * hi numeric, lo < hi). Subsequent planner calls see the lever in the
 * askedTopics ledger and route to the target probe (which has access
 * to the anchor in conversation history).
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import { RANGE_DASH_RE } from "../../server-handlers/_canonical-prose";

const BAND: NegotiationBand = {
  initialOffer: 30,
  maxStretch: 42,
  walkAway: 26,
  hasEquity: false,
};

const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "ap3",
    role: "Senior Product Designer",
    company: "Flipkart",
    band: BAND,
  }),
  ...overrides,
});

const initJunior = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "ap3-jr",
    role: "Product Designer",
    company: "Flipkart",
    band: BAND,
  }),
  ...overrides,
});

describe("AP3-F2 — component-aware discovery for senior profiles", () => {
  it("senior + currentCtc disclosed → next probe is component:base", () => {
    const s = init({
      phase: "opening",
      candidateCurrentCtc: 18,
      candidateTarget: null,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("component-probe");
    if (action.kind === "component-probe") {
      expect(action.component).toBe("base");
    }
  });

  it("senior + base populated → next probe is component:variable", () => {
    const s = init({
      phase: "opening",
      candidateCurrentCtc: 18,
      candidateTarget: null,
      candidateComponentBreakdown: {
        base: 14,
        variable: null,
        equity: null,
        basePercent: null,
        variablePercent: null,
        hasAny: true,
      },
      askedTopics: [{ topic: "currentCtcBase", atTurn: 1 }],
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("component-probe");
    if (action.kind === "component-probe") {
      expect(action.component).toBe("variable");
    }
  });

  it("senior + base+variable populated → next probe is component:esop", () => {
    const s = init({
      phase: "opening",
      candidateCurrentCtc: 18,
      candidateTarget: null,
      candidateComponentBreakdown: {
        base: 14,
        variable: 4,
        equity: null,
        basePercent: null,
        variablePercent: null,
        hasAny: true,
      },
      askedTopics: [
        { topic: "currentCtcBase", atTurn: 1 },
        { topic: "currentCtcVariable", atTurn: 2 },
      ],
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("component-probe");
    if (action.kind === "component-probe") {
      expect(action.component).toBe("esop");
    }
  });

  it("senior post-currentCtc — first three planner calls are base, variable, esop in order", () => {
    let s = init({
      phase: "opening",
      candidateCurrentCtc: 18,
      candidateTarget: null,
    });
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const a = planNextAction(s);
      if (a.kind !== "component-probe") break;
      seen.push(a.component);
      /* Simulate the probe firing without the candidate answering: push
       * onto askedTopics so the next planner call advances. */
      s = {
        ...s,
        askedTopics: [
          ...(s.askedTopics ?? []),
          { topic: ("currentCtc" + a.component.charAt(0).toUpperCase() + a.component.slice(1)) as never, atTurn: s.turnIndex + i },
        ],
      };
    }
    expect(seen).toEqual(["base", "variable", "esop"]);
  });

  it("entry/junior profile + currentCtc disclosed → does NOT fire component-probe", () => {
    const s = initJunior({
      phase: "opening",
      candidateCurrentCtc: 8,
      candidateTarget: null,
      candidateApplicableYoe: 1,
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("component-probe");
  });

  it("applicableYoe >= 4 fires component-probe even when role is junior-shaped", () => {
    const s = initJunior({
      phase: "opening",
      candidateCurrentCtc: 18,
      candidateTarget: null,
      candidateApplicableYoe: 5,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("component-probe");
  });

  it("FL4 (PDF#27) — senior YOE + null currentCtc → component-probe does NOT fire", () => {
    /* The previous gate could (in principle) emit a component probe
     * the moment YOE indicated seniority, even before the candidate
     * disclosed the total — which presupposes a number that hasn't
     * landed. The hard precondition is state.candidateCurrentCtc !=
     * null in BOTH the outer planner gate AND inside nextComponentProbe
     * itself. */
    const s = init({
      phase: "opening",
      candidateCurrentCtc: null,
      candidateTarget: null,
      candidateApplicableYoe: 8,
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("component-probe");
    /* Next action should be a currentCtc-shaped probe (either the
     * open-with-offer opener which asks for currentCtc, or the
     * discovery-probe path with item=currentCtc once the planner
     * routes past the opener). */
    if (action.kind === "discovery-probe") {
      expect(action.item).toMatch(/currentCtc/i);
    } else {
      expect(["open-with-offer", "discovery-probe"]).toContain(action.kind);
    }
  });

  it("component-probe canonical prose carries the required component token", () => {
    const s = init({
      phase: "opening",
      candidateCurrentCtc: 18,
      candidateTarget: null,
    });
    const action = planNextAction(s);
    if (action.kind !== "component-probe") throw new Error("expected component-probe");
    expect(action.component).toBe("base");
    const prose = renderCanonicalProse(action, s);
    expect(prose).toMatch(/\bbase\b/i);
  });
});

describe("AP3-F3 — band-disclosure lever", () => {
  it("currentCtc disclosed + no components needed (junior) + band complete → anchor-with-band", () => {
    const s = initJunior({
      phase: "opening",
      candidateCurrentCtc: 8,
      candidateTarget: null,
      candidateApplicableYoe: 1,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("anchor-with-band");
    if (action.kind === "anchor-with-band") {
      expect(action.lo).toBe(BAND.initialOffer);
      expect(action.hi).toBe(BAND.maxStretch);
    }
  });

  it("anchor-with-band canonical prose contains en-dash range + LPA + fitment", () => {
    const s = initJunior({
      phase: "opening",
      candidateCurrentCtc: 8,
      candidateTarget: null,
      candidateApplicableYoe: 1,
    });
    const action = planNextAction(s);
    if (action.kind !== "anchor-with-band") throw new Error("expected anchor-with-band");
    const prose = renderCanonicalProse(action, s);
    expect(RANGE_DASH_RE.test(prose)).toBe(true);
    expect(prose).toMatch(/\u2013/); // explicit en-dash
    expect(prose).toMatch(/\bLPA\b/i);
    expect(prose).toMatch(/\bfitment\b/i);
  });

  it("incomplete band (hi <= lo) → fires anchor-with-band in honest-defer mode (bandIncomplete=true)", () => {
    /* PDF#27 Fix 5 design: NEVER fall back to internal-leak language
     * like "missing from fact pack". When the band is unusable, the
     * lever still fires but with bandIncomplete=true so the prose
     * surface emits a panel-signoff defer + fitment invitation. */
    const badBand: NegotiationBand = {
      initialOffer: 30,
      maxStretch: 30, // not strictly greater than lo
      walkAway: 26,
      hasEquity: false,
    };
    const s = {
      ...initJunior({
        phase: "opening",
        candidateCurrentCtc: 8,
        candidateTarget: null,
        candidateApplicableYoe: 1,
      }),
      band: badBand,
    };
    const action = planNextAction(s);
    expect(action.kind).toBe("anchor-with-band");
    if (action.kind === "anchor-with-band") {
      expect(action.bandIncomplete).toBe(true);
      /* Defer prose carries the "fitment" token but no range / "LPA". */
      const prose = renderCanonicalProse(action, s);
      expect(prose).toMatch(/\bfitment\b/i);
      expect(prose).not.toMatch(/missing from/i);
    }
  });

  it("anchor-with-band fires at most ONCE per session", () => {
    let s = initJunior({
      phase: "opening",
      candidateCurrentCtc: 8,
      candidateTarget: null,
      candidateApplicableYoe: 1,
    });
    const first = planNextAction(s);
    expect(first.kind).toBe("anchor-with-band");
    /* Simulate the move firing — applyAiMove would push the askedTopic
     * onto state.askedTopics. */
    s = {
      ...s,
      askedTopics: [
        ...(s.askedTopics ?? []),
        { topic: "band-anchor-with-rationale", atTurn: s.turnIndex },
      ],
    };
    const second = planNextAction(s);
    expect(second.kind).not.toBe("anchor-with-band");
  });

  it("senior session sequence: currentCtc → component probes (base/var/esop) → anchor-with-band", () => {
    let s = init({
      phase: "opening",
      candidateCurrentCtc: 18,
      candidateTarget: null,
    });
    const sequence: string[] = [];
    /* Walk up to 5 planner calls; thread component probes by populating
     * the askedTopics ledger so the planner advances. */
    for (let i = 0; i < 5; i++) {
      const a = planNextAction(s);
      sequence.push(a.kind === "component-probe" ? `component:${a.component}` : a.kind);
      if (a.kind === "component-probe") {
        const topicName = ("currentCtc" + a.component.charAt(0).toUpperCase() + a.component.slice(1)) as never;
        s = {
          ...s,
          askedTopics: [...(s.askedTopics ?? []), { topic: topicName, atTurn: s.turnIndex + i }],
        };
        continue;
      }
      if (a.kind === "anchor-with-band") {
        s = {
          ...s,
          askedTopics: [
            ...(s.askedTopics ?? []),
            { topic: "band-anchor-with-rationale", atTurn: s.turnIndex + i },
          ],
        };
        continue;
      }
      break;
    }
    /* Expect the first four to be the three component probes plus
     * anchor-with-band. */
    expect(sequence.slice(0, 4)).toEqual([
      "component:base",
      "component:variable",
      "component:esop",
      "anchor-with-band",
    ]);
  });
});

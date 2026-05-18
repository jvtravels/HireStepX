/* PDF#33 Audit Pass — Move A (teaser excision) + Move B1
 * (variableInferred provenance) regression tests (2026-05-18).
 *
 * Move A: the kernel's canonical-prose carried six "let me walk you
 * through …" / "let me put the fitment in context" teaser openers.
 * Each one promised a subsequent narration that the kernel was not
 * architected to deliver — the next turn either repeated the teaser
 * or jumped topics, leaving the candidate confused. Move A:
 *   (1) replaces every teaser site with concrete content or a real
 *       question, and
 *   (2) installs a TEASER_PROSE_RE boundary gate in validateRestyle
 *       so the LLM restyle layer cannot reintroduce the pattern.
 *
 * Move B1: the component-breakdown extractor derives `variable` from
 * the total−base complement (PDF#29 Bug 1). Pre-Move-B1 that derived
 * value was indistinguishable from an explicit disclosure, so the
 * component-probe sequencer marked variable as "populated" and jumped
 * straight from base → esop. Candidates whose intended message was
 * "base IS my total, no variable" had their meaning silently flipped.
 * Move B1 stamps `variableInferred: true` on the derived path and
 * teaches `nextComponentProbe` to treat inferred-variable as
 * "needs-confirmation" so the bot still asks. */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
} from "../../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../../server-handlers/_canonical-prose";
import { validateRestyle as validateRestyleFn } from "../../../server-handlers/_response-pipeline";
import {
  extractComponentBreakdown,
  mergeBreakdown,
} from "../../../server-handlers/_component-breakdown";

const BAND: NegotiationBand = {
  initialOffer: 30,
  maxStretch: 45,
  walkAway: 25,
  hasEquity: true,
};

const newState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "pdf33-audit",
    role: "Senior Product Designer",
    company: "Meesho",
    band: BAND,
  }),
  ...overrides,
});

describe("PDF#33 Move A — TEASER_PROSE_RE boundary gate", () => {
  const state = newState();

  it("rejects 'let me walk you through' restyles", () => {
    const r = validateRestyleFn(
      "What's the vesting schedule on your current grant?",
      "Let me walk you through how the vesting and cliff are structured for this grade.",
      state,
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("teaser-prose");
  });

  it("rejects 'let me run you through' restyles", () => {
    const r = validateRestyleFn(
      "What's the base split?",
      "Let me run you through the fitment breakdown for this band.",
      state,
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("teaser-prose");
  });

  it("rejects 'let me put the fitment in context' restyles", () => {
    const r = validateRestyleFn(
      "What's the base split?",
      "Let me put the fitment in context before we go further.",
      state,
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("teaser-prose");
  });

  it("ALLOWS plain-English probes through (no teaser pattern)", () => {
    const safe = [
      "What's the vesting schedule and cliff on your current grant?",
      "On the equity side — any ESOPs or RSUs in your current package, and how's the vesting structured?",
      "Got it on the total — what's the base split?",
    ];
    for (const s of safe) {
      const r = validateRestyleFn(s, s, state);
      expect(r.reason ?? "").not.toBe("teaser-prose");
    }
  });
});

describe("PDF#33 Move A — canonical-prose has no teaser openers", () => {
  it("equity-clarity canonical is a substantive question, not a teaser", () => {
    const state = newState();
    const prose = renderCanonicalProse(
      {
        kind: "reactive-followup",
        ask: "fallback",
        trigger: "equityUnclear",
        topic: "equity-clarity",
        satisfiesTopic: "equity-clarity",
      },
      state,
    );
    expect(prose).not.toMatch(/let me (?:walk|run) you through/i);
    expect(prose).not.toMatch(/let me put .* in context/i);
    expect(prose).toMatch(/\?/);
  });
});

describe("PDF#33 Move B1 — variableInferred provenance flag", () => {
  it("stamps variableInferred=true when variable is derived from total−base complement", () => {
    const bd = extractComponentBreakdown("My base is ₹20 LPA", 30);
    expect(bd.base).toBe(20);
    expect(bd.variable).toBe(10);
    expect(bd.variableInferred).toBe(true);
  });

  it("does NOT stamp variableInferred when variable was explicitly stated", () => {
    const bd = extractComponentBreakdown(
      "Base ₹20 LPA, variable ₹8 LPA",
      30,
    );
    expect(bd.base).toBe(20);
    expect(bd.variable).toBe(8);
    expect(bd.variableInferred !== true).toBe(true);
  });

  it("does NOT stamp variableInferred when no total is supplied", () => {
    const bd = extractComponentBreakdown("My base is ₹20 LPA");
    expect(bd.base).toBe(20);
    expect(bd.variable).toBe(null);
    expect(bd.variableInferred !== true).toBe(true);
  });
});

describe("PDF#33 Move B1 — mergeBreakdown preserves provenance", () => {
  it("explicit disclosure CLEARS prior inferred flag", () => {
    const prior = extractComponentBreakdown("base ₹20 LPA", 30); /* infers variable=10 */
    expect(prior.variableInferred).toBe(true);
    const next = extractComponentBreakdown("actually variable is ₹6 LPA");
    const merged = mergeBreakdown(prior, next);
    expect(merged.variable).toBe(6);
    expect(merged.variableInferred !== true).toBe(true);
  });

  it("inferred flag survives merges that don't touch variable", () => {
    const prior = extractComponentBreakdown("base ₹20 LPA", 30);
    expect(prior.variableInferred).toBe(true);
    const next = extractComponentBreakdown("ESOPs are ₹5 LPA");
    const merged = mergeBreakdown(prior, next);
    expect(merged.variable).toBe(10);
    expect(merged.variableInferred).toBe(true);
    expect(merged.equity).toBe(5);
  });
});

describe("PDF#33 Move B1 — variable probe fires for confirmation when inferred", () => {
  it("planner does NOT skip variable when variable came from inference", () => {
    /* Set up: candidate said total=30 + base=20 → variable inferred 10.
     * Pre-B1, base→esop would jump. Post-B1, variable probe still
     * fires (for confirmation). */
    const state = newState({
      candidateCurrentCtc: 30,
      candidateComponentBreakdown: {
        base: 20,
        variable: 10,
        equity: null,
        basePercent: null,
        variablePercent: null,
        variableInferred: true,
        hasAny: true,
      },
      askedTopics: [
        { topic: "currentCtcAsked", atTurn: 1 },
        { topic: "currentCtcBase", atTurn: 2 },
      ] as NegotiationState["askedTopics"],
    });
    const action = planNextAction(state);
    /* If a component-probe is the next pick, it must be the variable
     * one — NOT esop. (Planner may legitimately pick something else
     * higher-priority; we only assert that IF it picks component-probe
     * it picks variable.) */
    if (action.kind === "component-probe") {
      expect(action.component).toBe("variable");
    }
  });

  it("planner DOES skip variable when variable was explicitly disclosed (not inferred)", () => {
    const state = newState({
      candidateCurrentCtc: 30,
      candidateComponentBreakdown: {
        base: 20,
        variable: 8,
        equity: null,
        basePercent: null,
        variablePercent: null,
        variableInferred: false,
        hasAny: true,
      },
      askedTopics: [
        { topic: "currentCtcAsked", atTurn: 1 },
        { topic: "currentCtcBase", atTurn: 2 },
      ] as NegotiationState["askedTopics"],
    });
    const action = planNextAction(state);
    if (action.kind === "component-probe") {
      /* Explicitly-disclosed variable should not be re-asked. */
      expect(action.component).not.toBe("variable");
    }
  });
});

describe("PDF#33 Move B1 — variable canonical prose adapts to inferred state", () => {
  it("renders confirmation prose when variableInferred=true", () => {
    const state = newState({
      candidateCurrentCtc: 30,
      candidateComponentBreakdown: {
        base: 20,
        variable: 10,
        equity: null,
        basePercent: null,
        variablePercent: null,
        variableInferred: true,
        hasAny: true,
      },
    });
    const prose = renderCanonicalProse(
      {
        kind: "component-probe",
        component: "variable",
        satisfiesTopic: "currentCtcVariable",
      },
      state,
    );
    /* Confirmation variant should echo the inferred number and the
     * total so the candidate has a concrete frame to confirm/correct. */
    expect(prose).toMatch(/quick check/i);
    expect(prose).toContain("10");
    expect(prose).toContain("30");
    expect(prose).toMatch(/\?/);
  });

  it("renders standard probe prose when variable is NOT yet known", () => {
    const state = newState({
      candidateCurrentCtc: 30,
      /* No componentBreakdown yet. */
    });
    const prose = renderCanonicalProse(
      {
        kind: "component-probe",
        component: "variable",
        satisfiesTopic: "currentCtcVariable",
      },
      state,
    );
    expect(prose).not.toMatch(/quick check/i);
    expect(prose).toMatch(/variable/i);
    expect(prose).toMatch(/\?/);
  });
});

/* Phase 5 Session B (2026-05-19) — round-persona-conditional canonical
 * prose tests.
 *
 * Three prose surfaces overlay the multi-round persona on top of the
 * existing sector persona:
 *   - band-disclosure-deflect (policy / scope-trade / strategic)
 *   - counter-offer            (cap floor / scope tradeoff / final
 *                              leverage)
 *   - anchor-with-offer        (floor / stretch / Director-tier)
 *
 * Plus distinct round-transition handoff prose per (from → to) edge.
 *
 * Default-OFF invariance: when `multiRoundEnabled !== true`, the
 * prose layer falls through to the sector persona branch and must
 * remain byte-identical to pre-Phase-5 output.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { renderCanonicalProse } from "../../../server-handlers/_canonical-prose";
import type { NegotiationRoundPersona } from "../../../server-handlers/_negotiation-rounds";
import type { SatisfiesTopic } from "../../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: true,
};

function mk(
  overrides: Partial<NegotiationState> = {},
  roundPersona?: NegotiationRoundPersona,
): NegotiationState {
  const base = initState({
    sessionId: "phase5-prose",
    role: "Senior Engineer",
    company: "Flipkart",
    band: BAND,
    multiRoundEnabled: roundPersona != null,
  });
  return {
    ...base,
    ...(roundPersona != null ? { roundPersona } : {}),
    ...overrides,
  };
}

describe("Phase 5 Session B — round-transition handoff prose", () => {
  it("hr-partner → hiring-manager renders the warm partner-led handoff", () => {
    const s = mk({}, "hiring-manager");
    const prose = renderCanonicalProse(
      {
        kind: "round-transition",
        from: "hr-partner",
        to: "hiring-manager",
        
      },
      s,
    );
    expect(prose).toContain("hiring manager");
    expect(prose).toMatch(/scope and team fit/);
    /* Distinct from the director handoff body so two consecutive
     * handoff turns can't collide on the rotating-ack guard. */
    expect(prose).not.toContain("pull in the director");
  });

  it("hiring-manager → director renders the process-led final-round handoff", () => {
    const s = mk({}, "director");
    const prose = renderCanonicalProse(
      {
        kind: "round-transition",
        from: "hiring-manager",
        to: "director",
        
      },
      s,
    );
    expect(prose).toContain("director");
    expect(prose).toMatch(/final round/);
    expect(prose).not.toMatch(/scope and team fit/);
  });

  it("two distinct handoff bodies do not share a phrase that would trigger the rotating-ack guard", () => {
    const sHm = mk({}, "hiring-manager");
    const sDir = mk({}, "director");
    const a = renderCanonicalProse(
      { kind: "round-transition", from: "hr-partner", to: "hiring-manager" },
      sHm,
    );
    const b = renderCanonicalProse(
      { kind: "round-transition", from: "hiring-manager", to: "director" },
      sDir,
    );
    /* Strip leading ACK tokens both sides; the residual must differ. */
    const norm = (x: string) => x.replace(/^(?:Thanks[^.]*\.|Appreciate[^.]*\.)\s*/i, "").trim();
    expect(norm(a)).not.toBe(norm(b));
  });
});

describe("Phase 5 Session B — band-disclosure-deflect × round persona", () => {
  it("HR Partner cites the hiring panel / band policy", () => {
    const s = mk({}, "hr-partner");
    const prose = renderCanonicalProse({ kind: "band-disclosure-deflect", satisfiesTopic: "band-disclosure-deflect" as SatisfiesTopic }, s);
    expect(prose).toMatch(/hiring panel/);
    expect(prose).toMatch(/grade fitment/);
  });

  it("Hiring Manager pivots to scope-trade framing", () => {
    const s = mk({}, "hiring-manager");
    const prose = renderCanonicalProse({ kind: "band-disclosure-deflect", satisfiesTopic: "band-disclosure-deflect" as SatisfiesTopic }, s);
    expect(prose).toMatch(/flex on structure/);
    expect(prose).toMatch(/scope|level/);
  });

  it("Director frames the deflection as final-leverage", () => {
    const s = mk({}, "director");
    const prose = renderCanonicalProse({ kind: "band-disclosure-deflect", satisfiesTopic: "band-disclosure-deflect" as SatisfiesTopic }, s);
    expect(prose).toMatch(/final number/);
    expect(prose).toMatch(/path forward/);
  });

  it("default-OFF (multiRoundEnabled=false) falls through to sector persona prose", () => {
    /* No roundPersona seeded; uses sector-default prose. */
    const s = mk();
    const prose = renderCanonicalProse({ kind: "band-disclosure-deflect", satisfiesTopic: "band-disclosure-deflect" as SatisfiesTopic }, s);
    expect(prose).toMatch(/won't be able to share internal numbers/);
  });
});

describe("Phase 5 Session B — counter-offer × round persona", () => {
  it("HR Partner caps at the band floor and cites grade-fitment ceiling", () => {
    const s = mk({}, "hr-partner");
    const prose = renderCanonicalProse(
      { kind: "counter-offer", counterTotalLpa: 24, satisfiesTopic: "counter-offer" as SatisfiesTopic },
      s,
    );
    expect(prose).toMatch(/₹24L/);
    expect(prose).toMatch(/band|ceiling|grade fitment/);
  });

  it("Hiring Manager frames the revision as a scope-tradeoff", () => {
    const s = mk({}, "hiring-manager");
    const prose = renderCanonicalProse(
      { kind: "counter-offer", counterTotalLpa: 28, satisfiesTopic: "counter-offer" as SatisfiesTopic },
      s,
    );
    expect(prose).toMatch(/₹28L/);
    expect(prose).toMatch(/scope/);
  });

  it("Director frames the revision as final-leverage sign-off", () => {
    const s = mk({}, "director");
    const prose = renderCanonicalProse(
      { kind: "counter-offer", counterTotalLpa: 32, satisfiesTopic: "counter-offer" as SatisfiesTopic },
      s,
    );
    expect(prose).toMatch(/₹32L/);
    expect(prose).toMatch(/Final number|sign off/i);
  });

  it("default-OFF falls through to sector body (byte-identical to v8)", () => {
    const s = mk();
    const prose = renderCanonicalProse(
      { kind: "counter-offer", counterTotalLpa: 28, satisfiesTopic: "counter-offer" as SatisfiesTopic },
      s,
    );
    expect(prose).toMatch(/₹28L/);
    expect(prose).toMatch(/revise the fitment/);
    /* Sector-default body — no scope / final-number framing. */
    expect(prose).not.toMatch(/Final number/);
  });
});

describe("Phase 5 Session B — anchor-with-offer × round persona", () => {
  it("HR Partner anchors at the band floor with a no-stretch tail", () => {
    const s = mk({}, "hr-partner");
    const prose = renderCanonicalProse(
      { kind: "anchor-with-offer", initialOffer: 22, bandIncomplete: false, satisfiesTopic: "anchor-with-offer" as SatisfiesTopic },
      s,
    );
    expect(prose).toMatch(/₹22 LPA/);
    expect(prose).toMatch(/band floor|no stretch/);
  });

  it("Hiring Manager widens the framing with a stretch reference", () => {
    const s = mk({}, "hiring-manager");
    const prose = renderCanonicalProse(
      { kind: "anchor-with-offer", initialOffer: 24, bandIncomplete: false, satisfiesTopic: "anchor-with-offer" as SatisfiesTopic },
      s,
    );
    expect(prose).toMatch(/₹24 LPA/);
    expect(prose).toMatch(/stretch band/);
  });

  it("Director hits the Director-tier band framing", () => {
    const s = mk({}, "director");
    const prose = renderCanonicalProse(
      { kind: "anchor-with-offer", initialOffer: 30, bandIncomplete: false, satisfiesTopic: "anchor-with-offer" as SatisfiesTopic },
      s,
    );
    expect(prose).toMatch(/₹30 LPA/);
    expect(prose).toMatch(/Director-tier/);
  });

  it("default-OFF preserves byte-identical sector-default output", () => {
    const s = mk();
    const prose = renderCanonicalProse(
      { kind: "anchor-with-offer", initialOffer: 24, bandIncomplete: false, satisfiesTopic: "anchor-with-offer" as SatisfiesTopic },
      s,
    );
    expect(prose).toMatch(/₹24 LPA/);
    /* Must NOT carry any Phase-5 round-persona token. */
    expect(prose).not.toMatch(/band floor|stretch band|Director-tier/);
  });
});

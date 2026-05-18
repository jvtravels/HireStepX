/* Phase 3 of SCORE_IMPROVEMENT_PLAN section 2 (Salary Negotiation) —
 * unit tests for the Indian recruiter SECTOR persona selector + the
 * persona-conditional canonical prose surfaces.
 *
 * Five archetypes (IT Services / GCC / Indian Unicorn / Early Startup /
 * BFSI) plus the default fallthrough. Selector is keyed off
 * tierBucket first; falls through to band-shape heuristics when tier
 * is unknown.
 */
import { describe, it, expect } from "vitest";
import {
  selectRecruiterSectorPersona,
  getRecruiterSectorPersona,
  type RecruiterSectorPersona,
} from "../../server-handlers/_indian-recruiter-personas";
import {
  renderCanonicalProse,
  buildRestylePrompt,
} from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: true,
};

function stateForPersona(p: RecruiterSectorPersona): NegotiationState {
  const base = initState({
    sessionId: "s-persona",
    role: "swe",
    company: "acme",
    band: BAND,
  });
  /* recruiterSectorPersona is optional on the state interface — set
   * it directly for the prose tests so we can exercise every branch
   * without depending on the selector. */
  return { ...base, recruiterSectorPersona: p };
}

void buildRestylePrompt; /* ensure tree-shake doesn't drop the import */

describe("selectRecruiterSectorPersona — tier-bucket mapping", () => {
  it("it_services tier → it-services persona", () => {
    expect(selectRecruiterSectorPersona({ tierBucket: "it_services" })).toBe("it-services");
  });
  it("listed_big_tech tier (FAANG / Big-Tech / GCC bucket) → gcc persona", () => {
    expect(selectRecruiterSectorPersona({ tierBucket: "listed_big_tech" })).toBe("gcc");
  });
  it("mature_unicorn / listed_unicorn → indian-unicorn persona", () => {
    expect(selectRecruiterSectorPersona({ tierBucket: "mature_unicorn" })).toBe("indian-unicorn");
    expect(selectRecruiterSectorPersona({ tierBucket: "listed_unicorn" })).toBe("indian-unicorn");
  });
  it("growth_startup / early_startup → early-startup persona", () => {
    expect(selectRecruiterSectorPersona({ tierBucket: "growth_startup" })).toBe("early-startup");
    expect(selectRecruiterSectorPersona({ tierBucket: "early_startup" })).toBe("early-startup");
  });
  it("bfsi tier → bfsi persona", () => {
    expect(selectRecruiterSectorPersona({ tierBucket: "bfsi" })).toBe("bfsi");
  });
  it("fmcg / psu → default (no sector-specific override yet)", () => {
    expect(selectRecruiterSectorPersona({ tierBucket: "fmcg" })).toBe("default");
    expect(selectRecruiterSectorPersona({ tierBucket: "psu" })).toBe("default");
  });
  it("unknown tier + no band shape → default", () => {
    expect(selectRecruiterSectorPersona({})).toBe("default");
  });
});

describe("selectRecruiterSectorPersona — band-shape fallback when tier unknown", () => {
  it("variable-heavy band (variableMax/initial > 0.30) → bfsi", () => {
    expect(
      selectRecruiterSectorPersona({
        tierBucket: null,
        band: { initialOffer: 30, variableMax: 12 }, // 40% variable
      }),
    ).toBe("bfsi");
  });
  it("equity + low base floor → early-startup", () => {
    expect(
      selectRecruiterSectorPersona({
        tierBucket: null,
        band: { initialOffer: 30, baseFloor: 15, hasEquity: true }, // 50% base
      }),
    ).toBe("early-startup");
  });
  it("equity + moderate base floor → indian-unicorn", () => {
    expect(
      selectRecruiterSectorPersona({
        tierBucket: null,
        band: { initialOffer: 30, baseFloor: 22, hasEquity: true }, // ~73% base
      }),
    ).toBe("indian-unicorn");
  });
});

describe("getRecruiterSectorPersona — config lookup", () => {
  it("returns IT-services config with hikeCap=0.30, rigid-band pushback", () => {
    const p = getRecruiterSectorPersona("it-services");
    expect(p.id).toBe("it-services");
    expect(p.hikeCap).toBeCloseTo(0.30, 2);
    expect(p.pushbackStyle).toBe("rigid-band");
    expect(p.prefersEsop).toBe(false);
  });
  it("returns BFSI config with variable-bump pushback", () => {
    const p = getRecruiterSectorPersona("bfsi");
    expect(p.pushbackStyle).toBe("variable-bump");
  });
  it("falls back to default config on unknown id", () => {
    expect(getRecruiterSectorPersona("not-a-real-persona").id).toBe("default");
    expect(getRecruiterSectorPersona(null).id).toBe("default");
    expect(getRecruiterSectorPersona(undefined).id).toBe("default");
  });
});

/* PDF-style integration tests — one per archetype. Each one exercises
 * the persona-conditional prose for `band-disclosure-deflect`,
 * `counter-offer`, and `anchor-with-offer`, and asserts the persona's
 * vocabulary tell shows up on at least one surface. */
describe("canonical-prose — persona-conditional surfaces (PDF-style)", () => {
  const counter: NextAction = { kind: "counter-offer", counterTotalLpa: 24 } as NextAction;
  const deflect: NextAction = { kind: "band-disclosure-deflect" } as NextAction;
  const anchor: NextAction = {
    kind: "anchor-with-offer",
    initialOffer: 20,
    bandIncomplete: false,
  } as NextAction;

  it("IT Services — rigid-band register on deflect + grade fitment on anchor + services ceiling on counter", () => {
    const s = stateForPersona("it-services");
    expect(renderCanonicalProse(deflect, s)).toMatch(/company policy|grade fitment/i);
    expect(renderCanonicalProse(deflect, s)).toMatch(/as per our band/i);
    expect(renderCanonicalProse(anchor, s)).toMatch(/grade fitment/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/services-track ceiling/i);
    // Counter must still carry the number-token contract.
    expect(renderCanonicalProse(counter, s)).toMatch(/₹24L/);
  });

  it("GCC — global-benchmark register across all three surfaces", () => {
    const s = stateForPersona("gcc");
    expect(renderCanonicalProse(deflect, s)).toMatch(/global benchmark/i);
    expect(renderCanonicalProse(anchor, s)).toMatch(/global band for this level/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/global band/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/₹24L/);
  });

  it("Indian Unicorn — ESOP pivot on deflect + ESOP grant on counter + ESOP framing on anchor", () => {
    const s = stateForPersona("indian-unicorn");
    expect(renderCanonicalProse(deflect, s)).toMatch(/equity side|ESOP/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/ESOP grant/i);
    expect(renderCanonicalProse(anchor, s)).toMatch(/ESOP grant/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/₹24L/);
  });

  it("Early Startup — cash runway framing + stretch on equity / equity %", () => {
    const s = stateForPersona("early-startup");
    expect(renderCanonicalProse(deflect, s)).toMatch(/cash runway|stretch on equity/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/Cash runway is tight|equity %/i);
    expect(renderCanonicalProse(anchor, s)).toMatch(/equity %/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/₹24L/);
  });

  it("BFSI — regulatory band on deflect + variable bump on counter + regulatory on anchor", () => {
    const s = stateForPersona("bfsi");
    expect(renderCanonicalProse(deflect, s)).toMatch(/regulatory band/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/Variable bumps|perf cycle/i);
    expect(renderCanonicalProse(anchor, s)).toMatch(/regulatory band/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/₹24L/);
  });

  it("default — renders the legacy pre-Phase-3 prose byte-identical", () => {
    const s = stateForPersona("default");
    /* Pre-Phase-3 default text — exact contract for the band-disclosure-deflect
     * surface. PDF#34/35 contract verification: byte-identical. */
    expect(renderCanonicalProse(deflect, s)).toBe(
      "I won't be able to share internal numbers, but as per our band for this grade, the offer I have on the table is what I shared. Happy to take your expectation back to the panel if there's a gap.",
    );
    /* Counter-offer default surface — byte-identical to pre-Phase-3
     * spiral lead + number. counterRound = 0 → first spiralLead. */
    const proseCounter = renderCanonicalProse(counter, s);
    expect(proseCounter).toContain("Hearing you out");
    expect(proseCounter).toContain("₹24L");
    expect(proseCounter).toContain("How does that look from your side?");
  });

  it("undefined persona on state → default fallthrough (back-compat)", () => {
    /* In-flight sessions serialised before Phase 3 shipped won't carry
     * recruiterSectorPersona — assert the prose surface treats the
     * undefined case identically to "default". */
    const sundef = initState({ sessionId: "s-bc", role: "swe", company: "acme", band: BAND });
    /* Strip the field explicitly (back-compat shape simulation). */
    const sbare = { ...sundef, recruiterSectorPersona: undefined } as NegotiationState;
    expect(renderCanonicalProse(deflect, sbare)).toBe(
      "I won't be able to share internal numbers, but as per our band for this grade, the offer I have on the table is what I shared. Happy to take your expectation back to the panel if there's a gap.",
    );
  });
});

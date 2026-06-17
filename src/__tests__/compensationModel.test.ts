import { describe, it, expect } from "vitest";
import {
  EMPTY_COMP,
  type CandidateComp,
  type CompObservation,
  applyObservation,
  applyObservations,
  observationsFromParsed,
  impliedTotal,
  reconciles,
} from "../../server-handlers/_compensation-model";

/**
 * Keystone unit tests for the scope-typed compensation model.
 *
 * The headline regression is the live-QA failure: a candidate who discloses
 * "48 total → 36 base → 12 variable → 48 total" must NEVER trip a
 * contradiction, because base/variable/total live on different axes and
 * reconcile. The old flat-scalar detector fired three false contradictions on
 * this exact sequence and stalled the session into a forced stalemate.
 */

const obs = (
  axis: CompObservation["axis"],
  value: number,
  turn: number,
  raw = "",
): CompObservation => ({ axis, value, turn, raw });

describe("compensation-model — cross-axis never contradicts", () => {
  it("the live-QA sequence (48 total → 36 base → 12 var → 48 total) fires NO contradiction", () => {
    let comp: CandidateComp = { ...EMPTY_COMP };
    const steps: Array<{ o: CompObservation; turn: number }> = [
      { o: obs("total", 48, 0, "current total CTC is 48 lakhs"), turn: 0 },
      { o: obs("fixed", 36, 1, "base is around 36"), turn: 1 },
      { o: obs("variable", 12, 2, "rest is 12 variable"), turn: 2 },
      { o: obs("total", 48, 3, "36 base + 12 variable = 48 total"), turn: 3 },
    ];
    for (const { o } of steps) {
      const res = applyObservation(comp, o);
      expect(res.contradiction, `axis=${o.axis} value=${o.value}`).toBeNull();
      comp = res.comp;
    }
    expect(comp.total?.value).toBe(48);
    expect(comp.fixed?.value).toBe(36);
    expect(comp.variable?.value).toBe(12);
    expect(reconciles(comp)).toBe(true);
  });

  it("a base figure does not overwrite the total slot", () => {
    let comp: CandidateComp = { ...EMPTY_COMP };
    comp = applyObservation(comp, obs("total", 48, 0)).comp;
    comp = applyObservation(comp, obs("fixed", 36, 1)).comp;
    expect(comp.total?.value).toBe(48);
    expect(comp.fixed?.value).toBe(36);
  });

  it("equity/variable below total never contradict", () => {
    let comp: CandidateComp = { ...EMPTY_COMP };
    comp = applyObservation(comp, obs("total", 50, 0)).comp;
    const a = applyObservation(comp, obs("equity", 6, 1));
    expect(a.contradiction).toBeNull();
    const b = applyObservation(a.comp, obs("variable", 8, 2));
    expect(b.contradiction).toBeNull();
  });
});

describe("compensation-model — same-axis genuinely contradicts", () => {
  it("total 48 → total 60 fires a contradiction on the total axis", () => {
    let comp: CandidateComp = { ...EMPTY_COMP };
    comp = applyObservation(comp, obs("total", 48, 0)).comp;
    const res = applyObservation(comp, obs("total", 60, 2));
    expect(res.contradiction).not.toBeNull();
    expect(res.contradiction?.axis).toBe("total");
    expect(res.contradiction?.oldValue).toBe(48);
    expect(res.contradiction?.newValue).toBe(60);
    expect(res.contradiction?.firstSeenTurn).toBe(0);
    // last value wins for forward reasoning
    expect(res.comp.total?.value).toBe(60);
  });

  it("fixed 36 → fixed 50 (same axis) contradicts", () => {
    let comp: CandidateComp = { ...EMPTY_COMP };
    comp = applyObservation(comp, obs("fixed", 36, 0)).comp;
    const res = applyObservation(comp, obs("fixed", 50, 2));
    expect(res.contradiction?.axis).toBe("fixed");
  });

  it("same-axis move WITHIN ±10% is a refinement, not a contradiction", () => {
    let comp: CandidateComp = { ...EMPTY_COMP };
    comp = applyObservation(comp, obs("total", 48, 0)).comp;
    const res = applyObservation(comp, obs("total", 50, 2)); // ~4% drift
    expect(res.contradiction).toBeNull();
    expect(res.comp.total?.value).toBe(50);
    expect(res.comp.total?.firstSeenTurn).toBe(0);
    expect(res.comp.total?.lastSeenTurn).toBe(2);
  });
});

describe("compensation-model — total demotion guard (leaked component)", () => {
  it("a 'total' echoing a known base is re-filed as fixed, not a new total", () => {
    let comp: CandidateComp = { ...EMPTY_COMP };
    comp = applyObservation(comp, obs("total", 48, 0)).comp;
    comp = applyObservation(comp, obs("fixed", 36, 1)).comp;
    // Upstream mis-parse leaks the base (36) onto the total axis next turn.
    const res = applyObservation(comp, obs("total", 36, 2));
    expect(res.contradiction).toBeNull(); // must NOT read 48→36 as a contradiction
    expect(res.comp.total?.value).toBe(48); // real total preserved
  });

  it("a genuinely larger total still registers (not demoted)", () => {
    let comp: CandidateComp = { ...EMPTY_COMP };
    comp = applyObservation(comp, obs("fixed", 36, 0)).comp;
    const res = applyObservation(comp, obs("total", 52, 1));
    expect(res.comp.total?.value).toBe(52);
  });
});

describe("compensation-model — batch ordering", () => {
  it("applyObservations sees components before total within one turn", () => {
    // All disclosed in a single utterance; total 36 would-be-leak is absorbed.
    const observations = [
      obs("total", 36, 3, "36 base + 12 variable = 48 total"),
      obs("fixed", 36, 3),
      obs("variable", 12, 3),
    ];
    // Seed a prior real total of 48.
    const comp: CandidateComp = applyObservation({ ...EMPTY_COMP }, obs("total", 48, 0)).comp;
    const res = applyObservations(comp, observations);
    expect(res.contradiction).toBeNull();
    expect(res.comp.total?.value).toBe(48);
    expect(res.comp.fixed?.value).toBe(36);
    expect(res.comp.variable?.value).toBe(12);
  });
});

describe("compensation-model — reconciliation", () => {
  it("impliedTotal needs the fixed leg", () => {
    expect(impliedTotal({ ...EMPTY_COMP })).toBeNull();
    let comp = applyObservation({ ...EMPTY_COMP }, obs("variable", 10, 0)).comp;
    expect(impliedTotal(comp)).toBeNull(); // variable alone → null
    comp = applyObservation(comp, obs("fixed", 30, 1)).comp;
    expect(impliedTotal(comp)).toBe(40);
  });

  it("reconciles is true when components sum near the total", () => {
    let comp = applyObservation({ ...EMPTY_COMP }, obs("total", 48, 0)).comp;
    comp = applyObservation(comp, obs("fixed", 36, 1)).comp;
    comp = applyObservation(comp, obs("variable", 12, 2)).comp;
    expect(reconciles(comp)).toBe(true);
  });

  it("reconciles is false when a single component exceeds the total", () => {
    let comp = applyObservation({ ...EMPTY_COMP }, obs("total", 30, 0)).comp;
    // fixed 45 > total 30 is impossible → does not reconcile
    comp = { ...comp, fixed: { value: 45, firstSeenTurn: 1, lastSeenTurn: 1, frame: "unknown", rawUtterance: "" } };
    expect(reconciles(comp)).toBe(false);
  });

  it("no total → vacuously reconciles", () => {
    const comp = applyObservation({ ...EMPTY_COMP }, obs("fixed", 36, 0)).comp;
    expect(reconciles(comp)).toBe(true);
  });
});

describe("compensation-model — observationsFromParsed adapter", () => {
  it("maps base/variable/equity to component axes and currentCtc to total", () => {
    const out = observationsFromParsed(
      { currentCtc: 48, componentBase: 36, componentVariable: 12, componentEquity: null },
      3,
      "utterance",
    );
    const byAxis = Object.fromEntries(out.map((o) => [o.axis, o.value]));
    expect(byAxis.total).toBe(48);
    expect(byAxis.fixed).toBe(36);
    expect(byAxis.variable).toBe(12);
    expect(byAxis.equity).toBeUndefined();
  });

  it("the parsed live sequence folds with no contradiction", () => {
    // turn 0: total only
    let comp: CandidateComp = applyObservations(
      { ...EMPTY_COMP },
      observationsFromParsed({ currentCtc: 48 }, 0, ""),
    ).comp;
    // turn 1: base disclosed (parser may also leak currentCtc=36)
    const r1 = applyObservations(
      comp,
      observationsFromParsed({ currentCtc: 36, componentBase: 36 }, 1, ""),
    );
    expect(r1.contradiction).toBeNull();
    comp = r1.comp;
    // turn 2: variable disclosed (parser leaks currentCtc=12)
    const r2 = applyObservations(
      comp,
      observationsFromParsed({ currentCtc: 12, componentVariable: 12 }, 2, ""),
    );
    expect(r2.contradiction).toBeNull();
    expect(r2.comp.total?.value).toBe(48);
    expect(r2.comp.fixed?.value).toBe(36);
    expect(r2.comp.variable?.value).toBe(12);
  });

  it("ignores non-finite values", () => {
    const out = observationsFromParsed(
      { currentCtc: NaN, componentBase: null, componentVariable: undefined },
      0,
      "",
    );
    expect(out).toEqual([]);
  });
});

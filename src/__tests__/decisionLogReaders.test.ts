/* Month 2 PR-5 (PDF #28) — decision-log telemetry readers unit tests.
 *
 * Locks the reader contracts the Month 3 replay harness depends on. */

import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  recentGuardrailFlags,
  countGuardrailFlag,
  lastFamilyEmitted,
  guardrailFlagSummary,
} from "../../server-handlers/_decision-log-readers";

const BAND: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 30,
  walkAway: 20,
  hasEquity: false,
};

function freshState(): NegotiationState {
  return initState({
    sessionId: "m2-pr5-readers",
    role: "Software Engineer",
    company: "JP Morgan",
    band: BAND,
  });
}

function seedLog(
  s: NegotiationState,
  entries: Array<{
    family?: "pressure-leverage" | "stall-tactic" | "anchor-set" | "discovery-probe";
    flags?: string[];
  }>,
): NegotiationState {
  s.decisionLog = entries.map((e, i) => ({
    turn: i,
    picker: "test-seed",
    rationale: "",
    phase: s.phase,
    family: e.family,
    guardrailFlags: e.flags,
  }));
  return s;
}

describe("recentGuardrailFlags", () => {
  it("returns [] for an empty decisionLog", () => {
    expect(recentGuardrailFlags(freshState())).toEqual([]);
  });

  it("returns [] when entries exist but none carry flags", () => {
    const s = seedLog(freshState(), [
      { family: "discovery-probe" },
      { family: "anchor-set" },
    ]);
    expect(recentGuardrailFlags(s)).toEqual([]);
  });

  it("returns flags from the last N entries in newest-first order", () => {
    const s = seedLog(freshState(), [
      { family: "pressure-leverage", flags: ["pressure-repeat"] },
      { family: "stall-tactic", flags: ["stall-cascade"] },
      { family: "anchor-set", flags: ["anchor-double-set"] },
    ]);
    expect(recentGuardrailFlags(s, 2)).toEqual([
      "anchor-double-set",
      "stall-cascade",
    ]);
  });

  it("respects n=0 by returning []", () => {
    const s = seedLog(freshState(), [
      { family: "pressure-leverage", flags: ["pressure-repeat"] },
    ]);
    expect(recentGuardrailFlags(s, 0)).toEqual([]);
  });

  it("handles n larger than log size gracefully", () => {
    const s = seedLog(freshState(), [
      { family: "pressure-leverage", flags: ["pressure-repeat"] },
    ]);
    expect(recentGuardrailFlags(s, 99)).toEqual(["pressure-repeat"]);
  });

  it("flattens multi-flag entries in newest-first order", () => {
    const s = seedLog(freshState(), [
      { family: "pressure-leverage", flags: ["pressure-repeat", "stall-cascade"] },
    ]);
    expect(recentGuardrailFlags(s, 1)).toEqual(["pressure-repeat", "stall-cascade"]);
  });
});

describe("countGuardrailFlag", () => {
  it("returns 0 on an empty log", () => {
    expect(countGuardrailFlag(freshState(), "pressure-repeat")).toBe(0);
  });

  it("counts occurrences across the full log", () => {
    const s = seedLog(freshState(), [
      { family: "pressure-leverage", flags: ["pressure-repeat"] },
      { family: "discovery-probe" },
      { family: "pressure-leverage", flags: ["pressure-repeat"] },
      { family: "stall-tactic", flags: ["stall-cascade"] },
    ]);
    expect(countGuardrailFlag(s, "pressure-repeat")).toBe(2);
    expect(countGuardrailFlag(s, "stall-cascade")).toBe(1);
    expect(countGuardrailFlag(s, "anchor-double-set")).toBe(0);
  });
});

describe("lastFamilyEmitted", () => {
  it("returns null for empty log", () => {
    expect(lastFamilyEmitted(freshState())).toBe(null);
  });

  it("returns the family of the most recent entry", () => {
    const s = seedLog(freshState(), [
      { family: "discovery-probe" },
      { family: "anchor-set" },
    ]);
    expect(lastFamilyEmitted(s)).toBe("anchor-set");
  });

  it("returns null when the last entry has no family stamp", () => {
    const s = freshState();
    s.decisionLog = [
      { turn: 0, picker: "legacy", rationale: "", phase: s.phase },
    ];
    expect(lastFamilyEmitted(s)).toBe(null);
  });
});

describe("guardrailFlagSummary", () => {
  it("returns {} on empty log", () => {
    expect(guardrailFlagSummary(freshState())).toEqual({});
  });

  it("aggregates flag counts across the session", () => {
    const s = seedLog(freshState(), [
      { family: "pressure-leverage", flags: ["pressure-repeat"] },
      { family: "stall-tactic", flags: ["stall-cascade"] },
      { family: "pressure-leverage", flags: ["pressure-repeat"] },
      { family: "anchor-set", flags: ["anchor-double-set", "pressure-repeat"] },
    ]);
    expect(guardrailFlagSummary(s)).toEqual({
      "pressure-repeat": 3,
      "stall-cascade": 1,
      "anchor-double-set": 1,
    });
  });

  it("omits flags that never fired", () => {
    const s = seedLog(freshState(), [
      { family: "pressure-leverage", flags: ["pressure-repeat"] },
    ]);
    const summary = guardrailFlagSummary(s);
    expect(summary["stall-cascade"]).toBeUndefined();
    expect("stall-cascade" in summary).toBe(false);
  });
});

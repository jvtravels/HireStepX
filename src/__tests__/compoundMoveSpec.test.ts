/* ARCH-C2b (2026-06-08) — CompoundMoveSpec hard-gate invariant tests.
 *
 * The compatibility matrix: hedge|defer + close-recap|commit-requiring
 * are the four forbidden pairs. Anything paired with "neutral" is
 * allowed. Constructor throws IncompatibleCompoundFrameError on a
 * forbidden pair — callers in _response-pipeline.ts catch and ship
 * the pivot alone (planner's escalation wins).
 */
import { describe, it, expect } from "vitest";
import {
  CompoundMoveSpec,
  IncompatibleCompoundFrameError,
  classifyPivotByAction,
  isCompoundCompatible,
} from "../../server-handlers/_compound-move-spec";
import type { NextAction } from "../../server-handlers/_next-action-planner";

describe("CompoundMoveSpec — constructor compatibility matrix", () => {
  /* Forbidden pairs: must throw on every one. */
  const forbidden = [
    ["hedge", "close-recap"],
    ["hedge", "commit-requiring"],
    ["defer", "close-recap"],
    ["defer", "commit-requiring"],
    ["defer", "terminal"],
    ["hedge", "terminal"],
  ] as const;
  for (const [a, p] of forbidden) {
    it(`throws on ${a} + ${p}`, () => {
      expect(
        () => new CompoundMoveSpec(a, p, "answer text", "pivot text"),
      ).toThrow(IncompatibleCompoundFrameError);
    });
  }

  /* Allowed pairs: any answer + neutral pivot, neutral answer + any pivot. */
  const allowed = [
    ["neutral", "neutral"],
    ["neutral", "close-recap"],
    ["neutral", "commit-requiring"],
    ["neutral", "terminal"],
    ["hedge", "neutral"],
    ["defer", "neutral"],
  ] as const;
  for (const [a, p] of allowed) {
    it(`accepts ${a} + ${p}`, () => {
      expect(
        () => new CompoundMoveSpec(a, p, "answer", "pivot"),
      ).not.toThrow();
    });
  }
});

describe("CompoundMoveSpec.render — join shape", () => {
  it("trims and forces terminal period on answer, joins with single space", () => {
    const c = new CompoundMoveSpec("neutral", "neutral", "  Hello world  ", "Pivot here.");
    expect(c.render()).toBe("Hello world. Pivot here.");
  });

  it("collapses trailing punctuation to single period (no double-period)", () => {
    const c = new CompoundMoveSpec("neutral", "neutral", "Already ends.", "Pivot.");
    expect(c.render()).toBe("Already ends. Pivot.");
  });

  it("returns trimmed answer when pivot is empty", () => {
    const c = new CompoundMoveSpec("neutral", "neutral", "Solo answer.", "");
    expect(c.render()).toBe("Solo answer.");
  });
});

describe("classifyPivotByAction — known kinds", () => {
  it("close-recap-formal → close-recap", () => {
    expect(
      classifyPivotByAction({ kind: "close-recap-formal" } as NextAction),
    ).toBe("close-recap");
  });

  it.each([
    "counter-offer",
    "anchor-with-offer",
    "band-anchor-with-rationale",
    "open-with-offer",
    "comparative-anchoring",
    "calibrated-surprise-lowball",
  ])("%s → commit-requiring", (kind) => {
    expect(classifyPivotByAction({ kind } as unknown as NextAction)).toBe(
      "commit-requiring",
    );
  });

  it("discovery-probe / info-disclosure / unknown → neutral", () => {
    for (const kind of ["discovery-probe", "info-disclosure", "panel-approval-stall"]) {
      expect(
        classifyPivotByAction({ kind } as unknown as NextAction),
      ).toBe("neutral");
    }
  });

  /* Terminal frames (2026-06-19) — a turn that ENDS the negotiation must
   * not carry a defer lead ("Coming back to the structure —"). */
  it("terminal-restate / polite-walkaway → terminal", () => {
    expect(classifyPivotByAction({ kind: "terminal-restate" } as NextAction)).toBe("terminal");
    expect(classifyPivotByAction({ kind: "polite-walkaway" } as NextAction)).toBe("terminal");
  });

  it("close → terminal for walkaway/stalemate, close-recap for accept", () => {
    expect(classifyPivotByAction({ kind: "close", mode: "walkaway" } as NextAction)).toBe("terminal");
    expect(classifyPivotByAction({ kind: "close", mode: "stalemate" } as NextAction)).toBe("terminal");
    expect(classifyPivotByAction({ kind: "close", mode: "accept" } as NextAction)).toBe("close-recap");
  });

  it("live-walk-away → terminal only on mode 'walk' (hold-firm/probe continue → neutral)", () => {
    expect(classifyPivotByAction({ kind: "live-walk-away", mode: "walk" } as NextAction)).toBe("terminal");
    expect(classifyPivotByAction({ kind: "live-walk-away", mode: "hold-firm" } as NextAction)).toBe("neutral");
    expect(classifyPivotByAction({ kind: "live-walk-away", mode: "probe" } as NextAction)).toBe("neutral");
  });
});

describe("isCompoundCompatible — pure introspection", () => {
  it("mirrors constructor on forbidden pairs", () => {
    expect(isCompoundCompatible("hedge", "close-recap")).toBe(false);
    expect(isCompoundCompatible("defer", "commit-requiring")).toBe(false);
  });
  it("mirrors constructor on allowed pairs", () => {
    expect(isCompoundCompatible("neutral", "commit-requiring")).toBe(true);
    expect(isCompoundCompatible("hedge", "neutral")).toBe(true);
  });
});

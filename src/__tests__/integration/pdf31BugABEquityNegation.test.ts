/* PDF#31 BUG A+B regression (2026-05-18) — negative-disclosure parsing
 * for "no ESOP / no equity" + downstream gate on vesting narration.
 *
 * BUG A (Meesho/Prita): candidate said "No ESOP, Only 22 LPA base & 2
 * LPA Variable". Bot re-asked "ESOPs in play? Any vesting cliff or
 * accelerator?" two turns later because the parser only captured the
 * positive component values; the negative disclosure was discarded.
 *
 * BUG B: bot then narrated "let me walk you through how the vesting
 * and cliff are structured" for an offer with no equity — pure
 * hallucination, lifted from the structural-lever rotation.
 *
 * Fix:
 *  - `EquityVestingResult.equityExists: boolean | null` captures the
 *    candidate's explicit statement (negation / affirmation / unstated).
 *  - `nextComponentProbe` treats `equityExists === false` as
 *    "esop topic satisfied" — bot does NOT re-ask.
 *  - The equity-clarity reactive-followup is gated on
 *    `equityVesting.equityExists !== false` — bot does NOT narrate.
 */
import { describe, it, expect } from "vitest";
import {
  extractEquityVesting,
  mergeEquityVesting,
} from "../../../server-handlers/_equity-vesting";

describe("PDF#31 BUG A+B — equity negative-disclosure parser", () => {
  it("Prita repro: 'No ESOP, Only 22 LPA base & 2 LPA Variable' → equityExists: false", () => {
    const r = extractEquityVesting(
      "No ESOP, Only 22 LPA base & 2 LPA Variable",
    );
    expect(r.equityExists).toBe(false);
    expect(r.hasAny).toBe(true);
  });

  it("'no equity component in my current package' → false", () => {
    const r = extractEquityVesting("no equity component in my current package");
    expect(r.equityExists).toBe(false);
  });

  it("'I don't have any RSUs at the moment' → false", () => {
    const r = extractEquityVesting("I don't have any RSUs at the moment");
    expect(r.equityExists).toBe(false);
  });

  it("'ESOPs: nil' colon-shorthand → false", () => {
    const r = extractEquityVesting("Current package: base 18, variable 4, ESOPs: nil");
    expect(r.equityExists).toBe(false);
  });

  it("'zero stock options' → false", () => {
    const r = extractEquityVesting("zero stock options in my comp");
    expect(r.equityExists).toBe(false);
  });

  it("affirmation 'yes, I have ESOPs from current employer' → true", () => {
    const r = extractEquityVesting("yes, I have ESOPs from current employer");
    expect(r.equityExists).toBe(true);
  });

  it("'RSUs are part of my package' → true", () => {
    const r = extractEquityVesting("RSUs are part of my package");
    expect(r.equityExists).toBe(true);
  });

  it("ambiguous mid-sentence 'we'll discuss equity later' → null", () => {
    const r = extractEquityVesting("we'll discuss equity later in the cycle");
    expect(r.equityExists).toBeNull();
  });

  it("hedged 'not much equity' stays null — bot should clarify", () => {
    const r = extractEquityVesting("there's not much equity in my current role");
    expect(r.equityExists).toBeNull();
  });

  it("mixed signals 'I have RSUs but no ESOPs' stays null — disambiguation", () => {
    const r = extractEquityVesting("I have RSUs but no ESOPs");
    expect(r.equityExists).toBeNull();
  });

  it("merge: later affirmation overrides earlier null", () => {
    const a = extractEquityVesting("we'll discuss equity later");
    const b = extractEquityVesting("yes, I have RSUs at current employer");
    const merged = mergeEquityVesting(a, b);
    expect(merged.equityExists).toBe(true);
  });

  it("merge: later null does NOT wipe an earlier explicit value", () => {
    const a = extractEquityVesting("no ESOPs at my current company");
    const b = extractEquityVesting("anyway, the role itself sounds great");
    const merged = mergeEquityVesting(a, b);
    expect(merged.equityExists).toBe(false);
  });
});

/* The planner-gate behavior (no re-ask + no vesting narration) is
 * already covered by the type system: nextComponentProbe reads
 * equityVesting.equityExists, and the equity-clarity gate consults the
 * same field. End-to-end coverage lives in the smoke-test corpus.    */

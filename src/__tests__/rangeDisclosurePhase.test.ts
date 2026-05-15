/* PDF #18 follow-up (2026-05-15) — range-disclosure phase rule.
 *
 * The bot must disclose a salary RANGE ("we're in the ₹18-22L band")
 * once after discovery completes and BEFORE converging to a specific
 * anchor. This test pins the predicate logic and the bracketed brief
 * line. */
import { describe, it, expect } from "vitest";
import {
  shouldDiscloseRange,
  buildRangeDisclosureBrief,
} from "../../server-handlers/_range-disclosure-phase";

describe("range-disclosure phase rule", () => {
  it("FIRES when discovery complete and nothing disclosed yet", () => {
    expect(
      shouldDiscloseRange({
        discoveryComplete: true,
        specificAnchorDisclosed: false,
        rangeAlreadyDisclosed: false,
      }),
    ).toBe(true);
  });

  it("does NOT fire while discovery is still incomplete", () => {
    expect(
      shouldDiscloseRange({
        discoveryComplete: false,
        specificAnchorDisclosed: false,
        rangeAlreadyDisclosed: false,
      }),
    ).toBe(false);
  });

  it("SUPPRESSED once a specific anchor has been disclosed", () => {
    /* After the first specific anchor, the conversation has progressed
     * to the negotiation phase — no more range talk. */
    expect(
      shouldDiscloseRange({
        discoveryComplete: true,
        specificAnchorDisclosed: true,
        rangeAlreadyDisclosed: false,
      }),
    ).toBe(false);
  });

  it("SUPPRESSED when the immediately-prior bot turn already disclosed a range", () => {
    /* Without this guard the bot would loop "₹18-22L … ₹18-22L …". */
    expect(
      shouldDiscloseRange({
        discoveryComplete: true,
        specificAnchorDisclosed: false,
        rangeAlreadyDisclosed: true,
      }),
    ).toBe(false);
  });

  it("buildRangeDisclosureBrief returns the bracketed PHASE RULE line", () => {
    const b = buildRangeDisclosureBrief({
      discoveryComplete: true,
      specificAnchorDisclosed: false,
      rangeAlreadyDisclosed: false,
    });
    expect(b).not.toBeNull();
    expect(b).toMatch(/^\[PHASE RULE: disclose RANGE not specific/);
    expect(b).toMatch(/X-Y/);
    expect(b).toContain("band");
  });

  it("buildRangeDisclosureBrief returns null when discovery incomplete", () => {
    expect(
      buildRangeDisclosureBrief({
        discoveryComplete: false,
        specificAnchorDisclosed: false,
        rangeAlreadyDisclosed: false,
      }),
    ).toBeNull();
  });

  it("buildRangeDisclosureBrief returns null when specific anchor already disclosed", () => {
    expect(
      buildRangeDisclosureBrief({
        discoveryComplete: true,
        specificAnchorDisclosed: true,
        rangeAlreadyDisclosed: false,
      }),
    ).toBeNull();
  });

  it("buildRangeDisclosureBrief returns null when the prior turn already disclosed a range (candidate-reaction turn)", () => {
    /* This is the "candidate has reacted; advance to negotiation"
     * leg — once the bot has put a range on the table, the next turn
     * should NOT re-emit the same directive. */
    expect(
      buildRangeDisclosureBrief({
        discoveryComplete: true,
        specificAnchorDisclosed: false,
        rangeAlreadyDisclosed: true,
      }),
    ).toBeNull();
  });
});

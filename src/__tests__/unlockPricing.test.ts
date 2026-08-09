import { describe, it, expect } from "vitest";
import {
  unlockPriceForMatch,
  UNLOCK_PRICE_STANDARD,
  UNLOCK_PRICE_STRONG,
  UNLOCK_STRONG_MATCH_THRESHOLD,
} from "../../server-handlers/_unlock-pricing";

describe("unlockPriceForMatch", () => {
  it("charges the standard price below the strong-match threshold", () => {
    expect(unlockPriceForMatch(0).amountPaise).toBe(UNLOCK_PRICE_STANDARD);
    expect(unlockPriceForMatch(59).amountPaise).toBe(UNLOCK_PRICE_STANDARD);
  });

  it("charges the strong-match price at and above the threshold", () => {
    expect(unlockPriceForMatch(UNLOCK_STRONG_MATCH_THRESHOLD).amountPaise).toBe(UNLOCK_PRICE_STRONG);
    expect(unlockPriceForMatch(100).amountPaise).toBe(UNLOCK_PRICE_STRONG);
  });

  it("matches the >= 60 strong-match convention from _requirement-match-helpers", () => {
    expect(UNLOCK_STRONG_MATCH_THRESHOLD).toBe(60);
  });

  it("returns a distinct label for strong matches", () => {
    expect(unlockPriceForMatch(80).label).not.toBe(unlockPriceForMatch(10).label);
  });
});

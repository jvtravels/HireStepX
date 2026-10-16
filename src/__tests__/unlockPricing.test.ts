import { describe, it, expect } from "vitest";
import {
  singleUnlockPrice,
  batchUnlockPrice,
  batchIndexForRank,
  unlockRateNote,
  UNLOCK_BUNDLE_SIZE,
  UNLOCK_BATCH_PRICE_PAISE,
  UNLOCK_SINGLE_PRICE_PAISE,
} from "../../server-handlers/_unlock-pricing";

describe("singleUnlockPrice", () => {
  it("charges the flat single-candidate price", () => {
    expect(singleUnlockPrice().amountPaise).toBe(UNLOCK_SINGLE_PRICE_PAISE);
  });
});

describe("batchUnlockPrice", () => {
  it("charges the flat batch price regardless of how many candidates fill it", () => {
    expect(batchUnlockPrice().amountPaise).toBe(UNLOCK_BATCH_PRICE_PAISE);
  });

  it("prices a batch below the single-unlock rate multiplied by the bundle size", () => {
    expect(batchUnlockPrice().amountPaise).toBeLessThan(singleUnlockPrice().amountPaise * UNLOCK_BUNDLE_SIZE);
  });

  it("prices a single unlock above the batch's effective per-candidate rate", () => {
    expect(singleUnlockPrice().amountPaise).toBeGreaterThan(UNLOCK_BATCH_PRICE_PAISE / UNLOCK_BUNDLE_SIZE);
  });
});

describe("batchIndexForRank", () => {
  it("groups the first UNLOCK_BUNDLE_SIZE ranks into batch 0", () => {
    expect(batchIndexForRank(0)).toBe(0);
    expect(batchIndexForRank(UNLOCK_BUNDLE_SIZE - 1)).toBe(0);
  });

  it("rolls over into the next batch once the bundle size is exceeded", () => {
    expect(batchIndexForRank(UNLOCK_BUNDLE_SIZE)).toBe(1);
    expect(batchIndexForRank(UNLOCK_BUNDLE_SIZE * 2 - 1)).toBe(1);
    expect(batchIndexForRank(UNLOCK_BUNDLE_SIZE * 2)).toBe(2);
  });
});

describe("unlockRateNote", () => {
  it("shows the per-head batch rate and the saving for a full batch", () => {
    const note = unlockRateNote(UNLOCK_BUNDLE_SIZE, UNLOCK_BATCH_PRICE_PAISE);
    expect(note.perCandidate).toBe("₹29.90");
    expect(note.savings).toBe("You save ₹291 against unlocking one at a time.");
    expect(note.batchHint).toBeNull();
  });

  it("prorates a partial batch", () => {
    const note = unlockRateNote(6, batchUnlockPrice(6).amountPaise);
    expect(note.perCandidate).toBe("₹29.90");
    expect(note.savings).toContain("₹174.60");
  });

  it("points a single unlock at the batch rate", () => {
    const note = unlockRateNote(1, UNLOCK_SINGLE_PRICE_PAISE);
    expect(note.perCandidate).toBe("₹59");
    expect(note.savings).toBeNull();
    expect(note.batchHint).toBe("Unlocking 10 at once costs ₹29.90 each.");
  });
});

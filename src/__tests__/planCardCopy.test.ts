import { describe, it, expect } from "vitest";
import { starterPackFootnote, planCtaLabel, planCtaTitle } from "../planCardCopy";

describe("starterPackFootnote", () => {
  it("never prints the pack size as availability", () => {
    // The bug being fixed: a spent pack advertising "5 sessions" above a buy CTA.
    for (const remaining of [0, 1, 3, 5]) {
      expect(starterPackFootnote(remaining)).not.toMatch(/\d+\s*sessions?/i);
    }
  });

  it("renders no footnote when the pack is spent — the red usage row + buy CTA already say it", () => {
    expect(starterPackFootnote(0)).toBe("");
  });

  it("treats a negative balance as spent (defensive) — still no footnote", () => {
    expect(starterPackFootnote(-1)).toBe("");
  });

  it("always returns empty — the card header and usage row tell the full story", () => {
    expect(starterPackFootnote(3)).toBe("");
    expect(starterPackFootnote(5)).toBe("");
  });
});

describe("planCtaLabel", () => {
  it("gives an exhausted Sprint Pack a buy CTA, never 'Upgrade to Pro'", () => {
    // A pack customer is not a Pro lead — and the modal it opens sells packs/credits.
    expect(planCtaLabel({ starterExhausted: true, freeExhausted: false, creditBalance: 0 }))
      .toBe("Buy more sessions");
    // Holding credits doesn't change the pack-out story.
    expect(planCtaLabel({ starterExhausted: true, freeExhausted: false, creditBalance: 4 }))
      .toBe("Buy more sessions");
  });

  it("keeps existing Free behaviour intact", () => {
    // Active free → see plans (modal shows Per Session + Sprint Pack, not Pro).
    expect(planCtaLabel({ starterExhausted: false, freeExhausted: false, creditBalance: 0 }))
      .toBe("See plans");
    // Exhausted free, no credits → unlock prompt.
    expect(planCtaLabel({ starterExhausted: false, freeExhausted: true, creditBalance: 0 }))
      .toBe("Unlock sessions now");
    // Exhausted free, with credits → buy more.
    expect(planCtaLabel({ starterExhausted: false, freeExhausted: true, creditBalance: 2 }))
      .toBe("Buy more sessions");
  });

  it("prefers the pack-out branch when a user is both flagged", () => {
    // Shouldn't happen in practice, but the exhausted-pack CTA must win over
    // any free-tier wording so the copy matches the pack modal.
    expect(planCtaLabel({ starterExhausted: true, freeExhausted: true, creditBalance: 0 }))
      .toBe("Buy more sessions");
  });
});

describe("planCtaTitle", () => {
  it("surfaces pricing in the tooltip for the see-plans CTA", () => {
    expect(planCtaTitle("See plans")).toMatch(/₹9/);
  });

  it("describes buying sessions for every buy CTA", () => {
    expect(planCtaTitle("Buy more sessions")).toBe("Buy more interview sessions");
    expect(planCtaTitle("Unlock sessions now")).toBe("Buy more interview sessions");
  });
});

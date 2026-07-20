/* Family G / B57 — the upgrade-nudge headline must never pitch an
 * impossible goal. At a perfect 100 the report used to say "Want to see if
 * you can beat it?", contradicting the 100/100 it just rendered. The copy
 * is now score-aware and session-count-aware. */
import { describe, it, expect } from "vitest";
import { upgradeNudgeCopy } from "../sessionReport/upgradeNudgeCopy";

describe("upgradeNudgeCopy — B57 score-aware headline", () => {
  it("perfect 100 drops the 'beat it' framing", () => {
    const c = upgradeNudgeCopy(100);
    expect(c.headline).not.toMatch(/beat it/i);
    expect(c.headline).toMatch(/perfect 100/i);
  });

  it("a non-perfect score >= 60 keeps the beat-it framing and shows the number", () => {
    const c = upgradeNudgeCopy(72);
    expect(c.headline).toBe("You scored 72. Want to see if you can beat it?");
  });

  it("99 still has a point to prove — beat-it framing stays", () => {
    expect(upgradeNudgeCopy(99).headline).toMatch(/beat it/i);
  });

  it("low score (< 60) uses improvement trajectory framing", () => {
    const c = upgradeNudgeCopy(45);
    expect(c.headline).toMatch(/45/);
    expect(c.headline).toMatch(/80\+/);
  });

  it("first session (priorSessionCount=0) uses '1 free session left' framing", () => {
    const c = upgradeNudgeCopy(68, 0);
    expect(c.headline).toMatch(/1 free session left/i);
    expect(c.subcopy).toMatch(/second session is still free/i);
  });

  it("first session at perfect 100 still shows '1 free session left' framing", () => {
    const c = upgradeNudgeCopy(100, 0);
    expect(c.headline).toMatch(/1 free session left/i);
  });

  it("second session and beyond shows upgrade framing", () => {
    const c = upgradeNudgeCopy(72, 1);
    expect(c.headline).toBe("You scored 72. Want to see if you can beat it?");
    expect(c.subcopy).toMatch(/Sprint Pack/);
  });

  it.each([
    [-5, 0],
    [0, 0],
    [72.4, 72],
    [72.6, 73],
    [140, 100],
  ])("clamps/rounds %p to a sane displayed score %p", (input, shown) => {
    const c = upgradeNudgeCopy(input);
    if (shown >= 100) {
      expect(c.headline).toMatch(/perfect 100/i);
    } else {
      expect(c.headline).toContain(`You scored ${shown}.`);
    }
  });

  it("a non-finite score degrades to 0, never NaN in the copy", () => {
    const c = upgradeNudgeCopy(Number.NaN);
    expect(c.headline).toContain("You scored 0.");
    expect(c.headline).not.toContain("NaN");
  });
});

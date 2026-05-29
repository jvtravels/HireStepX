import { describe, it, expect } from "vitest";
import { applyFallibilityOverlay } from "../../server-handlers/_recruiter-prose-realism";

const BASE = "So that's \u20B932L total for the offer.";

describe("applyFallibilityOverlay", () => {
  it("does not fire when warm, early-turn, and simple package", () => {
    /* Sample many sessions; none should produce a self-correction since
     * none of the cognitive-load gates are tripped. */
    for (let i = 0; i < 50; i++) {
      const out = applyFallibilityOverlay(BASE, {
        mood: "warm",
        turnIndex: 1,
        packageComplexity: 1,
        sessionId: `s-warm-${i}`,
      });
      expect(out).toBe(BASE);
    }
  });

  it("does not fire when text has no rupee figure", () => {
    const noRupee = "We're aligned on the role and trajectory.";
    const out = applyFallibilityOverlay(noRupee, {
      mood: "cooled",
      turnIndex: 12,
      packageComplexity: 5,
      sessionId: "s-no-rupee",
    });
    expect(out).toBe(noRupee);
  });

  it("fires deterministically for at least some seeds when conditions met", () => {
    /* With ~25% rate across 200 distinct sessionIds, we should observe
     * dozens of fires. Conditions: cooled mood. */
    let fires = 0;
    for (let i = 0; i < 200; i++) {
      const out = applyFallibilityOverlay(BASE, {
        mood: "cooled",
        turnIndex: 3,
        packageComplexity: 1,
        sessionId: `s-cool-${i}`,
      });
      if (out !== BASE) {
        fires++;
        /* The fired output should contain a self-correction marker. */
        expect(/wait|hold on|my bad|sorry/i.test(out)).toBe(true);
      }
    }
    expect(fires).toBeGreaterThanOrEqual(20);
    expect(fires).toBeLessThanOrEqual(80);
  });

  it("fires deterministically: same (sessionId, turnIndex) always produces same output", () => {
    const ctx = {
      mood: "cooled" as const,
      turnIndex: 5,
      packageComplexity: 4,
      sessionId: "s-determ-A",
    };
    const a = applyFallibilityOverlay(BASE, ctx);
    const b = applyFallibilityOverlay(BASE, ctx);
    expect(a).toBe(b);
  });

  it("is idempotent: running twice does not double-fire", () => {
    /* Find a sessionId that fires. */
    for (let i = 0; i < 200; i++) {
      const sessionId = `s-idem-${i}`;
      const ctx = {
        mood: "cooled" as const,
        turnIndex: 5,
        packageComplexity: 4,
        sessionId,
      };
      const once = applyFallibilityOverlay(BASE, ctx);
      if (once !== BASE) {
        const twice = applyFallibilityOverlay(once, ctx);
        expect(twice).toBe(once);
        return;
      }
    }
    throw new Error("no fallibility fire observed in 200 seeds — test invalid");
  });

  it("the corrected figure parses as a valid rupee amount", () => {
    for (let i = 0; i < 300; i++) {
      const out = applyFallibilityOverlay(BASE, {
        mood: "cooled",
        turnIndex: 5,
        packageComplexity: 4,
        sessionId: `s-parse-${i}`,
      });
      if (out === BASE) continue;
      /* Every rupee figure in the output must match ₹\d+(\.\d+)?L. */
      const matches = out.match(/\u20B9\d+(?:\.\d+)?L/g);
      expect(matches).not.toBeNull();
      for (const m of matches!) {
        expect(/^\u20B9\d+(?:\.\d+)?L$/.test(m)).toBe(true);
      }
    }
  });

  it("fires when turnIndex > 8 even on warm mood + simple package", () => {
    let fires = 0;
    for (let i = 0; i < 200; i++) {
      const out = applyFallibilityOverlay(BASE, {
        mood: "warm",
        turnIndex: 12,
        packageComplexity: 1,
        sessionId: `s-late-${i}`,
      });
      if (out !== BASE) fires++;
    }
    expect(fires).toBeGreaterThanOrEqual(15);
  });

  it("fires when packageComplexity >= 3 even on warm + early turn", () => {
    let fires = 0;
    for (let i = 0; i < 200; i++) {
      const out = applyFallibilityOverlay(BASE, {
        mood: "warm",
        turnIndex: 1,
        packageComplexity: 4,
        sessionId: `s-complex-${i}`,
      });
      if (out !== BASE) fires++;
    }
    expect(fires).toBeGreaterThanOrEqual(15);
  });
});

import { describe, it, expect } from "vitest";
import { humanizeRecruiterProse } from "../../server-handlers/_recruiter-prose-realism";

const BASE = "Our range for this band sits at 28 to 34 LPA, with the variable component capped at 18%.";

describe("humanizeRecruiterProse", () => {
  it("returns input byte-for-byte when sessionId is null (back-compat)", () => {
    const out = humanizeRecruiterProse(BASE, {
      sector: "consulting-big4",
      sessionId: null,
      turnIndex: 5,
    });
    expect(out).toBe(BASE);
  });

  it("is deterministic for a given (sessionId, turnIndex)", () => {
    const ctx = { sector: "gcc" as const, sessionId: "sess-A", turnIndex: 3 };
    expect(humanizeRecruiterProse(BASE, ctx)).toBe(humanizeRecruiterProse(BASE, ctx));
  });

  it("never alters the topical anchor (28-34 LPA, 18% variable stay intact)", () => {
    /* Sample 200 sessions; each humanized output must still contain the
     * numeric anchor. The realism layers add scaffolding, never overwrite
     * meaning. */
    for (let i = 0; i < 200; i++) {
      const out = humanizeRecruiterProse(BASE, {
        sector: "consulting-big4",
        sessionId: `s-${i}`,
        turnIndex: i % 7,
      });
      expect(out).toContain("28 to 34 LPA");
      expect(out).toContain("18%");
    }
  });

  it("most utterances ship unchanged (humanization is seasoning, not the meal)", () => {
    /* All three layers are probabilistic; the joint probability of NO
     * layer firing on a given utterance should be the dominant case so
     * the bank's voice still leads. */
    let unchanged = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const out = humanizeRecruiterProse(BASE, {
        sector: "gcc",
        sessionId: `s-${i}`,
        turnIndex: 4,
      });
      if (out === BASE) unchanged++;
    }
    const rate = unchanged / N;
    /* With p(tic)=0.22, p(hedge)=0.18, p(checkback)=0.22 (40-word floor
     * means short prose never gets a checkback — BASE is ~19 words so
     * checkback layer never fires), the no-fire probability is
     * roughly (1-0.22) * (1-0.18) ≈ 0.64. Allow a wide band. */
    expect(rate).toBeGreaterThan(0.45);
    expect(rate).toBeLessThan(0.85);
  });

  it("uses sector-appropriate tics (consulting-big4 leans on Fundamentally / Look)", () => {
    let bigFourTicHit = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const out = humanizeRecruiterProse(BASE, {
        sector: "consulting-big4",
        sessionId: `s-${i}`,
        turnIndex: 1,
      });
      if (/^(Fundamentally|At the end of the day|Look),/.test(out)) bigFourTicHit++;
    }
    /* Tic fires ~22% of the time per the layer rate. */
    const rate = bigFourTicHit / N;
    expect(rate).toBeGreaterThan(0.12);
    expect(rate).toBeLessThan(0.32);
  });

  it("appends a checkback to long prose at ~22%", () => {
    const longProse =
      "Our range for this band sits at 28 to 34 LPA, with the variable component capped at 18%. " +
      "We anchor against market data refreshed quarterly, the role's grade pay, and the team's " +
      "current comp distribution, and we don't move outside that envelope without a strong case.";
    let checkbackHit = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const out = humanizeRecruiterProse(longProse, {
        sector: "gcc",
        sessionId: `s-${i}`,
        turnIndex: 2,
      });
      if (/(Does that make sense\?|You with me\?|Right\?)$/.test(out)) checkbackHit++;
    }
    const rate = checkbackHit / N;
    expect(rate).toBeGreaterThan(0.12);
    expect(rate).toBeLessThan(0.32);
  });

  it("does NOT append a checkback to short prose (< 40 words)", () => {
    const shortProse = "We move on grade pay only.";
    for (let i = 0; i < 200; i++) {
      const out = humanizeRecruiterProse(shortProse, {
        sector: "psu",
        sessionId: `s-${i}`,
        turnIndex: 1,
      });
      expect(out).not.toMatch(/(Does that make sense\?|You with me\?|Right\?)$/);
    }
  });

  it("returns empty input unchanged", () => {
    expect(humanizeRecruiterProse("", { sessionId: "x", turnIndex: 1 })).toBe("");
  });
});

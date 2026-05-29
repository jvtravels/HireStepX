import { describe, it, expect } from "vitest";
import {
  classifyCandidateRegister,
  classifyFromLog,
} from "../../server-handlers/_candidate-register";
import { humanizeRecruiterProse } from "../../server-handlers/_recruiter-prose-realism";

describe("classifyCandidateRegister", () => {
  it("returns neutral for empty input", () => {
    expect(classifyCandidateRegister([])).toBe("neutral");
  });

  it("returns neutral when signal is too thin (≤1 hit)", () => {
    /* One casual hit isn't enough to commit; threshold is ≥2. */
    expect(classifyCandidateRegister(["yeah ok"])).toBe("neutral");
  });

  it("classifies a formal candidate (PSU-style phrasing)", () => {
    const utterances = [
      "Respectfully sir, I would like to know the budget for this role.",
      "Kindly share the structuring details at your convenience.",
      "May I please request the timeline for the offer letter?",
    ];
    expect(classifyCandidateRegister(utterances)).toBe("formal");
  });

  it("classifies a casual candidate (startup-IC phrasing)", () => {
    const utterances = [
      "Yeah let's hop on a call tbh",
      "Cool, no worries on the timeline",
      "Got it, that's totally fine",
    ];
    expect(classifyCandidateRegister(utterances)).toBe("casual");
  });

  it("classifies a direct candidate (terse + imperative)", () => {
    const utterances = [
      "Just tell me the number.",
      "What's the base?",
      "Don't dance around it.",
    ];
    expect(classifyCandidateRegister(utterances)).toBe("direct");
  });

  it("breaks ties with neutral", () => {
    /* Equal formal and casual signal across 4 utterances → tie → neutral. */
    const utterances = [
      "Respectfully share the offer letter sir.",  // formal +1
      "Kindly let me know the timeline.",  // formal +1
      "Yeah totally cool with that btw.",  // casual +1
      "No worries, gotcha on the plan.",  // casual +1
    ];
    expect(classifyCandidateRegister(utterances)).toBe("neutral");
  });

  it("honours the last-N window (default 5)", () => {
    /* 6 utterances where the first 3 are formal, last 3 are casual.
     * Window of 5 should drop the oldest and tilt toward casual. */
    const utterances = [
      "Kindly share the budget sir.",  // dropped
      "I would like to know the structure.",
      "Respectfully request the timeline.",
      "Yeah no worries on the call",
      "tbh I'm fine with either option",
      "cool, totally works for me",
    ];
    /* Window = last 5 = [I-would-like, respectfully, yeah, tbh, cool]
     * formal hits: 2 ("I would like", "respectfully")
     * casual hits: 3 ("no worries"/"yeah", "tbh", "cool"/"totally")
     * → casual wins. */
    expect(classifyCandidateRegister(utterances)).toBe("casual");
  });
});

describe("classifyFromLog", () => {
  it("returns neutral for an empty / missing log", () => {
    expect(classifyFromLog([])).toBe("neutral");
    expect(classifyFromLog(undefined)).toBe("neutral");
  });

  it("ignores AI speaker entries", () => {
    /* Only candidate utterances feed the classifier; AI prose can't
     * pollute it. */
    const log = [
      { speaker: "ai", text: "Yeah sure, totally happy to share btw" },
      { speaker: "candidate", text: "Kindly share the budget, sir." },
      { speaker: "ai", text: "Yeah no worries, lol" },
      { speaker: "candidate", text: "I would like to request the offer letter." },
      { speaker: "candidate", text: "Respectfully, may I know the timeline?" },
    ];
    expect(classifyFromLog(log)).toBe("formal");
  });
});

describe("humanizeRecruiterProse — register-conditioned probabilities", () => {
  const LONG_PROSE =
    "Our range for this band sits at 28 to 34 LPA, with the variable component capped at 18%. " +
    "We anchor against market data refreshed quarterly, the role's grade pay, and the team's " +
    "current comp distribution, and we don't move outside that envelope without a strong case.";

  it("fires tics LESS often for direct candidates", () => {
    let directHits = 0;
    let neutralHits = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      const direct = humanizeRecruiterProse(LONG_PROSE, {
        sector: "consulting-big4",
        sessionId: `s-${i}`,
        turnIndex: 1,
        candidateRegister: "direct",
      });
      const neutral = humanizeRecruiterProse(LONG_PROSE, {
        sector: "consulting-big4",
        sessionId: `s-${i}`,
        turnIndex: 1,
        candidateRegister: "neutral",
      });
      if (/^(Fundamentally|At the end of the day|Look),/.test(direct)) directHits++;
      if (/^(Fundamentally|At the end of the day|Look),/.test(neutral)) neutralHits++;
    }
    /* direct rate is 8%, neutral rate is 22% → direct should be
     * meaningfully lower. Use a wide band to avoid flakiness. */
    expect(directHits).toBeLessThan(neutralHits);
    expect(directHits / N).toBeLessThan(0.16);
    expect(neutralHits / N).toBeGreaterThan(0.14);
  });

  it("never emits a 'Yeah' tic for formal candidates (it-services sector)", () => {
    /* it-services tics include "Yeah so" — the formal-register filter
     * should drop it so the recruiter doesn't sound mismatched. */
    for (let i = 0; i < 300; i++) {
      const out = humanizeRecruiterProse(LONG_PROSE, {
        sector: "it-services",
        sessionId: `s-${i}`,
        turnIndex: 1,
        candidateRegister: "formal",
      });
      expect(out).not.toMatch(/^Yeah\s+so,/);
      expect(out).not.toMatch(/^Yeah,/);
    }
  });

  it("preserves back-compat for null/undefined candidateRegister (neutral default)", () => {
    /* No candidateRegister field → defaults to neutral → standard rates. */
    const ctx = {
      sector: "gcc" as const,
      sessionId: "sess-back-compat",
      turnIndex: 3,
    };
    const a = humanizeRecruiterProse(LONG_PROSE, ctx);
    const b = humanizeRecruiterProse(LONG_PROSE, { ...ctx, candidateRegister: "neutral" });
    expect(a).toBe(b);
  });
});

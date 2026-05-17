import { describe, it, expect } from "vitest";
import {
  BEHAVIORAL_PROBES,
  PROBE_TEXTS,
  cueFromEngineHints,
  pickBehavioralProbe,
  probePromptFragment,
  shouldSuppressCue,
} from "../../server-handlers/_behavioral-followup-bank";

describe("BEHAVIORAL_PROBES — shape", () => {
  it("exposes the canonical probe set", () => {
    // Originally ~15; grew as Lift-A signals + competency deepeners were
    // added. Bounds are a soft guardrail against runaway growth — bump
    // intentionally when a new cue lands with its own probe row(s).
    expect(BEHAVIORAL_PROBES.length).toBeGreaterThanOrEqual(20);
    expect(BEHAVIORAL_PROBES.length).toBeLessThanOrEqual(40);
  });

  it("every probe has cue + text + intent", () => {
    for (const p of BEHAVIORAL_PROBES) {
      expect(p.cue).toBeTruthy();
      expect(p.text.length).toBeGreaterThan(3);
      expect(p.intent.length).toBeGreaterThan(10);
    }
  });

  it("PROBE_TEXTS mirrors BEHAVIORAL_PROBES", () => {
    expect(PROBE_TEXTS).toHaveLength(BEHAVIORAL_PROBES.length);
    expect(PROBE_TEXTS[0]).toBe(BEHAVIORAL_PROBES[0].text);
  });
});

describe("cueFromEngineHints", () => {
  it("routes disagreement/conflict questions to conflict.disagreement BEFORE STAR gaps", () => {
    expect(
      cueFromEngineHints({
        starGap: "action",
        questionText: "Tell me about a time you had to disagree with your manager.",
      })
    ).toBe("conflict.disagreement");
  });

  it("matches 'pushed back' phrasing for conflict cue", () => {
    expect(
      cueFromEngineHints({ questionText: "Tell me about a time a peer pushed back on your design." })
    ).toBe("conflict.disagreement");
  });

  it("returns we-heavy when weHeavy is set (and no conflict)", () => {
    expect(cueFromEngineHints({ weHeavy: true, starGap: "action" })).toBe("we-heavy");
  });

  it("maps starGap=action → star.action", () => {
    expect(cueFromEngineHints({ starGap: "action" })).toBe("star.action");
  });

  it("maps starGap=result → star.result", () => {
    expect(cueFromEngineHints({ starGap: "result" })).toBe("star.result");
  });

  it("maps starGap=situation-task → star.situation-task", () => {
    expect(cueFromEngineHints({ starGap: "situation-task" })).toBe("star.situation-task");
  });

  it("returns null when no signal warrants a deterministic probe", () => {
    expect(cueFromEngineHints({})).toBeNull();
  });

  /* Competency deepeners for adaptability + execution-rigor — added
     alongside the taxonomy split in 2026-05. Same precedence band as
     conflict: when the question is on-topic, the competency probe wins
     over the generic STAR gap. */
  describe("adaptability + execution-rigor routing", () => {
    it("routes 'adapt to a major change' questions to adaptability.what-changed before STAR", () => {
      expect(
        cueFromEngineHints({
          starGap: "action",
          questionText: "Tell me about a time you had to adapt to a major change at work.",
        })
      ).toBe("adaptability.what-changed");
    });

    it("routes 'learn a new tool quickly' questions to adaptability.what-changed", () => {
      expect(
        cueFromEngineHints({
          questionText: "Tell me about a time you had to learn a new skill or tool quickly to ship something.",
        })
      ).toBe("adaptability.what-changed");
    });

    it("routes 'switch context' questions to adaptability.what-changed", () => {
      expect(
        cueFromEngineHints({
          questionText: "Tell me about a time you had to switch context between very different problems in a single day.",
        })
      ).toBe("adaptability.what-changed");
    });

    it("routes 'caught a bug in your own work' to execution-rigor.where-missed", () => {
      expect(
        cueFromEngineHints({
          starGap: "result",
          questionText: "Tell me about a time you caught a bug or issue in your own work before it shipped.",
        })
      ).toBe("execution-rigor.where-missed");
    });

    it("routes 'missed detail came back to bite' to execution-rigor.where-missed", () => {
      expect(
        cueFromEngineHints({
          questionText: "Tell me about a time a missed detail came back to bite you.",
        })
      ).toBe("execution-rigor.where-missed");
    });

    it("routes 'traded thoroughness for speed' to execution-rigor.where-missed", () => {
      expect(
        cueFromEngineHints({
          questionText: "Tell me about a time you traded thoroughness for speed and had to defend the call later.",
        })
      ).toBe("execution-rigor.where-missed");
    });

    it("defensiveness on failure question still wins over competency routing", () => {
      // Failure-question + deflection is the most-disqualifying signal —
      // even if some other competency keyword is present, own-it fires first.
      expect(
        cueFromEngineHints({
          defensiveness: true,
          questionText: "Tell me about a mistake you made adapting to a new process.",
        })
      ).toBe("defensiveness.own-it");
    });
  });
});

describe("pickBehavioralProbe — new competency cues", () => {
  it("returns an adaptability probe for adaptability.what-changed", () => {
    const p = pickBehavioralProbe({ cue: "adaptability.what-changed" });
    expect(p?.text).toMatch(/change.*how you worked/i);
  });

  it("returns an execution-rigor probe for execution-rigor.where-missed", () => {
    const p = pickBehavioralProbe({ cue: "execution-rigor.where-missed" });
    expect(p?.text).toMatch(/detail slip/i);
  });

  it("each new cue has exactly one canonical phrasing in the bank", () => {
    const newCues = [
      "adaptability.what-changed",
      "adaptability.learning-speed",
      "adaptability.tradeoff",
      "execution-rigor.where-missed",
      "execution-rigor.process-change",
      "execution-rigor.tradeoff-defense",
    ] as const;
    for (const c of newCues) {
      const p = pickBehavioralProbe({ cue: c });
      expect(p, `missing probe for ${c}`).not.toBeNull();
    }
  });
});

describe("pickBehavioralProbe", () => {
  it("returns a probe matching the requested cue", () => {
    const p = pickBehavioralProbe({ cue: "star.result" });
    expect(p).not.toBeNull();
    expect(p!.cue).toBe("star.result");
  });

  it("skips an already-asked phrasing (case + whitespace insensitive)", () => {
    const first = pickBehavioralProbe({ cue: "star.action" });
    const second = pickBehavioralProbe({
      cue: "star.action",
      alreadyAsked: [first!.text.toUpperCase() + "   "],
    });
    expect(second).not.toBeNull();
    expect(second!.text).not.toBe(first!.text);
  });

  it("returns a non-null probe for each new pushback + emotion cue", () => {
    const newCues = [
      "pushback.alternative",
      "pushback.risk",
      "pushback.assumption",
      "pushback.if-wrong",
      "emotion.feel",
      "emotion.hardest",
      "emotion.regret",
    ] as const;
    for (const cue of newCues) {
      const p = pickBehavioralProbe({ cue });
      expect(p, `cue=${cue}`).not.toBeNull();
      expect(p!.cue).toBe(cue);
    }
  });

  it("rotates between both variants of pushback.alternative across two picks", () => {
    const first = pickBehavioralProbe({ cue: "pushback.alternative" });
    expect(first).not.toBeNull();
    const second = pickBehavioralProbe({
      cue: "pushback.alternative",
      alreadyAsked: [first!.text],
    });
    expect(second).not.toBeNull();
    expect(second!.text).not.toBe(first!.text);
    expect(second!.cue).toBe("pushback.alternative");
  });

  it("falls back to the first candidate if all phrasings are exhausted", () => {
    const cue = "star.action" as const;
    const all = BEHAVIORAL_PROBES.filter(p => p.cue === cue).map(p => p.text);
    const picked = pickBehavioralProbe({ cue, alreadyAsked: all });
    expect(picked).not.toBeNull();
    expect(all).toContain(picked!.text);
  });
});

describe("cueFromEngineHints — Lift A signals", () => {
  it("defensiveness + failure question → defensiveness.own-it (highest precedence)", () => {
    expect(
      cueFromEngineHints({
        questionText: "Tell me about a mistake you made.",
        defensiveness: true,
        starGap: "action",
        weHeavy: true,
      }),
    ).toBe("defensiveness.own-it");
  });

  it("defensiveness WITHOUT a failure question does NOT fire defensiveness.own-it", () => {
    // No failure-shaped question → defensiveness shouldn't even be set
    // upstream, but if it is, the cue must not fire.
    expect(
      cueFromEngineHints({
        questionText: "Tell me about a successful project.",
        defensiveness: true,
        starGap: "action",
      }),
    ).toBe("star.action");
  });

  it("crispness === 'thin' → crispness.too-thin (beats weHeavy / starGap)", () => {
    expect(
      cueFromEngineHints({ crispness: "thin", weHeavy: true, starGap: "action" }),
    ).toBe("crispness.too-thin");
  });

  it("crispness === 'ok' does NOT mask weHeavy", () => {
    expect(cueFromEngineHints({ crispness: "ok", weHeavy: true })).toBe("we-heavy");
  });

  it("vagueness fires only when neither weHeavy nor starGap is set", () => {
    expect(cueFromEngineHints({ vagueness: true })).toBe("vagueness.quantify");
    // suppressed by weHeavy
    expect(cueFromEngineHints({ vagueness: true, weHeavy: true })).toBe("we-heavy");
    // suppressed by starGap
    expect(cueFromEngineHints({ vagueness: true, starGap: "result" })).toBe("star.result");
  });

  it("conflict question beats defensiveness when there's no failure framing", () => {
    expect(
      cueFromEngineHints({
        questionText: "Tell me about a time you had to disagree with your manager.",
        defensiveness: true,
      }),
    ).toBe("conflict.disagreement");
  });
});

describe("shouldSuppressCue — self-awareness suppression", () => {
  it("suppresses closer.would-do-differently when selfAwarenessShown is true", () => {
    expect(
      shouldSuppressCue("closer.would-do-differently", { selfAwarenessShown: true }),
    ).toBe(true);
  });

  it("does NOT suppress closer.would-do-differently when selfAwarenessShown is false", () => {
    expect(
      shouldSuppressCue("closer.would-do-differently", { selfAwarenessShown: false }),
    ).toBe(false);
    expect(shouldSuppressCue("closer.would-do-differently", {})).toBe(false);
  });

  it("does NOT suppress other cues when selfAwarenessShown is true", () => {
    expect(shouldSuppressCue("star.action", { selfAwarenessShown: true })).toBe(false);
    expect(shouldSuppressCue("closer.learning", { selfAwarenessShown: true })).toBe(false);
    expect(shouldSuppressCue("we-heavy", { selfAwarenessShown: true })).toBe(false);
  });
});

describe("BEHAVIORAL_PROBES — Lift A entries", () => {
  it("has a probe for each Lift A cue", () => {
    const cues = new Set(BEHAVIORAL_PROBES.map(p => p.cue));
    expect(cues.has("defensiveness.own-it")).toBe(true);
    expect(cues.has("crispness.too-thin")).toBe(true);
    expect(cues.has("vagueness.quantify")).toBe(true);
  });

  it("pickBehavioralProbe returns text for each Lift A cue", () => {
    const own = pickBehavioralProbe({ cue: "defensiveness.own-it" });
    expect(own!.text.toLowerCase()).toContain("own");
    const thin = pickBehavioralProbe({ cue: "crispness.too-thin" });
    expect(thin!.text.toLowerCase()).toContain("set the scene");
    const vague = pickBehavioralProbe({ cue: "vagueness.quantify" });
    expect(vague!.text.toLowerCase()).toContain("numbers");
  });
});

describe("probePromptFragment", () => {
  it("includes the probe text and intent in the fragment", () => {
    const probe = BEHAVIORAL_PROBES[0];
    const fragment = probePromptFragment(probe);
    expect(fragment).toContain(probe.text);
    expect(fragment).toContain(probe.intent);
    expect(fragment.toLowerCase()).toContain("preferred phrasing");
  });
});

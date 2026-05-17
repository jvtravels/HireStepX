import { describe, it, expect } from "vitest";
import {
  BEHAVIORAL_PROBES,
  PROBE_TEXTS,
  cueFromEngineHints,
  pickBehavioralProbe,
  probePromptFragment,
} from "../../server-handlers/_behavioral-followup-bank";

describe("BEHAVIORAL_PROBES — shape", () => {
  it("exposes ~15 canonical probes", () => {
    // Bank is intentionally ~15; allow a small range so adding a variant
    // doesn't break the suite, but catches runaway growth.
    expect(BEHAVIORAL_PROBES.length).toBeGreaterThanOrEqual(12);
    expect(BEHAVIORAL_PROBES.length).toBeLessThanOrEqual(20);
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

  it("falls back to the first candidate if all phrasings are exhausted", () => {
    const cue = "star.action" as const;
    const all = BEHAVIORAL_PROBES.filter(p => p.cue === cue).map(p => p.text);
    const picked = pickBehavioralProbe({ cue, alreadyAsked: all });
    expect(picked).not.toBeNull();
    expect(all).toContain(picked!.text);
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

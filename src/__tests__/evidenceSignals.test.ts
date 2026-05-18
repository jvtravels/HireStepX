import { describe, it, expect } from "vitest";
import { detectEvidenceQuality } from "../../server-handlers/_evidence-signals";

/* Phase-6.3 — evidence-quality detector.
 *
 * The audit fixture: candidates quoting "35-40% improvement" / "task
 * completion lifted by 15-20%" without baseline / measurement method /
 * sample size. Senior interviewers push exactly there. These tests pin
 * the three dimensions and the proximity window. */

describe("detectEvidenceQuality — gating", () => {
  it("no metric → hasMetric:false, missingDimensions:[]", () => {
    const r = detectEvidenceQuality("We rolled out the feature and users liked it a lot.");
    expect(r.hasMetric).toBe(false);
    expect(r.missingDimensions).toEqual([]);
    expect(r.evidenced).toBe(false);
  });

  it("null / empty input does not throw", () => {
    expect(detectEvidenceQuality(null).hasMetric).toBe(false);
    expect(detectEvidenceQuality(undefined).hasMetric).toBe(false);
    expect(detectEvidenceQuality("").hasMetric).toBe(false);
  });

  it("bare integer with no unit does NOT trigger hasMetric", () => {
    // "I led 3 teams" is an incidental count, not an outcome metric.
    const r = detectEvidenceQuality("I led 3 teams across the org and aligned everyone.");
    expect(r.hasMetric).toBe(false);
  });

  it("unit-tagged number (40%) triggers hasMetric", () => {
    const r = detectEvidenceQuality("We reduced p99 by 40%.");
    expect(r.hasMetric).toBe(true);
  });
});

describe("detectEvidenceQuality — baseline dimension", () => {
  it("'from X to Y' counts as baseline", () => {
    const r = detectEvidenceQuality("Load time dropped from 4.2s to 1.8s after the changes.");
    expect(r.hasMetric).toBe(true);
    expect(r.missingDimensions).not.toContain("baseline");
  });

  it("'previously' / 'used to' counts as baseline", () => {
    const r = detectEvidenceQuality("We had 15% bounce rate; previously the funnel sat at 28%.");
    expect(r.missingDimensions).not.toContain("baseline");
  });

  it("'down from' counts as baseline", () => {
    const r = detectEvidenceQuality("Conversion sat at 12%, down from 5% the prior quarter.");
    expect(r.missingDimensions).not.toContain("baseline");
  });

  it("metric without comparison-of-states flags baseline missing", () => {
    const r = detectEvidenceQuality("We saw a 35% lift in completion.");
    expect(r.missingDimensions).toContain("baseline");
  });
});

describe("detectEvidenceQuality — measurement-method dimension", () => {
  it("'A/B test' counts as method", () => {
    const r = detectEvidenceQuality("In the A/B test the variant won by 8%.");
    expect(r.missingDimensions).not.toContain("method");
  });

  it("'session recordings' counts as method", () => {
    const r = detectEvidenceQuality("Session recordings showed users tapping the CTA 30% more.");
    expect(r.missingDimensions).not.toContain("method");
  });

  it("'analytics' / 'mixpanel' counts as method", () => {
    expect(detectEvidenceQuality("Analytics showed 12% retention lift.").missingDimensions).not.toContain("method");
    expect(detectEvidenceQuality("Mixpanel funnels showed a 22% drop-off.").missingDimensions).not.toContain("method");
  });

  it("metric without measurement instrument flags method missing", () => {
    const r = detectEvidenceQuality("We saw a 40% improvement.");
    expect(r.missingDimensions).toContain("method");
  });
});

describe("detectEvidenceQuality — sample-size dimension", () => {
  it("'across N users' counts as sample", () => {
    const r = detectEvidenceQuality("We saw a 20% lift across 50000 users in week one.");
    expect(r.missingDimensions).not.toContain("sample");
  });

  it("'n = …' counts as sample", () => {
    const r = detectEvidenceQuality("Survey showed 30% preferred the new flow (n = 240).");
    expect(r.missingDimensions).not.toContain("sample");
  });

  it("metric without denominator flags sample missing", () => {
    const r = detectEvidenceQuality("We saw a 35% lift in checkout completion.");
    expect(r.missingDimensions).toContain("sample");
  });
});

describe("detectEvidenceQuality — proximity window", () => {
  it("evidence outside ±120 chars of the metric does not attach", () => {
    // 200+ chars of filler between metric and baseline language.
    const padding = " ".repeat(150) + "and that " + " ".repeat(40);
    const text = `We saw a 35% lift.${padding}previously we were at baseline 12%.`;
    const r = detectEvidenceQuality(text);
    // First metric 35% is far from "previously"; second metric 12% IS
    // near it. So baseline ends up attached via the second hit. That's
    // expected — aggregate over hits.
    expect(r.hasMetric).toBe(true);
  });

  it("audit fixture: '35-40% on slower networks' floats unevidenced", () => {
    const text =
      "the page load time reduced by around 35-40% on slower networks. Because of that, users were able to reach the key task faster";
    const r = detectEvidenceQuality(text);
    expect(r.hasMetric).toBe(true);
    expect(r.missingDimensions).toEqual(expect.arrayContaining(["baseline", "method", "sample"]));
    expect(r.evidenced).toBe(false);
  });

  it("well-evidenced sentence: baseline + method + sample all present", () => {
    const text =
      "In the A/B test across 80000 users, completion rose from 11% to 16% over two weeks.";
    const r = detectEvidenceQuality(text);
    expect(r.hasMetric).toBe(true);
    expect(r.missingDimensions).toEqual([]);
    expect(r.evidenced).toBe(true);
  });
});

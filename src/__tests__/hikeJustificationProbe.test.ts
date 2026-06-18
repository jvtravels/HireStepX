/* PDF #18 follow-up (2026-05-15) — hike-justification auto-probe.
 *
 * When the candidate's expected/current delta > 30% and no value
 * proof has been recorded, the recruiter MUST auto-probe with a
 * role-specific impact question. This pins the trigger threshold,
 * the role-family templates, and the suppression rule when
 * valueProofProvided is already true. */
import { describe, it, expect } from "vitest";
import {
  computeHikeDelta,
  shouldProbeHikeJustification,
  getHikeJustificationProbe,
  buildHikeJustificationBrief,
  HIKE_JUSTIFICATION_THRESHOLD,
} from "../../server-handlers/_hike-justification-probe";

describe("hike-justification probe", () => {
  it("threshold is 0.3 (>30% jump)", () => {
    expect(HIKE_JUSTIFICATION_THRESHOLD).toBe(0.3);
  });

  it("computeHikeDelta returns the fractional delta", () => {
    expect(computeHikeDelta(10, 16)).toBeCloseTo(0.6, 5);
    expect(computeHikeDelta(13, 21)).toBeCloseTo(0.6154, 3);
    expect(computeHikeDelta(20, 25)).toBeCloseTo(0.25, 5);
  });

  it("computeHikeDelta returns null when either CTC is missing or non-positive", () => {
    expect(computeHikeDelta(null, 20)).toBeNull();
    expect(computeHikeDelta(20, null)).toBeNull();
    expect(computeHikeDelta(0, 20)).toBeNull();
    expect(computeHikeDelta(20, 0)).toBeNull();
    expect(computeHikeDelta(-1, 20)).toBeNull();
  });

  it("FIRES on 13→21 (61% jump) when valueProof is missing", () => {
    expect(
      shouldProbeHikeJustification({
        currentCtcLpa: 13,
        expectedCtcLpa: 21,
        valueProofProvided: false,
      }),
    ).toBe(true);
  });

  it("does NOT fire on 12→14 (16% jump)", () => {
    expect(
      shouldProbeHikeJustification({
        currentCtcLpa: 12,
        expectedCtcLpa: 14,
        valueProofProvided: false,
      }),
    ).toBe(false);
  });

  it("does NOT fire on exactly 30% jump (>, not >=)", () => {
    expect(
      shouldProbeHikeJustification({
        currentCtcLpa: 10,
        expectedCtcLpa: 13,
        valueProofProvided: false,
      }),
    ).toBe(false);
  });

  it("FIRES on 30.0001% jump", () => {
    expect(
      shouldProbeHikeJustification({
        currentCtcLpa: 10,
        expectedCtcLpa: 13.001,
        valueProofProvided: false,
      }),
    ).toBe(true);
  });

  it("SUPPRESSED when valueProofProvided=true even on a 100% jump", () => {
    expect(
      shouldProbeHikeJustification({
        currentCtcLpa: 10,
        expectedCtcLpa: 20,
        valueProofProvided: true,
      }),
    ).toBe(false);
  });

  it("does not fire when either CTC is unknown", () => {
    expect(
      shouldProbeHikeJustification({
        currentCtcLpa: null,
        expectedCtcLpa: 25,
        valueProofProvided: false,
      }),
    ).toBe(false);
    expect(
      shouldProbeHikeJustification({
        currentCtcLpa: 10,
        expectedCtcLpa: null,
        valueProofProvided: false,
      }),
    ).toBe(false);
  });

  it("engineering probe references system design / scale / codebase (software title)", () => {
    const p = getHikeJustificationProbe("engineering", "Backend Software Engineer");
    expect(p.toLowerCase()).toMatch(/system|scale|codebase|performance/);
  });

  /* Regression (2026-06-18): classifyRoleFamily defaults EVERY unmatched
   * role to "engineering", which used to ship the software "system design /
   * codebase / scale wins" probe to Finance, HR, Legal, Civil/Mechanical
   * Engineer, Teacher… — "the static question asked to every role". The
   * software probe must now require a positive software-title signal. */
  it("engineering FAMILY but non-software title → generic probe, no software jargon", () => {
    for (const role of [
      "Finance Manager",
      "HR Business Partner",
      "Talent Acquisition Specialist",
      "Civil Engineer",
      "Mechanical Engineer",
      "Legal Counsel",
      "Operations Associate",
      "Chartered Accountant",
    ]) {
      const p = getHikeJustificationProbe("engineering", role).toLowerCase();
      expect(p, `role="${role}" leaked software jargon`).not.toMatch(
        /system design|codebase|scale wins/,
      );
      expect(p).toContain("what justifies it");
    }
  });

  it("engineering FAMILY with empty/missing title → generic probe (not software)", () => {
    expect(getHikeJustificationProbe("engineering").toLowerCase()).not.toMatch(
      /system design|codebase/,
    );
    expect(getHikeJustificationProbe("engineering", null).toLowerCase()).not.toMatch(
      /system design|codebase/,
    );
    expect(getHikeJustificationProbe("engineering", "").toLowerCase()).not.toMatch(
      /system design|codebase/,
    );
  });

  it("software titles DO get the software probe", () => {
    for (const role of [
      "Software Engineer",
      "Senior Backend Developer",
      "Full Stack Developer",
      "SDE-2",
      "DevOps Engineer",
      "Site Reliability Engineer",
      "Frontend Engineer",
      "Engineering Manager",
    ]) {
      const p = getHikeJustificationProbe("engineering", role).toLowerCase();
      expect(p, `role="${role}" missed software probe`).toMatch(
        /system design|codebase|scale/,
      );
    }
  });

  it("sales probe references quota / deal / account", () => {
    const p = getHikeJustificationProbe("sales");
    expect(p.toLowerCase()).toMatch(/quota|deal|account/);
  });

  it("csm-cs probe references retention / expansion", () => {
    const p = getHikeJustificationProbe("csm-cs");
    expect(p.toLowerCase()).toMatch(/retention|expansion|account/);
  });

  it("product / design / data have distinct probes", () => {
    expect(getHikeJustificationProbe("product").toLowerCase()).toMatch(
      /feature|metric|shipped|scope/,
    );
    expect(getHikeJustificationProbe("design").toLowerCase()).toMatch(
      /design system|portfolio|research|conversion|retention/,
    );
    expect(getHikeJustificationProbe("data").toLowerCase()).toMatch(
      /model|metric|infra|platform/,
    );
  });

  it("buildHikeJustificationBrief produces a bracketed line with the percentage", () => {
    const brief = buildHikeJustificationBrief(
      {
        currentCtcLpa: 13,
        expectedCtcLpa: 21,
        valueProofProvided: false,
      },
      "engineering",
      "Backend Software Engineer",
    );
    expect(brief).not.toBeNull();
    expect(brief).toMatch(/^\[HIKE JUSTIFICATION REQUIRED:/);
    expect(brief).toMatch(/62%|61%/);
    expect(brief).toContain("system");
  });

  it("buildHikeJustificationBrief returns null when probe should not fire", () => {
    expect(
      buildHikeJustificationBrief(
        {
          currentCtcLpa: 12,
          expectedCtcLpa: 14,
          valueProofProvided: false,
        },
        "engineering",
      ),
    ).toBeNull();
    expect(
      buildHikeJustificationBrief(
        {
          currentCtcLpa: 10,
          expectedCtcLpa: 20,
          valueProofProvided: true,
        },
        "engineering",
      ),
    ).toBeNull();
  });
});

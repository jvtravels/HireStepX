import { describe, it, expect } from "vitest";
import {
  computeHikePercent,
  extractRationale,
  extractHikeRationale,
  categorizeHike,
  hikeBriefToken,
  hikeCalibrationHint,
} from "../../server-handlers/_hike-rationale";

describe("computeHikePercent", () => {
  it("computes positive hike", () => {
    expect(computeHikePercent(30, 20)).toBe(50);
  });

  it("computes fractional hike rounded to 1 decimal", () => {
    expect(computeHikePercent(25, 18)).toBe(38.9);
  });

  it("returns null when target missing", () => {
    expect(computeHikePercent(null, 20)).toBe(null);
  });

  it("returns null when current missing", () => {
    expect(computeHikePercent(30, null)).toBe(null);
  });

  it("returns null when current is zero", () => {
    expect(computeHikePercent(30, 0)).toBe(null);
  });

  it("allows negative hike (pay cut)", () => {
    expect(computeHikePercent(15, 20)).toBe(-25);
  });
});

describe("extractRationale", () => {
  it("detects market-data via 'glassdoor'", () => {
    const r = extractRationale("glassdoor shows 32 LPA for my role");
    expect(r?.kind).toBe("market-data");
  });

  it("detects market-data via 'levels.fyi'", () => {
    const r = extractRationale("levels.fyi has this at 35 LPA");
    expect(r?.kind).toBe("market-data");
  });

  it("detects tenure-yoe", () => {
    const r = extractRationale("I have 8 years of experience");
    expect(r?.kind).toBe("tenure-yoe");
  });

  it("detects competing-offer", () => {
    const r = extractRationale("I have a competing offer at 30 LPA");
    expect(r?.kind).toBe("competing-offer");
  });

  it("detects scope-expansion", () => {
    const r = extractRationale("this role has more scope and reports");
    expect(r?.kind).toBe("scope-expansion");
  });

  it("detects specialization", () => {
    const r = extractRationale("my niche skill in distributed systems");
    expect(r?.kind).toBe("specialization");
  });

  it("detects col-relocation", () => {
    const r = extractRationale("cost of living in Bangalore is high");
    expect(r?.kind).toBe("col-relocation");
  });

  it("returns null when no cue present", () => {
    expect(extractRationale("I want 30 LPA")).toBe(null);
  });

  it("returns null on empty string", () => {
    expect(extractRationale("")).toBe(null);
  });
});

describe("extractHikeRationale", () => {
  it("combines hike% + rationale", () => {
    const r = extractHikeRationale("market rate is 30 LPA", 30, 20);
    expect(r.hikePercent).toBe(50);
    expect(r.rationale?.kind).toBe("market-data");
  });

  it("computes hike% even when no rationale", () => {
    const r = extractHikeRationale("I want it", 30, 20);
    expect(r.hikePercent).toBe(50);
    expect(r.rationale).toBe(null);
  });
});

describe("categorizeHike", () => {
  it("classifies <15% as conservative", () => {
    expect(categorizeHike(10)).toBe("conservative");
  });

  it("classifies 20% as normal", () => {
    expect(categorizeHike(20)).toBe("normal");
  });

  it("classifies 40% as aggressive", () => {
    expect(categorizeHike(40)).toBe("aggressive");
  });

  it("classifies 60% as extreme", () => {
    expect(categorizeHike(60)).toBe("extreme");
  });

  it("returns null on null input", () => {
    expect(categorizeHike(null)).toBe(null);
  });

  /* OA-B8 — a negative hike is a pay cut, not a "conservative" raise. */
  it("classifies a negative percent as pay-cut, not conservative", () => {
    expect(categorizeHike(-18)).toBe("pay-cut");
    expect(categorizeHike(-0.1)).toBe("pay-cut");
  });

  it("classifies exactly 0% as conservative (a flat lateral, not a cut)", () => {
    expect(categorizeHike(0)).toBe("conservative");
  });
});

describe("hikeBriefToken — OA-B8 negative-hike framing", () => {
  it("emits a hike= chip for a positive percent", () => {
    expect(hikeBriefToken(22)).toBe("hike=22%");
    expect(hikeBriefToken(0)).toBe("hike=0%");
  });

  it("emits an absolute payCut= chip for a negative percent (never hike=-N)", () => {
    expect(hikeBriefToken(-18)).toBe("payCut=18%");
    expect(hikeBriefToken(-7.5)).toBe("payCut=7.5%");
  });
});

describe("hikeCalibrationHint — OA-B8 single-source ladder", () => {
  it("frames a negative hike as a pay cut and forbids the raise frame", () => {
    const h = hikeCalibrationHint(-20);
    expect(h).toMatch(/pay cut/i);
    expect(h).toMatch(/20%/);
    expect(h).not.toMatch(/conservative|within market norms/i);
  });

  it("preserves the prior ladder text for non-negative buckets", () => {
    expect(hikeCalibrationHint(60)).toBe(
      "Hike is 60% — extreme. Frame your pushback respectfully; ask for the justification before any concession.",
    );
    expect(hikeCalibrationHint(35)).toBe(
      "Hike is 35% — aggressive. A justification probe is appropriate before counter-offering.",
    );
    expect(hikeCalibrationHint(20)).toBe(
      "Hike is 20% — normal switch-job range. Probe lightly or proceed to counter.",
    );
    expect(hikeCalibrationHint(10)).toBe(
      "Hike is 10% — conservative. The candidate's ask is well within market norms; consider matching.",
    );
  });
});

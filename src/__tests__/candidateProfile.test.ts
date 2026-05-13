import { describe, it, expect } from "vitest";
import {
  extractCandidateProfile,
  mergeCandidateProfile,
} from "../../server-handlers/_candidate-profile";

describe("extractCandidateProfile — career gap months", () => {
  it("parses '1 year gap' as 12", () => {
    expect(extractCandidateProfile("I had a 1 year gap").careerGapMonths).toBe(12);
  });

  it("parses '6 month break' as 6", () => {
    expect(extractCandidateProfile("a 6 month break").careerGapMonths).toBe(6);
  });

  it("parses 'gap of 8 months'", () => {
    expect(extractCandidateProfile("career gap of 8 months").careerGapMonths).toBe(8);
  });

  it("parses 'took a break for 18 months'", () => {
    expect(extractCandidateProfile("I took a break for 18 months").careerGapMonths).toBe(18);
  });

  it("rejects out-of-range gap", () => {
    expect(extractCandidateProfile("10 year gap").careerGapMonths).toBe(null);
  });
});

describe("extractCandidateProfile — gap activity", () => {
  it("detects upskill when gap context present", () => {
    expect(extractCandidateProfile("during my 6 month break I was upskilling").careerGapActivity).toBe("upskill");
  });

  it("detects freelance", () => {
    expect(extractCandidateProfile("8 month gap during which I was freelancing").careerGapActivity).toBe("freelance");
  });

  it("detects family reasons", () => {
    expect(extractCandidateProfile("during my break, family responsibilities took priority").careerGapActivity).toBe("family");
  });

  it("does NOT detect activity without gap context", () => {
    expect(extractCandidateProfile("I'm currently upskilling on the side").careerGapActivity).toBe(null);
  });
});

describe("extractCandidateProfile — tenure signal", () => {
  it("detects frequent via 'job hopper'", () => {
    expect(extractCandidateProfile("I've been called a job hopper").tenureSignal).toBe("frequent");
  });

  it("detects frequent via '4 jobs in 5 years'", () => {
    expect(extractCandidateProfile("4 jobs in 5 years").tenureSignal).toBe("frequent");
  });

  it("detects stable via '6 years at my current company'", () => {
    expect(extractCandidateProfile("I've been 6 years at my current company").tenureSignal).toBe("stable");
  });

  it("returns null when no signal", () => {
    expect(extractCandidateProfile("hello").tenureSignal).toBe(null);
  });
});

describe("extractCandidateProfile — level mismatch", () => {
  it("detects over via 'overqualified'", () => {
    expect(extractCandidateProfile("I may seem overqualified").levelMismatch).toBe("over");
  });

  it("detects under via 'may not match every requirement'", () => {
    expect(extractCandidateProfile("I may not match every requirement on paper").levelMismatch).toBe("under");
  });

  it("detects under via 'underqualified'", () => {
    expect(extractCandidateProfile("I'm a bit underqualified").levelMismatch).toBe("under");
  });
});

describe("extractCandidateProfile — hasAny + merge", () => {
  it("false on empty", () => {
    expect(extractCandidateProfile("").hasAny).toBe(false);
  });

  it("true when any field set", () => {
    expect(extractCandidateProfile("overqualified").hasAny).toBe(true);
  });

  it("merge: non-null overrides prior", () => {
    const prior = extractCandidateProfile("12 month gap");
    const next = extractCandidateProfile("18 month gap");
    expect(mergeCandidateProfile(prior, next).careerGapMonths).toBe(18);
  });

  it("merge: null preserves prior", () => {
    const prior = extractCandidateProfile("12 month gap");
    const next = extractCandidateProfile("overqualified");
    const m = mergeCandidateProfile(prior, next);
    expect(m.careerGapMonths).toBe(12);
    expect(m.levelMismatch).toBe("over");
  });

  it("merge: handles null prior", () => {
    expect(mergeCandidateProfile(null, extractCandidateProfile("overqualified")).levelMismatch).toBe("over");
  });
});

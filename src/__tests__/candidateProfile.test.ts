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

describe("Phase 25b — domain pivot", () => {
  it("detects 'transitioning from teaching to EdTech sales'", () => {
    const r = extractCandidateProfile("I'm transitioning from teaching to EdTech sales");
    expect(r.domainPivot).toBe(true);
  });

  it("detects 'career change'", () => {
    const r = extractCandidateProfile("This is a career change for me.");
    expect(r.domainPivot).toBe(true);
  });

  it("transferable-skills alone (no pivot) does NOT count", () => {
    const r = extractCandidateProfile("My skills carry over to this role.");
    expect(r.transferableSkillsClaimed).toBe(false);
  });

  it("transferable-skills + pivot context counts both", () => {
    const r = extractCandidateProfile(
      "I'm pivoting from design to product, and my transferable skills should translate.",
    );
    expect(r.domainPivot).toBe(true);
    expect(r.transferableSkillsClaimed).toBe(true);
  });

  it("merge: domainPivot is monotone-up", () => {
    const prior = mergeCandidateProfile(
      null,
      extractCandidateProfile("career change into product"),
    );
    expect(prior.domainPivot).toBe(true);
    const next = extractCandidateProfile("just discussing comp now");
    expect(mergeCandidateProfile(prior, next).domainPivot).toBe(true);
  });
});

describe("Phase 25b — compensation history", () => {
  it("detects delayed salary", () => {
    const r = extractCandidateProfile("My salary was delayed for 2 months at my current firm.");
    expect(r.compensationHistoryIssue).toBe("delayed");
  });

  it("detects unpaid salary", () => {
    const r = extractCandidateProfile("I haven't been paid for 3 months.");
    expect(r.compensationHistoryIssue).toBe("unpaid");
  });

  it("unpaid beats delayed when both present", () => {
    const r = extractCandidateProfile(
      "Salary was delayed for months and eventually unpaid wages piled up.",
    );
    expect(r.compensationHistoryIssue).toBe("unpaid");
  });

  it("merge: unpaid escalation sticks", () => {
    const prior = mergeCandidateProfile(
      null,
      extractCandidateProfile("salary was delayed last cycle"),
    );
    expect(prior.compensationHistoryIssue).toBe("delayed");
    const next = extractCandidateProfile("actually haven't been paid for 2 months now");
    expect(mergeCandidateProfile(prior, next).compensationHistoryIssue).toBe("unpaid");
  });

  it("merge: unpaid prior is not overwritten by later delayed", () => {
    const prior = mergeCandidateProfile(
      null,
      extractCandidateProfile("haven't been paid for 4 months"),
    );
    expect(prior.compensationHistoryIssue).toBe("unpaid");
    const next = extractCandidateProfile("payroll was just delayed last cycle");
    expect(mergeCandidateProfile(prior, next).compensationHistoryIssue).toBe("unpaid");
  });
});

describe("Phase 26 — service-bond detection", () => {
  it("detects 'service agreement'", () => {
    expect(extractCandidateProfile("I'm on a 2-year service agreement").serviceBondAccepted).toBe(true);
  });

  it("detects 'training bond'", () => {
    expect(extractCandidateProfile("There's a training bond at my current firm.").serviceBondAccepted).toBe(true);
  });

  it("detects 'signed a bond'", () => {
    expect(extractCandidateProfile("I signed a bond when I joined.").serviceBondAccepted).toBe(true);
  });

  it("does NOT false-fire on 'bond market' / 'bonds'", () => {
    expect(extractCandidateProfile("I work in the bond market.").serviceBondAccepted).toBe(false);
  });

  it("merge: serviceBondAccepted is monotone-up", () => {
    const prior = mergeCandidateProfile(null, extractCandidateProfile("I have a service agreement"));
    expect(prior.serviceBondAccepted).toBe(true);
    const next = extractCandidateProfile("just discussing comp now");
    expect(mergeCandidateProfile(prior, next).serviceBondAccepted).toBe(true);
  });
});

describe("Phase 26 — probation-comp detection", () => {
  it("detects 'probation salary'", () => {
    expect(extractCandidateProfile("Will the probation salary differ from confirmed?").probationCompMentioned).toBe(true);
  });

  it("detects 'during probation'", () => {
    expect(extractCandidateProfile("During probation, is comp different?").probationCompMentioned).toBe(true);
  });

  it("detects 'post-confirmation salary'", () => {
    expect(extractCandidateProfile("What's the post-confirmation salary?").probationCompMentioned).toBe(true);
  });

  it("merge: probationCompMentioned is monotone-up", () => {
    const prior = mergeCandidateProfile(null, extractCandidateProfile("probation salary please"));
    expect(prior.probationCompMentioned).toBe(true);
    expect(mergeCandidateProfile(prior, extractCandidateProfile("ok")).probationCompMentioned).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import {
  extractCandidateStance,
  mergeCandidateStance,
} from "../../server-handlers/_candidate-stance";

describe("extractCandidateStance — flexibility posture", () => {
  it("detects rigid via 'non-negotiable'", () => {
    expect(extractCandidateStance("this is non-negotiable").flexibilityPosture).toBe("rigid");
  });

  it("detects rigid via 'take it or leave it'", () => {
    expect(extractCandidateStance("take it or leave it").flexibilityPosture).toBe("rigid");
  });

  it("detects flexible via 'I'm flexible'", () => {
    expect(extractCandidateStance("I'm flexible on the number").flexibilityPosture).toBe("flexible");
  });

  it("detects flexible via 'open to discussion'", () => {
    expect(extractCandidateStance("open to discussion").flexibilityPosture).toBe("flexible");
  });

  it("rigid beats flexible when both fire", () => {
    expect(
      extractCandidateStance("I'm flexible on perks but the salary is non-negotiable").flexibilityPosture,
    ).toBe("rigid");
  });

  it("null when no cue", () => {
    expect(extractCandidateStance("hello").flexibilityPosture).toBe(null);
  });
});

describe("extractCandidateStance — marketReferenceVague", () => {
  it("true when 'as per market' has no number", () => {
    expect(extractCandidateStance("I want as per market").marketReferenceVague).toBe(true);
  });

  it("false when 'market standard' is anchored to a number", () => {
    expect(
      extractCandidateStance("market standard for my YOE is 32 LPA").marketReferenceVague,
    ).toBe(false);
  });

  it("true on 'industry standard'", () => {
    expect(extractCandidateStance("looking for industry standard").marketReferenceVague).toBe(true);
  });
});

describe("extractCandidateStance — salaryOnlyFactor", () => {
  it("true on 'only about the money'", () => {
    expect(extractCandidateStance("I'm only about the money").salaryOnlyFactor).toBe(true);
  });

  it("true on 'salary is the only factor'", () => {
    expect(extractCandidateStance("salary is the only factor for me").salaryOnlyFactor).toBe(true);
  });

  it("false on neutral mention of salary", () => {
    expect(extractCandidateStance("salary is important to me").salaryOnlyFactor).toBe(false);
  });
});

describe("extractCandidateStance — badmouthsCurrent", () => {
  it("true on 'my current company is toxic'", () => {
    expect(extractCandidateStance("my current company is toxic").badmouthsCurrent).toBe(true);
  });

  it("true on 'I hate my current job'", () => {
    expect(extractCandidateStance("I hate my current job").badmouthsCurrent).toBe(true);
  });

  it("false on neutral statement", () => {
    expect(extractCandidateStance("my current company is in fintech").badmouthsCurrent).toBe(false);
  });
});

describe("extractCandidateStance — confidentialOvershare", () => {
  it("true on 'our internal budget was X'", () => {
    expect(extractCandidateStance("our internal budget was 50 LPA").confidentialOvershare).toBe(true);
  });

  it("true on 'off the record'", () => {
    expect(extractCandidateStance("off the record, they're hiring 5 more").confidentialOvershare).toBe(true);
  });
});

describe("extractCandidateStance — soundsDesperate", () => {
  it("true on 'I really need this job'", () => {
    expect(extractCandidateStance("I really need this job").soundsDesperate).toBe(true);
  });

  it("true on 'I'll take anything'", () => {
    expect(extractCandidateStance("I'll take anything you offer").soundsDesperate).toBe(true);
  });

  it("true on 'no other offers'", () => {
    expect(extractCandidateStance("I have no other offers").soundsDesperate).toBe(true);
  });
});

describe("extractCandidateStance — treatsEquityAsCash", () => {
  it("true on 'counting esop as cash'", () => {
    expect(extractCandidateStance("I'm counting the ESOP as cash").treatsEquityAsCash).toBe(true);
  });

  it("true on 'equity is basically cash'", () => {
    expect(extractCandidateStance("equity is basically cash for me").treatsEquityAsCash).toBe(true);
  });
});

describe("extractCandidateStance — hasAny + merge", () => {
  it("false on empty", () => {
    expect(extractCandidateStance("").hasAny).toBe(false);
  });

  it("true on rigid", () => {
    expect(extractCandidateStance("non-negotiable").hasAny).toBe(true);
  });

  it("merge: last-stated wins for posture", () => {
    const prior = extractCandidateStance("non-negotiable");
    const next = extractCandidateStance("I'm flexible");
    expect(mergeCandidateStance(prior, next).flexibilityPosture).toBe("flexible");
  });

  it("merge: booleans monotone-up", () => {
    const prior = extractCandidateStance("I really need this job");
    const next = extractCandidateStance("hello");
    expect(mergeCandidateStance(prior, next).soundsDesperate).toBe(true);
  });

  it("merge: handles null prior", () => {
    expect(mergeCandidateStance(null, extractCandidateStance("non-negotiable")).flexibilityPosture).toBe("rigid");
  });
});

import { describe, it, expect } from "vitest";
import {
  extractCandidateStance,
  mergeCandidateStance,
  detectRecoverySignals,
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

describe("Phase 21 — multi-turn posture decay", () => {
  it("desperate decays when candidate later anchors on a number", () => {
    const turn1 = extractCandidateStance("I really need this job, please consider me.");
    expect(turn1.soundsDesperate).toBe(true);
    const turn2Text = "I'm targeting ₹22L for this role based on market data.";
    const turn2 = extractCandidateStance(turn2Text);
    const recovery = detectRecoverySignals(turn2Text);
    const merged = mergeCandidateStance(turn1, turn2, recovery);
    expect(merged.soundsDesperate).toBe(false);
  });

  it("desperate decays when candidate surfaces non-comp value", () => {
    const turn1 = extractCandidateStance("I'll take anything, I really need this job.");
    expect(turn1.soundsDesperate).toBe(true);
    const turn2Text = "Salary is one factor, but role scope, growth, and team are equally important to me.";
    const turn2 = extractCandidateStance(turn2Text);
    const recovery = detectRecoverySignals(turn2Text);
    const merged = mergeCandidateStance(turn1, turn2, recovery);
    expect(merged.soundsDesperate).toBe(false);
  });

  it("avoidsAnchor decays when candidate later states a concrete target", () => {
    const turn1 = extractCandidateStance("You decide, whatever the company offers.");
    expect(turn1.avoidsAnchor).toBe(true);
    const turn2Text = "My target is ₹18L LPA fixed.";
    const turn2 = extractCandidateStance(turn2Text);
    const recovery = detectRecoverySignals(turn2Text);
    const merged = mergeCandidateStance(turn1, turn2, recovery);
    expect(merged.avoidsAnchor).toBe(false);
  });

  it("badmouthsCurrent does NOT decay — it's a behavioural breach that stays sticky", () => {
    const turn1 = extractCandidateStance("My current company is toxic and the manager is a tyrant.");
    expect(turn1.badmouthsCurrent).toBe(true);
    const turn2Text = "I'm targeting ₹22L based on market data for the role.";
    const turn2 = extractCandidateStance(turn2Text);
    const recovery = detectRecoverySignals(turn2Text);
    const merged = mergeCandidateStance(turn1, turn2, recovery);
    /* Badmouthing happened; the recruiter would remember. No decay. */
    expect(merged.badmouthsCurrent).toBe(true);
  });

  it("desperate does NOT decay if the new utterance re-fires it", () => {
    const turn1 = extractCandidateStance("I really need this job.");
    expect(turn1.soundsDesperate).toBe(true);
    /* Anchor present but ALSO new desperation cue — the new cue dominates. */
    const turn2Text = "I'm targeting ₹15L but honestly I'll take anything you offer.";
    const turn2 = extractCandidateStance(turn2Text);
    const recovery = detectRecoverySignals(turn2Text);
    const merged = mergeCandidateStance(turn1, turn2, recovery);
    expect(merged.soundsDesperate).toBe(true);
  });

  it("personalExpenseJustification decays on market-data rationale", () => {
    const turn1 = extractCandidateStance("I need this salary because my home loan EMI is high.");
    expect(turn1.personalExpenseJustification).toBe(true);
    const turn2Text = "Based on Levels.fyi data, peers at similar levels are at ₹26L.";
    const turn2 = extractCandidateStance(turn2Text);
    const recovery = detectRecoverySignals(turn2Text);
    const merged = mergeCandidateStance(turn1, turn2, recovery);
    expect(merged.personalExpenseJustification).toBe(false);
  });
});

describe("extractCandidateStance — complainedAboutHikePercent", () => {
  it("true on 'only 15% hike'", () => {
    expect(extractCandidateStance("that's only 15% hike").complainedAboutHikePercent).toBe(true);
  });

  it("true on 'just 10% bump'", () => {
    expect(extractCandidateStance("just 10% bump on my current").complainedAboutHikePercent).toBe(true);
  });

  it("false on neutral mention", () => {
    expect(extractCandidateStance("I'd like a fair hike").complainedAboutHikePercent).toBe(false);
  });
});

describe("extractCandidateStance — stallSignal", () => {
  it("captures stall on 'let me think about it'", () => {
    const r = extractCandidateStance("let me think about it", 7);
    expect(r.stallSignal).toBeTruthy();
    expect(r.stallSignal?.statedAt).toBe(7);
    expect(r.stallSignal?.kind).toBe("thinking");
  });

  it("captures stall on 'I need to discuss with family'", () => {
    const r = extractCandidateStance("I need to discuss with family", 3);
    expect(r.stallSignal).toBeTruthy();
    expect(r.stallSignal?.kind).toBe("family-discussion");
  });

  it("null when no stall cue", () => {
    expect(extractCandidateStance("yes I accept", 1).stallSignal).toBeFalsy();
  });

  it("merge keeps earliest statedAt", () => {
    const t1 = extractCandidateStance("let me think about it", 2);
    const t2 = extractCandidateStance("let me think it over", 5);
    expect(t1.stallSignal?.statedAt).toBe(2);
    expect(t2.stallSignal?.statedAt).toBe(5);
    const merged = mergeCandidateStance(t1, t2, detectRecoverySignals("let me think it over"));
    expect(merged.stallSignal?.statedAt).toBe(2);
  });
});

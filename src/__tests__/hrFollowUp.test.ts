import { describe, it, expect } from "vitest";
import { buildHrFollowUpRules, hrFollowUpContext, isPayQuestion } from "../../server-handlers/_hr-follow-up";

describe("buildHrFollowUpRules", () => {
  it("frames HR as a recruiter screen and bans craft probes and offer role-play", () => {
    const out = buildHrFollowUpRules();
    expect(out).toMatch(/HR-ROUND FOLLOW-UP RULES/);
    expect(out).toMatch(/NEVER ask for project or craft detail/);
    expect(out).toMatch(/Do not role-play an offer/);
    expect(out).not.toMatch(/HIRING MANAGER/);
  });

  it("lets a clear answer move on", () => {
    expect(buildHrFollowUpRules()).toMatch(/needsFollowUp to false/);
  });

  it("appends salary context only when provided", () => {
    expect(buildHrFollowUpRules("SALARY-CTX")).toMatch(/SALARY-CTX$/);
    expect(buildHrFollowUpRules()).not.toMatch(/SALARY-CTX/);
  });
});

describe("isPayQuestion", () => {
  it.each([
    "What is your current CTC?",
    "What are your salary expectations?",
    "What is your notice period?",
  ])("detects pay: %s", q => expect(isPayQuestion(q)).toBe(true));

  it.each(["Why do you want to join us?", "Tell me about yourself", ""])("ignores non-pay: %s", q =>
    expect(isPayQuestion(q)).toBe(false));

  it("tolerates undefined", () => {
    expect(isPayQuestion(undefined)).toBe(false);
  });
});

describe("hrFollowUpContext", () => {
  it("is empty for non-HR types and never evaluates the salary lookup", () => {
    let called = false;
    expect(hrFollowUpContext("behavioral", "What is your CTC?", () => { called = true; return "X"; })).toBe("");
    expect(called).toBe(false);
  });

  it("attaches salary context for HR pay questions only", () => {
    expect(hrFollowUpContext("hr-round", "What is your notice period?", () => "SAL")).toMatch(/SAL$/);
    expect(hrFollowUpContext("hr-round", "Why us?", () => "SAL")).not.toMatch(/SAL/);
  });
});

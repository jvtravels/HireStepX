import { describe, it, expect } from "vitest";
import {
  extractDecisionDeadline,
  mergeDecisionDeadline,
} from "../../server-handlers/_decision-deadline";

describe("extractDecisionDeadline — deadline days", () => {
  it("parses 'in 3 days'", () => {
    expect(extractDecisionDeadline("I need to respond in 3 days").deadlineDays).toBe(3);
  });

  it("parses 'within 48 hours' as 2 days", () => {
    expect(extractDecisionDeadline("respond within 48 hours").deadlineDays).toBe(2);
  });

  it("parses '24 hours' as 1 day", () => {
    expect(extractDecisionDeadline("decision in 24 hours").deadlineDays).toBe(1);
  });

  it("parses 'by EOD' as 0", () => {
    expect(extractDecisionDeadline("need answer by EOD").deadlineDays).toBe(0);
  });

  it("parses 'by Friday'", () => {
    expect(extractDecisionDeadline("respond by Friday").deadlineDays).toBe(4);
  });

  it("parses '1 week'", () => {
    expect(extractDecisionDeadline("within 1 week").deadlineDays).toBe(7);
  });

  it("rejects out-of-range deadline", () => {
    expect(extractDecisionDeadline("respond in 90 days").deadlineDays).toBe(null);
  });
});

describe("extractDecisionDeadline — explicit flag", () => {
  it("fires on 'deadline'", () => {
    expect(extractDecisionDeadline("the deadline is approaching").deadlineExplicit).toBe(true);
  });

  it("fires on 'offer expires'", () => {
    expect(extractDecisionDeadline("the offer expires tomorrow").deadlineExplicit).toBe(true);
  });

  it("fires when day count present", () => {
    expect(extractDecisionDeadline("in 3 days").deadlineExplicit).toBe(true);
  });

  it("false when unrelated", () => {
    expect(extractDecisionDeadline("hello").deadlineExplicit).toBe(false);
  });
});

describe("extractDecisionDeadline — conditional accept", () => {
  it("fires on 'if you match X, I'll sign'", () => {
    const r = extractDecisionDeadline("if you match 30 LPA, I'll sign today");
    expect(r.conditionalAcceptance).toBe(true);
    expect(r.conditionalEvidence).toContain("sign");
  });

  it("fires on 'provided you cover buyout, I'm in'", () => {
    expect(extractDecisionDeadline("provided you cover the buyout, I'm in").conditionalAcceptance).toBe(true);
  });

  it("does NOT fire on unconditional accept", () => {
    expect(extractDecisionDeadline("I'll sign today").conditionalAcceptance).toBe(false);
  });

  it("does NOT fire on conditional without commitment", () => {
    expect(extractDecisionDeadline("if you match 30 LPA, can we discuss?").conditionalAcceptance).toBe(false);
  });
});

describe("extractDecisionDeadline — hasAny + empty", () => {
  it("false on empty", () => {
    expect(extractDecisionDeadline("").hasAny).toBe(false);
  });

  it("true when any field set", () => {
    expect(extractDecisionDeadline("by Friday").hasAny).toBe(true);
  });
});

describe("mergeDecisionDeadline", () => {
  it("shorter deadline wins", () => {
    const prior = extractDecisionDeadline("respond in 5 days");
    const next = extractDecisionDeadline("respond in 2 days");
    expect(mergeDecisionDeadline(prior, next).deadlineDays).toBe(2);
  });

  it("null preserves prior deadline", () => {
    const prior = extractDecisionDeadline("respond in 5 days");
    const next = extractDecisionDeadline("hello");
    expect(mergeDecisionDeadline(prior, next).deadlineDays).toBe(5);
  });

  it("explicit flag monotone-up", () => {
    const prior = extractDecisionDeadline("the deadline is approaching");
    const next = extractDecisionDeadline("hello");
    expect(mergeDecisionDeadline(prior, next).deadlineExplicit).toBe(true);
  });

  it("conditional is last-stated-wins (can withdraw)", () => {
    const prior = extractDecisionDeadline("if you match 30 LPA, I'll sign");
    const next = extractDecisionDeadline("hello");
    expect(mergeDecisionDeadline(prior, next).conditionalAcceptance).toBe(false);
  });

  it("handles null prior", () => {
    expect(mergeDecisionDeadline(null, extractDecisionDeadline("by Friday")).deadlineDays).toBe(4);
  });
});

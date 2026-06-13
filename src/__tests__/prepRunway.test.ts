import { describe, it, expect } from "vitest";
import {
  mockTypeForRound,
  prepLaunchUrl,
  adaptDifficulty,
  buildPrepRunway,
  planToEventBody,
  type PrepRunwayParent,
} from "../../server-handlers/_prep-runway";

const parent: PrepRunwayParent = {
  id: "parent-1",
  start_utc: "2026-07-01T09:00:00.000Z",
  company: "Amazon",
  type: "System Design",
  timezone: "Asia/Kolkata",
};

describe("mockTypeForRound", () => {
  it("maps rounds to interview-engine type params", () => {
    expect(mockTypeForRound("System Design")).toBe("system_design");
    expect(mockTypeForRound("Technical")).toBe("technical");
    expect(mockTypeForRound("Coding")).toBe("technical");
    expect(mockTypeForRound("Case Study")).toBe("case");
    expect(mockTypeForRound("Salary negotiation")).toBe("salary-negotiation");
    expect(mockTypeForRound("Behavioral")).toBe("behavioral");
    expect(mockTypeForRound("Phone Screen")).toBe("behavioral");
    expect(mockTypeForRound("")).toBe("behavioral");
  });
});

describe("prepLaunchUrl", () => {
  it("prefills company, focus, and difficulty", () => {
    const url = prepLaunchUrl({ company: "Amazon", mockType: "system_design", focus: "weak-areas", difficulty: "hard" });
    expect(url).toContain("/session/new?");
    expect(url).toContain("type=system_design");
    expect(url).toContain("company=Amazon");
    expect(url).toContain("focus=weak-areas");
    expect(url).toContain("difficulty=hard");
    expect(url).toContain("source=prep-runway");
  });
  it("omits a 'general' focus", () => {
    expect(prepLaunchUrl({ company: "", mockType: "behavioral", focus: "general", difficulty: "warmup" })).not.toContain("focus=");
  });
});

describe("adaptDifficulty", () => {
  it("leaves the baseline alone without a score", () => {
    expect(adaptDifficulty("standard")).toBe("standard");
    expect(adaptDifficulty("standard", NaN)).toBe("standard");
  });
  it("stretches a strong candidate to hard", () => {
    expect(adaptDifficulty("standard", 90)).toBe("hard");
  });
  it("never piles hard onto a struggling candidate", () => {
    expect(adaptDifficulty("hard", 40)).toBe("standard");
  });
  it("does not promote warmup", () => {
    expect(adaptDifficulty("warmup", 95)).toBe("warmup");
  });
});

describe("buildPrepRunway", () => {
  it("emits the full ladder when the interview is far out", () => {
    const plans = buildPrepRunway(parent, { now: "2026-06-01T00:00:00.000Z" });
    expect(plans.map((p) => p.offsetLabel)).toEqual(["T-7", "T-4", "T-2", "T-1", "T+2h"]);
    // Same time-of-day, N days earlier.
    expect(plans[0].start_utc).toBe("2026-06-24T09:00:00.000Z");
    // Reflection is 2h after the interview.
    expect(plans[4].start_utc).toBe("2026-07-01T11:00:00.000Z");
  });
  it("skips nodes already in the past", () => {
    // 3 days before the interview: T-7 and T-4 have passed.
    const plans = buildPrepRunway(parent, { now: "2026-06-28T12:00:00.000Z" });
    expect(plans.map((p) => p.offsetLabel)).toEqual(["T-2", "T-1", "T+2h"]);
  });
  it("returns nothing when the interview itself has fully passed", () => {
    const plans = buildPrepRunway(parent, { now: "2026-07-02T00:00:00.000Z" });
    expect(plans).toEqual([]);
  });
  it("returns nothing without a start instant", () => {
    expect(buildPrepRunway({ ...parent, start_utc: null }, { now: "2026-06-01T00:00:00.000Z" })).toEqual([]);
  });
  it("propagates an adapted difficulty into the deep link", () => {
    const plans = buildPrepRunway(parent, { now: "2026-06-01T00:00:00.000Z", recentScore: 90 });
    const t2 = plans.find((p) => p.offsetLabel === "T-2")!;
    expect(t2.difficulty).toBe("hard");
    expect(t2.deepLink).toContain("difficulty=hard");
  });
  it("keeps the reflection a non-mock node with no deep link", () => {
    const plans = buildPrepRunway(parent, { now: "2026-06-01T00:00:00.000Z" });
    const reflect = plans.find((p) => p.isReflection)!;
    expect(reflect.deepLink).toBe("");
    expect(reflect.difficulty).toBe("warmup");
  });
});

describe("planToEventBody", () => {
  it("shapes a prep-session body the normalizer accepts", () => {
    const [t7] = buildPrepRunway(parent, { now: "2026-06-01T00:00:00.000Z" });
    const body = planToEventBody(t7, parent);
    expect(body.kind).toBe("prep-session");
    expect(body.parent_interview_id).toBe("parent-1");
    expect(body.source).toBe("prep-runway");
    expect(body.title).toBe("Calibration mock · T-7");
    expect(body.company).toBe("Amazon");
    expect(body.reminders).toBe(true);
    expect(typeof body.notes).toBe("string");
  });
  it("marks the reflection body distinctly", () => {
    const plans = buildPrepRunway(parent, { now: "2026-06-01T00:00:00.000Z" });
    const body = planToEventBody(plans.find((p) => p.isReflection)!, parent);
    expect(body.type).toBe("reflection");
    expect(Array.isArray(body.reminders)).toBe(true);
  });
});

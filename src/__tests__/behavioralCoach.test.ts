/* Tests for the behavioral coach template registry.
 *
 * The registry lives under tempo/designs/canvases/interview-result-focus/
 * because that's where it was extracted, but the analyzer in prod imports
 * the same module. These tests pin the per-flag contract:
 *
 *   - every flag has a non-empty headline / rationale / prebiasDimension
 *   - rationale interpolates the per-session context (questionIndex,
 *     counterpartyRole, personaVoice) so the same flag emits per-user
 *     copy, not a generic string
 *   - the conflict + failure helpers compose correctly from the
 *     dominant flag
 */

import { describe, it, expect } from "vitest";
import {
  BEHAVIORAL_COACH,
  coachOneHabit,
  coachConflict,
  coachFailureQuote,
  type BehavioralFlag,
} from "../../tempo/designs/canvases/interview-result-focus/_behavioral-coach";

const ALL_FLAGS: BehavioralFlag[] = [
  "one_sided_conflict_narrative",
  "weak_specificity_in_failure_story",
  "we_without_i",
  "result_missing",
  "rambling_answers",
  "rehearsed_answers",
  "low_conviction_delivery",
  "weak_star_structure",
];

describe("BEHAVIORAL_COACH registry", () => {
  it("covers every declared flag", () => {
    for (const flag of ALL_FLAGS) {
      expect(BEHAVIORAL_COACH[flag]).toBeDefined();
      expect(typeof BEHAVIORAL_COACH[flag].oneHabit).toBe("function");
    }
  });

  it.each(ALL_FLAGS)("%s emits a non-empty one-habit block", (flag) => {
    const habit = coachOneHabit(flag, {
      questionIndex: 3,
      counterpartyRole: "VP",
      personaVoice: "Indian HM",
    });
    expect(habit.headline.length).toBeGreaterThan(8);
    expect(habit.rationale.length).toBeGreaterThan(20);
    expect(habit.prebiasDimension.length).toBeGreaterThan(3);
  });

  it("interpolates questionIndex into the rationale when provided", () => {
    const habit = coachOneHabit("one_sided_conflict_narrative", {
      questionIndex: 4,
      counterpartyRole: "VP",
    });
    expect(habit.rationale).toContain("Q4");
    expect(habit.rationale).toContain("VP");
  });

  it("falls back to a generic stakeholder when role is omitted", () => {
    const habit = coachOneHabit("one_sided_conflict_narrative", {
      questionIndex: 2,
    });
    expect(habit.rationale).toContain("stakeholder");
  });

  it("falls back to a generic persona voice when omitted", () => {
    const habit = coachOneHabit("rambling_answers", { questionIndex: 6 });
    expect(habit.rationale).toContain("Indian HM");
  });

  it("rationale is unique per flag (no template-string copy-paste)", () => {
    const rationales = ALL_FLAGS.map((f) =>
      coachOneHabit(f, { questionIndex: 1, counterpartyRole: "PM" }).rationale,
    );
    const unique = new Set(rationales);
    expect(unique.size).toBe(ALL_FLAGS.length);
  });

  it("prebias dimensions are unique per flag", () => {
    const dims = ALL_FLAGS.map((f) => coachOneHabit(f).prebiasDimension);
    const unique = new Set(dims);
    expect(unique.size).toBe(ALL_FLAGS.length);
  });
});

describe("coachConflict", () => {
  it("returns a counterparty-frame line tied to the named role", () => {
    const line = coachConflict({ counterpartyRole: "VP" });
    expect(line).toContain("VP");
    expect(line.toLowerCase()).toContain("counterparty");
  });

  it("degrades cleanly when no role is provided", () => {
    const line = coachConflict({});
    expect(line.length).toBeGreaterThan(20);
    expect(line.toLowerCase()).toContain("they");
  });
});

describe("coachFailureQuote", () => {
  it("provides a concrete rewrite anchor, not generic prose", () => {
    const q = coachFailureQuote({});
    expect(q).toContain("rollback");
    expect(q.toLowerCase()).toContain("hindsight theatre");
  });
});

describe("idempotency", () => {
  it("repeated calls with the same ctx return the same copy", () => {
    const a = coachOneHabit("we_without_i", { questionIndex: 2 });
    const b = coachOneHabit("we_without_i", { questionIndex: 2 });
    expect(a).toEqual(b);
  });
});

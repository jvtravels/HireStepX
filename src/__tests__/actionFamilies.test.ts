/* Month 2 PR-1 (PDF #28) — Action family taxonomy unit tests.
 *
 * Locks the invariants the upcoming family-routing PRs depend on:
 *   - Every family has at least one kind.
 *   - Every kind maps to exactly one family.
 *   - familyOf is total over the known kind set.
 *   - The set of known kinds matches the planner's emitted kinds (this
 *     is the regression that catches "new kind landed without taxonomy
 *     update" before it ships). */

import { describe, it, expect } from "vitest";
import {
  ACTION_FAMILIES,
  KIND_TO_FAMILY,
  KNOWN_ACTION_KINDS,
  familyOf,
  isOfFamily,
  kindsInFamily,
  type ActionFamily,
} from "../../server-handlers/_action-families";

describe("ActionFamily taxonomy", () => {
  it("has exactly 11 families", () => {
    expect(ACTION_FAMILIES.length).toBe(11);
  });

  it("ACTION_FAMILIES has no duplicates", () => {
    expect(new Set(ACTION_FAMILIES).size).toBe(ACTION_FAMILIES.length);
  });

  it("every family in ACTION_FAMILIES has at least one kind", () => {
    for (const fam of ACTION_FAMILIES) {
      expect(kindsInFamily(fam).length).toBeGreaterThan(0);
    }
  });

  it("every kind in KIND_TO_FAMILY maps to a family from ACTION_FAMILIES", () => {
    const famSet = new Set<ActionFamily>(ACTION_FAMILIES);
    for (const [kind, fam] of Object.entries(KIND_TO_FAMILY)) {
      expect(famSet.has(fam)).toBe(true);
      expect(kind.length).toBeGreaterThan(0);
    }
  });

  it("KNOWN_ACTION_KINDS is sorted and deduped", () => {
    const sorted = [...KNOWN_ACTION_KINDS].sort();
    expect(KNOWN_ACTION_KINDS).toEqual(sorted);
    expect(new Set(KNOWN_ACTION_KINDS).size).toBe(KNOWN_ACTION_KINDS.length);
  });
});

describe("familyOf", () => {
  it("returns the mapped family for every known kind", () => {
    for (const kind of KNOWN_ACTION_KINDS) {
      expect(familyOf(kind)).toBe(KIND_TO_FAMILY[kind]);
    }
  });

  it("returns 'unmapped' for an unknown kind", () => {
    expect(familyOf("totally-made-up-kind")).toBe("unmapped");
  });
});

describe("isOfFamily", () => {
  it("returns true for a kind in the queried family", () => {
    expect(isOfFamily("discovery-probe", "discovery-probe")).toBe(true);
    expect(isOfFamily("manager-consult-stall", "stall-tactic")).toBe(true);
  });

  it("returns false for a kind outside the queried family", () => {
    expect(isOfFamily("polite-walkaway", "anchor-set")).toBe(false);
  });

  it("returns false for an unknown kind", () => {
    expect(isOfFamily("nope", "anchor-set")).toBe(false);
  });
});

describe("kindsInFamily", () => {
  it("returns the kinds for a populated family", () => {
    const stalls = kindsInFamily("stall-tactic");
    expect(stalls).toContain("manager-consult-stall");
    expect(stalls).toContain("panel-approval-stall");
    expect(stalls).toContain("vague-promise");
  });

  it("returns sorted kinds", () => {
    const kinds = kindsInFamily("anchor-set");
    expect(kinds).toEqual([...kinds].sort());
  });

  it("partitions KIND_TO_FAMILY exactly across all families", () => {
    const total = ACTION_FAMILIES.reduce(
      (sum, fam) => sum + kindsInFamily(fam).length,
      0,
    );
    expect(total).toBe(Object.keys(KIND_TO_FAMILY).length);
  });
});

describe("planner-emitted kinds are all taxonomy-mapped (regression guard)", () => {
  /* This is the lock: every kind the planner currently emits MUST be
   * in KIND_TO_FAMILY. Updated 2026-06-07 from grep
   * "actionKind: \"...\"" across server-handlers/. */
  const PLANNER_EMITTED_KINDS = [
    "accept-lowball-quiet",
    "acknowledge-and-recover",
    "acknowledge-existing-offer",
    "acknowledge-retention-offer",
    "anchor-defense-hike-strong",
    "anchor-with-offer",
    "answer-direct",
    "band-anchor-with-rationale",
    "calibrated-surprise-lowball",
    "callback-prior-context",
    "clarify-prior-question",
    "close-recap-formal",
    "comparative-anchoring",
    "competing-offer-warm-ack",
    "competitor-match",
    "contradiction-callout",
    "ctc-ask",
    "ctc-inflation-anchor",
    "ctc-inflation-truth",
    "currentCtcAsked",
    "discovery-probe",
    "exploding-offer-pressure",
    "fake-competing-candidate",
    "fake-leverage-challenge",
    "internal-equity-defense",
    "manager-consult-stall",
    "match-existing-offer-prose",
    "noticePeriodAsked",
    "panel-approval-stall",
    "paraphrase-recap",
    "polite-walkaway",
    "post-acceptance-document-request",
    "proactive-sweetener",
    "reactive-followup",
    "retention-trump-warning",
    "round-transition",
    "vague-promise",
  ];

  it("every planner-emitted kind maps to a real family", () => {
    for (const kind of PLANNER_EMITTED_KINDS) {
      const fam = familyOf(kind);
      expect(fam, `kind "${kind}" is missing from KIND_TO_FAMILY`).not.toBe(
        "unmapped",
      );
    }
  });

  it("no extra kinds in KIND_TO_FAMILY beyond what the planner emits (no dead entries)", () => {
    const planner = new Set(PLANNER_EMITTED_KINDS);
    const orphans = KNOWN_ACTION_KINDS.filter((k) => !planner.has(k));
    expect(orphans).toEqual([]);
  });
});

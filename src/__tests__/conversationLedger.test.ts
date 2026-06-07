/* PDF #28 Month 1 PR-1 — Conversation Ledger unit tests.
 *
 * Proves the ledger's invariants are real:
 *   I1. Append-only — entries are never mutated or removed.
 *   I2. First-wins — getFact returns the FIRST capture, not the latest.
 *   I3. Strict typing — discriminated union narrows correctly.
 *   I4. Pure — same inputs produce same ledger, no hidden state.
 *
 * No callers read the ledger in PR-1. These tests are the contract
 * the rest of the migration sequence (PR-2 through PR-6) builds on. */

import { describe, it, expect } from "vitest";
import {
  emptyLedger,
  recordFact,
  recordAskedTopic,
  recordEmittedAction,
  recordUnclassified,
  recordRefusal,
  hasFact,
  getFact,
  getFactSource,
  wasTopicAsked,
  askedTopicCount,
  wasTopicRefused,
  consecutiveUnclassifiedTail,
  entriesSince,
  allFactEntries,
  size,
  snapshot,
  isFactEntry,
  isAskedTopicEntry,
  isEmittedActionEntry,
  isUnclassifiedEntry,
  isRefusalEntry,
} from "../../server-handlers/_conversation-ledger";

describe("emptyLedger", () => {
  it("returns a ledger with no entries", () => {
    const led = emptyLedger();
    expect(led.entries).toEqual([]);
    expect(size(led)).toBe(0);
  });

  it("produces a fresh ledger on each call (no shared reference)", () => {
    const a = emptyLedger();
    const b = emptyLedger();
    expect(a).not.toBe(b);
    expect(a.entries).not.toBe(b.entries);
  });
});

describe("I1 — append-only", () => {
  it("recordFact returns a NEW ledger, does not mutate the original", () => {
    const before = emptyLedger();
    const after = recordFact(before, "current-ctc", 44, "main-parser", 3, "my current ctc is 44 LPA");
    expect(before.entries).toEqual([]);     // original untouched
    expect(after.entries).toHaveLength(1);
    expect(before).not.toBe(after);
  });

  it("multiple writers compose without mutating intermediates", () => {
    const l0 = emptyLedger();
    const l1 = recordFact(l0, "current-ctc", 44, "main-parser", 3, "44 LPA");
    const l2 = recordAskedTopic(l1, "currentCtcAsked", 4, { kind: "ctc-ask", satisfiesTopic: "currentCtcAsked" });
    const l3 = recordUnclassified(l2, "okay", 5, "terse");
    expect(l0.entries).toHaveLength(0);
    expect(l1.entries).toHaveLength(1);
    expect(l2.entries).toHaveLength(2);
    expect(l3.entries).toHaveLength(3);
  });

  it("appending the same fact twice creates two entries", () => {
    const l = recordFact(
      recordFact(emptyLedger(), "current-ctc", 44, "main-parser", 3, "first"),
      "current-ctc", 99, "disclosure-tracker", 5, "second",
    );
    expect(l.entries).toHaveLength(2);
  });
});

describe("I2 — first-wins semantics", () => {
  it("getFact returns the FIRST capture even when later writes exist", () => {
    const l = recordFact(
      recordFact(emptyLedger(), "current-ctc", 44, "main-parser", 3, "first"),
      "current-ctc", 99, "disclosure-tracker", 5, "second",
    );
    expect(getFact(l, "current-ctc")).toBe(44);
  });

  it("getFactSource returns the source of the FIRST capture", () => {
    const l = recordFact(
      recordFact(emptyLedger(), "current-ctc", 44, "disclosure-tracker", 3, "first"),
      "current-ctc", 44, "main-parser", 5, "second",
    );
    expect(getFactSource(l, "current-ctc")).toBe("disclosure-tracker");
  });

  it("hasFact stays true once set, regardless of later writes", () => {
    const l1 = recordFact(emptyLedger(), "current-ctc", 44, "main-parser", 3, "x");
    expect(hasFact(l1, "current-ctc")).toBe(true);
    const l2 = recordFact(l1, "current-ctc", 99, "manual", 5, "y");
    expect(hasFact(l2, "current-ctc")).toBe(true);
    expect(getFact(l2, "current-ctc")).toBe(44);
  });

  it("snapshot.facts records only the first value per kind", () => {
    const l = recordFact(
      recordFact(emptyLedger(), "current-ctc", 44, "main-parser", 3, "first"),
      "current-ctc", 99, "manual", 5, "second",
    );
    const snap = snapshot(l);
    expect(snap.facts["current-ctc"]).toEqual({ value: 44, source: "main-parser", atTurn: 3 });
  });
});

describe("recordFact — every FactKind round-trips", () => {
  it.each([
    ["current-ctc", 44 as const],
    ["target-ctc", 60 as const],
    ["notice-period-days", 90 as const],
    ["competing-offer", 50 as const],
    ["component-base", 30 as const],
    ["component-variable", 8 as const],
    ["component-equity", 12 as const],
  ] as const)("number fact %s round-trips", (kind, value) => {
    const l = recordFact(emptyLedger(), kind, value, "main-parser", 1, "raw");
    expect(getFact(l, kind)).toBe(value);
    expect(hasFact(l, kind)).toBe(true);
  });

  it.each([
    ["current-company", "Razorpay"],
    ["joining-date", "2026-08-01"],
  ] as const)("string fact %s round-trips", (kind, value) => {
    const l = recordFact(emptyLedger(), kind, value, "disclosure-tracker", 2, "raw");
    expect(getFact(l, kind)).toBe(value);
  });
});

describe("askedTopic — dedup primitives", () => {
  it("wasTopicAsked returns null when never asked", () => {
    expect(wasTopicAsked(emptyLedger(), "currentCtcAsked")).toBeNull();
  });

  it("wasTopicAsked returns the FIRST ask's turn", () => {
    const l = recordAskedTopic(
      recordAskedTopic(emptyLedger(), "currentCtcAsked", 3, { kind: "ctc-ask" }),
      "currentCtcAsked", 8, { kind: "ctc-ask" },
    );
    expect(wasTopicAsked(l, "currentCtcAsked")).toEqual({ atTurn: 3 });
  });

  it("askedTopicCount tallies repeat asks", () => {
    const l = recordAskedTopic(
      recordAskedTopic(
        recordAskedTopic(emptyLedger(), "currentCtcAsked", 3, { kind: "ctc-ask" }),
        "noticePeriodAsked", 4, { kind: "notice-ask" },
      ),
      "currentCtcAsked", 8, { kind: "ctc-ask" },
    );
    expect(askedTopicCount(l, "currentCtcAsked")).toBe(2);
    expect(askedTopicCount(l, "noticePeriodAsked")).toBe(1);
    expect(askedTopicCount(l, "targetAsked")).toBe(0);
  });
});

describe("refusal tracking", () => {
  it("wasTopicRefused returns the refusal turn", () => {
    const l = recordRefusal(emptyLedger(), "competingOffersAsked", 5, "I'd rather not share that");
    expect(wasTopicRefused(l, "competingOffersAsked")).toEqual({ atTurn: 5 });
    expect(wasTopicRefused(l, "currentCtcAsked")).toBeNull();
  });
});

describe("consecutiveUnclassifiedTail — empty-prose recovery driver", () => {
  it("returns 0 on empty ledger", () => {
    expect(consecutiveUnclassifiedTail(emptyLedger())).toBe(0);
  });

  it("counts trailing unclassifieds", () => {
    const l = recordUnclassified(
      recordUnclassified(emptyLedger(), "okay", 3, "terse"),
      "next", 4, "terse",
    );
    expect(consecutiveUnclassifiedTail(l)).toBe(2);
  });

  it("resets at the first fact entry", () => {
    const l = recordUnclassified(
      recordFact(
        recordUnclassified(emptyLedger(), "okay", 3, "terse"),
        "current-ctc", 4, "main-parser", 4, "44 LPA",
      ),
      "fine", 5, "terse",
    );
    expect(consecutiveUnclassifiedTail(l)).toBe(1);
  });

  it("resets at the first refusal entry", () => {
    const l = recordUnclassified(
      recordRefusal(
        recordUnclassified(emptyLedger(), "okay", 3, "terse"),
        "currentCtcAsked", 4, "rather not say",
      ),
      "fine", 5, "terse",
    );
    expect(consecutiveUnclassifiedTail(l)).toBe(1);
  });

  it("bot-side entries (asked-topic, emitted-action) do NOT break the streak", () => {
    const l = recordUnclassified(
      recordAskedTopic(
        recordUnclassified(emptyLedger(), "okay", 3, "terse"),
        "currentCtcAsked", 4, { kind: "ctc-ask" },
      ),
      "fine", 5, "terse",
    );
    expect(consecutiveUnclassifiedTail(l)).toBe(2);
  });
});

describe("entriesSince — turn-scoped queries", () => {
  it("returns entries at or after the given turn", () => {
    const l = recordUnclassified(
      recordFact(
        recordFact(emptyLedger(), "current-ctc", 44, "main-parser", 1, "x"),
        "target-ctc", 60, "main-parser", 3, "y",
      ),
      "okay", 5, "terse",
    );
    expect(entriesSince(l, 3)).toHaveLength(2);
    expect(entriesSince(l, 5)).toHaveLength(1);
    expect(entriesSince(l, 99)).toHaveLength(0);
  });
});

describe("allFactEntries — facts-only view", () => {
  it("filters out non-fact entries", () => {
    const l = recordEmittedAction(
      recordUnclassified(
        recordFact(emptyLedger(), "current-ctc", 44, "main-parser", 1, "x"),
        "okay", 2, "terse",
      ),
      { kind: "ctc-ask" }, 3, "What's your current CTC?",
    );
    expect(allFactEntries(l)).toHaveLength(1);
  });
});

describe("type guards", () => {
  it("isFactEntry narrows correctly across all fact kinds", () => {
    const facts: Array<Parameters<typeof recordFact>[1]> = [
      "current-ctc", "current-company", "target-ctc", "notice-period-days",
      "competing-offer", "joining-date", "component-base", "component-variable",
      "component-equity",
    ];
    for (const factKind of facts) {
      const l = recordFact(
        emptyLedger(),
        factKind,
        typeof factKind === "string" && (factKind === "current-company" || factKind === "joining-date") ? "x" : 42,
        "main-parser", 1, "raw",
      );
      const e = l.entries[0];
      expect(isFactEntry(e)).toBe(true);
      expect(isAskedTopicEntry(e)).toBe(false);
      expect(isEmittedActionEntry(e)).toBe(false);
      expect(isUnclassifiedEntry(e)).toBe(false);
      expect(isRefusalEntry(e)).toBe(false);
    }
  });

  it("each non-fact kind matches exactly one guard", () => {
    const l = recordRefusal(
      recordUnclassified(
        recordEmittedAction(
          recordAskedTopic(emptyLedger(), "currentCtcAsked", 1, { kind: "ctc-ask" }),
          { kind: "ctc-ask" }, 1, "prose",
        ),
        "okay", 2, "terse",
      ),
      "competingOffersAsked", 3, "rather not",
    );
    const [asked, emitted, unclass, refusal] = l.entries;
    expect(isAskedTopicEntry(asked)).toBe(true);
    expect(isEmittedActionEntry(emitted)).toBe(true);
    expect(isUnclassifiedEntry(unclass)).toBe(true);
    expect(isRefusalEntry(refusal)).toBe(true);
  });
});

describe("snapshot — diagnostic flatten", () => {
  it("includes facts, askedTopics, refusals, and unclassifiedCount", () => {
    const l = recordRefusal(
      recordUnclassified(
        recordAskedTopic(
          recordFact(emptyLedger(), "current-ctc", 44, "main-parser", 1, "x"),
          "currentCtcAsked", 2, { kind: "ctc-ask", satisfiesTopic: "currentCtcAsked" },
        ),
        "okay", 3, "terse",
      ),
      "competingOffersAsked", 4, "no thanks",
    );
    const snap = snapshot(l);
    expect(snap.totalEntries).toBe(4);
    expect(snap.facts["current-ctc"]).toBeDefined();
    expect(snap.askedTopics).toEqual([{ topic: "currentCtcAsked", atTurn: 2, actionKind: "ctc-ask" }]);
    expect(snap.refusals).toEqual([{ topic: "competingOffersAsked", atTurn: 4 }]);
    expect(snap.unclassifiedCount).toBe(1);
  });

  it("snapshot is safe to JSON.stringify (telemetry-friendly)", () => {
    const l = recordFact(emptyLedger(), "current-ctc", 44, "main-parser", 1, "raw");
    expect(() => JSON.stringify(snapshot(l))).not.toThrow();
  });
});

describe("I4 — purity", () => {
  it("same inputs produce structurally equal ledgers", () => {
    const a = recordFact(
      recordAskedTopic(emptyLedger(), "currentCtcAsked", 1, { kind: "ctc-ask" }),
      "current-ctc", 44, "main-parser", 2, "raw",
    );
    const b = recordFact(
      recordAskedTopic(emptyLedger(), "currentCtcAsked", 1, { kind: "ctc-ask" }),
      "current-ctc", 44, "main-parser", 2, "raw",
    );
    expect(a).toEqual(b);
  });
});

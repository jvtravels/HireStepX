import { describe, it, expect } from "vitest";
import {
  aggregateCompetencies,
  COMPETENCY_LABELS,
  COMPETENCY_PATTERNS,
  COMPETENCY_TRACK_WEIGHTS,
  detectCompetencies,
  topCompetenciesForTrack,
} from "../../../server-handlers/analyzers/_behavioral-competencies";

/* Behavioral competency taxonomy — Phase 2 unit tests.
 *
 * Pin the patterns so taxonomy drift (and the cascading "wrong
 * competency surfaced in the report" bug) is caught on every
 * change. Each competency gets at least: one phrasing that MUST
 * fire, and one similar noun-only phrasing that MUST NOT fire. */

describe("detectCompetencies — first-person behavioural framing", () => {
  it("ownership fires on verb forms but not on noun mention", () => {
    expect(detectCompetencies("I owned the migration end-to-end").has("ownership")).toBe(true);
    expect(detectCompetencies("I took ownership of the on-call rotation").has("ownership")).toBe(true);
    expect(detectCompetencies("I drove alignment across three teams").has("ownership")).toBe(true);
    // Noun-only mention — wanting ownership ≠ demonstrating it
    expect(detectCompetencies("I want more ownership in my next role").has("ownership")).toBe(false);
  });

  it("customer-obsession fires on user-research / dogfooding language", () => {
    expect(detectCompetencies("I talked to five merchants before designing the flow").has("customer-obsession")).toBe(true);
    expect(detectCompetencies("We dug into NPS and drop-off data").has("customer-obsession")).toBe(true);
    expect(detectCompetencies("I dogfooded the app for two weeks").has("customer-obsession")).toBe(true);
    expect(detectCompetencies("Customer experience is important to me").has("customer-obsession")).toBe(false);
  });

  it("bias-for-action fires on speed / decisiveness language", () => {
    expect(detectCompetencies("I didn't wait for the spec — I shipped a v0 the same day").has("bias-for-action")).toBe(true);
    expect(detectCompetencies("Within 24 hours I had a prototype out").has("bias-for-action")).toBe(true);
    expect(detectCompetencies("I cut through the deadlock and proposed a path").has("bias-for-action")).toBe(true);
  });

  it("learn-and-be-curious fires on study / experimentation language", () => {
    expect(detectCompetencies("I didn't know Kafka so I read up over the weekend").has("learn-and-be-curious")).toBe(true);
    expect(detectCompetencies("I ran a spike to validate the approach").has("learn-and-be-curious")).toBe(true);
    expect(detectCompetencies("I paired with a senior engineer for two days").has("learn-and-be-curious")).toBe(true);
  });

  it("earn-trust fires on candour and rebuild-trust language", () => {
    expect(detectCompetencies("I rebuilt trust by sharing weekly demos").has("earn-trust")).toBe(true);
    expect(detectCompetencies("I was honest with the team about the slip").has("earn-trust")).toBe(true);
    expect(detectCompetencies("I admitted I had got the estimate wrong").has("earn-trust")).toBe(true);
  });

  it("deliver-results fires on shipped / on-time language", () => {
    expect(detectCompetencies("We shipped the feature on time despite the cutover").has("deliver-results")).toBe(true);
    expect(detectCompetencies("I delivered the refactor in six weeks").has("deliver-results")).toBe(true);
    expect(detectCompetencies("We hit the SLA two quarters running").has("deliver-results")).toBe(true);
  });

  it("dive-deep fires on investigation / data language", () => {
    expect(detectCompetencies("I root-caused it down to a single config flag").has("dive-deep")).toBe(true);
    expect(detectCompetencies("The data showed a 3x spike on Sundays").has("dive-deep")).toBe(true);
    expect(detectCompetencies("I pulled the logs and traced the request path").has("dive-deep")).toBe(true);
  });

  it("influence-without-authority fires on cross-team alignment language", () => {
    expect(detectCompetencies("I convinced the platform team to adopt our schema").has("influence-without-authority")).toBe(true);
    expect(detectCompetencies("I got buy-in from three partner teams").has("influence-without-authority")).toBe(true);
    expect(detectCompetencies("I partnered with another team on the rollout").has("influence-without-authority")).toBe(true);
  });

  it("think-big fires on long-horizon / multi-year framing", () => {
    expect(detectCompetencies("I proposed a multi-year migration plan").has("think-big")).toBe(true);
    expect(detectCompetencies("I made the case for a longer-term investment").has("think-big")).toBe(true);
    expect(detectCompetencies("I stepped back and reframed the problem").has("think-big")).toBe(true);
  });

  it("invent-and-simplify fires on simplification / reinvention", () => {
    expect(detectCompetencies("I simplified the deploy from 14 steps to 3").has("invent-and-simplify")).toBe(true);
    expect(detectCompetencies("I proposed a new architecture that cut the complexity").has("invent-and-simplify")).toBe(true);
    expect(detectCompetencies("I challenged the assumption that we needed all four services").has("invent-and-simplify")).toBe(true);
  });

  it("multiple competencies can fire on a single rich answer", () => {
    const text =
      "I owned the checkout migration. I talked to merchants weekly to validate the redesign. We shipped on time and reduced p99 latency by 40%.";
    const hits = detectCompetencies(text);
    expect(hits.has("ownership")).toBe(true);
    expect(hits.has("customer-obsession")).toBe(true);
    expect(hits.has("deliver-results")).toBe(true);
  });

  it("returns empty set for blank input", () => {
    expect(detectCompetencies("").size).toBe(0);
  });
});

describe("aggregateCompetencies — session-wide counts", () => {
  it("sums hits across multiple answers", () => {
    const answers = [
      "I owned the migration. We shipped on time.",
      "I drove cross-team alignment and rebuilt trust with platform.",
      "I dug into the data and root-caused the latency spike.",
    ];
    const counts = aggregateCompetencies(answers);
    expect(counts.ownership).toBe(2); // "I owned" + "I drove"
    expect(counts["deliver-results"]).toBeGreaterThanOrEqual(1);
    expect(counts["dive-deep"]).toBeGreaterThanOrEqual(1);
  });

  it("never returns negative or undefined counts", () => {
    const counts = aggregateCompetencies([]);
    for (const k of Object.keys(counts) as Array<keyof typeof counts>) {
      expect(counts[k]).toBe(0);
    }
  });
});

describe("topCompetenciesForTrack — weighted ranking", () => {
  it("returns competencies weighted for the target track", () => {
    const counts = aggregateCompetencies([
      "I owned the launch and shipped on time.",
      "I owned the migration end-to-end.",
      "I made the case for a longer-term roadmap investment.",
    ]);
    // amazon-lp weights both ownership and think-big — ownership wins on raw count.
    const top = topCompetenciesForTrack(counts, "amazon-lp", 3);
    expect(top[0]).toBe("ownership");
    expect(top).toContain("think-big");
  });

  it("filters to zero hits gracefully", () => {
    const counts = aggregateCompetencies(["yes", "ok", "hmm"]);
    expect(topCompetenciesForTrack(counts, "amazon-lp", 3)).toEqual([]);
  });

  it("falls back to unweighted top when track is null", () => {
    const counts = aggregateCompetencies([
      "I owned the launch.",
      "I drove the migration.",
      "I dogfooded the app for two weeks.",
    ]);
    const top = topCompetenciesForTrack(counts, null, 2);
    expect(top.length).toBe(2);
    // ownership has 2 hits, customer-obsession has 1 — ownership should rank first.
    expect(top[0]).toBe("ownership");
  });
});

describe("taxonomy invariants", () => {
  it("every competency has a label and a non-empty pattern set", () => {
    for (const k of Object.keys(COMPETENCY_PATTERNS) as Array<keyof typeof COMPETENCY_PATTERNS>) {
      expect(COMPETENCY_PATTERNS[k].length).toBeGreaterThanOrEqual(2);
      expect(COMPETENCY_LABELS[k]).toBeTruthy();
      expect(COMPETENCY_LABELS[k].length).toBeLessThan(32);
    }
  });

  it("every track has at least 4 load-bearing competencies", () => {
    for (const t of Object.keys(COMPETENCY_TRACK_WEIGHTS) as Array<keyof typeof COMPETENCY_TRACK_WEIGHTS>) {
      const n = Object.keys(COMPETENCY_TRACK_WEIGHTS[t]).length;
      expect(n).toBeGreaterThanOrEqual(4);
    }
  });
});

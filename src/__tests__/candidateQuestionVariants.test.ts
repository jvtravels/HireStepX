/* Candidate-question paraphrase variant tests (2026-05-29).
 *
 * The realism-pass added 2 paraphrases to each of the 14 curated topics
 * so repeat sessions don't get word-for-word identical recruiter prose.
 * These tests pin the rotation contract:
 *
 *   1. Without a seed → always returns `base` (back-compat, snapshot-stable).
 *   2. With a seed → returns one of {base, ...variants} deterministically.
 *   3. Two different seeds eventually return different prose for the same
 *      topic (otherwise the rotation isn't actually rotating).
 *   4. Sector / round overrides still preempt variants (persona-correctness
 *      beats paraphrase rotation).
 */

import { describe, it, expect } from "vitest";
import {
  renderCandidateQuestionResponse,
  type CandidateQuestionTopic,
} from "../../server-handlers/_candidate-question";

const ALL_TOPICS: readonly CandidateQuestionTopic[] = [
  "esop-structure",
  "fixed-variable-split",
  "budget-disclosure",
  "in-hand-monthly",
  "review-cycle",
  "location-remote",
  "verification-bgv",
  "benefits-non-ctc",
  "notice-buyout",
  "variable-mechanics",
  "range-grade-leverage",
  "tax-structuring",
  "channel-switch",
  "meta-coaching",
];

describe("renderCandidateQuestionResponse — variant rotation", () => {
  it("returns a non-null string for every topic with no seed (back-compat)", () => {
    for (const t of ALL_TOPICS) {
      const prose = renderCandidateQuestionResponse(t, null, null);
      expect(prose, `topic ${t} returned null`).toBeTruthy();
    }
  });

  it("returns the same prose for the same seed (deterministic)", () => {
    for (const t of ALL_TOPICS) {
      const a = renderCandidateQuestionResponse(t, null, null, "session-1:5");
      const b = renderCandidateQuestionResponse(t, null, null, "session-1:5");
      expect(a).toBe(b);
    }
  });

  it("rotation actually rotates — two seeds produce variant divergence across topics", () => {
    /* For each topic, run a sample of seeds. Across the sample we expect
     * at least two distinct prose strings to be returned (otherwise the
     * rotation is degenerate — either no variants or a hash collision). */
    for (const t of ALL_TOPICS) {
      const seen = new Set<string>();
      for (let i = 0; i < 12; i++) {
        const prose = renderCandidateQuestionResponse(t, null, null, `seed-${i}:${i}`);
        if (prose) seen.add(prose);
      }
      expect(seen.size, `topic ${t} returned only one variant across 12 seeds`).toBeGreaterThan(1);
    }
  });

  it("sector override preempts variant rotation (persona correctness wins)", () => {
    /* esop-structure has a bfsi sectorOverride. That override must fire
     * regardless of seed — we never paraphrase a sector-corrected
     * answer because the base + variants assume a different sector. */
    const proseA = renderCandidateQuestionResponse("esop-structure", "bfsi", null, "seed-1:0");
    const proseB = renderCandidateQuestionResponse("esop-structure", "bfsi", null, "seed-99:99");
    expect(proseA).toBe(proseB);
    expect(proseA).toContain("don't run ESOPs");
  });

  it("round override preempts variant rotation", () => {
    /* budget-disclosure has a director roundOverride. Same contract. */
    const proseA = renderCandidateQuestionResponse("budget-disclosure", null, "director", "seed-1:0");
    const proseB = renderCandidateQuestionResponse("budget-disclosure", null, "director", "seed-99:99");
    expect(proseA).toBe(proseB);
    // #114 lexicon: the director override dropped the "zip code" Americanism
    // for Indian recruiter register; "panel's read" is unique to this override.
    expect(proseA).toContain("panel's read");
  });
});

describe("renderCandidateQuestionResponse — phase tinting", () => {
  it("budget-disclosure shifts to closing-warm register under closing-push", () => {
    /* No sector / round / seed needed — phase alone should pick the
     * tinted variant. The closing-warm tint signals "I want this to land." */
    const prose = renderCandidateQuestionResponse(
      "budget-disclosure",
      null,
      null,
      null,
      "closing-push",
    );
    expect(prose).toBeTruthy();
    expect(prose).toContain("want this to land");
  });

  it("notice-buyout shifts to urgent register under closing-push", () => {
    const prose = renderCandidateQuestionResponse(
      "notice-buyout",
      null,
      null,
      null,
      "closing-push",
    );
    expect(prose).toContain("deal-maker");
  });

  it("fixed-variable-split shifts to closing-warm register under closing-push", () => {
    const prose = renderCandidateQuestionResponse(
      "fixed-variable-split",
      null,
      null,
      null,
      "closing-push",
    );
    expect(prose).toContain("sign something");
  });

  it("falls back to base / variant rotation when phase has no tint", () => {
    /* esop-structure has no phaseTinted entries — under any phase the
     * renderer should fall through to variant rotation (or base when
     * seed is null). */
    const prose = renderCandidateQuestionResponse(
      "esop-structure",
      null,
      null,
      null,
      "closing-push",
    );
    expect(prose).toContain("ESOP");
  });

  it("sector override preempts phase tint (content correctness wins)", () => {
    /* range-grade-leverage has both a closing-push tint AND a psu
     * sectorOverride. Sector must win — PSU grade-pay reality trumps
     * tone. */
    const prose = renderCandidateQuestionResponse(
      "range-grade-leverage",
      "psu",
      null,
      null,
      "closing-push",
    );
    expect(prose).toContain("cadre");
  });
});

describe("renderCandidateQuestionResponse — persona quirks", () => {
  it("PSU sector gets formal grade-pay register on budget-disclosure", () => {
    const prose = renderCandidateQuestionResponse("budget-disclosure", "psu", null);
    expect(prose).toContain("deputy GM");
  });

  it("Big-4 sector gets P&C / fitment lexicon on budget-disclosure", () => {
    const prose = renderCandidateQuestionResponse("budget-disclosure", "consulting-big4", null);
    expect(prose).toContain("P&C");
  });

  it("early-startup sector gets casual register on channel-switch", () => {
    const prose = renderCandidateQuestionResponse("channel-switch", "early-startup", null);
    expect(prose).toContain("hop on a call");
  });

  it("early-startup sector gets no-pressure register on meta-coaching", () => {
    const prose = renderCandidateQuestionResponse("meta-coaching", "early-startup", null);
    expect(prose).toContain("No pressure");
  });
});

/* PDF#29 Bug 5 (2026-05-18) — answer-validator semantic state guards.
 *
 * Symptom: bot emitted "Our final offer remains the same as presented
 * earlier." when highestOfferMade=0 — no offer had ever been presented.
 * Root cause: validateAnswer enforced number-allowlist + banned-idiom
 * only; no semantic guards against unfounded state claims, and the
 * answer-restyle path bypassed NEXT_ACTION_CONTRACT.
 *
 * fixture from PDF 29 manual replay session (2026-05-18) — phrasing per
 * kernel diagnostic.
 */
import { describe, it, expect } from "vitest";
import { validateAnswer } from "../../server-handlers/_response-pipeline";

describe("PDF#29 Bug 5 — validateAnswer semantic state guards", () => {
  it("rejects 'Our final offer remains the same...' when highestOfferMade=0 in discovery", () => {
    const r = validateAnswer(
      "Our final offer remains the same as presented earlier.",
      {},
      { highestOfferMade: 0, phase: "opening" },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("unfounded-final-offer-claim");
  });

  it("accepts the same phrasing once an offer is on the table in counter-offer phase", () => {
    const r = validateAnswer(
      "Our final offer remains the same as presented earlier.",
      {},
      { highestOfferMade: 28, phase: "counter-offer" },
    );
    expect(r.valid).toBe(true);
  });

  it("rejects 'our offer stands' when highestOfferMade=0", () => {
    const r = validateAnswer(
      "Our offer stands and we cannot move further.",
      {},
      { highestOfferMade: 0, phase: "probe-expectations" },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("unfounded-final-offer-claim");
  });

  it("rejects 'as presented earlier' when highestOfferMade=0", () => {
    const r = validateAnswer(
      "Sticking with the structure as presented earlier.",
      {},
      { highestOfferMade: 0, phase: "opening" },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("unfounded-final-offer-claim");
  });

  it("rejects band-leak in a pre-anchor phase", () => {
    const r = validateAnswer(
      "Our band lands you at ₹28 LPA",
      {},
      { highestOfferMade: 0, phase: "opening" },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("band-leak-pre-anchor");
  });

  it("rejects band-leak in probe-expectations", () => {
    const r = validateAnswer(
      "Our band for this grade caps at 32 LPA.",
      {},
      { highestOfferMade: 0, phase: "probe-expectations" },
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("band-leak-pre-anchor");
  });

  it("accepts band reference in post-anchor counter-offer phase", () => {
    const r = validateAnswer(
      "We can stretch within the band to 32 LPA.",
      { candidateCurrentCtc: 18, budgetBand: { low: 23, high: 32, walk: 20 } },
      { highestOfferMade: 23, phase: "counter-offer" },
    );
    expect(r.valid).toBe(true);
  });

  it("preserves back-compat — omitting stateContext skips the semantic guards", () => {
    const r = validateAnswer(
      "Our final offer remains the same as presented earlier.",
      {},
    );
    expect(r.valid).toBe(true);
  });
});

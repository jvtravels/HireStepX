/* S13-B6 (2026-07-18) — the "excited" sentiment prefix must not assert
 * range alignment ("Glad we're in the same range —") before any offer is
 * on the table. Pre-anchor (highestOfferMade === 0) the prefix falls back
 * to a neutral warm acknowledgement; once a range exists the "same range"
 * phrasing is legitimate. Locks the offerOnTable gate on
 * renderSentimentPrefix. */
import { describe, it, expect } from "vitest";
import { renderSentimentPrefix } from "../../server-handlers/_canonical-prose";

describe("renderSentimentPrefix — excited arm offer gate (S13-B6)", () => {
  it("does NOT claim 'same range' when no offer is on the table (pre-anchor)", () => {
    const prefix = renderSentimentPrefix("excited", false);
    expect(prefix).not.toBeNull();
    expect(prefix ?? "").not.toMatch(/same range/i);
  });

  it("defaults offerOnTable to false (no offer signal → no 'same range')", () => {
    const prefix = renderSentimentPrefix("excited");
    expect(prefix ?? "").not.toMatch(/same range/i);
  });

  it("MAY claim 'same range' once an offer exists (offerOnTable true)", () => {
    const prefix = renderSentimentPrefix("excited", true);
    expect(prefix).toMatch(/same range/i);
  });

  it("leaves the other sentiment arms unchanged", () => {
    expect(renderSentimentPrefix("frustrated", false)).toMatch(/hear you/i);
    expect(renderSentimentPrefix("hesitant", false)).toMatch(/take your time/i);
    expect(renderSentimentPrefix("decisive", true)).toBeNull();
    expect(renderSentimentPrefix("neutral", true)).toBeNull();
    expect(renderSentimentPrefix(null)).toBeNull();
  });
});

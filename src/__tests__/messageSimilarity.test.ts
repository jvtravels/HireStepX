/* Fix 4 (2026-05-15) — Full-message-repetition detector.
 *
 * Real session: bot sent verbatim "Current offer is ₹24 LPA total CTC.
 * Typical structure here is base around 75-85% of CTC..." two turns in
 * a row. Anti-repetition only tracked benefit tokens. The fix is a
 * word-shingle Jaccard at 5-grams. */
import { describe, it, expect } from "vitest";
import {
  detectBotReplyRepetition,
  BOT_REPLY_REPETITION_THRESHOLD,
} from "../../server-handlers/_recruiter-facts";

describe("detectBotReplyRepetition", () => {
  it("detects verbatim repetition", () => {
    const r = detectBotReplyRepetition(
      "Current offer is ₹24 LPA total CTC. Typical structure here is base around 75-85% of CTC.",
      "Current offer is ₹24 LPA total CTC. Typical structure here is base around 75-85% of CTC.",
    );
    expect(r.repeated).toBe(true);
    expect(r.similarity).toBeCloseTo(1, 1);
  });

  it("detects near-verbatim repetition above threshold", () => {
    const r = detectBotReplyRepetition(
      "Current offer is ₹24 LPA total CTC. Typical structure here is base around 75-85% of CTC overall.",
      "Current offer is ₹24 LPA total CTC. Typical structure here is base around 75-85% of CTC.",
    );
    expect(r.repeated).toBe(true);
    expect(r.similarity).toBeGreaterThanOrEqual(BOT_REPLY_REPETITION_THRESHOLD);
  });

  it("does NOT flag substantively different replies", () => {
    const r = detectBotReplyRepetition(
      "Vesting is 4-year with a 1-year cliff and monthly vesting thereafter.",
      "Current offer is ₹24 LPA total CTC. Typical structure is base around 75-85%.",
    );
    expect(r.repeated).toBe(false);
  });

  it("returns repeated=false when lastReply is null", () => {
    const r = detectBotReplyRepetition("Whatever the bot said.", null);
    expect(r.repeated).toBe(false);
    expect(r.similarity).toBe(0);
  });

  it("handles short replies gracefully", () => {
    const r = detectBotReplyRepetition("OK.", "OK.");
    expect(r.similarity).toBeGreaterThan(0);
  });

  it("does NOT flag paraphrased replies that share only a few tokens", () => {
    const r = detectBotReplyRepetition(
      "We anchor at ₹24L; let's discuss your expectations.",
      "Tell me more about your current notice period and joining timeline.",
    );
    expect(r.repeated).toBe(false);
  });
});

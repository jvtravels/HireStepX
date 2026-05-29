import { describe, it, expect } from "vitest";
import { renderCandidateQuestionResponse } from "../../server-handlers/_candidate-question";

describe("renderCandidateQuestionResponse — strict variant rotation", () => {
  it("a re-ask of the same topic lands on a different variant when serveCount advances", () => {
    /* Pick a topic that has variants. `variable-comfort` does. Ask three
     * times with serveCount 0, 1, 2 and assert each call returns a
     * different string. With at least 3 candidates in [base, ...variants]
     * the first three serves are guaranteed distinct. */
    const seed = "sess-A:5";
    const a = renderCandidateQuestionResponse("variable-mechanics", null, null, seed, null, 0);
    const b = renderCandidateQuestionResponse("variable-mechanics", null, null, seed, null, 1);
    const c = renderCandidateQuestionResponse("variable-mechanics", null, null, seed, null, 2);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(c).not.toBeNull();
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });

  it("serveCount=0 matches the legacy pure-hash output (back-compat)", () => {
    const seed = "sess-A:5";
    const withZero = renderCandidateQuestionResponse("variable-mechanics", null, null, seed, null, 0);
    const withoutCount = renderCandidateQuestionResponse("variable-mechanics", null, null, seed, null);
    expect(withZero).toBe(withoutCount);
  });

  it("serveCount wraps at candidate-list length", () => {
    /* Re-ask N+1 times where N is the variant count. The 0th and Nth
     * serves should coincide because (hash + 0) mod N == (hash + N) mod N. */
    const seed = "sess-B:7";
    const a0 = renderCandidateQuestionResponse("variable-mechanics", null, null, seed, null, 0);
    /* Probe candidate-list length by stepping until we wrap. We don't
     * hard-code N because the bank's variant counts can shift. Walk up
     * to 8 steps; first index where a_k === a_0 is the length. */
    let wrap = -1;
    for (let k = 1; k <= 8; k++) {
      const ak = renderCandidateQuestionResponse("variable-mechanics", null, null, seed, null, k);
      if (ak === a0) { wrap = k; break; }
    }
    expect(wrap).toBeGreaterThan(0);
    const aWrap = renderCandidateQuestionResponse("variable-mechanics", null, null, seed, null, wrap);
    expect(a0).toBe(aWrap);
  });

  it("returns null when topic has no entry in the bank", () => {
    /* Renderer falls back to null for unknown topics; the planner's
     * caller treats null as "no curated prose, use the safe generic
     * fallback ack". serveCount must not affect this path. */
    /* @ts-expect-error — exercising the null branch with a fake topic. */
    const out = renderCandidateQuestionResponse("nonexistent-topic", null, null, "sess:1", null, 3);
    expect(out).toBeNull();
  });
});

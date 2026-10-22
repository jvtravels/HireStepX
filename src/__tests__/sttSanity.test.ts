import { describe, it, expect } from "vitest";
import { detectSttGarbling, sttRepromptResponse } from "../../server-handlers/_stt-sanity";

describe("detectSttGarbling", () => {
  it("flags empty input", () => {
    expect(detectSttGarbling("")).toEqual({ garbled: true, reason: "empty" });
    expect(detectSttGarbling("   ")).toEqual({ garbled: true, reason: "empty" });
  });

  it("flags text with no tokens after stripping punctuation", () => {
    expect(detectSttGarbling("...")).toEqual({ garbled: true, reason: "no-tokens" });
  });

  it("flags a single-letter-cluster shape", () => {
    const result = detectSttGarbling("m. k. b. uh.");
    expect(result.garbled).toBe(true);
    expect(result.reason).toBe("single-letter-cluster");
  });

  it("passes a real short legit token like 'ok'", () => {
    expect(detectSttGarbling("ok.")).toEqual({ garbled: false, reason: null });
  });

  it("flags a low-word-ratio short fragment", () => {
    const result = detectSttGarbling("m k xz");
    expect(result.garbled).toBe(true);
  });

  it("passes a normal sentence", () => {
    expect(detectSttGarbling("I led the migration to the new payment provider last year.")).toEqual({
      garbled: false,
      reason: null,
    });
  });
});

describe("sttRepromptResponse", () => {
  it("returns the deterministic re-prompt string", () => {
    expect(sttRepromptResponse()).toBe("Sorry, I didn't catch that clearly. Could you say that again?");
  });
});

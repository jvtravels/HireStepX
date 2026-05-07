import { describe, it, expect } from "vitest";
import { categorizeLlmError, emptyBreakdown } from "../../server-handlers/_admin-llm-categorizer";

/* The categorizer drives the admin "Error Breakdown" card. Wrong buckets =
 * wrong root-cause call when the on-call engineer is triaging a degraded
 * session. These tests lock the regex contracts against drift.
 *
 * Notes:
 *   - "timeout" status takes priority over message content
 *   - rate-limit comes before server-error so 429 doesn't leak into 5xx
 *   - context-length wins over server-error for clarity */

describe("categorizeLlmError", () => {
  it("classifies status='timeout' as timeout regardless of message", () => {
    expect(categorizeLlmError("timeout", "")).toBe("timeout");
    expect(categorizeLlmError("timeout", "Some other text")).toBe("timeout");
  });

  it("classifies AbortError messages as timeout", () => {
    expect(categorizeLlmError("error", "Request was aborted")).toBe("timeout");
    expect(categorizeLlmError("error", "ETIMEDOUT")).toBe("timeout");
    expect(categorizeLlmError("error", "Request timed out after 6000ms")).toBe("timeout");
  });

  it("classifies HTTP 429 / rate-limit text as rateLimit", () => {
    expect(categorizeLlmError("error", "Groq error 429: Too Many Requests")).toBe("rateLimit");
    expect(categorizeLlmError("error", "tokens per minute exceeded")).toBe("rateLimit");
    expect(categorizeLlmError("error", "rate limit exceeded for this model")).toBe("rateLimit");
    expect(categorizeLlmError("error", "QUOTA EXCEEDED")).toBe("rateLimit");
  });

  it("classifies context-length errors", () => {
    expect(categorizeLlmError("error", "context length exceeded: 8192 tokens")).toBe("contextLength");
    expect(categorizeLlmError("error", "Maximum context length is 32768 tokens")).toBe("contextLength");
    expect(categorizeLlmError("error", "Prompt is too long")).toBe("contextLength");
  });

  it("classifies HTTP 5xx as serverError", () => {
    expect(categorizeLlmError("error", "Groq error 503: Service Unavailable")).toBe("serverError");
    expect(categorizeLlmError("error", "Gemini 502 Bad Gateway")).toBe("serverError");
    expect(categorizeLlmError("error", "model is currently overloaded")).toBe("serverError");
    expect(categorizeLlmError("error", "Service is temporarily unavailable")).toBe("serverError");
  });

  it("classifies auth errors", () => {
    expect(categorizeLlmError("error", "Groq error 401: Unauthorized")).toBe("auth");
    expect(categorizeLlmError("error", "403 Forbidden")).toBe("auth");
    expect(categorizeLlmError("error", "Invalid API key")).toBe("auth");
  });

  it("classifies safety blocks", () => {
    expect(categorizeLlmError("error", "Response blocked by safety settings")).toBe("safety");
    expect(categorizeLlmError("error", "Content policy violation")).toBe("safety");
    expect(categorizeLlmError("error", "Recitation detected")).toBe("safety");
  });

  it("falls through to 'other' for unrecognized errors", () => {
    expect(categorizeLlmError("error", "Some random error")).toBe("other");
    expect(categorizeLlmError("error", "")).toBe("other");
    expect(categorizeLlmError(null, null)).toBe("other");
    expect(categorizeLlmError("error", undefined)).toBe("other");
  });

  it("priority: timeout wins over rate-limit when both present", () => {
    // A 429 that aborted mid-flight should be classified as timeout
    // (the timeout is what the user actually experienced).
    expect(categorizeLlmError("timeout", "429 too many requests")).toBe("timeout");
  });

  it("priority: rate-limit wins over serverError on 429 + 5xx mention", () => {
    // 429 mentions are higher signal than 503 mentions; the order in
    // categorizeLlmError reflects that. Lock it.
    expect(categorizeLlmError("error", "429 ... fallback to 503")).toBe("rateLimit");
  });
});

describe("emptyBreakdown", () => {
  it("returns a zeroed breakdown with all bucket keys", () => {
    const b = emptyBreakdown();
    expect(b).toEqual({
      rateLimit: 0,
      contextLength: 0,
      timeout: 0,
      serverError: 0,
      auth: 0,
      safety: 0,
      other: 0,
    });
  });

  it("returns a fresh object each call (no shared mutable state)", () => {
    const a = emptyBreakdown();
    const b = emptyBreakdown();
    a.rateLimit = 5;
    expect(b.rateLimit).toBe(0);
  });
});

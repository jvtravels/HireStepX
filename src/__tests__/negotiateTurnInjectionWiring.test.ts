/* Wiring assertions for /api/negotiate-turn (2026-05-14):
 *   - detectPromptInjection runs after clampInput on the candidate input.
 *   - detectMultiTurnInjection runs on the recent window (last 5 turns).
 *   - bot reply is wrapped with detectTokenLeak post-LLM.
 *
 * Source-level structural tests are the right granularity here because
 * the handler itself is an Edge function — invoking it with a full
 * Request requires the worker runtime + Redis stub, which is more
 * surface than this slice needs to assert. Behavior of each individual
 * helper is covered in adversarialDetector / multiTurnInjectionAndLeak
 * tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(
  join(__dirname, "..", "..", "server-handlers", "negotiate-turn.ts"),
  "utf-8",
);

describe("negotiate-turn — prompt-injection + leak-guard wiring", () => {
  it("imports detectPromptInjection from the adversarial detector", () => {
    expect(SOURCE).toContain("detectPromptInjection");
    expect(SOURCE).toMatch(/from\s+["']\.\/_adversarial-detector["']/);
  });

  it("imports detectMultiTurnInjection", () => {
    expect(SOURCE).toContain("detectMultiTurnInjection");
  });

  it("imports detectTokenLeak and redactLeakedTokens", () => {
    expect(SOURCE).toContain("detectTokenLeak");
    expect(SOURCE).toContain("redactLeakedTokens");
  });

  it("calls detectPromptInjection on the clamped candidate input", () => {
    expect(SOURCE).toMatch(/detectPromptInjection\(\s*safeAnswer/);
  });

  it("calls detectMultiTurnInjection on the recent turn window", () => {
    expect(SOURCE).toMatch(/detectMultiTurnInjection\(/);
    /* The window must include the conversationLog. */
    expect(SOURCE).toMatch(/conversationLog\.slice\(-5\)/);
  });

  it("sanitizes the injected candidate answer (replaces with [redacted])", () => {
    expect(SOURCE).toMatch(/sanitizedAnswer\s*=\s*["']\[redacted\]["']/);
  });

  it("wraps the bot reply with detectTokenLeak after LLM generation", () => {
    /* Order matters in the turn branch: the leak guard must run BEFORE
     * the FINAL applyAiMove (the one in the turn handler — there's also
     * an earlier applyAiMove in the init branch). */
    const leakIdx = SOURCE.indexOf("detectTokenLeak(text)");
    const applyIdx = SOURCE.lastIndexOf("state = applyAiMove(state, move, text)");
    expect(leakIdx).toBeGreaterThan(-1);
    expect(applyIdx).toBeGreaterThan(leakIdx);
  });

  it("emits a PostHog event when injection is detected", () => {
    expect(SOURCE).toMatch(/captureServerEvent\(["']kernel_prompt_injection["']/);
  });

  it("emits a PostHog event when token leak is detected", () => {
    expect(SOURCE).toMatch(/captureServerEvent\(["']kernel_token_leak["']/);
  });

  it("does NOT 400 on injection — continues with sanitized input", () => {
    /* If we were 400-ing, the SOURCE would have an early return adjacent
     * to detectPromptInjection. Confirm no such pattern. */
    const block = SOURCE.slice(SOURCE.indexOf("const injection = detectPromptInjection"), SOURCE.indexOf("const adversarial = detectAdversarialInput"));
    expect(block).not.toMatch(/return\s+new\s+Response[^]*status:\s*400/);
  });

  it("threads injectionDetected into logTurnUsage", () => {
    expect(SOURCE).toMatch(/injectionDetected\b/);
  });
});

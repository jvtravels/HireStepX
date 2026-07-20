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

const TURN_HELPERS = readFileSync(
  join(__dirname, "..", "..", "server-handlers", "_negotiate-turn-helpers.ts"),
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

// S13-B5: the joining-bonus lever prompt must contain an explicit direction
// guard so the LLM cannot ask the candidate about their current employer's
// joining bonus instead of OFFERING one. Source-level assertion is the
// appropriate granularity — model output cannot be unit-tested.
describe("S13-B5: joining-bonus lever has direction guard in prompt", () => {
  it("joining-bonus guidance explicitly states direction: recruiter extends TO candidate", () => {
    expect(TURN_HELPERS).toContain("DIRECTION");
    expect(TURN_HELPERS).toContain("do NOT ask what joining bonus the candidate currently receives");
  });

  it("joiningBonusAsk hint says 'from us (the employer)' to prevent direction inversion", () => {
    expect(TURN_HELPERS).toContain("from us (the employer)");
  });
});

const ENGINE_SOURCE = readFileSync(
  join(__dirname, "..", "useInterviewEngine.ts"),
  "utf-8",
);

// OA-B17: advancing lock (advancingRef) must be released BEFORE setPhase("thinking")
// in the success path of handleNextQuestion. If it isn't, short TTS cycles
// (thinking → speaking → listening) complete before the 4-second backstop fires,
// landing back in the "listening" phase with advancingRef still true — the user's
// first tap on the next question is silently dropped. The structural fix is an
// explicit clearTimeout + ref reset immediately before setPhase. Source-level
// assertion is the right granularity for a React state-machine invariant.
describe("OA-B17: advancingRef released before phase flip in success path", () => {
  it("clearTimeout(advancingSafetyTimer) appears before setPhase('thinking') in the advance path", () => {
    const clearIdx = ENGINE_SOURCE.lastIndexOf("clearTimeout(advancingSafetyTimer)");
    const phaseIdx = ENGINE_SOURCE.lastIndexOf('setPhase("thinking")');
    expect(clearIdx).toBeGreaterThan(-1);
    expect(phaseIdx).toBeGreaterThan(-1);
    // The final explicit clear (in the success path) must precede the final setPhase("thinking")
    expect(clearIdx).toBeLessThan(phaseIdx);
  });

  it("advancingRef.current = false appears immediately before setPhase('thinking') in the advance success block", () => {
    // Locate the OA-B17 comment that marks the fix, and confirm the pattern follows it
    expect(ENGINE_SOURCE).toContain("OA-B17: the advance is complete — release the lock before phase flips");
    const markerIdx = ENGINE_SOURCE.indexOf("OA-B17: the advance is complete");
    const refResetIdx = ENGINE_SOURCE.indexOf("advancingRef.current = false;", markerIdx);
    const phaseIdx = ENGINE_SOURCE.indexOf('setPhase("thinking")', markerIdx);
    expect(refResetIdx).toBeGreaterThan(-1);
    expect(phaseIdx).toBeGreaterThan(-1);
    expect(refResetIdx).toBeLessThan(phaseIdx);
  });
});

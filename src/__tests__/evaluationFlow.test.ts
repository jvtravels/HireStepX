import { describe, it, expect, vi } from "vitest";
import { runEvaluationFlow } from "../_evaluation-flow";

/* runEvaluationFlow is async and depends on fetchLLMEvaluation +
   saveToIDB; both are injected via the input bag for testability.
   These tests cover the four important branches:
     1. No answers — short-circuits to the fallback message
     2. LLM returns a valid evaluation — values flow through
     3. LLM call times out — usedFallback=false, evalTimedOut=true
     4. LLM call fails with a network error — queues an offline retry */

const baseTranscript = [
  { speaker: "ai" as const, text: "Tell me about yourself.", time: "00:01" },
  { speaker: "user" as const, text: "I led a six-person team and shipped a migration that improved deploys by 40%.", time: "00:02" },
];

const baseInput = {
  evalTranscript: baseTranscript,
  currentStep: 5,
  scriptLength: 6,
  difficulty: "standard",
  elapsed: 600,
  interviewType: "behavioral",
  originalQuestions: ["Tell me about yourself."],
  role: "Senior Engineer",
  evalAbort: new AbortController(),
  sessionId: "test-session-1",
};

describe("runEvaluationFlow", () => {
  it("short-circuits with the no-answers message when transcript has no user turns", async () => {
    const out = await runEvaluationFlow({
      ...baseInput,
      evalTranscript: [{ speaker: "ai", text: "Tell me about yourself.", time: "00:01" }],
      fetchEvaluation: vi.fn().mockResolvedValue(null),
      saveOfflineRetry: vi.fn(),
    });
    expect(out.usedFallback).toBe(true);
    expect(out.aiFeedback).toMatch(/no answers were recorded/i);
  });

  it("merges LLM evaluation values when the call succeeds", async () => {
    const fetchEval = vi.fn().mockResolvedValue({
      overallScore: 82,
      skillScores: { Communication: 85, Structure: 80 },
      strengths: ["Concrete metrics", "Clear ownership"],
      improvements: ["Tighten the opening"],
      feedback: "Strong example with measurable outcome.",
      idealAnswers: [{ question: "Tell me about yourself.", ideal: "...", candidateSummary: "..." }],
    });
    const out = await runEvaluationFlow({
      ...baseInput,
      fetchEvaluation: fetchEval,
      saveOfflineRetry: vi.fn(),
    });
    expect(out.score).toBe(82);
    expect(out.aiFeedback).toMatch(/strong example/i);
    expect(out.skillScores.Communication).toBe(85);
    expect(out.usedFallback).toBe(false);
    expect(out.evalTimedOut).toBe(false);
  });

  it("flags evalTimedOut and emits a toast when the LLM throws a timeout", async () => {
    const out = await runEvaluationFlow({
      ...baseInput,
      fetchEvaluation: vi.fn().mockRejectedValue(new Error("Request timed out after 18s")),
      saveOfflineRetry: vi.fn(),
    });
    expect(out.evalTimedOut).toBe(true);
    expect(out.usedFallback).toBe(false);
    expect(out.toastMessage).toMatch(/took too long/i);
    expect(out.aiFeedback.length).toBeGreaterThan(0);
  });

  it("queues an offline retry when the LLM call fails with a network error", async () => {
    const saveRetry = vi.fn().mockResolvedValue(undefined);
    const out = await runEvaluationFlow({
      ...baseInput,
      fetchEvaluation: vi.fn().mockRejectedValue(new Error("network fetch failed")),
      saveOfflineRetry: saveRetry,
    });
    expect(out.usedFallback).toBe(true);
    expect(out.saveWarning).toMatch(/network fetch failed/i);
    expect(saveRetry).toHaveBeenCalledTimes(1);
    const [retryKey, payload] = saveRetry.mock.calls[0];
    expect(retryKey).toBe(`hirestepx_eval_retry_${baseInput.sessionId}`);
    expect((payload as { sessionId: string }).sessionId).toBe(baseInput.sessionId);
  });

  it("falls back to estimated scores when the LLM returns null", async () => {
    const out = await runEvaluationFlow({
      ...baseInput,
      fetchEvaluation: vi.fn().mockResolvedValue(null),
      saveOfflineRetry: vi.fn(),
    });
    expect(out.usedFallback).toBe(true);
    expect(out.aiFeedback).toMatch(/evaluation unavailable/i);
    // Score still produced from the heuristic fallback
    expect(typeof out.score).toBe("number");
    expect(out.score).toBeGreaterThanOrEqual(0);
  });

  it("passes negotiationContext through only for salary-negotiation type", async () => {
    const fetchEval = vi.fn().mockResolvedValue(null);
    await runEvaluationFlow({
      ...baseInput,
      interviewType: "salary-negotiation",
      negotiationBand: { initialOffer: 1500000, maxStretch: 2000000 },
      targetSalary: 1800000,
      highestOfferMade: 1700000,
      negotiationStyle: "defensive",
      fetchEvaluation: fetchEval,
      saveOfflineRetry: vi.fn(),
    });
    const passed = fetchEval.mock.calls[0][0];
    expect(passed.negotiationContext).toBeDefined();
    expect(passed.negotiationContext.initialOffer).toBe(1500000);
    expect(passed.negotiationContext.candidateTarget).toBe(1800000);
    expect(passed.negotiationContext.negotiationStyle).toBe("defensive");
  });

  it("omits negotiationContext entirely for non-negotiation types", async () => {
    const fetchEval = vi.fn().mockResolvedValue(null);
    await runEvaluationFlow({
      ...baseInput,
      fetchEvaluation: fetchEval,
      saveOfflineRetry: vi.fn(),
    });
    expect(fetchEval.mock.calls[0][0].negotiationContext).toBeUndefined();
  });
});

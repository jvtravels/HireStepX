import { describe, it, expect, vi, beforeEach } from "vitest";

const callLLMMock = vi.fn();
vi.mock("../../server-handlers/_llm", () => ({
  callLLM: (...args: unknown[]) => callLLMMock(...args),
  extractJSON: <T,>(text: string): T | null => {
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  },
}));

import { llmRerankCandidates, blendScore } from "../../server-handlers/_requirement-match-llm";
import type { CandidatePoolRow, RequirementInput } from "../../server-handlers/_requirement-match-helpers";

function candidate(overrides: Partial<CandidatePoolRow> = {}): CandidatePoolRow {
  return {
    id: "c1",
    name: "Candidate",
    target_role: "Backend Engineer",
    industry: "Tech",
    resume_data: { skills: ["Node.js", "Postgres"] },
    avg_score: 70,
    sessions_completed: 3,
    last_active_days_ago: 1,
    ...overrides,
  };
}

const req: RequirementInput = { title: "Backend Engineer", location: "Bengaluru", description: "Build APIs in Node.js" };

describe("llmRerankCandidates", () => {
  beforeEach(() => {
    callLLMMock.mockReset();
  });

  it("returns an empty map for an empty candidate list without calling the LLM", async () => {
    const result = await llmRerankCandidates(req, [], {});
    expect(result.size).toBe(0);
    expect(callLLMMock).not.toHaveBeenCalled();
  });

  it("parses a valid JSON array response into a candidateId -> score map", async () => {
    callLLMMock.mockResolvedValue({ text: JSON.stringify([{ candidateId: "c1", score: 82 }]), model: "gemini" });
    const result = await llmRerankCandidates(req, [candidate()], {});
    expect(result.get("c1")).toBe(82);
  });

  it("clamps out-of-range scores into 0-100", async () => {
    callLLMMock.mockResolvedValue({ text: JSON.stringify([{ candidateId: "c1", score: 140 }]), model: "gemini" });
    const result = await llmRerankCandidates(req, [candidate()], {});
    expect(result.get("c1")).toBe(100);
  });

  it("skips malformed rows (missing fields, wrong types) without throwing", async () => {
    callLLMMock.mockResolvedValue({
      text: JSON.stringify([{ candidateId: "c1" }, { score: 50 }, { candidateId: "c2", score: "not a number" }]),
      model: "gemini",
    });
    const result = await llmRerankCandidates(req, [candidate()], {});
    expect(result.size).toBe(0);
  });

  it("returns an empty map when the LLM response isn't a JSON array", async () => {
    callLLMMock.mockResolvedValue({ text: JSON.stringify({ candidateId: "c1", score: 90 }), model: "gemini" });
    const result = await llmRerankCandidates(req, [candidate()], {});
    expect(result.size).toBe(0);
  });

  it("returns an empty map (never throws) when every LLM provider fails", async () => {
    callLLMMock.mockRejectedValue(new Error("all providers failed"));
    const result = await llmRerankCandidates(req, [candidate()], {});
    expect(result.size).toBe(0);
  });

  it("passes userId through to callLLM's meta", async () => {
    callLLMMock.mockResolvedValue({ text: "[]", model: "gemini" });
    await llmRerankCandidates(req, [candidate()], { userId: "user-123" });
    const metaArg = callLLMMock.mock.calls[0][2];
    expect(metaArg.userId).toBe("user-123");
  });

  it("includes the requirement's structured skills and experience band in the prompt", async () => {
    callLLMMock.mockResolvedValue({ text: "[]", model: "gemini" });
    const withSkills: RequirementInput = { ...req, skills: ["Node.js", "Postgres"], experienceMin: 2, experienceMax: 5 };
    await llmRerankCandidates(withSkills, [candidate()], {});
    const prompt = callLLMMock.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("Node.js");
    expect(prompt).toContain("2-5 years");
  });

  it("degrades gracefully when skills/experience are omitted", async () => {
    callLLMMock.mockResolvedValue({ text: "[]", model: "gemini" });
    await llmRerankCandidates(req, [candidate()], {});
    const prompt = callLLMMock.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("not specified");
    expect(prompt).toContain("any-any years");
  });
});

describe("blendScore", () => {
  it("averages the deterministic and LLM scores 50/50", () => {
    expect(blendScore(60, 80)).toBe(70);
  });

  it("falls back to the deterministic score when the LLM has no opinion", () => {
    expect(blendScore(42, undefined)).toBe(42);
  });

  it("rounds to the nearest integer", () => {
    expect(blendScore(61, 60)).toBe(61);
  });
});

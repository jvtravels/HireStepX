import { describe, it, expect, vi, beforeEach } from "vitest";

const store = vi.hoisted(() => new Map<string, string>());
const llm = vi.hoisted(() => ({ calls: 0 }));

vi.mock("../../server-handlers/_shared", () => ({
  redisGet: async (k: string) => store.get(k) ?? null,
  redisSetEx: async (k: string, _t: number, v: string) => { store.set(k, v); },
  hashStable: async (s: string) => s,
}));
vi.mock("../../server-handlers/_llm", () => ({
  callLLM: async () => { llm.calls++; return { text: '[{"candidateId":"c1","score":80}]', model: "m" }; },
  extractJSON: (t: string) => JSON.parse(t),
}));

import { llmRerankCandidates } from "../../server-handlers/_requirement-match-llm";

const req = { title: "SWE", location: "Pune", skills: ["react"], description: "build", experienceMin: 1, experienceMax: 3 } as never;
const cand = (id: string) => ({ id, target_role: "SWE", industry: "it", resume_data: null, sessions_completed: 2, avg_score: 70 }) as never;

describe("llmRerankCandidates cache", () => {
  beforeEach(() => { store.clear(); llm.calls = 0; });

  it("skips the LLM when requirement and shortlist are unchanged", async () => {
    const a = await llmRerankCandidates(req, [cand("c1")], {});
    const b = await llmRerankCandidates(req, [cand("c1")], {});
    expect(a.get("c1")).toBe(80);
    expect(b.get("c1")).toBe(80);
    expect(llm.calls).toBe(1);
  });

  it("re-calls the LLM when the shortlist changes", async () => {
    await llmRerankCandidates(req, [cand("c1")], {});
    await llmRerankCandidates(req, [cand("c1"), cand("c2")], {});
    expect(llm.calls).toBe(2);
  });
});

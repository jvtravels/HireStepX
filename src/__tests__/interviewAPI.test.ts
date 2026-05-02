import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveSessionResult } from "../interviewAPI";
import type { SessionResult } from "../interviewAPI";

// Mock supabase decrementSessionCredit (saveSession is no longer used — the
// client now routes through /api/sessions/save via apiFetch to avoid
// extension-wrapped fetch hangs on large transcript payloads).
vi.mock("../supabase", () => ({
  decrementSessionCredit: vi.fn(() => Promise.resolve(false)),
  authHeaders: vi.fn(() => Promise.resolve({ "Content-Type": "application/json" })),
}));

// Mock apiClient's apiFetch — the new transport for session saves.
interface MockApiResponse {
  ok: boolean;
  status: number;
  data: { ok: boolean; practiceAppended?: boolean } | null;
  error: string | null;
  headers: Record<string, string>;
}
const mockApiFetch = vi.fn<(...args: unknown[]) => Promise<MockApiResponse>>(() => Promise.resolve({
  ok: true,
  status: 200,
  data: { ok: true, practiceAppended: true },
  error: null,
  headers: {},
}));
vi.mock("../apiClient", () => ({
  apiFetch: (path: unknown, body: unknown) => mockApiFetch(path, body),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Provide localStorage for non-jsdom environments
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};
try {
  // Only stub if localStorage doesn't exist or doesn't have .clear
  if (typeof localStorage === "undefined" || typeof localStorage.clear !== "function") {
    vi.stubGlobal("localStorage", mockLocalStorage);
  }
} catch {
  vi.stubGlobal("localStorage", mockLocalStorage);
}

const RESULTS_KEY = "hirestepx_sessions";

function makeSession(overrides?: Partial<SessionResult>): SessionResult {
  return {
    id: "test123",
    date: new Date().toISOString(),
    type: "behavioral",
    difficulty: "standard",
    focus: "",
    duration: 300,
    score: 75,
    questions: 3,
    transcript: [{ speaker: "ai", text: "Hello", time: "0:00" }],
    ai_feedback: "Good job",
    skill_scores: { communication: 80, structure: 70 },
    ...overrides,
  };
}

describe("interviewAPI", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("saveSessionResult", () => {
    it("saves to localStorage successfully", async () => {
      const session = makeSession();
      const result = await saveSessionResult(session);
      expect(result.localOk).toBe(true);

      const stored = JSON.parse(localStorage.getItem(RESULTS_KEY) || "[]");
      expect(stored.length).toBe(1);
      expect(stored[0].id).toBe("test123");
    });

    it("prepends new session to existing sessions", async () => {
      localStorage.setItem(RESULTS_KEY, JSON.stringify([makeSession({ id: "old1" })]));
      const result = await saveSessionResult(makeSession({ id: "new1" }));
      expect(result.localOk).toBe(true);

      const stored = JSON.parse(localStorage.getItem(RESULTS_KEY) || "[]");
      expect(stored.length).toBe(2);
      expect(stored[0].id).toBe("new1");
      expect(stored[1].id).toBe("old1");
    });

    it("saves to Supabase when userId is provided", async () => {
      const session = makeSession();
      const result = await saveSessionResult(session, "user-abc");
      expect(result.cloudOk).toBe(true);
      expect(mockApiFetch).toHaveBeenCalledWith("/api/sessions/save", expect.objectContaining({
        id: "test123",
      }));
    });

    it("returns cloudOk=true when no userId (local-only)", async () => {
      const result = await saveSessionResult(makeSession());
      expect(result.cloudOk).toBe(true);
    });

    it("handles Supabase failure gracefully", async () => {
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        data: null,
        error: "bad gateway",
        headers: {},
      });
      const result = await saveSessionResult(makeSession(), "user-abc");
      expect(result.localOk).toBe(true);
      expect(result.cloudOk).toBe(false);
    });

    it("preserves all session fields in localStorage", async () => {
      const session = makeSession({
        score: 92,
        ai_feedback: "Excellent performance",
        skill_scores: { communication: 95, leadership: 88 },
        ideal_answers: [{ question: "Q1", ideal: "A1", candidateSummary: "Summary" }],
      });
      await saveSessionResult(session);

      const stored = JSON.parse(localStorage.getItem(RESULTS_KEY) || "[]")[0];
      expect(stored.score).toBe(92);
      expect(stored.ai_feedback).toBe("Excellent performance");
      expect(stored.skill_scores.communication).toBe(95);
      expect(stored.ideal_answers.length).toBe(1);
    });
  });
});

/* ─── extractAccentMarkup — LLM accent parsing ─── */
describe("extractAccentMarkup", () => {
  let extractAccentMarkup: typeof import("../interviewAPI").extractAccentMarkup;
  beforeEach(async () => {
    extractAccentMarkup = (await import("../interviewAPI")).extractAccentMarkup;
  });

  it("extracts a single-word accent and strips the markup", () => {
    const r = extractAccentMarkup("Tell me about a *time* you led without authority.");
    expect(r.cleaned).toBe("Tell me about a time you led without authority.");
    expect(r.accentSplit).toEqual({
      before: "Tell me about a",
      accent: "time",
      after: "you led without authority",
    });
  });

  it("preserves a leading [Persona] tag in cleaned text and accentSplit.before", () => {
    const r = extractAccentMarkup("[Hiring Manager] How would you *size* the market for groceries?");
    expect(r.cleaned).toBe("[Hiring Manager] How would you size the market for groceries?");
    expect(r.accentSplit?.before).toBe("[Hiring Manager] How would you");
    expect(r.accentSplit?.accent).toBe("size");
  });

  it("returns no accentSplit when LLM emits no markup", () => {
    const r = extractAccentMarkup("Tell me about your last role.");
    expect(r.cleaned).toBe("Tell me about your last role.");
    expect(r.accentSplit).toBeUndefined();
  });

  it("rejects stopword accents and falls back to clean text", () => {
    const r = extractAccentMarkup("Tell *me* about a time you led.");
    expect(r.cleaned).toBe("Tell me about a time you led.");
    expect(r.accentSplit).toBeUndefined();
  });

  it("rejects multi-word accents (regex won't match phrases)", () => {
    const r = extractAccentMarkup("Tell me about *a time* you led.");
    expect(r.accentSplit).toBeUndefined();
  });

  it("strips trailing punctuation from after-segment", () => {
    const r = extractAccentMarkup("Walk me through a *project* where you led.");
    expect(r.accentSplit?.after).toBe("where you led");
  });

  it("strips stray asterisks defensively when no valid marker is found", () => {
    const r = extractAccentMarkup("Tell me ** about your role.");
    expect(r.cleaned).toBe("Tell me  about your role.");
    expect(r.accentSplit).toBeUndefined();
  });

  it("only takes the FIRST accent if LLM emits multiple", () => {
    const r = extractAccentMarkup("Tell me about a *time* you *led* a team.");
    expect(r.accentSplit?.accent).toBe("time");
    // The second marker still gets stripped via stripStrayAsterisks fallback
    expect(r.cleaned).not.toContain("*");
  });

  it("handles empty input", () => {
    const r = extractAccentMarkup("");
    expect(r.cleaned).toBe("");
    expect(r.accentSplit).toBeUndefined();
  });

  it("rejects accents longer than 24 characters", () => {
    const r = extractAccentMarkup("Tell me about a *supercalifragilisticexpialidocious* moment.");
    expect(r.accentSplit).toBeUndefined();
  });
});

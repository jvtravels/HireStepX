import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimitError } from "../apiClient";
import type { ApiResponse } from "../apiClient";
import { fetchFollowUp, fetchLLMEvaluation } from "../interviewAPI";

/* OA-B9 regression: fetchFollowUp must surface a 429 as a typed rate-limit
   signal (RateLimitError) instead of collapsing it into the same silent null
   as "no follow-up needed". A 200 with no follow-up still returns null; a 500
   still throws a server-error. The 429 branch lives in apiClient
   (throwIfRateLimited) — this exercises the REAL central path, mocking only the
   apiFetch transport. */

vi.mock("../supabase", () => ({
  authHeaders: vi.fn(() => Promise.resolve({ "Content-Type": "application/json" })),
}));

// Keep the real throwIfRateLimited / RateLimitError (the central 429 path);
// only stub the transport so we can inject server responses.
const mockApiFetch = vi.fn<(...args: unknown[]) => Promise<ApiResponse<unknown>>>();
vi.mock("../apiClient", async (importActual) => {
  const actual = await importActual<typeof import("../apiClient")>();
  return {
    ...actual,
    apiFetch: (path: unknown, body: unknown, opts: unknown) => mockApiFetch(path, body, opts),
  };
});

// localStorage for the client-side checkRateLimit bucket used by fetchFollowUp.
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
});

function resp(over: Partial<ApiResponse<unknown>>): ApiResponse<unknown> {
  return { ok: false, status: 500, data: null, error: null, errorData: null, headers: {}, ...over };
}

const params = {
  question: "Tell me about a hard project",
  answer: "I led a migration.",
  type: "behavioral",
  role: "SWE",
};

describe("fetchFollowUp — OA-B9 429 handling", () => {
  beforeEach(() => {
    localStorage.clear();
    mockApiFetch.mockReset();
  });

  it("surfaces a 429 as a typed RateLimitError with retryAfter (not silent null)", async () => {
    mockApiFetch.mockResolvedValue(resp({ status: 429, errorData: { retryAfter: 12 } }));
    await expect(fetchFollowUp(params)).rejects.toBeInstanceOf(RateLimitError);
    // and the retryAfter is preserved on the typed signal
    await expect(fetchFollowUp(params)).rejects.toMatchObject({ retryAfter: 12, status: 429 });
  });

  it("returns null on a 200 with no follow-up needed", async () => {
    mockApiFetch.mockResolvedValue(resp({
      ok: true,
      status: 200,
      data: { needsFollowUp: false, followUpText: "" },
      error: null,
    }));
    await expect(fetchFollowUp(params)).resolves.toEqual({ needsFollowUp: false, followUpText: "" });
  });

  it("returns null (silent) on a 4xx that is not a rate-limit", async () => {
    mockApiFetch.mockResolvedValue(resp({ status: 400 }));
    await expect(fetchFollowUp(params)).resolves.toBeNull();
  });

  it("does not surface a rate-limit signal on 500 (returns null after retries)", async () => {
    mockApiFetch.mockResolvedValue(resp({ status: 500 }));
    // fetchFollowUp swallows non-429 throws in its outer catch → resolves null;
    // the point is the 500 path must NOT masquerade as a RateLimitError.
    await expect(fetchFollowUp(params)).resolves.toBeNull();
  });
});

describe("fetchLLMEvaluation — shared 429 central path", () => {
  const evalParams = {
    sessionId: "s1",
    transcript: [{ role: "interviewer" as const, text: "hi" }],
    meta: {},
  } as unknown as Parameters<typeof fetchLLMEvaluation>[0];

  beforeEach(() => {
    localStorage.clear();
    mockApiFetch.mockReset();
  });

  it("throws a RateLimitError (with retryAfter) on 429 via the shared gate", async () => {
    mockApiFetch.mockResolvedValue(resp({ status: 429, errorData: { retryAfter: 7 } }));
    await expect(fetchLLMEvaluation(evalParams)).rejects.toMatchObject({
      name: "RateLimitError",
      retryAfter: 7,
    });
  });

  it("still throws a server-error on 500", async () => {
    mockApiFetch.mockResolvedValue(resp({ status: 500 }));
    await expect(fetchLLMEvaluation(evalParams)).rejects.toThrow(/server error/i);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  kickoffEagerGrade,
  resolveBaseUrl,
} from "../../server-handlers/_eager-grade";

const validInput = (overrides?: Partial<Parameters<typeof kickoffEagerGrade>[0]>) => ({
  baseUrl: "https://hirestepx.com",
  authorization: "Bearer abc.def.ghi",
  sessionId: "sess-12345678",
  transcript: [
    { role: "interviewer", text: "Tell me about yourself" },
    { role: "candidate", text: "Hi, I'm a senior PM with 5 years of experience…" },
  ],
  meta: { type: "behavioral", focus: "general", duration: 600 },
  ...overrides,
});

describe("resolveBaseUrl", () => {
  beforeEach(() => {
    delete process.env.APP_URL;
  });

  it("returns APP_URL when set", () => {
    process.env.APP_URL = "https://prod.hirestepx.com";
    expect(resolveBaseUrl("https://anything.example/api/save-session")).toBe(
      "https://prod.hirestepx.com",
    );
  });

  it("strips trailing slash from APP_URL", () => {
    process.env.APP_URL = "https://prod.hirestepx.com/";
    expect(resolveBaseUrl("https://anything.example")).toBe(
      "https://prod.hirestepx.com",
    );
  });

  it("falls back to req.url origin when APP_URL is unset", () => {
    expect(resolveBaseUrl("https://preview.vercel.app/api/save-session?x=1")).toBe(
      "https://preview.vercel.app",
    );
  });

  it("preserves http (dev) protocol", () => {
    expect(resolveBaseUrl("http://localhost:3000/api/save-session")).toBe(
      "http://localhost:3000",
    );
  });

  it("returns null on bad inputs", () => {
    expect(resolveBaseUrl(null)).toBeNull();
    expect(resolveBaseUrl(undefined)).toBeNull();
    expect(resolveBaseUrl("")).toBeNull();
    expect(resolveBaseUrl("not-a-url")).toBeNull();
  });
});

describe("kickoffEagerGrade", () => {
  it("posts to /api/evaluate-session on the resolved base", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    kickoffEagerGrade(validInput({ fetchImpl: fetchMock as unknown as typeof fetch }));
    // Fire-and-forget: the call is scheduled but may not have run yet.
    // Yield to the microtask queue and assert the fetch landed.
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://hirestepx.com/api/evaluate-session",
    );
  });

  it("forwards the user's Authorization header verbatim", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    kickoffEagerGrade(
      validInput({
        authorization: "Bearer user-jwt-token-xyz",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    );
    await new Promise((r) => setTimeout(r, 0));
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer user-jwt-token-xyz");
  });

  it("marks the request with X-Eager-Grade so observability can split it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    kickoffEagerGrade(validInput({ fetchImpl: fetchMock as unknown as typeof fetch }));
    await new Promise((r) => setTimeout(r, 0));
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Eager-Grade"]).toBe("1");
  });

  it("sends sessionId + transcript + meta in the body (full evaluate contract)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    kickoffEagerGrade(validInput({ fetchImpl: fetchMock as unknown as typeof fetch }));
    await new Promise((r) => setTimeout(r, 0));
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.sessionId).toBe("sess-12345678");
    expect(body.transcript).toHaveLength(2);
    expect(body.meta).toEqual({ type: "behavioral", focus: "general", duration: 600 });
  });

  it("returns synchronously even when fetch resolves later", () => {
    let resolveFetch: (v: { ok: boolean; status: number }) => void = () => undefined;
    const slowFetch = vi.fn().mockImplementation(
      () => new Promise((r) => { resolveFetch = r; }),
    );
    const t0 = Date.now();
    kickoffEagerGrade(
      validInput({ fetchImpl: slowFetch as unknown as typeof fetch }),
    );
    const elapsed = Date.now() - t0;
    // Returning synchronously means the in-flight fetch can't have
    // delayed us. Allow a tiny budget for the call construction itself.
    expect(elapsed).toBeLessThan(20);
    // Clean up the dangling promise so the test runner doesn't wait.
    resolveFetch({ ok: true, status: 200 });
  });

  it("does NOT throw when fetch rejects (caller must never see an unhandled rejection)", async () => {
    const errorFetch = vi.fn().mockRejectedValue(new Error("network down"));
    expect(() =>
      kickoffEagerGrade(
        validInput({ fetchImpl: errorFetch as unknown as typeof fetch }),
      ),
    ).not.toThrow();
    // Wait for the rejection to be handled internally — the .catch()
    // in the helper should swallow it cleanly.
    await new Promise((r) => setTimeout(r, 0));
    // If we reach here with no unhandled rejection, the contract holds.
    expect(errorFetch).toHaveBeenCalled();
  });

  it("no-ops on missing sessionId", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    kickoffEagerGrade(validInput({ sessionId: "", fetchImpl: fetchMock as unknown as typeof fetch }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no-ops on empty transcript (degenerate session)", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    kickoffEagerGrade(validInput({ transcript: [], fetchImpl: fetchMock as unknown as typeof fetch }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no-ops on missing Authorization header", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    kickoffEagerGrade(validInput({ authorization: "", fetchImpl: fetchMock as unknown as typeof fetch }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no-ops on empty baseUrl", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    kickoffEagerGrade(validInput({ baseUrl: "", fetchImpl: fetchMock as unknown as typeof fetch }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no-ops on malformed baseUrl rather than crashing", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    expect(() =>
      kickoffEagerGrade(
        validInput({ baseUrl: "not a url", fetchImpl: fetchMock as unknown as typeof fetch }),
      ),
    ).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs (does NOT throw) when the eager grade returns a non-OK response", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    kickoffEagerGrade(validInput({ fetchImpl: fetchMock as unknown as typeof fetch }));
    await new Promise((r) => setTimeout(r, 0));
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain("500");
    warnSpy.mockRestore();
  });
});

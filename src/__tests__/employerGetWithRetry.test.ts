import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/supabase", () => ({ authHeaders: vi.fn().mockResolvedValue({}) }));
const reportHandledError = vi.fn();
vi.mock("../errorReporter", () => ({ reportHandledError }));

import { getWithRetry } from "../employer/EmployerDataContext";

function respond(status: number) {
  return new Response(JSON.stringify({ n: status }), { status });
}

describe("getWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reportHandledError.mockClear();
  });

  it("returns a 429 straight away without retrying or reporting", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(429));
    vi.stubGlobal("fetch", fetchMock);
    const res = await getWithRetry("/api/employer-requirements");
    expect(res?.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("retries a 500 and succeeds without reporting", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respond(500)).mockResolvedValueOnce(respond(200));
    vi.stubGlobal("fetch", fetchMock);
    const pending = getWithRetry("/api/employer-dashboard?range=30");
    await vi.runAllTimersAsync();
    expect((await pending)?.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(reportHandledError).not.toHaveBeenCalled();
  });

  it("reports once the retries are exhausted, without the query string", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(respond(503)));
    vi.stubGlobal("fetch", fetchMock);
    const pending = getWithRetry("/api/employer-dashboard?range=30");
    await vi.runAllTimersAsync();
    expect((await pending)?.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.waitFor(() => expect(reportHandledError).toHaveBeenCalledWith("Employer fetch failed: /api/employer-dashboard 503"));
  });

  it("treats a 404 as an answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(404));
    vi.stubGlobal("fetch", fetchMock);
    expect((await getWithRetry("/api/employer-requirement-detail?id=x"))?.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reportHandledError).not.toHaveBeenCalled();
  });
});

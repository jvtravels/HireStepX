import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchHedged } from "../employer/EmployerDataContext";

const ok = (body: string) => new Response(body, { status: 200 });

describe("fetchHedged", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("sends one request when the first answers quickly", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok("a"));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchHedged("/api/x", {}, new AbortController().signal);
    expect(await res.text()).toBe("a");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends a second request when the first stays silent and takes whichever answers", async () => {
    const fetchMock = vi.fn()
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValueOnce(ok("second"));
    vi.stubGlobal("fetch", fetchMock);
    const pending = fetchHedged("/api/x", {}, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(6_001);
    expect(await (await pending).text()).toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects only when every request failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    await expect(fetchHedged("/api/x", {}, new AbortController().signal)).rejects.toThrow("net");
  });
});

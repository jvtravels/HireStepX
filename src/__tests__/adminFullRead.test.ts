import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server-handlers/_shared", () => ({
  getClientIp: () => "1.1.1.1",
  isRateLimited: async () => false,
  slog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const res = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  ({ ok, status, json: async () => body, text: async () => JSON.stringify(body), headers: new Headers() }) as unknown as Response;
const ids = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: `r-${String(from + i).padStart(6, "0")}` }));

beforeEach(() => {
  vi.resetModules();
  process.env.SUPABASE_URL = "https://proj.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
});

describe("fetchAllRows / readQuality", () => {
  it("pages past the 1000-row cap", async () => {
    const all = ids(0, 2300);
    global.fetch = vi.fn(async (url: string) => {
      const after = /id=gt\.([^&]+)/.exec(String(url))?.[1];
      const start = after ? all.findIndex((r) => r.id === after) + 1 : 0;
      return res(all.slice(start, start + 1000));
    }) as unknown as typeof fetch;
    const { fetchAllRows } = await import("../../server-handlers/_admin-shared");
    const out = await fetchAllRows("sessions?select=id");
    expect(out).toMatchObject({ failed: false, truncated: false });
    expect(out.rows).toHaveLength(2300);
  });

  it("reports failed (with no partial rows) when a page read errors", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => (n++ === 0 ? res(ids(0, 1000)) : res({ message: "x" }, false, 503))) as unknown as typeof fetch;
    const { fetchAllRows } = await import("../../server-handlers/_admin-shared");
    expect(await fetchAllRows("sessions?select=id")).toEqual({ rows: [], truncated: false, failed: true });
  });

  it("reports truncated at the row cap", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => res(ids(1000 * n++, 1000))) as unknown as typeof fetch;
    const { fetchAllRows } = await import("../../server-handlers/_admin-shared");
    const out = await fetchAllRows("sessions?select=id", 2000);
    expect(out.truncated).toBe(true);
    expect(out.rows).toHaveLength(2000);
  });

  it("readQuality names the degraded and truncated sources", async () => {
    const { readQuality } = await import("../../server-handlers/_admin-shared");
    expect(readQuality({ a: { failed: false, truncated: false }, b: { failed: true, truncated: false }, c: { failed: false, truncated: true } })).toEqual({
      degraded: true, degradedSources: ["b"], truncated: true, truncatedSources: ["c"],
    });
    expect(readQuality({ a: { failed: false, truncated: false } })).toMatchObject({ degraded: false, truncated: false });
  });
});

describe("modeledCostForMonth", () => {
  it("throws rather than persisting a falsely low cost when a usage read fails", async () => {
    global.fetch = vi.fn(async (url: string) => (String(url).includes("llm_usage") ? res({ message: "x" }, false, 503) : res([]))) as unknown as typeof fetch;
    const { modeledCostForMonth } = await import("../../server-handlers/_admin-financials");
    await expect(modeledCostForMonth("2026-09")).rejects.toThrow(/complete usage data/);
  });

  it("computes from complete (empty) reads", async () => {
    global.fetch = vi.fn(async () => res([])) as unknown as typeof fetch;
    const { modeledCostForMonth } = await import("../../server-handlers/_admin-financials");
    expect(await modeledCostForMonth("2026-09")).toBe(0);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const eraseUserData = vi.fn();
vi.mock("../../server-handlers/_erase-user", () => ({ eraseUserData: (...a: unknown[]) => eraseUserData(...a), posthogConfigFromEnv: () => undefined }));
vi.mock("../../server-handlers/_erase-user-email", () => ({ sendErasureEmail: vi.fn(async () => undefined) }));
vi.mock("../../server-handlers/_cron-heartbeat", () => ({ recordCronResult: vi.fn(async () => undefined) }));

function mockRes() {
  return { statusCode: 0, body: undefined as unknown, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
}

describe("cleanup-deleted-accounts queue", () => {
  let urls: string[];
  let columnExists: boolean;
  let stillDeleted: Record<string, boolean>;

  beforeEach(() => {
    vi.resetModules();
    eraseUserData.mockReset();
    eraseUserData.mockResolvedValue({ ok: true, failedSteps: [], retainedFinancialRecords: false });
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc");
    vi.stubEnv("CRON_SECRET", "s3cret");
    urls = [];
    columnExists = true;
    stillDeleted = { a: true, b: true };
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      urls.push(`${init?.method ?? "GET"} ${u}`);
      if (u.includes("erasure_attempted_at") && !columnExists) return new Response("{}", { status: 400 });
      if (u.includes("select=id&order=")) return new Response(JSON.stringify([{ id: "a" }, { id: "b" }]));
      if (u.includes("select=id") && u.includes("id=eq.")) {
        const id = /id=eq\.([^&]+)/.exec(u)![1];
        return new Response(JSON.stringify(stillDeleted[id] ? [{ id }] : []));
      }
      return new Response("{}", { status: 204 });
    }));
  });

  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  async function run() {
    const { default: handler } = await import("../../server-handlers/cleanup-deleted-accounts");
    const res = mockRes();
    await handler({ method: "GET", headers: { authorization: "Bearer s3cret" } } as never, res as never);
    return res;
  }

  it("reads never-attempted accounts first and stamps each attempt", async () => {
    const res = await run();
    expect(res.body).toMatchObject({ deleted: 2 });
    expect(urls[0]).toContain("order=erasure_attempted_at.asc.nullsfirst,deleted_at.asc");
    expect(urls.filter((u) => u.startsWith("PATCH"))).toHaveLength(2);
  });

  it("falls back to deleted_at ordering before migration 0056 is applied", async () => {
    columnExists = false;
    const res = await run();
    expect(res.body).toMatchObject({ deleted: 2 });
    expect(urls.some((u) => u.includes("order=deleted_at.asc"))).toBe(true);
  });

  it("skips an account that was restored after the batch was read", async () => {
    stillDeleted.a = false;
    const res = await run();
    expect(res.body).toMatchObject({ deleted: 1 });
    expect(eraseUserData).toHaveBeenCalledTimes(1);
    expect(eraseUserData.mock.calls[0][1]).toBe("b");
  });
});

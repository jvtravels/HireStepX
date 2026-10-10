import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.CRON_SECRET = "cron-secret";

const slogError = vi.fn();
vi.mock("../../server-handlers/_shared", () => ({ slog: { error: (...a: unknown[]) => slogError(...a), warn: vi.fn() } }));

const runMatching = vi.fn();
vi.mock("../../server-handlers/employer-requirements", () => ({
  runMatching: (...a: unknown[]) => runMatching(...a),
  SUSPENDED_MATCHING_STATUS: "suspended",
}));

const { default: handler, CRON_TIME_BUDGET_MS, CRON_MATCH_TIMEOUT_MS } = await import("../../server-handlers/cron-rematch-requirements");

function row(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `req-${i}`, employer_id: `emp-${i}`, title: "Dev", location: "Pune", description: "x", skills: [], experience_min: null,
    experience_max: null, min_readiness_band: null, min_star_completeness: null, employment_type: null, duration_weeks: null,
    hours_per_week: null, stage: "ready_for_review", status: "ready", last_matched_at: null, employers: { suspended_at: null }, ...extra,
  };
}

function installFetch(rows: unknown[], opts: { ok?: boolean; total?: number } = {}) {
  const fetchMock = vi.fn(async () => ({
    ok: opts.ok ?? true, status: opts.ok === false ? 500 : 200,
    headers: { get: (k: string) => (k.toLowerCase() === "content-range" ? `0-${rows.length - 1}/${opts.total ?? rows.length}` : null) },
    json: async () => rows,
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const call = (auth: string | null = "Bearer cron-secret") =>
  handler(new Request("https://x.test/api/cron/rematch-requirements", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  runMatching.mockReset();
  runMatching.mockResolvedValue("ready");
  slogError.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("cron-rematch-requirements", () => {
  it("rejects a missing or wrong secret without touching the database", async () => {
    const f = installFetch([row(1)]);
    expect((await call(null)).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    expect(f).not.toHaveBeenCalled();
    expect(runMatching).not.toHaveBeenCalled();
  });

  it("excludes suspended employers in the query and defensively in code", async () => {
    const f = installFetch([row(1), row(2, { employers: { suspended_at: "2026-01-01T00:00:00Z" } })]);
    const res = await call();
    const url = String((f.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("employers!inner(suspended_at)");
    expect(url).toContain("employers.suspended_at=is.null");
    expect(url).toContain("order=last_matched_at.asc.nullsfirst");
    expect(runMatching).toHaveBeenCalledTimes(1);
    expect(runMatching.mock.calls[0][0]).toBe("req-1");
    expect((await res.json()).processed).toBe(1);
  });

  it("passes the longer cron timeout to each match", async () => {
    installFetch([row(1)]);
    await call();
    expect(runMatching.mock.calls[0][3]).toEqual({ timeoutMs: CRON_MATCH_TIMEOUT_MS });
  });

  it("isolates a requirement that throws and still processes the rest", async () => {
    installFetch([row(1), row(2), row(3)]);
    runMatching.mockImplementation(async (id: string) => {
      if (id === "req-2") throw new Error("boom");
      return "ready";
    });
    const body = await (await call()).json();
    expect(body).toMatchObject({ ok: true, processed: 3, matched: 2, failed: 1, skipped_suspended: 0, budget_exhausted: false, deferred: 0 });
    expect(slogError).toHaveBeenCalledTimes(1);
  });

  it("counts runMatching's 'suspended' result as skipped, not matched", async () => {
    installFetch([row(1), row(2)]);
    runMatching.mockImplementation(async (id: string) => (id === "req-1" ? "suspended" : "ready"));
    const body = await (await call()).json();
    expect(body).toMatchObject({ matched: 1, skipped_suspended: 1, failed: 0 });
  });

  it("caps a run at 150 requirements and reports the backlog", async () => {
    installFetch(Array.from({ length: 300 }, (_, i) => row(i)), { total: 1200 });
    const body = await (await call()).json();
    expect(body.processed).toBeLessThanOrEqual(150);
    expect(body.open_requirements).toBe(1200);
    expect(runMatching.mock.calls.length).toBe(body.processed);
  });

  it("stops starting batches once the time budget is spent and reports the deferred remainder", async () => {
    vi.useFakeTimers();
    installFetch(Array.from({ length: 20 }, (_, i) => row(i)));
    runMatching.mockImplementation(async () => {
      vi.setSystemTime(Date.now() + CRON_TIME_BUDGET_MS / 2 + 1);
      return "ready";
    });
    const body = await (await call()).json();
    expect(body.budget_exhausted).toBe(true);
    expect(body.processed).toBeLessThan(20);
    expect(body.processed + body.deferred).toBe(20);
    expect(body.processed).toBeGreaterThan(0);
  });

  it("returns 502 when the open-requirement read fails", async () => {
    installFetch([], { ok: false });
    expect((await call()).status).toBe(502);
    expect(runMatching).not.toHaveBeenCalled();
  });
});

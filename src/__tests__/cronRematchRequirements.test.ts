import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.CRON_SECRET = "cron-secret";

const slogError = vi.fn();
vi.mock("../../server-handlers/_shared", () => ({ slog: { error: (...a: unknown[]) => slogError(...a), warn: vi.fn() } }));

const recordCronResult = vi.fn(async (..._args: unknown[]) => true);
vi.mock("../../server-handlers/_cron-heartbeat", () => ({ recordCronResult: (...a: unknown[]) => recordCronResult(...a) }));

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
  recordCronResult.mockClear();
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
    expect(url).toContain("order=last_rematch_attempt_at.asc.nullsfirst,last_matched_at.asc.nullsfirst");
    expect(url).toContain("or=(due_date.is.null,due_date.gte.");
    expect(runMatching).toHaveBeenCalledTimes(1);
    expect(runMatching.mock.calls[0][0]).toBe("req-1");
    expect((await res.json()).processed).toBe(1);
  });

  it("reports zero errors to the heartbeat on a clean sweep", async () => {
    installFetch([row(1), row(2)]);
    await call();
    expect(recordCronResult).toHaveBeenCalledWith("cron-rematch-requirements", { errors: 0 });
  });

  it("reports the failure count to the heartbeat so a failing sweep goes stale", async () => {
    installFetch([row(1), row(2), row(3)]);
    runMatching.mockResolvedValue("failed");
    const body = await (await call()).json();
    expect(body.failed).toBe(3);
    expect(recordCronResult).toHaveBeenCalledWith("cron-rematch-requirements", { errors: 3 });
  });

  it("passes the longer cron timeout to each match", async () => {
    installFetch([row(1)]);
    await call();
    expect(runMatching.mock.calls[0][3]).toEqual({ timeoutMs: CRON_MATCH_TIMEOUT_MS, onFailure: expect.any(Function), onStale: expect.any(Function) });
  });

  it("counts a pass that stood down for an edit as skipped_stale, not matched", async () => {
    installFetch([row(1), row(2)]);
    runMatching.mockImplementation(async (id: string, _req: unknown, _owner: string, opts: { onStale?: () => void }) => {
      if (id === "req-1") opts.onStale?.();
      return "generating";
    });
    const body = await (await call()).json();
    expect(body).toMatchObject({ matched: 1, skipped_stale: 1, failed: 0 });
    expect(recordCronResult).toHaveBeenCalledWith("cron-rematch-requirements", { errors: 0 });
  });

  it("isolates a requirement that throws and still processes the rest", async () => {
    installFetch([row(1), row(2), row(3)]);
    runMatching.mockImplementation(async (id: string) => {
      if (id === "req-2") throw new Error("boom");
      return "ready";
    });
    const res = await call();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, processed: 3, matched: 2, failed: 1, skipped_suspended: 0, budget_exhausted: false, deferred: 0 });
    expect(slogError).toHaveBeenCalledTimes(1);
  });

  it("counts runMatching's 'suspended' result as skipped, not matched", async () => {
    installFetch([row(1), row(2)]);
    runMatching.mockImplementation(async (id: string) => (id === "req-1" ? "suspended" : "ready"));
    const body = await (await call()).json();
    expect(body).toMatchObject({ matched: 1, skipped_suspended: 1, failed: 0 });
  });

  it("skips a requirement whose deadline passed long ago, but not a recently overdue one", async () => {
    const day = 86_400_000;
    installFetch([
      row(1, { due_date: new Date(Date.now() - 200 * day).toISOString() }),
      row(2, { due_date: new Date(Date.now() - 3 * day).toISOString() }),
      row(3),
    ]);
    await call();
    expect(runMatching.mock.calls.map((c) => c[0]).sort()).toEqual(["req-2", "req-3"]);
  });

  it("scores with the requirement's Other skills and work mode, like the interactive path", async () => {
    installFetch([row(1, { custom_skill_sets: ["GraphQL"], work_mode: "remote" })]);
    await call();
    expect(runMatching.mock.calls[0][1]).toMatchObject({ customSkills: ["GraphQL"], workMode: "remote" });
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

  it("counts a pass that failed but kept its ready status via onFailure", async () => {
    installFetch([row(1), row(2)]);
    runMatching.mockImplementation(async (id: string, _r: unknown, _o: unknown, opts: { onFailure?: () => void }) => {
      if (id === "req-1") opts.onFailure?.();
      return "ready";
    });
    const body = await (await call()).json();
    expect(body).toMatchObject({ processed: 2, failed: 1, matched: 1 });
  });

  it("falls back to the legacy ordering when migration 0044's attempt column is missing", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = String(input);
      const withColumn = url.includes("last_rematch_attempt_at");
      return {
        ok: !withColumn, status: withColumn ? 400 : 200,
        headers: { get: () => null },
        json: async () => (withColumn ? {} : [row(1)]),
        text: async () => "column does not exist",
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const body = await (await call()).json();
    expect(body.processed).toBe(1);
    expect(String(fetchMock.mock.calls[1][0])).toContain("order=last_matched_at.asc.nullsfirst");
    expect(String(fetchMock.mock.calls[1][0])).not.toContain("last_rematch_attempt_at");
  });

  describe("only requirements whose inputs changed or that are stale", () => {
    const day = 86_400_000;
    const agoIso = (d: number) => new Date(Date.now() - d * day).toISOString();
    const installProbe = (rows: unknown[], probe: { ok: boolean; body: unknown }) => {
      const fetchMock = vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.includes("matching_inputs_changed_at")) return { ok: probe.ok, status: probe.ok ? 200 : 400, headers: { get: () => null }, json: async () => probe.body };
        return { ok: true, status: 200, headers: { get: () => null }, json: async () => rows };
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      return fetchMock;
    };

    it("skips unchanged recent requirements and runs changed, never-matched and over-age ones", async () => {
      installProbe(
        [
          row(1, { last_matched_at: agoIso(1) }), // matched after the last change: skipped
          row(2, { last_matched_at: agoIso(3) }), // a candidate changed since: due
          row(3, { last_matched_at: null }), // never matched: due
          row(4, { last_matched_at: agoIso(20) }), // over the max age: due
          row(5, { last_matched_at: agoIso(0.5) }), // matched after the last change: skipped
        ],
        { ok: true, body: [{ matching_inputs_changed_at: agoIso(2) }] },
      );
      const body = await (await call()).json();
      expect(runMatching.mock.calls.map((c) => c[0]).sort()).toEqual(["req-2", "req-3", "req-4"]);
      expect(body).toMatchObject({ processed: 3, skipped_unchanged: 2, failed: 0 });
    });

    it("skips every recent requirement when no candidate input has ever changed", async () => {
      installProbe([row(1, { last_matched_at: agoIso(1) }), row(2, { last_matched_at: agoIso(2) })], { ok: true, body: [] });
      const body = await (await call()).json();
      expect(runMatching).not.toHaveBeenCalled();
      expect(body).toMatchObject({ processed: 0, skipped_unchanged: 2 });
      expect(recordCronResult).toHaveBeenCalledWith("cron-rematch-requirements", { errors: 0 });
    });

    it("runs every open requirement, as before, when migration 0057 is not applied", async () => {
      installProbe([row(1, { last_matched_at: agoIso(1) }), row(2, { last_matched_at: agoIso(2) })], { ok: false, body: { code: "42703" } });
      const body = await (await call()).json();
      expect(runMatching).toHaveBeenCalledTimes(2);
      expect(body).toMatchObject({ processed: 2, skipped_unchanged: 0 });
    });

    it("does not probe for candidate changes when there are no open requirements", async () => {
      const f = installProbe([], { ok: true, body: [] });
      const body = await (await call()).json();
      expect(f.mock.calls.some((c) => String(c[0]).includes("matching_inputs_changed_at"))).toBe(false);
      expect(body.processed).toBe(0);
    });

    it("keeps the stalest-attempt-first order among the due requirements", async () => {
      installProbe(
        [row(1, { last_matched_at: agoIso(10), last_rematch_attempt_at: agoIso(1) }), row(2, { last_matched_at: agoIso(12), last_rematch_attempt_at: agoIso(5) })],
        { ok: true, body: [] },
      );
      await call();
      expect(runMatching.mock.calls.map((c) => c[0])).toEqual(["req-2", "req-1"]);
    });
  });

  it("returns 502 when the open-requirement read fails", async () => {
    installFetch([], { ok: false });
    expect((await call()).status).toBe(502);
    expect(runMatching).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const isRateLimited = vi.fn();

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...a: unknown[]) => withAuthAndRateLimit(...a),
  isRateLimited: (...a: unknown[]) => isRateLimited(...a),
  rateLimitResponse: () => new Response("{}", { status: 429 }),
  corsHeaders: () => ({}),
  supabaseUrl: () => "https://example.supabase.co",
  supabaseServiceHeaders: () => ({ apikey: "service-role-key", Authorization: "Bearer service-role-key", "Content-Type": "application/json" }),
  slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { default: handler } = await import("../../server-handlers/candidate-visibility");

const UID = "user-1";
type Call = { url: string; method: string; body?: string };

/** State-aware fake of the REST surface the handler touches. */
function fakeDb(opts: { visibility?: "masked" | "off"; profileMissing?: boolean; logFails?: boolean; deleteFails?: boolean } = {}) {
  const db = { visibility: opts.visibility ?? "masked", log: [] as unknown[], calls: [] as Call[] };
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    db.calls.push({ url: u, method, body: init?.body as string | undefined });
    const ok = (body: unknown, extra: Record<string, unknown> = {}) => ({ ok: true, status: 200, json: async () => body, headers: new Headers(extra.headers as Record<string, string> | undefined) }) as unknown as Response;
    if (u.includes("/rest/v1/profiles")) {
      if (method === "GET") return opts.profileMissing ? ok([]) : ok([{ employer_visibility: db.visibility, employer_visibility_updated_at: "2026-10-01T00:00:00Z" }]);
      const patch = JSON.parse(init!.body as string);
      const cas = u.match(/employer_visibility=eq\.(\w+)/)?.[1];
      if (cas && cas !== db.visibility) return ok([]);
      db.visibility = patch.employer_visibility;
      return ok([{ id: UID }]);
    }
    if (u.includes("/rest/v1/candidate_consent_log")) {
      if (method === "POST") {
        if (opts.logFails) return { ok: false, status: 500 } as unknown as Response;
        db.log.push(JSON.parse(init!.body as string));
        return ok([]);
      }
      return ok([{ action: "granted", created_at: "2026-09-01T00:00:00Z", source: "onboarding" }]);
    }
    if (u.includes("/rest/v1/requirement_matches")) {
      if (method === "DELETE") return opts.deleteFails ? ({ ok: false, status: 500 } as unknown as Response) : ok([]);
      return ok([], { headers: { "content-range": "0-0/7" } });
    }
    return ok([]);
  }) as unknown as typeof fetch;
  return db;
}

function req(method: "GET" | "POST", body?: unknown) {
  return new Request("https://x.test/api/candidate-visibility", { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: UID }, headers: {} });
  isRateLimited.mockResolvedValue(false);
});

describe("GET /api/candidate-visibility", () => {
  it("401s when unauthenticated", async () => {
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: null }, headers: {} });
    expect((await handler(req("GET"))).status).toBe(401);
  });

  it("returns state, history, policy version and the 30-day viewer count", async () => {
    fakeDb({ visibility: "masked" });
    const res = await handler(req("GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      visibility: "masked",
      updatedAt: "2026-10-01T00:00:00Z",
      policyVersion: "employer-discovery-2026-10",
      history: [{ action: "granted", createdAt: "2026-09-01T00:00:00Z", source: "onboarding" }],
      stats: { employersViewedLast30d: 7 },
    });
  });

  it("404s when the profile is missing", async () => {
    fakeDb({ profileMissing: true });
    expect((await handler(req("GET"))).status).toBe(404);
  });
});

describe("POST /api/candidate-visibility", () => {
  it("400s on an invalid visibility value and on bad JSON", async () => {
    fakeDb();
    expect((await handler(req("POST", { visibility: "public" }))).status).toBe(400);
    const bad = new Request("https://x.test/api/candidate-visibility", { method: "POST", body: "{oops" });
    expect((await handler(bad)).status).toBe(400);
  });

  it("429s when the write bucket is exhausted", async () => {
    fakeDb();
    isRateLimited.mockResolvedValue(true);
    expect((await handler(req("POST", { visibility: "off" }))).status).toBe(429);
  });

  it("is a no-op for an unchanged value: no write, no log row", async () => {
    const db = fakeDb({ visibility: "masked" });
    const res = await handler(req("POST", { visibility: "masked" }));
    expect(res.status).toBe(200);
    expect((await res.json()).changed).toBe(false);
    expect(db.calls.some((c) => c.method === "PATCH" || c.method === "DELETE")).toBe(false);
    expect(db.log).toHaveLength(0);
  });

  it("switching off appends a 'withdrawn' log row and deletes only LOCKED matches", async () => {
    const db = fakeDb({ visibility: "masked" });
    const res = await handler(req("POST", { visibility: "off", source: "post_session_prompt" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.changed).toBe(true);
    expect(db.visibility).toBe("off");
    expect(db.log).toEqual([{ user_id: UID, purpose: "employer_discovery", action: "withdrawn", policy_version: "employer-discovery-2026-10", source: "post_session_prompt" }]);
    const del = db.calls.find((c) => c.method === "DELETE")!;
    expect(del.url).toContain("requirement_matches?candidate_user_id=eq.user-1");
    expect(del.url).toContain("unlocked=not.is.true");
  });

  it("switching back on logs 'granted' and deletes nothing", async () => {
    const db = fakeDb({ visibility: "off" });
    await handler(req("POST", { visibility: "masked" }));
    expect(db.visibility).toBe("masked");
    expect(db.log[0]).toMatchObject({ action: "granted" });
    expect(db.calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("reverts the profile and 500s when the consent log cannot be written", async () => {
    const db = fakeDb({ visibility: "masked", logFails: true });
    const res = await handler(req("POST", { visibility: "off" }));
    expect(res.status).toBe(500);
    expect(db.visibility).toBe("masked");
    expect(db.calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("still succeeds when the locked-match cleanup fails (consent is already recorded)", async () => {
    const db = fakeDb({ visibility: "masked", deleteFails: true });
    const res = await handler(req("POST", { visibility: "off" }));
    expect(res.status).toBe(200);
    expect(db.visibility).toBe("off");
    expect(db.log).toHaveLength(1);
  });
});

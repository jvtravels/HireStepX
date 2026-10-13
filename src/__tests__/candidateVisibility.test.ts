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
function fakeDb(opts: {
  visibility?: "masked" | "off"; profileMissing?: boolean; logFails?: boolean; deleteFails?: boolean;
  /** consent-log rows already on file (GET returns these); default one legacy 'granted'. */
  existingLog?: Array<{ action: "granted" | "withdrawn"; created_at: string; source: string }>;
  /** simulate migration 0037 not applied: selecting/patching employer_notice_seen_at 400s. */
  noNoticeColumn?: boolean;
  noticeSeenAt?: string | null;
} = {}) {
  const db = { visibility: opts.visibility ?? "masked", log: [] as unknown[], calls: [] as Call[], noticeSeenAt: opts.noticeSeenAt ?? null as string | null };
  const existingLog = opts.existingLog ?? [{ action: "granted" as const, created_at: "2026-09-01T00:00:00Z", source: "onboarding" }];
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    db.calls.push({ url: u, method, body: init?.body as string | undefined });
    const ok = (body: unknown, extra: Record<string, unknown> = {}) => ({ ok: true, status: 200, json: async () => body, headers: new Headers(extra.headers as Record<string, string> | undefined) }) as unknown as Response;
    if (u.includes("/rest/v1/profiles")) {
      if (opts.noNoticeColumn && (u.includes("employer_notice_seen_at") || (init?.body as string | undefined)?.includes("employer_notice_seen_at"))) {
        return { ok: false, status: 400, json: async () => ({ code: "42703" }) } as unknown as Response;
      }
      if (method === "GET") return opts.profileMissing ? ok([]) : ok([{ employer_visibility: db.visibility, employer_visibility_updated_at: "2026-10-01T00:00:00Z", employer_notice_seen_at: db.noticeSeenAt }]);
      const patch = JSON.parse(init!.body as string);
      if ("employer_notice_seen_at" in patch) { db.noticeSeenAt = patch.employer_notice_seen_at; return ok([{ id: UID }]); }
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
      if (u.includes("action=eq.granted")) return ok(existingLog.filter((r) => r.action === "granted").map(() => ({ id: "l1" })));
      return ok(existingLog);
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
      policyVersion: "employer-discovery-2026-10-v2",
      history: [{ action: "granted", createdAt: "2026-09-01T00:00:00Z", source: "onboarding" }],
      noticePending: false,
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
    expect(db.log).toEqual([{ user_id: UID, purpose: "employer_discovery", action: "withdrawn", policy_version: "employer-discovery-2026-10-v2", source: "post_session_prompt" }]);
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


describe("discovery stays on by default; the dashboard notice records an affirmative choice", () => {
  it("GET flags the notice as pending for a masked user with no consent record", async () => {
    fakeDb({ visibility: "masked", existingLog: [] });
    expect((await (await handler(req("GET"))).json()).noticePending).toBe(true);
  });

  it("GET does not flag it once the user has seen it, or has any consent record", async () => {
    fakeDb({ visibility: "masked", existingLog: [], noticeSeenAt: "2026-10-05T00:00:00Z" });
    expect((await (await handler(req("GET"))).json()).noticePending).toBe(false);
    fakeDb({ visibility: "masked", existingLog: [{ action: "withdrawn", created_at: "2026-09-01T00:00:00Z", source: "settings" }] });
    expect((await (await handler(req("GET"))).json()).noticePending).toBe(false);
  });

  it("'Keep on' (masked -> masked, no grant on file) logs 'granted' without touching the column", async () => {
    const db = fakeDb({ visibility: "masked", existingLog: [] });
    const res = await handler(req("POST", { visibility: "masked", source: "dashboard" }));
    expect(res.status).toBe(200);
    expect((await res.json()).changed).toBe(true);
    expect(db.log).toEqual([{ user_id: UID, purpose: "employer_discovery", action: "granted", policy_version: "employer-discovery-2026-10-v2", source: "dashboard" }]);
    expect(db.calls.some((c) => c.method === "PATCH" && c.body?.includes("employer_visibility\""))).toBe(false);
    expect(db.noticeSeenAt).not.toBeNull();
  });

  it("'Keep on' twice does not append a second 'granted' row", async () => {
    const db = fakeDb({ visibility: "masked" }); // one grant already on file
    await handler(req("POST", { visibility: "masked", source: "dashboard" }));
    expect(db.log).toHaveLength(0);
  });

  it("'Turn off' from the notice logs 'withdrawn', removes locked matches and marks the notice seen", async () => {
    const db = fakeDb({ visibility: "masked", existingLog: [] });
    await handler(req("POST", { visibility: "off", source: "dashboard" }));
    expect(db.visibility).toBe("off");
    expect(db.log).toMatchObject([{ action: "withdrawn", source: "dashboard" }]);
    expect(db.calls.some((c) => c.method === "DELETE" && c.url.includes("unlocked=not.is.true"))).toBe(true);
    expect(db.noticeSeenAt).not.toBeNull();
  });

  it("{ noticeSeen: true } only stamps the notice; no visibility or log change", async () => {
    const db = fakeDb({ visibility: "masked", existingLog: [] });
    const res = await handler(req("POST", { noticeSeen: true }));
    expect(res.status).toBe(200);
    expect(db.noticeSeenAt).not.toBeNull();
    expect(db.log).toHaveLength(0);
    expect(db.visibility).toBe("masked");
  });

  it("keeps working when migration 0037 is not applied (no employer_notice_seen_at column)", async () => {
    const db = fakeDb({ visibility: "masked", existingLog: [], noNoticeColumn: true });
    const get = await handler(req("GET"));
    expect(get.status).toBe(200);
    expect((await get.json()).noticePending).toBe(true); // falls back to "never answered"
    const keep = await handler(req("POST", { visibility: "masked", source: "dashboard" }));
    expect(keep.status).toBe(200);
    expect(db.log).toMatchObject([{ action: "granted" }]);
    const seen = await handler(req("POST", { noticeSeen: true }));
    expect(seen.status).toBe(200);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.RESEND_API_KEY = "re_key";
const slogError = vi.fn();
const redisGet = vi.fn();
const redisSetEx = vi.fn();
vi.mock("../../server-handlers/_shared", () => ({
  slog: { error: (...a: unknown[]) => slogError(...a), warn: vi.fn(), info: vi.fn() },
  supabaseUrl: () => "https://example.supabase.co",
  supabaseServiceHeaders: () => ({ apikey: "k" }),
  redisGet: (...a: unknown[]) => redisGet(...a),
  redisSetEx: (...a: unknown[]) => redisSetEx(...a),
}));
const filterSuppressed = vi.fn();
vi.mock("../../server-handlers/_unsubscribe", () => ({
  filterSuppressed: (...a: unknown[]) => filterSuppressed(...a),
  marketingEmailParts: async () => ({ footer: { marketing: true }, resend: { reply_to: "hello@hirestepx.com", headers: {} } }),
  preferenceDepsFromEnv: () => ({ supabaseUrl: "", serviceKey: "" }),
}));
const sendEmployerEmail = vi.fn();
vi.mock("../../server-handlers/_employer-emails", async (orig) => ({
  ...(await orig<typeof import("../../server-handlers/_employer-emails")>()),
  sendEmployerEmail: (...a: unknown[]) => sendEmployerEmail(...a),
}));
const recordCronResult = vi.fn();
vi.mock("../../server-handlers/_cron-heartbeat", () => ({ recordCronResult: (...a: unknown[]) => recordCronResult(...a) }));
const captureServerEvent = vi.fn();
vi.mock("../../server-handlers/_posthog", () => ({ captureServerEvent: (...a: unknown[]) => captureServerEvent(...a) }));

const {
  buildActivity, selectWinbacks, isWinbackEligible, winbackDedupeKey, winbackIdempotencyKey, buildWinbackEmail,
  WINBACK_COOLDOWN_SECONDS,
} = await import("../../server-handlers/_employer-winback-helpers");
const { default: handler } = await import("../../server-handlers/send-employer-winback");

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 17, 6, 0, 0);
const ago = (d: number) => new Date(NOW - d * DAY).toISOString();

describe("buildActivity", () => {
  it("folds requirements and unlocks per employer and ignores bad rows", () => {
    const a = buildActivity(
      [{ employer_id: "e1", created_at: ago(20) }, { employer_id: "e1", created_at: ago(10) }, { employer_id: "e2", created_at: "not-a-date" }, { employer_id: "", created_at: ago(1) }],
      [{ employer_id: "e1", unlocked_at: ago(15) }, { employer_id: "e3", unlocked_at: ago(40) }],
    );
    const e1 = a.find((x) => x.employerId === "e1");
    expect(e1).toMatchObject({ requirementCount: 2, unlockCount: 1 });
    expect(e1?.firstRequirementAt).toBe(NOW - 20 * DAY);
    expect(e1?.lastRequirementAt).toBe(NOW - 10 * DAY);
    expect(a.find((x) => x.employerId === "e2")).toBeUndefined();
    expect(a.find((x) => x.employerId === "e3")).toMatchObject({ requirementCount: 0, unlockCount: 1 });
  });
});

describe("selectWinbacks", () => {
  const pick = (reqs: number[], unlocks: number[], opts?: { allowNoUnlock?: boolean }) =>
    selectWinbacks(
      buildActivity(reqs.map((d) => ({ employer_id: "e1", created_at: ago(d) })), unlocks.map((d) => ({ employer_id: "e1", unlocked_at: ago(d) }))),
      NOW,
      opts,
    );

  it("picks no_unlock for a requirement 7-60 days old with zero unlocks", () => {
    expect(pick([8], [])).toEqual([{ employerId: "e1", kind: "no_unlock", requirementCount: 1, unlockCount: 0 }]);
    expect(pick([7.5], [])).toHaveLength(1);
  });

  it("does not pick a requirement younger than 7 days or older than 60 days", () => {
    expect(pick([5], [])).toEqual([]);
    expect(pick([61], [])).toEqual([]);
  });

  it("measures no_unlock from the first requirement, not the latest", () => {
    expect(pick([30, 2], [])).toHaveLength(1);
  });

  it("skips no_unlock when the unlock read was truncated", () => {
    expect(pick([10], [], { allowNoUnlock: false })).toEqual([]);
  });

  it("picks inactive when unlocks exist and nothing happened for 30-180 days", () => {
    expect(pick([100], [45])).toEqual([{ employerId: "e1", kind: "inactive", requirementCount: 1, unlockCount: 1 }]);
  });

  it("does not pick an employer who unlocked or posted within 30 days", () => {
    expect(pick([100], [10])).toEqual([]);
    expect(pick([5], [90])).toEqual([]);
  });

  it("does not pick an employer idle for 180+ days (lapsed, not a win-back)", () => {
    expect(pick([300], [200])).toEqual([]);
  });

  it("returns candidates in a deterministic order", () => {
    const a = buildActivity(
      [{ employer_id: "b", created_at: ago(10) }, { employer_id: "a", created_at: ago(10) }],
      [],
    );
    expect(selectWinbacks(a, NOW).map((c) => c.employerId)).toEqual(["a", "b"]);
  });
});

describe("isWinbackEligible", () => {
  it("accepts an active employer with an address", () => {
    expect(isWinbackEligible({ suspended_at: null }, "a@acme.com")).toBe(true);
  });
  it("rejects suspended or pending-deletion employers, missing rows and missing addresses", () => {
    expect(isWinbackEligible({ suspended_at: "2026-10-01T00:00:00Z" }, "a@acme.com")).toBe(false);
    expect(isWinbackEligible(null, "a@acme.com")).toBe(false);
    expect(isWinbackEligible({ suspended_at: null }, null)).toBe(false);
    expect(isWinbackEligible({ suspended_at: null }, "nope")).toBe(false);
  });
});

describe("winback keys and copy", () => {
  it("uses a 30-day cooldown and a stable per-employer dedupe key", () => {
    expect(WINBACK_COOLDOWN_SECONDS).toBe(30 * 86_400);
    expect(winbackDedupeKey("e1")).toBe("employer_winback:e1");
  });

  it("buckets the idempotency key per 30 days", () => {
    expect(winbackIdempotencyKey("e1", NOW)).toBe(winbackIdempotencyKey("e1", NOW + DAY));
    expect(winbackIdempotencyKey("e1", NOW)).not.toBe(winbackIdempotencyKey("e1", NOW + 31 * DAY));
    expect(winbackIdempotencyKey("e1", NOW)).not.toBe(winbackIdempotencyKey("e2", NOW));
  });

  it("builds both emails with no em dashes, an escaped company name and a dashboard link", () => {
    for (const kind of ["no_unlock", "inactive"] as const) {
      const m = buildWinbackEmail(kind, "<b>Acme</b> & Co");
      expect(m.subject).not.toContain("—");
      expect(m.html).not.toContain("—");
      expect(m.html).not.toContain("<b>Acme</b>");
      expect(m.html).toContain("/employer");
    }
    expect(buildWinbackEmail("no_unlock", "Acme").subject).not.toBe(buildWinbackEmail("inactive", "Acme").subject);
  });

  it("falls back to a generic name when the company name is blank", () => {
    expect(buildWinbackEmail("inactive", "   ").html).toContain("your company");
  });
});

interface Data { reqs?: unknown[]; unlocks?: unknown[]; employers?: unknown[]; profiles?: unknown[]; failAt?: string }
function installFetch(d: Data) {
  global.fetch = vi.fn(async (url: string) => {
    const u = String(url);
    const kind = u.includes("requirement_matches") ? "unlocks" : u.includes("employer_requirements") ? "reqs" : u.includes("/employers?") ? "employers" : u.includes("/profiles?") ? "profiles" : "";
    if (d.failAt === kind) return { ok: false, json: async () => ({}) };
    const body = kind === "reqs" ? d.reqs : kind === "unlocks" ? d.unlocks : kind === "employers" ? d.employers : d.profiles;
    return { ok: true, json: async () => body ?? [] };
  }) as unknown as typeof fetch;
}
const baseData = (): Data => ({
  reqs: [{ employer_id: "e1", created_at: ago(10) }],
  unlocks: [],
  employers: [{ id: "e1", suspended_at: null, company_name: "Acme" }],
  profiles: [{ id: "e1", email: "boss@acme.com" }],
});
const call = (auth: string | null = "Bearer cron-secret") =>
  handler(new Request("https://x.test/api/send-employer-winback", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  redisGet.mockReset().mockResolvedValue(null);
  redisSetEx.mockReset();
  slogError.mockReset();
  recordCronResult.mockReset().mockResolvedValue(true);
  captureServerEvent.mockReset();
  sendEmployerEmail.mockReset().mockResolvedValue(true);
  filterSuppressed.mockReset().mockImplementation(async (_d: unknown, rows: unknown[]) => rows);
});

describe("send-employer-winback handler", () => {
  it("fails closed with 401 when CRON_SECRET is unset or wrong", async () => {
    process.env.CRON_SECRET = "";
    expect((await call("Bearer ")).status).toBe(401);
    process.env.CRON_SECRET = "cron-secret";
    expect((await call("Bearer nope")).status).toBe(401);
    expect(sendEmployerEmail).not.toHaveBeenCalled();
  });

  it("sends one win-back, sets the 30-day dedupe key, emits the event without PII and records the heartbeat", async () => {
    installFetch(baseData());
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, sent: 1, skipped: 0, failed: 0 });
    expect(sendEmployerEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "boss@acme.com", idempotencyKey: expect.stringContaining("employer-winback-e1-") }));
    expect(redisSetEx).toHaveBeenCalledWith("employer_winback:e1", WINBACK_COOLDOWN_SECONDS, expect.any(String));
    expect(captureServerEvent).toHaveBeenCalledWith("employer_winback_sent", "e1", { kind: "no_unlock", requirement_count: 1, unlock_count: 0 });
    expect(JSON.stringify(captureServerEvent.mock.calls)).not.toContain("acme");
    expect(recordCronResult).toHaveBeenCalledWith("send-employer-winback", { errors: 0 });
  });

  it("skips an employer inside the 30-day cooldown", async () => {
    installFetch(baseData());
    redisGet.mockResolvedValue("2026-10-01T00:00:00Z");
    expect(await (await call()).json()).toMatchObject({ sent: 0, skipped: 1 });
    expect(sendEmployerEmail).not.toHaveBeenCalled();
  });

  it("skips opted-out and suspended employers", async () => {
    installFetch(baseData());
    filterSuppressed.mockResolvedValue([]);
    expect(await (await call()).json()).toMatchObject({ sent: 0, skipped: 1 });

    installFetch({ ...baseData(), employers: [{ id: "e1", suspended_at: "2026-10-01T00:00:00Z", company_name: "Acme" }] });
    filterSuppressed.mockImplementation(async (_d: unknown, rows: unknown[]) => rows);
    expect(await (await call()).json()).toMatchObject({ sent: 0, skipped: 1 });
    expect(sendEmployerEmail).not.toHaveBeenCalled();
  });

  it("does not treat a past unlocker as never-unlocked", async () => {
    installFetch({ ...baseData(), unlocks: [{ unlocked_at: ago(8), employer_requirements: { employer_id: "e1" } }] });
    expect(await (await call()).json()).toMatchObject({ sent: 0, considered: 0 });
  });

  it("502s with NO heartbeat when an activity read fails", async () => {
    installFetch({ ...baseData(), failAt: "unlocks" });
    expect((await call()).status).toBe(502);
    expect(slogError).toHaveBeenCalledWith("employer winback read failed", expect.objectContaining({ step: "Activity query failed" }));
    expect(recordCronResult).not.toHaveBeenCalled();
  });

  it("502s when the employer lookup fails rather than dropping the send silently", async () => {
    installFetch({ ...baseData(), failAt: "profiles" });
    expect((await call()).status).toBe(502);
    expect(recordCronResult).not.toHaveBeenCalled();
  });

  it("does not set the dedupe key when the send fails, and a total failure withholds the heartbeat", async () => {
    installFetch(baseData());
    sendEmployerEmail.mockResolvedValue(false);
    const res = await call();
    expect(res.status).toBe(502);
    expect(redisSetEx).not.toHaveBeenCalled();
    expect(captureServerEvent).not.toHaveBeenCalled();
    expect(recordCronResult).toHaveBeenCalledWith("send-employer-winback", { errors: 1 });
  });
});

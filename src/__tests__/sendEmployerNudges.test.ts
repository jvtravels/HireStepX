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

const { default: handler } = await import("../../server-handlers/send-employer-nudges");

const DAY = 86_400_000;
const createdAgo = (d: number) => new Date(Date.now() - d * DAY).toISOString();

function installFetch(o: { reqs?: unknown[]; matches?: unknown[]; employers?: unknown[]; profiles?: unknown[]; reqOk?: boolean }) {
  const f = vi.fn(async (url: string) => {
    const u = String(url);
    const body = u.includes("employer_requirements") ? o.reqs
      : u.includes("requirement_matches") ? o.matches
      : u.includes("/employers?") ? o.employers
      : u.includes("/profiles?") ? o.profiles : [];
    return { ok: u.includes("employer_requirements") ? (o.reqOk ?? true) : true, json: async () => body ?? [] };
  });
  global.fetch = f as unknown as typeof fetch;
  return f;
}

const call = (auth: string | null = "Bearer cron-secret") =>
  handler(new Request("https://x.test/api/send-employer-nudges", { headers: auth ? { authorization: auth } : {} }));

const baseData = () => ({
  reqs: [{ id: "r1", employer_id: "e1", title: "Dev", created_at: createdAgo(4), status: "ready" }],
  matches: [{ requirement_id: "r1", unlocked: false }, { requirement_id: "r1", unlocked: false }],
  employers: [{ id: "e1", suspended_at: null }],
  profiles: [{ id: "e1", email: "boss@acme.com" }],
});

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret";
  redisGet.mockReset().mockResolvedValue(null);
  redisSetEx.mockReset();
  sendEmployerEmail.mockReset().mockResolvedValue(true);
  filterSuppressed.mockReset().mockImplementation(async (_d: unknown, rows: unknown[]) => rows);
});

describe("send-employer-nudges", () => {
  it("fails closed with 401 when CRON_SECRET is unset or wrong", async () => {
    process.env.CRON_SECRET = "";
    expect((await call("Bearer ")).status).toBe(401);
    process.env.CRON_SECRET = "cron-secret";
    expect((await call("Bearer nope")).status).toBe(401);
    expect(sendEmployerEmail).not.toHaveBeenCalled();
  });

  it("sends one nudge, then marks the per-requirement dedupe key", async () => {
    installFetch(baseData());
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, sent: 1, skipped: 0 });
    expect(sendEmployerEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "boss@acme.com", idempotencyKey: "employer-nudge-matches_waiting-r1" }));
    expect(redisSetEx).toHaveBeenCalledWith("employer_nudge:matches_waiting:r1", expect.any(Number), expect.any(String));
  });

  it("is idempotent: an existing dedupe key skips the send", async () => {
    installFetch(baseData());
    redisGet.mockResolvedValue("2026-10-30T00:00:00Z");
    const res = await call();
    expect(await res.json()).toMatchObject({ sent: 0, skipped: 1 });
    expect(sendEmployerEmail).not.toHaveBeenCalled();
  });

  it("skips opted-out and suspended employers", async () => {
    installFetch(baseData());
    filterSuppressed.mockResolvedValue([]);
    expect(await (await call()).json()).toMatchObject({ sent: 0, skipped: 1 });

    installFetch({ ...baseData(), employers: [{ id: "e1", suspended_at: "2026-10-01T00:00:00Z" }] });
    filterSuppressed.mockImplementation(async (_d: unknown, rows: unknown[]) => rows);
    expect(await (await call()).json()).toMatchObject({ sent: 0, skipped: 1 });
    expect(sendEmployerEmail).not.toHaveBeenCalled();
  });

  it("does not mark the dedupe key when the send fails, so the next run retries", async () => {
    installFetch(baseData());
    sendEmployerEmail.mockResolvedValue(false);
    expect(await (await call()).json()).toMatchObject({ sent: 0, skipped: 1 });
    expect(redisSetEx).not.toHaveBeenCalled();
  });

  it("502s when the requirement query fails", async () => {
    installFetch({ ...baseData(), reqOk: false });
    expect((await call()).status).toBe(502);
  });
});

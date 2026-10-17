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
const recordCronResult = vi.fn();
vi.mock("../../server-handlers/_cron-heartbeat", () => ({ recordCronResult: (...a: unknown[]) => recordCronResult(...a) }));
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
  recordCronResult.mockReset().mockResolvedValue(true);
  slogError.mockReset();
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

  it("does not mark the dedupe key when the send fails, so the next run retries; a total send failure is a failed run", async () => {
    installFetch(baseData());
    sendEmployerEmail.mockResolvedValue(false);
    const res = await call();
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ ok: false, sent: 0, skipped: 1, failed: 1 });
    expect(redisSetEx).not.toHaveBeenCalled();
    expect(recordCronResult).toHaveBeenCalledWith("send-employer-nudges", { errors: 1 });
  });

  it("records a clean heartbeat on a successful run", async () => {
    installFetch(baseData());
    await call();
    expect(recordCronResult).toHaveBeenCalledWith("send-employer-nudges", { errors: 0 });
  });

  it("records a clean heartbeat when there is nothing to do", async () => {
    installFetch({ reqs: [] });
    const res = await call();
    expect(res.status).toBe(200);
    expect(recordCronResult).toHaveBeenCalledWith("send-employer-nudges", { errors: 0 });
  });

  it("one bad address among successful sends does not fail the run", async () => {
    installFetch({
      reqs: [
        { id: "r1", employer_id: "e1", title: "Dev", created_at: createdAgo(4), status: "ready" },
        { id: "r2", employer_id: "e2", title: "QA", created_at: createdAgo(4), status: "ready" },
      ],
      matches: [{ requirement_id: "r1", unlocked: false }, { requirement_id: "r2", unlocked: false }],
      employers: [{ id: "e1", suspended_at: null }, { id: "e2", suspended_at: null }],
      profiles: [{ id: "e1", email: "a@acme.com" }, { id: "e2", email: "b@acme.com" }],
    });
    sendEmployerEmail.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, sent: 1, failed: 1 });
    expect(recordCronResult).toHaveBeenCalledWith("send-employer-nudges", { errors: 0 });
  });

  it("502s with an error log and NO heartbeat when the requirement query fails", async () => {
    installFetch({ ...baseData(), reqOk: false });
    expect((await call()).status).toBe(502);
    expect(slogError).toHaveBeenCalledWith("employer nudges read failed", expect.objectContaining({ step: "Requirement query failed" }));
    expect(recordCronResult).not.toHaveBeenCalled();
  });

  it("502s and records no heartbeat when the match read fails (not treated as zero matches)", async () => {
    global.fetch = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("requirement_matches")) return { ok: false, json: async () => ({}) };
      return { ok: true, json: async () => (u.includes("employer_requirements") ? baseData().reqs : []) };
    }) as unknown as typeof fetch;
    expect((await call()).status).toBe(502);
    expect(slogError).toHaveBeenCalledWith("employer nudges read failed", expect.objectContaining({ step: "Match query failed" }));
    expect(recordCronResult).not.toHaveBeenCalled();
    expect(sendEmployerEmail).not.toHaveBeenCalled();
  });

  it("502s when the employer or profile lookup fails", async () => {
    global.fetch = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/profiles?")) return { ok: false, json: async () => ({}) };
      const d = baseData();
      return { ok: true, json: async () => (u.includes("employer_requirements") ? d.reqs : u.includes("requirement_matches") ? d.matches : u.includes("/employers?") ? d.employers : []) };
    }) as unknown as typeof fetch;
    expect((await call()).status).toBe(502);
    expect(slogError).toHaveBeenCalledWith("employer nudges read failed", expect.objectContaining({ step: "Employer lookup failed" }));
    expect(recordCronResult).not.toHaveBeenCalled();
  });

  it("pages requirement reads past the 1000-row PostgREST cap", async () => {
    const reqPages: string[] = [];
    const many = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}`, employer_id: "e1", title: "Dev", created_at: createdAgo(1), status: "ready" }));
    global.fetch = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("employer_requirements")) {
        reqPages.push(u);
        return { ok: true, json: async () => (u.includes("offset=0&") ? many : []) };
      }
      return { ok: true, json: async () => [] };
    }) as unknown as typeof fetch;
    const res = await call();
    expect(res.status).toBe(200);
    expect(reqPages).toHaveLength(2);
    expect(reqPages[0]).toContain("offset=0&limit=1000");
    expect(reqPages[1]).toContain("offset=1000&limit=1000");
    expect(reqPages[0]).toContain("order=created_at.desc,id.desc");
    expect(await res.json()).toMatchObject({ considered: 1000 });
  });
});

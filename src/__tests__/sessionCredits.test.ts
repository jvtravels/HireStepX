import { describe, it, expect, vi } from "vitest";
import {
  getSessionCredits,
  grantSessionCredits,
  consumeSessionCredit,
} from "../../server-handlers/_session-credits";

const BASE = "https://proj.supabase.co";
const KEY = "service-role-key";
const USER = "user-123";

type Call = { url: string; method: string; body?: unknown };

/** Build a fetch mock that routes by HTTP method:
 *  - GET  → returns the configured balance row(s)
 *  - POST/PATCH → returns { ok: writeOk } and records the call. */
function mockFetch(opts: { rows?: unknown; getOk?: boolean; writeOk?: boolean }) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method || "GET").toUpperCase();
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url, method, body });
    if (method === "GET") {
      return { ok: opts.getOk ?? true, json: async () => opts.rows ?? [] } as Response;
    }
    return { ok: opts.writeOk ?? true, json: async () => ({}) } as Response;
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe("_session-credits", () => {
  it("reads a positive balance", async () => {
    const { fn } = mockFetch({ rows: [{ balance: 4 }] });
    expect(await getSessionCredits(BASE, KEY, USER, fn)).toBe(4);
  });

  it("returns 0 for missing row, failed read, or negative balance", async () => {
    expect(await getSessionCredits(BASE, KEY, USER, mockFetch({ rows: [] }).fn)).toBe(0);
    expect(await getSessionCredits(BASE, KEY, USER, mockFetch({ getOk: false }).fn)).toBe(0);
    expect(await getSessionCredits(BASE, KEY, USER, mockFetch({ rows: [{ balance: -2 }] }).fn)).toBe(0);
  });

  it("grants credits on top of the existing balance and upserts the total", async () => {
    const { fn, calls } = mockFetch({ rows: [{ balance: 2 }], writeOk: true });
    const newBalance = await grantSessionCredits(BASE, KEY, USER, 3, fn);
    expect(newBalance).toBe(5);
    const write = calls.find(c => c.method === "POST");
    expect(write).toBeTruthy();
    expect((write!.body as { balance: number }).balance).toBe(5);
    expect((write!.body as { user_id: string }).user_id).toBe(USER);
  });

  it("clamps the granted quantity to 1..10", async () => {
    expect(await grantSessionCredits(BASE, KEY, USER, 99, mockFetch({ rows: [{ balance: 0 }] }).fn)).toBe(10);
    expect(await grantSessionCredits(BASE, KEY, USER, 0, mockFetch({ rows: [{ balance: 0 }] }).fn)).toBe(1);
    expect(await grantSessionCredits(BASE, KEY, USER, -5, mockFetch({ rows: [{ balance: 1 }] }).fn)).toBe(2);
  });

  it("returns null when the grant write fails", async () => {
    const { fn } = mockFetch({ rows: [{ balance: 1 }], writeOk: false });
    expect(await grantSessionCredits(BASE, KEY, USER, 1, fn)).toBeNull();
  });

  it("retries the grant on transient write failure and succeeds (money-critical path)", async () => {
    const calls: Call[] = [];
    let writeAttempts = 0;
    const fn = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ url, method, body });
      if (method === "GET") return { ok: true, json: async () => [{ balance: 2 }] } as Response;
      writeAttempts++;
      // Fail the first two write attempts, succeed on the third.
      return { ok: writeAttempts >= 3, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;
    const newBalance = await grantSessionCredits(BASE, KEY, USER, 1, fn, 3);
    expect(newBalance).toBe(3);
    expect(writeAttempts).toBe(3);
  });

  it("returns null after exhausting all retries", async () => {
    const { fn } = mockFetch({ rows: [{ balance: 1 }], writeOk: false });
    expect(await grantSessionCredits(BASE, KEY, USER, 1, fn, 2)).toBeNull();
  });

  /** Build a fetch mock for the atomic consume RPC: POST /rest/v1/rpc/consume_session_credit
   *  returns a bare boolean (the SQL function result). */
  function mockRpc(opts: { ok?: boolean; result?: unknown }) {
    const calls: Call[] = [];
    const fn = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ url, method, body });
      return { ok: opts.ok ?? true, json: async () => opts.result } as Response;
    });
    return { fn: fn as unknown as typeof fetch, calls };
  }

  it("consumes one credit via the atomic RPC and reports success", async () => {
    const { fn, calls } = mockRpc({ ok: true, result: true });
    expect(await consumeSessionCredit(BASE, KEY, USER, fn)).toBe(true);
    const rpc = calls.find(c => c.method === "POST");
    expect(rpc).toBeTruthy();
    expect(rpc!.url).toContain("/rpc/consume_session_credit");
    expect((rpc!.body as { p_user_id: string }).p_user_id).toBe(USER);
  });

  it("reports no consume when the RPC returns false (zero balance)", async () => {
    const { fn } = mockRpc({ ok: true, result: false });
    expect(await consumeSessionCredit(BASE, KEY, USER, fn)).toBe(false);
  });

  it("reports failure when the consume RPC call fails", async () => {
    const { fn } = mockRpc({ ok: false, result: null });
    expect(await consumeSessionCredit(BASE, KEY, USER, fn)).toBe(false);
  });
});

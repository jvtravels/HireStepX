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

  it("consumes one credit when the balance is positive", async () => {
    const { fn, calls } = mockFetch({ rows: [{ balance: 2 }], writeOk: true });
    expect(await consumeSessionCredit(BASE, KEY, USER, fn)).toBe(true);
    const patch = calls.find(c => c.method === "PATCH");
    expect(patch).toBeTruthy();
    expect((patch!.body as { balance: number }).balance).toBe(1);
    // The decrement is filtered server-side so balance can never go negative.
    expect(patch!.url).toContain("balance=gt.0");
  });

  it("does not consume (and issues no write) when the balance is zero", async () => {
    const { fn, calls } = mockFetch({ rows: [{ balance: 0 }] });
    expect(await consumeSessionCredit(BASE, KEY, USER, fn)).toBe(false);
    expect(calls.some(c => c.method === "PATCH")).toBe(false);
  });

  it("reports failure when the consume write fails", async () => {
    const { fn } = mockFetch({ rows: [{ balance: 1 }], writeOk: false });
    expect(await consumeSessionCredit(BASE, KEY, USER, fn)).toBe(false);
  });
});

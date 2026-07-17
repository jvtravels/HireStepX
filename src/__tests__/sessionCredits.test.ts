import { describe, it, expect, vi } from "vitest";
import {
  getSessionCredits,
  grantSessionCredits,
  consumeSessionCredit,
  revokeSessionCredits,
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

  /** Build a fetch mock for the atomic grant RPC + fallback upsert path.
   *  Routes by URL so RPC calls and upsert calls can be controlled independently. */
  function mockGrantFetch(opts: {
    rpcOk?: boolean;
    rpcBalance?: number | null;  // null = RPC missing (404), skip to fallback
    rows?: unknown;
    writeOk?: boolean;
  }) {
    const calls: Call[] = [];
    const fn = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ url, method, body });
      if (url.includes("/rpc/grant_session_credits")) {
        // opts.rpcBalance===null means RPC not deployed (404)
        if (opts.rpcBalance === null) return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
        return { ok: opts.rpcOk ?? true, status: 200, json: async () => opts.rpcBalance ?? 0 } as unknown as Response;
      }
      if (method === "GET") {
        return { ok: true, json: async () => opts.rows ?? [] } as Response;
      }
      // Fallback upsert POST
      return { ok: opts.writeOk ?? true, json: async () => ({}) } as Response;
    });
    return { fn: fn as unknown as typeof fetch, calls };
  }

  it("grants credits atomically via the RPC path (primary)", async () => {
    // RPC returns the new balance directly — no fallback read needed
    const { fn, calls } = mockGrantFetch({ rpcOk: true, rpcBalance: 5 });
    const newBalance = await grantSessionCredits(BASE, KEY, USER, 3, fn);
    expect(newBalance).toBe(5);
    // Only one POST (to the RPC) — no GET + upsert fallback
    const posts = calls.filter(c => c.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toContain("/rpc/grant_session_credits");
    expect((posts[0].body as { p_user_id: string }).p_user_id).toBe(USER);
    expect((posts[0].body as { p_qty: number }).p_qty).toBe(3);
  });

  it("falls back to read-then-upsert when RPC is not deployed", async () => {
    // Simulate RPC missing (404) — should fall through to legacy path
    const { fn, calls } = mockGrantFetch({ rpcBalance: null, rows: [{ balance: 2 }], writeOk: true });
    const newBalance = await grantSessionCredits(BASE, KEY, USER, 3, fn);
    expect(newBalance).toBe(5);
    // Should have: RPC POST (404), GET for balance, upsert POST
    const posts = calls.filter(c => c.method === "POST");
    expect(posts).toHaveLength(2); // RPC attempt + upsert fallback
    const upsert = posts.find(c => c.url.includes("/session_credits") && !c.url.includes("/rpc/"));
    expect(upsert).toBeTruthy();
    expect((upsert!.body as { balance: number }).balance).toBe(5);
    expect((upsert!.body as { user_id: string }).user_id).toBe(USER);
  });

  it("clamps the granted quantity to 1..10", async () => {
    expect(await grantSessionCredits(BASE, KEY, USER, 99, mockGrantFetch({ rpcOk: true, rpcBalance: 10 }).fn)).toBe(10);
    expect(await grantSessionCredits(BASE, KEY, USER, 0, mockGrantFetch({ rpcOk: true, rpcBalance: 1 }).fn)).toBe(1);
    expect(await grantSessionCredits(BASE, KEY, USER, -5, mockGrantFetch({ rpcOk: true, rpcBalance: 2 }).fn)).toBe(2);
  });

  it("returns null when the grant fails (RPC + all fallback retries exhausted)", async () => {
    // RPC 404 and fallback upsert always fails
    const { fn } = mockGrantFetch({ rpcBalance: null, rows: [{ balance: 1 }], writeOk: false });
    expect(await grantSessionCredits(BASE, KEY, USER, 1, fn)).toBeNull();
  });

  it("retries the grant on transient write failure and succeeds (money-critical path)", async () => {
    // RPC is not deployed (404). Fallback upsert fails twice then succeeds.
    let upsertAttempts = 0;
    const fn = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      if (url.includes("/rpc/grant_session_credits")) {
        return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
      }
      if (method === "GET") return { ok: true, json: async () => [{ balance: 2 }] } as Response;
      upsertAttempts++;
      // Fail first two upsert attempts, succeed on the third.
      return { ok: upsertAttempts >= 3, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;
    const newBalance = await grantSessionCredits(BASE, KEY, USER, 1, fn, 3);
    expect(newBalance).toBe(3);
    expect(upsertAttempts).toBe(3);
  });

  it("returns null after exhausting all retries", async () => {
    const { fn } = mockGrantFetch({ rpcBalance: null, rows: [{ balance: 1 }], writeOk: false });
    expect(await grantSessionCredits(BASE, KEY, USER, 1, fn, 2)).toBeNull();
  });

  it("retries the RPC on transient 5xx without ever touching the non-atomic fallback", async () => {
    // This is the race-condition fix. A 5xx from the RPC means the DB is having
    // a transient issue — NOT that the function is missing. Falling back to the
    // non-atomic read-then-upsert in this case is what caused credit loss when
    // the webhook and the client callback both hit the fallback simultaneously
    // (both read balance=X, both write X+qty, one grant silently clobbered).
    // The fix: retry the atomic RPC only; never touch the non-atomic path on 5xx.
    let rpcAttempts = 0;
    const fn = vi.fn(async (url: string) => {
      if (url.includes("/rpc/grant_session_credits")) {
        rpcAttempts++;
        if (rpcAttempts < 3) return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
        return { ok: true, status: 200, json: async () => 7 } as unknown as Response;
      }
      // If this line is ever reached, the non-atomic fallback fired — fail the test.
      throw new Error("non-atomic fallback must not be called for transient RPC errors");
    }) as unknown as typeof fetch;

    const newBalance = await grantSessionCredits(BASE, KEY, USER, 3, fn, 3);
    expect(newBalance).toBe(7);
    expect(rpcAttempts).toBe(3);
  });

  it("passes paymentId to the RPC for credit ledger traceability", async () => {
    const { fn, calls } = mockGrantFetch({ rpcOk: true, rpcBalance: 5 });
    await grantSessionCredits(BASE, KEY, USER, 3, fn, 0, { paymentId: "pay_test123" });
    const rpcCall = calls.find(c => c.url.includes("/rpc/grant_session_credits"));
    expect((rpcCall?.body as { p_payment_id?: string })?.p_payment_id).toBe("pay_test123");
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

  /* Refund revocation (B5) — the old refund path PATCHed the long-dropped
   * `profiles.session_credits` column, so refunded single-session buyers kept
   * every credit. revokeSessionCredits must instead zero the authoritative
   * session_credits TABLE via reconcile_session_credits. */
  it("revokes credits by zeroing the ledger via reconcile_session_credits RPC", async () => {
    const { fn, calls } = mockRpc({ ok: true, result: 0 });
    expect(await revokeSessionCredits(BASE, KEY, USER, 0, "refund:pay_abc", fn)).toBe(0);
    const rpc = calls.find(c => c.method === "POST");
    expect(rpc).toBeTruthy();
    expect(rpc!.url).toContain("/rpc/reconcile_session_credits");
    expect(rpc!.url).not.toContain("/profiles"); // never touches the dead column
    expect((rpc!.body as { p_user_id: string }).p_user_id).toBe(USER);
    expect((rpc!.body as { p_correct_balance: number }).p_correct_balance).toBe(0);
    expect((rpc!.body as { p_note: string }).p_note).toBe("refund:pay_abc");
  });

  it("returns null when the revoke RPC fails (surfaces the error, no silent no-op)", async () => {
    const { fn } = mockRpc({ ok: false, result: null });
    expect(await revokeSessionCredits(BASE, KEY, USER, 0, "refund", fn)).toBeNull();
  });
});

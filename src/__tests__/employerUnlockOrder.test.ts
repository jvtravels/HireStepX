import { describe, it, expect, vi } from "vitest";
import {
  isUuid, isFreshOpenOrder, decideUnlockLimit, pendingOrderMatchCount, findReusableOrder, findOverlappingOrder,
  insertUnlockOrder, loadOpenOrders, findOlderOverlap, noOlderOverlap, countUnlocksLast24h, tryCreateLock, STALE_CREATED_ORDER_MS,
} from "../../server-handlers/_employer-unlock-order";
import { TIER_LIMITS } from "../../server-handlers/_employer-trust";
import { FakeUnlockDb, HEADERS, SUPABASE, order, match } from "./unlockTestUtils";

vi.mock("../../server-handlers/_shared", () => ({ slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const NOW = Date.parse("2026-10-10T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("isUuid", () => {
  it("accepts uuids and rejects PostgREST-injection-shaped input", () => {
    expect(isUuid("3f2b8a52-1c4d-4e6f-9a0b-1234567890ab")).toBe(true);
    expect(isUuid("m1")).toBe(false);
    expect(isUuid("abc,or=(a.eq.1)")).toBe(false);
  });
});

describe("decideUnlockLimit", () => {
  it("allows up to the tier limit and refuses beyond it with limit/remaining", () => {
    const basic = TIER_LIMITS.basic.unlocksPerDay;
    expect(decideUnlockLimit({ tier: "basic", used: basic - 1, requested: 1 })).toEqual({ ok: true });
    const r = decideUnlockLimit({ tier: "basic", used: basic - 1, requested: 2 });
    expect(r).toMatchObject({ ok: false, limit: basic, remaining: 1 });
    if (!r.ok) expect(r.message).toContain("Daily unlock limit");
  });
  it("never reports negative remaining", () => {
    const r = decideUnlockLimit({ tier: "verified", used: 500, requested: 1 });
    expect(r).toMatchObject({ ok: false, remaining: 0, limit: TIER_LIMITS.verified.unlocksPerDay });
  });
  it("higher tiers have higher limits", () => {
    expect(TIER_LIMITS.verified.unlocksPerDay).toBeGreaterThan(TIER_LIMITS.email_verified.unlocksPerDay);
    expect(TIER_LIMITS.email_verified.unlocksPerDay).toBeGreaterThan(TIER_LIMITS.basic.unlocksPerDay);
  });
});

describe("open order rules", () => {
  const fresh = order({ razorpay_order_id: "o_fresh", match_ids: ["a"], created_at: ago(60_000) });
  const stale = order({ razorpay_order_id: "o_stale", match_ids: ["b"], created_at: ago(STALE_CREATED_ORDER_MS + 1000) });
  const paid = order({ razorpay_order_id: "o_paid", status: "paid", match_ids: ["c", "d"], created_at: ago(5 * 3600_000) });

  it("isFreshOpenOrder: paid always, created only within the stale window", () => {
    expect(isFreshOpenOrder(fresh, NOW)).toBe(true);
    expect(isFreshOpenOrder(stale, NOW)).toBe(false);
    expect(isFreshOpenOrder(paid, NOW)).toBe(true);
  });
  it("pendingOrderMatchCount counts only fresh open orders", () => {
    expect(pendingOrderMatchCount([fresh, stale, paid], NOW)).toBe(3);
  });
  it("findReusableOrder matches mode + exact id set on unpaid orders only", () => {
    expect(findReusableOrder([fresh, stale, paid], "single", ["a"])?.razorpay_order_id).toBe("o_fresh");
    expect(findReusableOrder([fresh, stale, paid], "single", ["b"])?.razorpay_order_id).toBe("o_stale");
    expect(findReusableOrder([fresh, paid], "batch", ["a"])).toBeNull();
    expect(findReusableOrder([paid], "single", ["c", "d"])).toBeNull();
  });
  it("findOverlappingOrder ignores stale unpaid orders but honours paid ones", () => {
    expect(findOverlappingOrder([fresh, stale, paid], ["b", "x"], NOW)).toBeNull();
    expect(findOverlappingOrder([fresh, stale, paid], ["d"], NOW)?.razorpay_order_id).toBe("o_paid");
  });
});

describe("loaders", () => {
  it("loadOpenOrders returns rows, null on failure", async () => {
    const db = new FakeUnlockDb().seed({ orders: [order(), order({ razorpay_order_id: "o2", status: "fulfilled" })] });
    const rows = await loadOpenOrders(SUPABASE, HEADERS, "emp-1", db.fetch as typeof fetch);
    expect(rows?.map((r) => r.razorpay_order_id)).toEqual(["order_1"]);
    db.failWhen = () => true;
    expect(await loadOpenOrders(SUPABASE, HEADERS, "emp-1", db.fetch as typeof fetch)).toBeNull();
  });
  it("countUnlocksLast24h counts rows and reports null on failure", async () => {
    const f = vi.fn(async (_url: string) => new Response(JSON.stringify([{ id: "a" }, { id: "b" }]), { status: 200 }));
    expect(await countUnlocksLast24h(SUPABASE, HEADERS, "emp-1", NOW, f as unknown as typeof fetch)).toBe(2);
    const url = String(f.mock.calls[0][0]);
    expect(url).toContain("unlocked=eq.true");
    expect(url).toContain("employer_requirements.employer_id=eq.emp-1");
    const bad = vi.fn(async () => new Response("x", { status: 500 }));
    expect(await countUnlocksLast24h(SUPABASE, HEADERS, "emp-1", NOW, bad as unknown as typeof fetch)).toBeNull();
  });
});

describe("insertUnlockOrder", () => {
  const row = { razorpayOrderId: "order_x", employerId: "emp-1", requirementId: "req-1", mode: "single" as const, matchIds: ["m1"], amount: 5900, currency: "INR" };

  it("inserts a 'created' order", async () => {
    const db = new FakeUnlockDb();
    const r = await insertUnlockOrder(SUPABASE, HEADERS, row, db.fetch as typeof fetch);
    expect(r.kind).toBe("inserted");
    expect(db.orders.get("order_x")).toMatchObject({ status: "created", amount: 5900, match_ids: ["m1"] });
  });

  it("stores credit_applied_paise when credit was applied", async () => {
    const db = new FakeUnlockDb();
    await insertUnlockOrder(SUPABASE, HEADERS, { ...row, amount: 3900, creditAppliedPaise: 2000 }, db.fetch as typeof fetch);
    expect((db.orders.get("order_x") as unknown as Record<string, unknown>).credit_applied_paise).toBe(2000);
  });

  it("retries without credit_applied_paise when migration 0042's column is absent (400)", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const f = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const b = JSON.parse(String(init?.body)) as Record<string, unknown>;
      bodies.push(b);
      return "credit_applied_paise" in b
        ? new Response('{"code":"PGRST204"}', { status: 400 })
        : new Response(JSON.stringify([order({ razorpay_order_id: "order_x" })]), { status: 201 });
    });
    const r = await insertUnlockOrder(SUPABASE, HEADERS, { ...row, amount: 3900, creditAppliedPaise: 2000 }, f as unknown as typeof fetch);
    expect(r.kind).toBe("inserted");
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).not.toHaveProperty("credit_applied_paise");
  });

  it("never sends credit_applied_paise for a plain cash order", async () => {
    const f = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify([order()]), { status: 201, headers: { "x-body": String(init?.body) } }));
    await insertUnlockOrder(SUPABASE, HEADERS, row, f as unknown as typeof fetch);
    expect(String((f.mock.calls[0][1] as RequestInit).body)).not.toContain("credit_applied_paise");
  });

  it("on a 409 (unique open-single index) returns the winner's order for reuse", async () => {
    const winner = order({ razorpay_order_id: "order_winner", match_ids: ["m1"] });
    const f = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response("{}", { status: 409 });
      return new Response(JSON.stringify([winner]), { status: 200 });
    });
    const r = await insertUnlockOrder(SUPABASE, HEADERS, row, f as unknown as typeof fetch);
    expect(r).toMatchObject({ kind: "conflict", order: { razorpay_order_id: "order_winner" } });
  });

  it("returns an error for any other failure", async () => {
    const f = vi.fn(async () => new Response("nope", { status: 500 }));
    expect((await insertUnlockOrder(SUPABASE, HEADERS, row, f as unknown as typeof fetch)).kind).toBe("error");
  });
});

describe("tryCreateLock", () => {
  const cfg = { url: "https://redis.test", token: "t" };
  it("is a non-blocking optimisation: unavailable without config or on failure", async () => {
    expect(await tryCreateLock("k", { url: "", token: "" }, 10)).toBe("unavailable");
    expect(await tryCreateLock("k", cfg, 10, vi.fn(async () => { throw new Error("x"); }) as unknown as typeof fetch)).toBe("unavailable");
  });
  it("distinguishes acquired from held", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ result: "OK" }), { status: 200 }));
    const held = vi.fn(async () => new Response(JSON.stringify({ result: null }), { status: 200 }));
    expect(await tryCreateLock("k", cfg, 10, ok as unknown as typeof fetch)).toBe("acquired");
    expect(await tryCreateLock("k", cfg, 10, held as unknown as typeof fetch)).toBe("held");
  });
});

void match;

describe("findOlderOverlap", () => {
  const mine = { razorpay_order_id: "order_b", match_ids: ["m1", "m2"], created_at: ago(1000) };
  const other = (over: Partial<ReturnType<typeof order>> = {}) => order({ razorpay_order_id: "order_a", match_ids: ["m2", "m3"], created_at: ago(5000), status: "created", ...over });

  it("returns the older live order that shares a match", () => {
    expect(findOlderOverlap([other()], mine, NOW)?.razorpay_order_id).toBe("order_a");
  });

  it("ignores a younger overlapping order, so only one of two racing orders backs out", () => {
    expect(findOlderOverlap([other({ created_at: ago(10) })], mine, NOW)).toBeNull();
    const olderMine = { ...mine, created_at: ago(9000), razorpay_order_id: "order_z" };
    expect(findOlderOverlap([other()], olderMine, NOW)).toBeNull();
  });

  it("breaks an exact created_at tie by order id, deterministically on both sides", () => {
    const t = ago(2000);
    const a = other({ created_at: t });
    expect(findOlderOverlap([a], { ...mine, created_at: t }, NOW)?.razorpay_order_id).toBe("order_a");
    expect(findOlderOverlap([order({ ...a, razorpay_order_id: "order_c" })], { ...mine, created_at: t }, NOW)).toBeNull();
  });

  it("ignores itself, disjoint orders and stale abandoned unpaid orders", () => {
    expect(findOlderOverlap([order({ razorpay_order_id: "order_b", match_ids: ["m1"], created_at: ago(9000) })], mine, NOW)).toBeNull();
    expect(findOlderOverlap([other({ match_ids: ["m9"] })], mine, NOW)).toBeNull();
    expect(findOlderOverlap([other({ created_at: ago(STALE_CREATED_ORDER_MS + 1000) })], mine, NOW)).toBeNull();
  });

  it("a paid order always counts, however old", () => {
    expect(findOlderOverlap([other({ status: "paid", created_at: ago(STALE_CREATED_ORDER_MS * 4) })], mine, NOW)?.razorpay_order_id).toBe("order_a");
  });
});

describe("noOlderOverlap", () => {
  const mineRow = order({ razorpay_order_id: "order_b", match_ids: ["m1"], created_at: ago(1000) });

  it("is false when an older live order covers the match", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify([order({ razorpay_order_id: "order_a", match_ids: ["m1"], created_at: ago(5000) })]), { status: 200 }));
    expect(await noOlderOverlap(SUPABASE, HEADERS, mineRow, NOW, f as unknown as typeof fetch)).toBe(false);
  });

  it("is true when nothing older overlaps", async () => {
    const f = vi.fn(async () => new Response("[]", { status: 200 }));
    expect(await noOlderOverlap(SUPABASE, HEADERS, mineRow, NOW, f as unknown as typeof fetch)).toBe(true);
  });

  it("lets the order proceed when the read fails (the DB guard and fulfilment are the other layers)", async () => {
    const bad = vi.fn(async () => new Response("x", { status: 500 }));
    expect(await noOlderOverlap(SUPABASE, HEADERS, mineRow, NOW, bad as unknown as typeof fetch)).toBe(true);
    const boom = vi.fn(async () => { throw new Error("net"); });
    expect(await noOlderOverlap(SUPABASE, HEADERS, mineRow, NOW, boom as unknown as typeof fetch)).toBe(true);
  });
});

describe("insertUnlockOrder: migration 0054 claim guard", () => {
  const batch = { razorpayOrderId: "order_x", employerId: "emp-1", requirementId: "req-1", mode: "batch" as const, matchIds: ["m1", "m2"], amount: 11800, currency: "INR" };
  const conflictFetch = (existing: unknown[]) => vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) =>
    init?.method === "POST"
      ? new Response('{"code":"23505","message":"unlock_match_claim_conflict"}', { status: 409 })
      : new Response(JSON.stringify(existing), { status: 200 }));

  it("flags an overlap with a different purchase instead of handing back someone else's order", async () => {
    const other = order({ razorpay_order_id: "order_single", mode: "single", match_ids: ["m1"] });
    const r = await insertUnlockOrder(SUPABASE, HEADERS, batch, conflictFetch([other]) as unknown as typeof fetch);
    expect(r).toEqual({ kind: "conflict", order: null, overlap: true });
  });

  it("still returns the winner when an identical batch won the race", async () => {
    const winner = order({ razorpay_order_id: "order_winner", mode: "batch", match_ids: ["m1", "m2"] });
    const r = await insertUnlockOrder(SUPABASE, HEADERS, batch, conflictFetch([winner]) as unknown as typeof fetch);
    expect(r).toMatchObject({ kind: "conflict", order: { razorpay_order_id: "order_winner" } });
    expect(r.kind === "conflict" && r.overlap).toBeFalsy();
  });
});

import { describe, it, expect, vi } from "vitest";
import {
  heldByOtherOrders, relockableMatchIds, remainingReturnablePaise, refundOverlapPaise, creditNoteAmountForCashRefund,
  incrementalOverlapPaise, ownershipKey, loadOtherLiveOrders, loadNotDeliveredKeys, loadOwnership, NOT_DELIVERED_REASONS,
} from "../../server-handlers/_unlock-ownership";

const BASE = "https://example.supabase.co";
const H = { apikey: "k" };
const res = (body: unknown, status = 200) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
const o = (id: string, ...matches: string[]) => ({ razorpay_order_id: id, match_ids: matches });

describe("ownership rules", () => {
  it("a match is held when another live order lists it and did not hand it back", () => {
    expect([...heldByOtherOrders(["m1", "m2"], [o("b", "m2", "m3")], new Set())]).toEqual(["m2"]);
  });

  it("an order that returned the match as not delivered never owned it", () => {
    expect(heldByOtherOrders(["m2"], [o("b", "m2")], new Set([ownershipKey("m2", "b")])).size).toBe(0);
  });

  it("relock covers only matches this order delivered and nobody else holds", () => {
    const mine = o("a", "m1", "m2", "m3");
    const others = [o("b", "m2")];
    expect(relockableMatchIds(mine, others, new Set())).toEqual(["m1", "m3"]);
    expect(relockableMatchIds(mine, others, new Set([ownershipKey("m3", "a")]))).toEqual(["m1"]);
    expect(relockableMatchIds(mine, others, new Set([ownershipKey("m2", "b")]))).toEqual(["m1", "m2", "m3"]);
    expect(relockableMatchIds(mine, [], new Set())).toEqual(["m1", "m2", "m3"]);
  });

  it("ownershipKey distinguishes order and match", () => {
    expect(ownershipKey("m1", "a")).not.toBe(ownershipKey("a", "m1"));
  });
});

describe("refund arithmetic", () => {
  it("remainingReturnablePaise is what was paid less cash refunded and credit returned, never negative", () => {
    expect(remainingReturnablePaise({ cashPaise: 3900, creditSpentPaise: 2000, cashRefundedPaise: 1000, creditReturnedPaise: 500 })).toBe(4400);
    expect(remainingReturnablePaise({ cashPaise: 5900, creditSpentPaise: 0, cashRefundedPaise: 5900, creditReturnedPaise: 5900 })).toBe(0);
    expect(remainingReturnablePaise({ cashPaise: 5900, creditSpentPaise: 0, cashRefundedPaise: -5, creditReturnedPaise: -5 })).toBe(5900);
  });

  it("refundOverlapPaise is the amount by which cash and credit back together exceed the order's value", () => {
    expect(refundOverlapPaise({ cashPaise: 5900, creditSpentPaise: 0, cashRefundedTotalPaise: 1000, creditReturnedPaise: 5900 })).toBe(1000);
    expect(refundOverlapPaise({ cashPaise: 5900, creditSpentPaise: 0, cashRefundedTotalPaise: 1000, creditReturnedPaise: 2000 })).toBe(0);
    expect(refundOverlapPaise({ cashPaise: 3900, creditSpentPaise: 2000, cashRefundedTotalPaise: 3900, creditReturnedPaise: 2100 })).toBe(100);
  });

  it("creditNoteAmountForCashRefund caps a note to what the order could still give back", () => {
    const full = { cashPaise: 5900, creditSpentPaise: 0, cashRefundedBeforePaise: 0 };
    expect(creditNoteAmountForCashRefund({ ...full, refundPaise: 1000, creditReturnedPaise: 0 })).toBe(1000);
    expect(creditNoteAmountForCashRefund({ ...full, refundPaise: 1000, creditReturnedPaise: 5400 })).toBe(500);
    expect(creditNoteAmountForCashRefund({ ...full, refundPaise: 1000, creditReturnedPaise: 5900 })).toBe(0);
    expect(creditNoteAmountForCashRefund({ ...full, refundPaise: 99.6, creditReturnedPaise: 0 })).toBe(100);
  });

  it("incrementalOverlapPaise only counts what earlier refunds have not already taken back", () => {
    expect(incrementalOverlapPaise(1500, 1000)).toBe(500);
    expect(incrementalOverlapPaise(1000, 1000)).toBe(0);
    expect(incrementalOverlapPaise(500, 1000)).toBe(0);
    expect(incrementalOverlapPaise(500, -1)).toBe(500);
  });
});

describe("loadOtherLiveOrders", () => {
  it("asks for other fulfilled/partial orders overlapping the matches, excluding itself", async () => {
    const f = vi.fn(async () => res([o("b", "m1")]));
    expect(await loadOtherLiveOrders(BASE, H, o("a", "m1", "m 2"), f as unknown as typeof fetch)).toEqual([o("b", "m1")]);
    const url = decodeURIComponent(String((f.mock.calls[0] as unknown[])[0]));
    expect(url).toContain("status=in.(fulfilled,partial)");
    expect(url).toContain("razorpay_order_id=neq.a");
    expect(url).toContain("match_ids=ov.{m1,m 2}");
  });

  it("is empty without a read when the order lists no matches", async () => {
    const f = vi.fn();
    expect(await loadOtherLiveOrders(BASE, H, o("a"), f as unknown as typeof fetch)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it("returns null (retry) on an HTTP error, a malformed body or a thrown fetch", async () => {
    expect(await loadOtherLiveOrders(BASE, H, o("a", "m1"), (async () => res({}, 500)) as unknown as typeof fetch)).toBeNull();
    expect(await loadOtherLiveOrders(BASE, H, o("a", "m1"), (async () => res({ not: "array" })) as unknown as typeof fetch)).toBeNull();
    expect(await loadOtherLiveOrders(BASE, H, o("a", "m1"), (async () => { throw new Error("net"); }) as unknown as typeof fetch)).toBeNull();
  });

  it("drops rows that are not orders", async () => {
    const f = async () => res([o("b", "m1"), { razorpay_order_id: 5, match_ids: ["m1"] }, { razorpay_order_id: "c" }]);
    expect(await loadOtherLiveOrders(BASE, H, o("a", "m1"), f as unknown as typeof fetch)).toEqual([o("b", "m1")]);
  });
});

describe("loadNotDeliveredKeys", () => {
  it("returns match|order keys for refund rows written because the order could not deliver", async () => {
    const f = vi.fn(async () => res([{ match_id: "m1", order_ref: "b" }, { match_id: null, order_ref: "b" }]));
    const keys = await loadNotDeliveredKeys(BASE, H, ["m1"], ["a", "b"], f as unknown as typeof fetch);
    expect([...(keys ?? [])]).toEqual([ownershipKey("m1", "b")]);
    const url = decodeURIComponent(String((f.mock.calls[0] as unknown[])[0]));
    expect(url).toContain(`reason=in.(${NOT_DELIVERED_REASONS.join(",")})`);
    expect(url).toContain("kind=eq.refund");
  });

  it("reads an absent ledger (migration unapplied) as no such rows, but a real failure as unknown", async () => {
    expect((await loadNotDeliveredKeys(BASE, H, ["m1"], ["a"], (async () => res({}, 404)) as unknown as typeof fetch))?.size).toBe(0);
    expect((await loadNotDeliveredKeys(BASE, H, ["m1"], ["a"], (async () => res('{"code":"PGRST205"}', 400)) as unknown as typeof fetch))?.size).toBe(0);
    expect(await loadNotDeliveredKeys(BASE, H, ["m1"], ["a"], (async () => res({}, 500)) as unknown as typeof fetch)).toBeNull();
    expect(await loadNotDeliveredKeys(BASE, H, ["m1"], ["a"], (async () => res({ x: 1 })) as unknown as typeof fetch)).toBeNull();
  });

  it("skips the read when there is nothing to look up", async () => {
    const f = vi.fn();
    expect((await loadNotDeliveredKeys(BASE, H, [], ["a"], f as unknown as typeof fetch))?.size).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("loadOwnership", () => {
  it("makes one read when no other order overlaps, two when one does", async () => {
    const none = vi.fn(async () => res([]));
    expect(await loadOwnership(BASE, H, o("a", "m1"), none as unknown as typeof fetch)).toEqual({ others: [], notDelivered: new Set() });
    expect(none).toHaveBeenCalledTimes(1);

    const f = vi.fn(async (url: RequestInfo | URL) => (String(url).includes("employer_credit_ledger") ? res([{ match_id: "m1", order_ref: "b" }]) : res([o("b", "m1")])));
    const r = await loadOwnership(BASE, H, o("a", "m1"), f as unknown as typeof fetch);
    expect(r?.others).toEqual([o("b", "m1")]);
    expect(r?.notDelivered.has(ownershipKey("m1", "b"))).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("is null when either read fails, so the caller retries instead of guessing", async () => {
    expect(await loadOwnership(BASE, H, o("a", "m1"), (async () => res({}, 500)) as unknown as typeof fetch)).toBeNull();
    const f = async (url: RequestInfo | URL) => (String(url).includes("employer_credit_ledger") ? res({}, 500) : res([o("b", "m1")]));
    expect(await loadOwnership(BASE, H, o("a", "m1"), f as unknown as typeof fetch)).toBeNull();
  });
});

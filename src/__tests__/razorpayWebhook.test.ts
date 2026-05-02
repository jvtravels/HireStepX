import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  computeRazorpaySignature,
  verifyRazorpaySignature,
  extractEventId,
  buildDedupKey,
  classifyEvent,
  isHandledEvent,
  HANDLED_WEBHOOK_EVENTS,
  InMemoryDedupStore,
} from "../../server-handlers/_razorpay-helpers";

/**
 * razorpay-webhook.ts — pure helpers
 *
 * The webhook itself does heavy fetch work and routes to subscription /
 * payment side effects. We've extracted the security-critical bits
 * (signature verification, dedup, event routing) so they can be
 * unit-tested without a Vercel handler.
 */

const TEST_SECRET = "test_secret_key";

function sign(body: string, secret = TEST_SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("computeRazorpaySignature", () => {
  it("matches a hand-computed reference", () => {
    const body = '{"event":"payment.captured"}';
    const expected = createHmac("sha256", TEST_SECRET).update(body).digest("hex");
    expect(computeRazorpaySignature(body, TEST_SECRET)).toBe(expected);
  });

  it("returns 64-char lowercase hex", () => {
    expect(computeRazorpaySignature("anything", TEST_SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifyRazorpaySignature", () => {
  it("accepts a known-good payload + signature pair", () => {
    const body = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_123"}}}}';
    const sig = sign(body);
    expect(verifyRazorpaySignature(body, sig, TEST_SECRET)).toBe(true);
  });

  it("rejects a known-bad signature", () => {
    const body = '{"event":"payment.captured"}';
    const wrong = "0".repeat(64);
    expect(verifyRazorpaySignature(body, wrong, TEST_SECRET)).toBe(false);
  });

  it("rejects when the body was tampered with after signing (sig was for body A, attacker submits body B)", () => {
    const original = '{"amount":4900,"plan":"weekly"}';
    const tampered = '{"amount":99900,"plan":"yearly-pro"}';
    const sig = sign(original);
    expect(verifyRazorpaySignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("rejects when the secret is wrong (forgery attempt with attacker's key)", () => {
    const body = '{"event":"payment.captured"}';
    const sig = sign(body, "attackers_secret_key");
    expect(verifyRazorpaySignature(body, sig, TEST_SECRET)).toBe(false);
  });

  it("rejects empty signature header", () => {
    const body = '{"event":"x"}';
    expect(verifyRazorpaySignature(body, "", TEST_SECRET)).toBe(false);
  });

  it("rejects when the secret is empty (misconfigured webhook)", () => {
    const body = '{"event":"x"}';
    const sig = sign(body, ""); // attacker can compute hmac with empty secret too
    expect(verifyRazorpaySignature(body, sig, "")).toBe(false);
  });

  it("rejects on length mismatch without throwing (timingSafeEqual would otherwise)", () => {
    const body = '{"event":"x"}';
    expect(verifyRazorpaySignature(body, "abc", TEST_SECRET)).toBe(false);
  });

  it("is robust to a non-hex signature header (no crash)", () => {
    const body = '{"event":"x"}';
    expect(() => verifyRazorpaySignature(body, "!!not-hex!!", TEST_SECRET)).not.toThrow();
    expect(verifyRazorpaySignature(body, "!!not-hex!!", TEST_SECRET)).toBe(false);
  });
});

describe("extractEventId", () => {
  it("reads payment.entity.id for payment.captured", () => {
    const evt = { event: "payment.captured", payload: { payment: { entity: { id: "pay_abc" } } } };
    expect(extractEventId(evt)).toBe("pay_abc");
  });

  it("reads subscription.entity.id for subscription.* events", () => {
    const evt = { event: "subscription.activated", payload: { subscription: { entity: { id: "sub_xyz" } } } };
    expect(extractEventId(evt)).toBe("sub_xyz");
  });

  it("falls back to top-level entity.id when nested entity is absent", () => {
    expect(extractEventId({ entity: { id: "evt_top" } })).toBe("evt_top");
  });

  it("returns empty string when no id is present", () => {
    expect(extractEventId({ event: "x" })).toBe("");
    expect(extractEventId({})).toBe("");
    expect(extractEventId(null)).toBe("");
  });
});

describe("buildDedupKey", () => {
  it("composes <eventType>:<eventId>", () => {
    expect(buildDedupKey("payment.captured", "pay_1")).toBe("payment.captured:pay_1");
  });

  it("returns empty string when either side is missing (so caller skips dedup)", () => {
    expect(buildDedupKey("", "pay_1")).toBe("");
    expect(buildDedupKey("payment.captured", "")).toBe("");
  });

  it("differentiates the same id across different event types", () => {
    // Same payment id but different event types must dedup separately —
    // payment.captured and payment.failed are distinct deliveries.
    const a = buildDedupKey("payment.captured", "pay_1");
    const b = buildDedupKey("payment.failed", "pay_1");
    expect(a).not.toBe(b);
  });
});

describe("classifyEvent / isHandledEvent", () => {
  it("routes payment.captured to one_time_payment", () => {
    expect(classifyEvent("payment.captured")).toBe("one_time_payment");
  });

  it("routes subscription.* events to subscription_lifecycle", () => {
    for (const evt of [
      "subscription.activated",
      "subscription.charged",
      "subscription.halted",
      "subscription.cancelled",
      "subscription.completed",
      "subscription.paused",
      "subscription.resumed",
    ] as const) {
      expect(classifyEvent(evt)).toBe("subscription_lifecycle");
    }
  });

  it("ignores unknown event types (returns 200 + skipped on the wire)", () => {
    expect(classifyEvent("refund.processed")).toBe("ignored");
    expect(classifyEvent("order.paid")).toBe("ignored");
    expect(classifyEvent("")).toBe("ignored");
    expect(classifyEvent("bogus.event")).toBe("ignored");
  });

  it("isHandledEvent narrows correctly across the full HANDLED list", () => {
    for (const evt of HANDLED_WEBHOOK_EVENTS) {
      expect(isHandledEvent(evt)).toBe(true);
    }
    expect(isHandledEvent("nope")).toBe(false);
  });
});

describe("InMemoryDedupStore", () => {
  it("returns true on first observation, false on a duplicate", () => {
    const store = new InMemoryDedupStore();
    expect(store.markProcessed("evt_1")).toBe(true);
    expect(store.markProcessed("evt_1")).toBe(false);
  });

  it("differentiates distinct event ids", () => {
    const store = new InMemoryDedupStore();
    expect(store.markProcessed("evt_1")).toBe(true);
    expect(store.markProcessed("evt_2")).toBe(true);
  });

  it("evicts when capacity is reached (bounded memory)", () => {
    const store = new InMemoryDedupStore(3);
    store.markProcessed("a");
    store.markProcessed("b");
    store.markProcessed("c");
    expect(store.size).toBe(3);
    // Next insert triggers a clear (size >= max)
    store.markProcessed("d");
    expect(store.has("a")).toBe(false);
    expect(store.has("d")).toBe(true);
  });

  it("treats an empty event id as 'nothing to dedup' (returns true)", () => {
    const store = new InMemoryDedupStore();
    expect(store.markProcessed("")).toBe(true);
    // And does NOT remember the empty string
    expect(store.has("")).toBe(false);
  });
});

describe("end-to-end: webhook reception path", () => {
  // Simulate the early portion of the handler: receive raw body + sig,
  // verify, parse, classify, dedup. This is the section we care about
  // most because it's the security gate.
  function receive(rawBody: string, signature: string, secret: string, store: InMemoryDedupStore) {
    if (!verifyRazorpaySignature(rawBody, signature, secret)) {
      return { status: 400, body: { error: "Invalid signature" } } as const;
    }
    let event: unknown;
    try { event = JSON.parse(rawBody); } catch {
      return { status: 400, body: { error: "Invalid JSON" } } as const;
    }
    const eventType = (event as { event?: string })?.event || "";
    const eventId = extractEventId(event);
    const key = buildDedupKey(eventType, eventId);
    if (key && !store.markProcessed(key)) {
      return { status: 200, body: { received: true, skipped: "duplicate" } } as const;
    }
    const route = classifyEvent(eventType);
    if (route === "ignored") {
      return { status: 200, body: { received: true, skipped: eventType } } as const;
    }
    return { status: 200, body: { received: true, route } } as const;
  }

  it("dedups the same event id processed twice", () => {
    const store = new InMemoryDedupStore();
    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_dup" } } },
    });
    const sig = sign(body);
    const first = receive(body, sig, TEST_SECRET, store);
    const second = receive(body, sig, TEST_SECRET, store);
    expect(first.status).toBe(200);
    expect("route" in first.body && first.body.route).toBe("one_time_payment");
    expect(second.status).toBe(200);
    expect("skipped" in second.body && second.body.skipped).toBe("duplicate");
  });

  it("rejects with 400 when signature is missing/wrong", () => {
    const store = new InMemoryDedupStore();
    const body = JSON.stringify({ event: "payment.captured" });
    const out = receive(body, "0".repeat(64), TEST_SECRET, store);
    expect(out.status).toBe(400);
  });

  it("returns 200 + skipped for unhandled event types", () => {
    const store = new InMemoryDedupStore();
    const body = JSON.stringify({
      event: "refund.processed",
      payload: { payment: { entity: { id: "pay_r1" } } },
    });
    const sig = sign(body);
    const out = receive(body, sig, TEST_SECRET, store);
    expect(out.status).toBe(200);
    expect("skipped" in out.body && out.body.skipped).toBe("refund.processed");
  });

  it("routes subscription.activated to subscription_lifecycle", () => {
    const store = new InMemoryDedupStore();
    const body = JSON.stringify({
      event: "subscription.activated",
      payload: { subscription: { entity: { id: "sub_1" } } },
    });
    const sig = sign(body);
    const out = receive(body, sig, TEST_SECRET, store);
    expect(out.status).toBe(200);
    expect("route" in out.body && out.body.route).toBe("subscription_lifecycle");
  });

  it("rejects malformed JSON even if the signature is valid", () => {
    const store = new InMemoryDedupStore();
    const body = "not json";
    const sig = sign(body);
    const out = receive(body, sig, TEST_SECRET, store);
    expect(out.status).toBe(400);
  });
});

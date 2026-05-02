/* Pure helpers for razorpay-webhook.ts.
   The webhook itself does heavy fetch work; these helpers carry the
   security-critical bits we want pinned by tests:
     • signature verification (timing-safe)
     • event id / dedup key derivation
     • event-type classification
   Extract them so they're exercisable without the Vercel handler. */

import { createHmac, timingSafeEqual } from "crypto";

/** HMAC-SHA256(secret, rawBody) → hex. Mirrors what Razorpay computes
 *  when signing the webhook delivery; we recompute and compare. */
export function computeRazorpaySignature(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/** Constant-time compare of the supplied X-Razorpay-Signature header
 *  against the recomputed HMAC. Returns false on length mismatch
 *  rather than throwing (timingSafeEqual would otherwise throw). */
export function verifyRazorpaySignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!secret || !signature || typeof signature !== "string") return false;
  const expected = computeRazorpaySignature(rawBody, secret);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  try {
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/** Extract the canonical event id from a Razorpay webhook payload.
 *  Razorpay puts the entity id in different places depending on event
 *  type — payment.captured nests it under payload.payment.entity.id,
 *  subscription.* nests it under payload.subscription.entity.id, etc. */
export function extractEventId(event: unknown): string {
  if (!event || typeof event !== "object") return "";
  const e = event as Record<string, unknown>;
  const entity = e.entity as { id?: string } | undefined;
  const payload = e.payload as
    | { payment?: { entity?: { id?: string } }; subscription?: { entity?: { id?: string } } }
    | undefined;
  return (
    entity?.id ||
    payload?.payment?.entity?.id ||
    payload?.subscription?.entity?.id ||
    ""
  );
}

/** Build the dedup key used to gate duplicate webhook deliveries.
 *  Format: "<event_type>:<entity_id>". Empty string when either side
 *  is missing — caller should skip dedup in that case. */
export function buildDedupKey(eventType: string, eventId: string): string {
  if (!eventType || !eventId) return "";
  return `${eventType}:${eventId}`;
}

export const HANDLED_WEBHOOK_EVENTS = [
  "payment.captured",
  "subscription.activated",
  "subscription.charged",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.completed",
  "subscription.paused",
  "subscription.resumed",
] as const;

export type HandledWebhookEvent = (typeof HANDLED_WEBHOOK_EVENTS)[number];

export function isHandledEvent(eventType: string): eventType is HandledWebhookEvent {
  return (HANDLED_WEBHOOK_EVENTS as readonly string[]).includes(eventType);
}

/** Classify an event into the routing branches the handler takes.
 *  Pure function — no side effects, no fetches. */
export type EventRoute =
  | "subscription_lifecycle"
  | "one_time_payment"
  | "ignored";

export function classifyEvent(eventType: string): EventRoute {
  if (!eventType) return "ignored";
  if (!isHandledEvent(eventType)) return "ignored";
  if (eventType.startsWith("subscription.")) return "subscription_lifecycle";
  if (eventType === "payment.captured") return "one_time_payment";
  return "ignored";
}

/** In-memory dedup store with eviction at DEDUP_MAX entries. Used as a
 *  fallback when Redis is unavailable. Returns true if the event id was
 *  newly recorded, false if it had already been processed. */
export class InMemoryDedupStore {
  private readonly seen = new Set<string>();
  constructor(private readonly maxEntries: number = 500) {}

  markProcessed(eventId: string): boolean {
    if (!eventId) return true; // Nothing to dedup against
    if (this.seen.has(eventId)) return false;
    if (this.seen.size >= this.maxEntries) this.seen.clear();
    this.seen.add(eventId);
    return true;
  }

  has(eventId: string): boolean {
    return this.seen.has(eventId);
  }

  get size(): number {
    return this.seen.size;
  }
}
